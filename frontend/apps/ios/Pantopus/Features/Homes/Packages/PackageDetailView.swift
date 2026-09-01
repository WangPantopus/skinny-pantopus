//
//  PackageDetailView.swift
//  Pantopus
//
//  T6.3d (P14) — Read-mostly Package detail. Built on the shared
//  `ContentDetailShell`. Fetches the parent packages list to find the
//  matching row by id (backend has no GET-by-id), then renders the
//  courier tile + title + meta grid + status-driven action stack.
//
//  Actions: "Mark picked up" (status → `picked_up`) and "Mark missing"
//  (status → `lost`). Both go via `PUT /api/homes/:id/packages/:pkgId`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class PackageDetailViewModel {
    enum State: Equatable {
        case loading
        case loaded(PackageDTO)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isSaving: Bool = false
    private(set) var saveError: String?

    private let homeId: String
    private let packageId: String
    private let api: APIClient
    private let onChanged: @Sendable () -> Void
    private let onClose: @Sendable () -> Void

    init(
        homeId: String,
        packageId: String,
        api: APIClient = .shared,
        onChanged: @escaping @Sendable () -> Void = {},
        onClose: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.packageId = packageId
        self.api = api
        self.onChanged = onChanged
        self.onClose = onClose
    }

    func load() async {
        state = .loading
        do {
            let response: GetHomePackagesResponse = try await api.request(
                HomesEndpoints.packages(homeId: homeId)
            )
            guard let pkg = response.packages.first(where: { $0.id == packageId }) else {
                state = .error(message: "This package is no longer available.")
                return
            }
            state = .loaded(pkg)
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this package."
            )
        }
    }

    func markPickedUp() async {
        await update(request: UpdatePackageRequest(status: "picked_up"))
    }

    func markMissing() async {
        await update(request: UpdatePackageRequest(status: "lost"))
    }

    /// Soft-remove via status flip — backend has no DELETE handler for
    /// packages today. Marks as `returned` and closes the screen.
    func remove() async {
        await update(request: UpdatePackageRequest(status: "returned"))
        if case .loaded = state {
            onClose()
        }
    }

    private func update(request: UpdatePackageRequest) async {
        guard !isSaving else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            let response: HomePackageResponse = try await api.request(
                HomesEndpoints.updatePackage(
                    homeId: homeId,
                    packageId: packageId,
                    request: request
                )
            )
            onChanged()
            state = .loaded(response.package)
        } catch {
            saveError = (error as? APIError)?.errorDescription
                ?? "Couldn't update this package."
        }
    }
}

struct PackageDetailView: View {
    @State private var viewModel: PackageDetailViewModel
    private let onBack: @Sendable () -> Void

    init(
        homeId: String,
        packageId: String,
        onBack: @escaping @Sendable () -> Void,
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        _viewModel = State(initialValue: PackageDetailViewModel(
            homeId: homeId,
            packageId: packageId,
            onChanged: onChanged
        ) {
            Task { @MainActor in onBack() }
        })
        self.onBack = onBack
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingShell(onBack: onBack)
            case let .loaded(pkg):
                LoadedShell(
                    pkg: pkg,
                    saving: viewModel.isSaving,
                    saveError: viewModel.saveError,
                    onBack: onBack,
                    onMarkPickedUp: markPickedUp,
                    onMarkMissing: markMissing,
                    onRemove: removePackage
                )
            case let .error(message):
                ErrorShell(message: message, onBack: onBack) {
                    Task { await viewModel.load() }
                }
            }
        }
        .accessibilityIdentifier("packageDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .onAppear { Analytics.track(.screenPackageDetailViewed) }
        .task { await viewModel.load() }
    }

    private func markPickedUp() {
        Task { await viewModel.markPickedUp() }
    }

    private func markMissing() {
        Task { await viewModel.markMissing() }
    }

    private func removePackage() {
        Task { await viewModel.remove() }
    }
}

// MARK: - Shells

private struct LoadingShell: View {
    let onBack: () -> Void
    var body: some View {
        ContentDetailShell(
            title: "Package",
            onBack: onBack,
            header: {
                Shimmer(height: 100, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 60, cornerRadius: Radii.md)
                    Shimmer(height: 60, cornerRadius: Radii.md)
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

private struct ErrorShell: View {
    let message: String
    let onBack: () -> Void
    let onRetry: () -> Void
    var body: some View {
        ContentDetailShell(
            title: "Package",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this package",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") { onRetry() }
                )
                .frame(height: 400)
            }
        )
    }
}

private struct LoadedShell: View {
    let pkg: PackageDTO
    let saving: Bool
    let saveError: String?
    let onBack: () -> Void
    let onMarkPickedUp: () -> Void
    let onMarkMissing: () -> Void
    let onRemove: () -> Void

    var body: some View {
        let projection = PackagesListViewModel.project(
            package: pkg,
            currentUserId: nil
        ) { _ in nil }
        let status = projection.status
        return ContentDetailShell(
            title: "Package",
            onBack: onBack,
            header: {
                PackageHeader(projection: projection)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    DetailGrid(pkg: pkg, projection: projection)
                    if let saveError {
                        Text(saveError)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                    }
                    if status != .returned {
                        Button(role: .destructive, action: onRemove) {
                            HStack(spacing: Spacing.s2) {
                                Icon(.trash2, size: 16, color: Theme.Color.error)
                                Text("Remove package")
                                    .pantopusTextStyle(.small)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Theme.Color.error)
                            }
                        }
                        .accessibilityIdentifier("packageDetail_remove")
                        .disabled(saving)
                    }
                }
                .padding(.horizontal, Spacing.s4)
            },
            cta: {
                PackageCtaStack(
                    status: status,
                    saving: saving,
                    onMarkPickedUp: onMarkPickedUp,
                    onMarkMissing: onMarkMissing
                )
            }
        )
    }
}

private struct PackageCtaStack: View {
    let status: PackageChipStatus
    let saving: Bool
    let onMarkPickedUp: () -> Void
    let onMarkMissing: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            PrimaryButton(
                title: primaryTitle,
                isLoading: saving,
                isEnabled: !status.isTerminal && !saving
            ) {
                await MainActor.run { onMarkPickedUp() }
            }
            .accessibilityIdentifier("packageDetail_markPickedUp")

            if !status.isTerminal {
                Button(action: onMarkMissing) {
                    Text("Mark missing")
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .accessibilityIdentifier("packageDetail_markMissing")
                .disabled(saving)
            }
        }
    }

    private var primaryTitle: String {
        switch status {
        case .pickedUp: "Picked up"
        case .delivered: "Mark picked up"
        case .lost: "Marked missing"
        case .returned: "Returned"
        case .expected, .outForDelivery: "Mark picked up"
        }
    }
}

private struct PackageHeader: View {
    let projection: PackageRowProjection

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(projection.courier.background)
                        .frame(width: 48, height: 48)
                    Icon(
                        projection.courier.icon,
                        size: 22,
                        color: projection.courier.foreground
                    )
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(projection.title)
                        .pantopusTextStyle(.h3)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                    if let subtitle = projection.subtitle {
                        Text(subtitle)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            StatusChip(
                projection.chipText,
                variant: projection.chipVariant,
                icon: projection.chipIcon
            )
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }
}

private struct DetailGrid: View {
    let pkg: PackageDTO
    let projection: PackageRowProjection

    var body: some View {
        VStack(spacing: Spacing.s0) {
            row(label: "Courier", value: projection.courier.label)
            if let tracking = pkg.trackingNumber, !tracking.isEmpty {
                divider
                row(label: "Tracking", value: tracking)
            }
            if let vendor = pkg.vendorName, !vendor.isEmpty {
                divider
                row(label: "Vendor", value: vendor)
            }
            if let drop = pkg.deliveryInstructions, !drop.isEmpty {
                divider
                row(label: "Drop instructions", value: drop)
            }
            if let when = PackagesListViewModel.parseDate(pkg.expectedAt ?? ""),
               !(pkg.expectedAt ?? "").isEmpty {
                divider
                row(label: "Expected", value: formatDay(when))
            }
            if let when = PackagesListViewModel.parseDate(pkg.deliveredAt ?? ""),
               !(pkg.deliveredAt ?? "").isEmpty {
                divider
                row(label: "Delivered", value: formatDay(when))
            }
            divider
            row(label: "Status", value: projection.chipText)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private func row(label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s4)
            Text(value)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    private func formatDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: date)
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}

#Preview {
    PackageDetailView(homeId: "preview", packageId: "pkg-1") {}
}
