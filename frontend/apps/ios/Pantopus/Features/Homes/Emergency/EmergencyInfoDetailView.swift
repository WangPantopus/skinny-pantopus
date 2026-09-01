//
//  EmergencyInfoDetailView.swift
//  Pantopus
//
//  P2.8 — Read-only Emergency Info detail. Built on the shared
//  `ContentDetailShell`. Renders:
//    Header  — category tile + title + severity chip + verified-by line.
//    Body    — details paragraph + last-updated meta + Edit + Delete.
//    CTA     — none (Edit lives in the body so it pairs with Delete).
//
//  Critical severity chips render with the error-bg fill and the
//  alert-triangle glyph per the acceptance check. Delete confirms with
//  a destructive confirmation dialog before removing.
//

import SwiftUI

public struct EmergencyInfoDetailView: View {
    @State private var viewModel: EmergencyInfoDetailViewModel
    @State private var showsEditSheet = false
    private let homeId: String
    private let onBack: @Sendable () -> Void

    public init(
        homeId: String,
        emergencyId: String,
        onBack: @escaping @Sendable () -> Void,
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.onBack = onBack
        _viewModel = State(initialValue: EmergencyInfoDetailViewModel(
            homeId: homeId,
            emergencyId: emergencyId,
            onChanged: onChanged
        ) {
            Task { @MainActor in onBack() }
        })
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingShell
            case let .loaded(draft):
                loadedShell(draft: draft)
            case .missing:
                missingShell
            case let .error(message):
                errorShell(message: message)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("emergencyInfoDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .confirmationDialog(
            "Delete this emergency item?",
            isPresented: $viewModel.showsDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                viewModel.confirmDelete()
            }
            .accessibilityIdentifier("emergencyDetail_deleteConfirm")
            Button("Keep", role: .cancel) {}
        } message: {
            Text("This removes it from the household emergency plan. Anyone with access will no longer see it.")
        }
        .sheet(isPresented: $showsEditSheet) {
            if case let .loaded(draft) = viewModel.state {
                NavigationStack {
                    AddEmergencyInfoFormView(
                        viewModel: AddEmergencyInfoFormViewModel(
                            homeId: homeId,
                            mode: .edit(draft),
                            // swiftlint:disable:next trailing_closure
                            onUpdated: { [viewModel] updated in
                                Task { @MainActor in viewModel.apply(updated: updated) }
                            }
                        )
                    )
                }
            }
        }
    }

    // MARK: - Shells

    private var loadingShell: some View {
        ContentDetailShell(
            title: "Emergency item",
            onBack: { onBack() },
            header: {
                Shimmer(height: 100, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 80, cornerRadius: Radii.md)
                    Shimmer(height: 48, cornerRadius: Radii.md)
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }

    private var missingShell: some View {
        ContentDetailShell(
            title: "Emergency item",
            onBack: { onBack() },
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Item no longer available",
                    subcopy: "This emergency entry may have been removed by another household member.",
                    cta: EmptyState.CTA(title: "Back") { onBack() }
                )
                .frame(height: 400)
            }
        )
    }

    private func errorShell(message: String) -> some View {
        ContentDetailShell(
            title: "Emergency item",
            onBack: { onBack() },
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this item",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") {
                        await viewModel.load()
                    }
                )
                .frame(height: 400)
            }
        )
    }

    private func loadedShell(draft: EmergencyFormDraft) -> some View {
        ContentDetailShell(
            title: "Emergency item",
            onBack: { onBack() },
            header: {
                DetailHeader(draft: draft)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if !draft.details.isEmpty {
                        DetailsCard(text: draft.details)
                    }
                    MetaCard(draft: draft)
                    ActionsRow(
                        onEdit: { showsEditSheet = true },
                        onDelete: { viewModel.showsDeleteConfirm = true }
                    )
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

// MARK: - Detail header

private struct DetailHeader: View {
    let draft: EmergencyFormDraft

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(draft.category.palette.background)
                        .frame(width: 48, height: 48)
                    Icon(
                        draft.category.icon,
                        size: 24,
                        color: draft.category.palette.foreground
                    )
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(draft.title)
                        .pantopusTextStyle(.h3)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(draft.category.label)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
            }
            if let severity = draft.severity {
                SeverityChip(severity: severity)
            }
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

/// Severity chip — pair-of-tokens fill with an inline icon. Critical
/// gets the error-bg fill + alert-triangle glyph per the acceptance
/// check.
struct SeverityChip: View {
    let severity: EmergencySeverity

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(severity.icon, size: 12, color: severity.foreground)
            Text(severity.label)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(severity.foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(severity.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .accessibilityIdentifier("severityChip_\(severity.rawValue)")
        .accessibilityLabel("Severity \(severity.label)")
    }
}

// MARK: - Cards

private struct DetailsCard: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Details")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Text(text)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("emergencyDetail_body")
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

private struct MetaCard: View {
    let draft: EmergencyFormDraft

    var body: some View {
        VStack(spacing: Spacing.s0) {
            if let verified = draft.verifiedByUserId, !verified.isEmpty {
                row(label: "Verified by", value: verified, icon: .userRound)
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
            row(
                label: "Last updated",
                value: Self.formatDate(draft.lastUpdated),
                icon: .clock
            )
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private func row(label: String, value: String, icon: PantopusIcon) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 14, color: Theme.Color.appTextSecondary)
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(value)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    private static func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

private struct ActionsRow: View {
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Button(action: onEdit) {
                HStack(spacing: Spacing.s2) {
                    Icon(.pencil, size: 16, color: Theme.Color.appTextInverse)
                    Text("Edit")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("emergencyDetail_edit")

            Button(role: .destructive, action: onDelete) {
                HStack(spacing: Spacing.s2) {
                    Icon(.trash2, size: 16, color: Theme.Color.error)
                    Text("Delete")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.error)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Theme.Color.errorBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("emergencyDetail_delete")
        }
    }
}

#Preview {
    EmergencyInfoDetailView(
        homeId: "preview",
        emergencyId: "preview-1"
    ) {}
}
