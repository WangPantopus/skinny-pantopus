//
//  LogMaintenanceFormView.swift
//  Pantopus
//
//  P2.9 — Single-page form for logging (or editing) a maintenance
//  entry. Wraps the shared `FormShell` archetype. Photos use the same
//  `PhotosPicker` pattern as the listings + claim-evidence flows;
//  receipts use a `fileImporter` so PDFs are accepted alongside
//  images.
//

// swiftlint:disable file_length

import Foundation
import Observation
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct LogMaintenanceFormView: View {
    @State private var viewModel: LogMaintenanceFormViewModel
    @State private var photoPickerSelection: [PhotosPickerItem] = []
    @State private var photoPickerShown: Bool = false
    @State private var receiptPickerShown: Bool = false
    private let onClose: @Sendable () -> Void
    private let onSubmitted: @Sendable (String) -> Void

    init(
        viewModel: LogMaintenanceFormViewModel,
        onClose: @escaping @Sendable () -> Void,
        onSubmitted: @escaping @Sendable (String) -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
        self.onSubmitted = onSubmitted
    }

    var body: some View {
        FormShell(
            title: viewModel.screenTitle,
            rightActionLabel: viewModel.submitLabel,
            isValid: viewModel.canSubmit,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSubmitting,
            onClose: onClose,
            onCommit: commit
        ) {
            CategoryGroup(viewModel: viewModel)
            DetailsGroup(viewModel: viewModel)
            PerformedByGroup(viewModel: viewModel)
            CostAndNextDueGroup(viewModel: viewModel)
            NotesGroup(viewModel: viewModel)
            PhotosGroup(
                viewModel: viewModel
            ) { photoPickerShown = true }
            ReceiptGroup(
                viewModel: viewModel
            ) { receiptPickerShown = true }
            if let err = viewModel.submitError {
                Text(err)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.error)
                    .padding(.horizontal, Spacing.s4)
                    .accessibilityIdentifier("logMaintenance_error")
            }
        }
        .photosPicker(
            isPresented: $photoPickerShown,
            selection: $photoPickerSelection,
            maxSelectionCount: max(1, LogMaintenanceFormViewModel.maxPhotos - viewModel.photos.count),
            matching: .images
        )
        .onChange(of: photoPickerSelection) { _, items in
            guard !items.isEmpty else { return }
            handlePhotoSelection(items)
        }
        .fileImporter(
            isPresented: $receiptPickerShown,
            allowedContentTypes: [.pdf, .image],
            allowsMultipleSelection: false
        ) { result in
            handleReceiptResult(result)
        }
        .onChange(of: viewModel.pendingEvent) { _, event in
            guard let event else { return }
            switch event {
            case .dismiss:
                viewModel.consumeEvent()
                onClose()
            case let .created(taskId), let .updated(taskId):
                viewModel.consumeEvent()
                onSubmitted(taskId)
            }
        }
        .accessibilityIdentifier("logMaintenanceForm")
        .onAppear { Analytics.track(.screenLogMaintenanceViewed) }
        .task { await viewModel.loadIfNeeded() }
    }

    private func commit() {
        Task { await viewModel.submit() }
    }

    private func handlePhotoSelection(_ items: [PhotosPickerItem]) {
        photoPickerSelection = []
        Task {
            for item in items where viewModel.photos.count < LogMaintenanceFormViewModel.maxPhotos {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    let filename = "maintenance-photo-\(UUID().uuidString.prefix(6)).jpg"
                    viewModel.addPhoto(
                        MaintenanceDraftFile(filename: filename, mimeType: "image/jpeg", data: data)
                    )
                }
            }
        }
    }

    private func handleReceiptResult(_ result: Result<[URL], any Error>) {
        switch result {
        case let .success(urls):
            guard let url = urls.first else { return }
            let didStart = url.startAccessingSecurityScopedResource()
            defer { if didStart { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else { return }
            let mime = url.pathExtension.lowercased() == "pdf" ? "application/pdf" : "image/jpeg"
            viewModel.pickReceipt(
                MaintenanceDraftFile(
                    filename: url.lastPathComponent,
                    mimeType: mime,
                    data: data
                )
            )
        case .failure:
            // User cancelled — no-op.
            break
        }
    }
}

// MARK: - Field groups

private struct CategoryGroup: View {
    @Bindable var viewModel: LogMaintenanceFormViewModel

    var body: some View {
        FormFieldGroup("Category") {
            MaintenanceCategoryGrid(selected: viewModel.category) { newValue in
                viewModel.category = newValue
                viewModel.recomputeDirty()
            }
            .accessibilityIdentifier("logMaintenance_category")
        }
    }
}

private struct MaintenanceCategoryGrid: View {
    let selected: MaintenanceCategory
    let onSelect: (MaintenanceCategory) -> Void

    /// Mirrors the design spec ordering: HVAC / plumbing / electrical /
    /// appliance / yard / roof / other. The other 6 palette entries
    /// (gutter, pest, cleaning, painting, safety, chimney) infer from
    /// the title on the list view — they don't need a dedicated picker
    /// tile in the spec.
    private static let displayed: [MaintenanceCategory] = [
        .hvac, .plumbing, .electrical, .appliance, .landscape, .roof, .generic
    ]

    private let columns = [
        GridItem(.adaptive(minimum: 84), spacing: Spacing.s2)
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: Spacing.s2) {
            ForEach(Self.displayed, id: \.self) { category in
                let isSelected = category == selected
                Button {
                    onSelect(category)
                } label: {
                    VStack(spacing: Spacing.s1) {
                        ZStack {
                            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                .fill(category.background)
                                .frame(width: 36, height: 36)
                            Icon(category.icon, size: 18, color: category.foreground)
                        }
                        Text(category == .landscape ? "Yard" : category.label)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .frame(maxWidth: .infinity, minHeight: 76)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.appBg)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(
                                isSelected ? Theme.Color.primary600 : Theme.Color.appBorderSubtle,
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(category == .landscape ? "Yard" : category.label)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
                .accessibilityIdentifier("logMaintenance_category_\(category.rawValue)")
            }
        }
    }
}

private struct DetailsGroup: View {
    @Bindable var viewModel: LogMaintenanceFormViewModel

    var body: some View {
        FormFieldGroup("Details") {
            PantopusTextField(
                "Title",
                text: Binding(
                    get: { viewModel.title },
                    set: { viewModel.title = $0
                        viewModel.recomputeDirty()
                    }
                ),
                placeholder: "Fall HVAC tune-up",
                identifier: "logMaintenance_title"
            )

            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Date completed")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                DatePicker(
                    "Date completed",
                    selection: Binding(
                        get: { viewModel.dateCompleted },
                        set: { viewModel.dateCompleted = $0
                            viewModel.recomputeDirty()
                        }
                    ),
                    in: ...Date(),
                    displayedComponents: .date
                )
                .labelsHidden()
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("logMaintenance_dateCompleted")
            }
        }
    }
}

private struct PerformedByGroup: View {
    @Bindable var viewModel: LogMaintenanceFormViewModel

    var body: some View {
        FormFieldGroup("Performed by") {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Picker(
                    "Performed by",
                    selection: Binding(
                        get: { viewModel.performedBy },
                        set: { viewModel.performedBy = $0
                            viewModel.recomputeDirty()
                        }
                    )
                ) {
                    Text("Self").tag(MaintenancePerformedBy.`self`)
                    Text("Member").tag(MaintenancePerformedBy.member)
                    Text("Contractor").tag(MaintenancePerformedBy.contractor)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("logMaintenance_performedBy")

                if viewModel.performedBy != .self {
                    PantopusTextField(
                        viewModel.performedBy == .member ? "Member name" : "Contractor name",
                        text: Binding(
                            get: { viewModel.performerName },
                            set: { viewModel.performerName = $0
                                viewModel.recomputeDirty()
                            }
                        ),
                        placeholder: viewModel.performedBy == .member
                            ? "Alex"
                            : "Riverside HVAC",
                        identifier: "logMaintenance_performerName"
                    )
                }
                if viewModel.performedBy == .contractor {
                    PantopusTextField(
                        "Contact (optional)",
                        text: Binding(
                            get: { viewModel.performerContact },
                            set: { viewModel.performerContact = $0
                                viewModel.recomputeDirty()
                            }
                        ),
                        placeholder: "(555) 555-0142 · hello@riverside.com",
                        identifier: "logMaintenance_performerContact"
                    )
                }
            }
        }
    }
}

private struct CostAndNextDueGroup: View {
    @Bindable var viewModel: LogMaintenanceFormViewModel

    var body: some View {
        FormFieldGroup("Cost & schedule") {
            PantopusTextField(
                "Cost",
                text: Binding(
                    get: { viewModel.costText },
                    set: { viewModel.costText = $0
                        viewModel.recomputeDirty()
                    }
                ),
                placeholder: "$0",
                keyboardType: .decimalPad,
                identifier: "logMaintenance_cost"
            )

            VStack(alignment: .leading, spacing: Spacing.s2) {
                Toggle(isOn: Binding(
                    get: { viewModel.nextDueEnabled },
                    set: { viewModel.nextDueEnabled = $0
                        viewModel.recomputeDirty()
                    }
                )) {
                    Text("Set next-due reminder")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                }
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("logMaintenance_nextDueToggle")

                if viewModel.nextDueEnabled {
                    DatePicker(
                        "Next-due",
                        selection: Binding(
                            get: { viewModel.nextDueDate },
                            set: { viewModel.nextDueDate = $0
                                viewModel.recomputeDirty()
                            }
                        ),
                        in: Date()...,
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("logMaintenance_nextDueDate")

                    Picker(
                        "Recurrence",
                        selection: Binding(
                            get: { viewModel.recurrence },
                            set: { viewModel.recurrence = $0
                                viewModel.recomputeDirty()
                            }
                        )
                    ) {
                        ForEach(MaintenanceRecurrence.allCases, id: \.self) { recurrence in
                            Text(recurrence.label).tag(recurrence)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("logMaintenance_recurrence")

                    Text("We'll add this to the home calendar as a reminder.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }
}

private struct NotesGroup: View {
    @Bindable var viewModel: LogMaintenanceFormViewModel

    var body: some View {
        FormFieldGroup("Notes") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Notes (optional)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField(
                    "Replaced filter, topped off coolant…",
                    text: Binding(
                        get: { viewModel.notes },
                        set: { viewModel.notes = $0
                            viewModel.recomputeDirty()
                        }
                    ),
                    axis: .vertical
                )
                .lineLimit(3...6)
                .font(Theme.Font.body)
                .padding(Spacing.s3)
                .frame(minHeight: 96, alignment: .topLeading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("logMaintenance_notes")
            }
        }
    }
}

private struct PhotosGroup: View {
    @Bindable var viewModel: LogMaintenanceFormViewModel
    let onPick: () -> Void

    var body: some View {
        FormFieldGroup("Photos") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Up to 4 photos.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: Spacing.s2),
                    GridItem(.flexible(), spacing: Spacing.s2)
                ], spacing: Spacing.s2) {
                    ForEach(viewModel.photoSlots) { slot in
                        PhotoTile(
                            slot: slot,
                            onPick: onPick
                        ) { id in viewModel.removePhoto(id: id) }
                    }
                }
                .accessibilityIdentifier("logMaintenance_photos")
            }
        }
    }
}

private struct PhotoTile: View {
    let slot: LogMaintenanceFormViewModel.PhotoSlot
    let onPick: () -> Void
    let onRemove: (UUID) -> Void

    var body: some View {
        if let file = slot.file {
            ZStack(alignment: .topTrailing) {
                if let image = UIImage(data: file.data) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(maxWidth: .infinity)
                        .frame(height: 96)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                } else {
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(Theme.Color.appSurfaceMuted)
                        .frame(height: 96)
                        .overlay(Icon(.image, size: 24, color: Theme.Color.appTextSecondary))
                }
                Button(
                    action: { onRemove(file.id) },
                    label: {
                        Icon(.x, size: 14, color: Theme.Color.appTextInverse)
                            .padding(Spacing.s1)
                            .background(Circle().fill(Theme.Color.appText.opacity(0.65)))
                    }
                )
                .padding(Spacing.s1)
                .accessibilityLabel("Remove photo")
                .accessibilityIdentifier("logMaintenance_photo_remove_\(slot.id)")
            }
            .accessibilityIdentifier("logMaintenance_photo_\(slot.id)")
        } else {
            Button(action: onPick) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(Theme.Color.appBorderSubtle, style: StrokeStyle(lineWidth: 1, dash: [4]))
                    .frame(height: 96)
                    .overlay(
                        VStack(spacing: Spacing.s1) {
                            Icon(.camera, size: 20, color: Theme.Color.appTextSecondary)
                            Text("Add photo")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add photo")
            .accessibilityIdentifier("logMaintenance_photo_add_\(slot.id)")
        }
    }
}

private struct ReceiptGroup: View {
    @Bindable var viewModel: LogMaintenanceFormViewModel
    let onPick: () -> Void

    var body: some View {
        FormFieldGroup("Receipt") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                if let receipt = viewModel.receipt {
                    HStack(spacing: Spacing.s3) {
                        ZStack {
                            RoundedRectangle(cornerRadius: Radii.sm)
                                .fill(Theme.Color.appSurfaceMuted)
                                .frame(width: 40, height: 40)
                            Icon(
                                receipt.mimeType == "application/pdf" ? .fileText : .image,
                                size: 18,
                                color: Theme.Color.appTextSecondary
                            )
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(receipt.filename)
                                .pantopusTextStyle(.body)
                                .foregroundStyle(Theme.Color.appText)
                                .lineLimit(1)
                            Text(receipt.mimeType == "application/pdf" ? "PDF" : "Image")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer()
                        Button(
                            action: { viewModel.pickReceipt(nil) },
                            label: {
                                Icon(.x, size: 18, color: Theme.Color.appTextSecondary)
                                    .frame(width: 32, height: 32)
                            }
                        )
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove receipt")
                        .accessibilityIdentifier("logMaintenance_receipt_remove")
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
                    )
                    .accessibilityIdentifier("logMaintenance_receipt")
                } else {
                    Button(action: onPick) {
                        HStack(spacing: Spacing.s2) {
                            Icon(.paperclip, size: 18, color: Theme.Color.primary600)
                            Text("Attach receipt (PDF or image)")
                                .pantopusTextStyle(.body)
                                .foregroundStyle(Theme.Color.primary600)
                            Spacer()
                        }
                        .padding(Spacing.s3)
                        .background(Theme.Color.primary50)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Attach receipt")
                    .accessibilityIdentifier("logMaintenance_receipt_pick")
                }
            }
        }
    }
}

#Preview {
    LogMaintenanceFormView(
        viewModel: LogMaintenanceFormViewModel(homeId: "preview"),
        onClose: {},
        onSubmitted: { _ in }
    )
}
