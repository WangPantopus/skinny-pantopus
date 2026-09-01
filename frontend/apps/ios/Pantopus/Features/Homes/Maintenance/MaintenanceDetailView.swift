//
//  MaintenanceDetailView.swift
//  Pantopus
//
//  P2.9 — Read-only detail surface for a single maintenance entry.
//  Built on the shared `ContentDetailShell`. Reads the parent
//  maintenance list to find the row by id (the backend has no
//  GET-by-id endpoint today; the list is small enough that
//  re-fetching is cheap, mirroring `BillDetailView`).
//
//  The shell renders: category-tinted header + key/value detail grid +
//  vendor + cost + completion date + notes block + 2×2 photo grid +
//  receipt thumbnail. Bottom actions are Edit + Delete; both wired via
//  the existing `PUT /api/homes/:id/maintenance/:taskId` and
//  `DELETE /api/homes/:id/maintenance/:taskId` endpoints.
//

// swiftlint:disable file_length

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class MaintenanceDetailViewModel {
    enum State: Equatable {
        case loading
        case loaded(MaintenanceTaskDTO)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isMutating: Bool = false
    private(set) var actionError: String?

    private let homeId: String
    private let taskId: String
    private let api: APIClient
    private let draftStore: MaintenanceDraftStore
    private let onChanged: @Sendable () -> Void
    private let onDeleted: @Sendable () -> Void

    init(
        homeId: String,
        taskId: String,
        api: APIClient = .shared,
        draftStore: MaintenanceDraftStore = .shared,
        onChanged: @escaping @Sendable () -> Void = {},
        onDeleted: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.taskId = taskId
        self.api = api
        self.draftStore = draftStore
        self.onChanged = onChanged
        self.onDeleted = onDeleted
    }

    var draft: MaintenanceDraft? {
        draftStore.draft(for: taskId)
    }

    func load() async {
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func delete() async {
        guard !isMutating else { return }
        isMutating = true
        actionError = nil
        defer { isMutating = false }
        do {
            _ = try await api.request(
                HomesEndpoints.deleteMaintenance(homeId: homeId, taskId: taskId)
            )
            draftStore.remove(id: taskId)
            Analytics.track(.ctaMaintenanceDelete(result: .success))
            onChanged()
            onDeleted()
        } catch {
            Analytics.track(.ctaMaintenanceDelete(result: .error))
            actionError = (error as? APIError)?.errorDescription
                ?? "Couldn't delete this maintenance entry."
        }
    }

    private func fetch() async {
        do {
            let response: GetHomeMaintenanceResponse = try await api.request(
                HomesEndpoints.maintenance(homeId: homeId)
            )
            guard let task = response.tasks.first(where: { $0.id == taskId }) else {
                state = .error(message: "This maintenance entry is no longer available.")
                return
            }
            state = .loaded(task)
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this maintenance entry."
            )
        }
    }
}

public struct MaintenanceDetailView: View {
    @State private var viewModel: MaintenanceDetailViewModel
    @State private var showDeleteConfirm: Bool = false
    private let onBack: @Sendable () -> Void
    private let onEdit: @Sendable () -> Void

    public init(
        homeId: String,
        taskId: String,
        onBack: @escaping @Sendable () -> Void,
        onEdit: @escaping @Sendable () -> Void,
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        let backHandler = onBack
        _viewModel = State(initialValue: MaintenanceDetailViewModel(
            homeId: homeId,
            taskId: taskId,
            onChanged: onChanged
        ) { Task { @MainActor in backHandler() } })
        self.onBack = onBack
        self.onEdit = onEdit
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingBody(onBack: onBack)
            case let .loaded(task):
                LoadedBody(
                    task: task,
                    draft: viewModel.draft,
                    isMutating: viewModel.isMutating,
                    actionError: viewModel.actionError,
                    onBack: onBack,
                    onEdit: onEdit
                ) { showDeleteConfirm = true }
            case let .error(message):
                let vm = viewModel
                ErrorBody(
                    message: message,
                    onBack: onBack
                ) { Task { await vm.refresh() } }
            }
        }
        .background(Theme.Color.appBg.ignoresSafeArea())
        .accessibilityIdentifier("maintenanceDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .onAppear { Analytics.track(.screenMaintenanceDetailViewed) }
        .task { await viewModel.load() }
        .confirmationDialog(
            "Delete this maintenance entry?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { await viewModel.delete() }
            }
            .accessibilityIdentifier("maintenanceDetail_deleteConfirm")
            Button("Keep it", role: .cancel) {}
        } message: {
            Text("It won't appear in the maintenance log anymore.")
        }
    }
}

// MARK: - Shells

private struct LoadingBody: View {
    let onBack: () -> Void

    var body: some View {
        ContentDetailShell(
            title: "Maintenance",
            onBack: onBack,
            header: {
                Shimmer(height: 100, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 60, cornerRadius: Radii.md)
                    Shimmer(height: 60, cornerRadius: Radii.md)
                    Shimmer(height: 120, cornerRadius: Radii.md)
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

private struct ErrorBody: View {
    let message: String
    let onBack: () -> Void
    let onRetry: () -> Void

    var body: some View {
        ContentDetailShell(
            title: "Maintenance",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this entry",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") {
                        onRetry()
                    }
                )
                .frame(height: 400)
            }
        )
    }
}

private struct LoadedBody: View {
    let task: MaintenanceTaskDTO
    let draft: MaintenanceDraft?
    let isMutating: Bool
    let actionError: String?
    let onBack: @Sendable () -> Void
    let onEdit: @Sendable () -> Void
    let onDelete: () -> Void

    var body: some View {
        let projection = MaintenanceListViewModel.project(task: task, now: Date())
        return ContentDetailShell(
            title: "Maintenance",
            onBack: onBack,
            header: {
                MaintenanceHeader(task: task, projection: projection)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    DetailGrid(task: task, draft: draft)
                    if let notes = draft?.notes, !notes.isEmpty {
                        NotesBlock(notes: notes)
                    }
                    if let photos = draft?.photos, !photos.isEmpty {
                        PhotoGrid(photos: photos)
                    }
                    if let receipt = draft?.receipt {
                        ReceiptBlock(file: receipt)
                    }
                    if let actionError {
                        Text(actionError)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("maintenanceDetail_actionError")
                    }
                    DetailActions(
                        isMutating: isMutating,
                        onEdit: onEdit,
                        onDelete: onDelete
                    )
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

// MARK: - Sub-views

private struct MaintenanceHeader: View {
    let task: MaintenanceTaskDTO
    let projection: MaintenanceRowProjection

    var body: some View {
        let category = projection.category
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(category.background)
                        .frame(width: 48, height: 48)
                    Icon(category.icon, size: 24, color: category.foreground)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(projection.title)
                        .pantopusTextStyle(.h3)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(category == .landscape ? "Yard" : category.label)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Text(projection.amount)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
            }
            StatusChip(projection.chipText, variant: projection.chipVariant, icon: projection.chipIcon)
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
    let task: MaintenanceTaskDTO
    let draft: MaintenanceDraft?

    var body: some View {
        VStack(spacing: Spacing.s0) {
            row(label: "Status", value: task.status.capitalized.replacingOccurrences(of: "_", with: " "))
            divider
            row(label: "Performed by", value: performedByValue)
            if let contact = draft?.performerContact, !contact.isEmpty {
                divider
                row(label: "Contact", value: contact)
            }
            if let due = MaintenanceListViewModel.formatDateShort(iso: task.dueDate) {
                divider
                row(label: "Next due", value: due)
            }
            divider
            row(label: "Recurrence", value: recurrenceLabel)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private var performedByValue: String {
        if let draft {
            switch draft.performedBy {
            case .self: return "Self"
            case .member:
                let trimmed = draft.performerName.trimmingCharacters(in: .whitespaces)
                return trimmed.isEmpty ? "Household member" : "Member · \(trimmed)"
            case .contractor:
                let trimmed = draft.performerName.trimmingCharacters(in: .whitespaces)
                return trimmed.isEmpty ? "Contractor" : trimmed
            }
        }
        let trimmedVendor = task.vendor?.trimmingCharacters(in: .whitespaces) ?? ""
        return trimmedVendor.isEmpty ? "Self" : trimmedVendor
    }

    private var recurrenceLabel: String {
        switch task.recurrence {
        case "one_time": "One-time"
        case "monthly": "Monthly"
        case "quarterly": "Quarterly"
        case "yearly": "Yearly"
        case "weekly": "Weekly"
        default: task.recurrence.capitalized
        }
    }

    private func row(label: String, value: String) -> some View {
        HStack {
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

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}

private struct NotesBlock: View {
    let notes: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("NOTES")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Text(notes)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.s4)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
                )
                .accessibilityIdentifier("maintenanceDetail_notes")
        }
    }
}

private struct PhotoGrid: View {
    let photos: [MaintenanceDraftFile]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("PHOTOS")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: Spacing.s2),
                GridItem(.flexible(), spacing: Spacing.s2)
            ], spacing: Spacing.s2) {
                ForEach(photos) { photo in
                    PhotoCell(file: photo)
                }
            }
            .accessibilityIdentifier("maintenanceDetail_photos")
        }
    }
}

private struct PhotoCell: View {
    let file: MaintenanceDraftFile

    var body: some View {
        ZStack {
            if let image = UIImage(data: file.data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: 120)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            } else {
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Theme.Color.appSurfaceMuted)
                    .frame(height: 120)
                    .overlay(Icon(.image, size: 24, color: Theme.Color.appTextSecondary))
            }
        }
        .accessibilityIdentifier("maintenanceDetail_photo_\(file.id.uuidString)")
        .accessibilityLabel("Photo")
    }
}

private struct ReceiptBlock: View {
    let file: MaintenanceDraftFile

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("RECEIPT")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(Theme.Color.appSurfaceMuted)
                        .frame(width: 40, height: 40)
                    Icon(
                        file.mimeType == "application/pdf" ? .fileText : .image,
                        size: 18,
                        color: Theme.Color.appTextSecondary
                    )
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(file.filename)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(file.mimeType == "application/pdf" ? "PDF" : "Image")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
            .accessibilityIdentifier("maintenanceDetail_receipt")
        }
    }
}

private struct DetailActions: View {
    let isMutating: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Button(action: onEdit) {
                HStack(spacing: Spacing.s2) {
                    Icon(.pencil, size: 16, color: Theme.Color.primary600)
                    Text("Edit")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary600)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            }
            .buttonStyle(.plain)
            .disabled(isMutating)
            .accessibilityIdentifier("maintenanceDetail_edit")

            Button(role: .destructive, action: onDelete) {
                HStack(spacing: Spacing.s2) {
                    Icon(.trash2, size: 16, color: Theme.Color.error)
                    Text("Delete")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.error)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.errorBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            }
            .buttonStyle(.plain)
            .disabled(isMutating)
            .accessibilityIdentifier("maintenanceDetail_delete")
        }
    }
}

#Preview {
    MaintenanceDetailView(
        homeId: "preview",
        taskId: "preview-task",
        onBack: {},
        onEdit: {}
    )
}
