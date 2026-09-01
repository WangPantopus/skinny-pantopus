//
//  PostGigV1View.swift
//  Pantopus
//
//  A13.8 — legacy V1 single-screen gig composer. Phase 4: real photo
//  uploads (PhotosPicker → `POST /api/files/upload` per tile) and an
//  edit mode (`editGigId` → prefill + PATCH, title "Edit gig", CTA
//  "Save").
//

import PhotosUI
import SwiftUI

public struct PostGigV1View: View {
    @State private var viewModel: PostGigV1ViewModel
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showsPhotosPicker = false
    private let onClose: @MainActor () -> Void
    private let onPosted: @MainActor (String) -> Void

    public init(
        viewModel: PostGigV1ViewModel = PostGigV1ViewModel(),
        onClose: @escaping @MainActor () -> Void = {},
        onPosted: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
        self.onPosted = onPosted
    }

    public var body: some View {
        FormShell(
            title: viewModel.screenTitle,
            leading: .back,
            rightActionLabel: viewModel.commitLabel,
            isValid: viewModel.canAttemptSubmit,
            isDirty: viewModel.isPostEnabled,
            isSaving: viewModel.state.isSubmitting,
            onClose: onClose,
            onCommit: commit
        ) {
            content
        }
        .task { await viewModel.load() }
        .toolbar(.hidden, for: .tabBar)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("postGigV1")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state.loadState {
        case .loading:
            PostGigV1LoadingView()
        case .empty:
            PostGigV1EmptyView { viewModel.startFromEmpty() }
        case let .error(message):
            PostGigV1FatalErrorView(message: message) { viewModel.retry() }
        case .ready:
            formContent
        }
    }

    @ViewBuilder private var formContent: some View {
        if !viewModel.state.validationErrors.isEmpty {
            PostGigV1ErrorBanner(errors: viewModel.state.validationErrors)
                .padding(.horizontal, Spacing.s4)
        }

        FormFieldGroup("Category") {
            PostGigV1CategoryField(
                selected: viewModel.state.form.category,
                error: viewModel.error(for: .category),
                onSelect: viewModel.updateCategory
            )
        }

        FormFieldGroup("Details") {
            PantopusTextField(
                "Title",
                text: Binding(
                    get: { viewModel.state.form.title },
                    set: { viewModel.updateTitle($0) }
                ),
                placeholder: "Help moving a sofa up 3 flights",
                state: fieldState(.title),
                isRequired: true,
                identifier: "postGigV1_title"
            )

            PostGigV1DescriptionField(
                text: Binding(
                    get: { viewModel.state.form.description },
                    set: { viewModel.updateDescription($0) }
                ),
                error: viewModel.error(for: .description)
            )
        }

        FormFieldGroup("Pay") {
            PostGigV1PriceField(
                value: Binding(
                    get: { viewModel.state.form.price },
                    set: { viewModel.updatePrice($0) }
                ),
                unit: viewModel.state.form.priceType.unitLabel,
                isDisabled: viewModel.state.form.priceType == .free,
                error: viewModel.error(for: .price)
            )

            PostGigV1RadioRow(
                selected: viewModel.state.form.priceType,
                onSelect: viewModel.updatePriceType
            )
        }

        FormFieldGroup("When") {
            PostGigV1DateField(
                date: Binding(
                    get: { viewModel.state.form.scheduledAt },
                    set: { viewModel.updateScheduledAt($0) }
                ),
                label: viewModel.dateLabel(for: viewModel.state.form.scheduledAt),
                error: viewModel.error(for: .dateTime)
            )
        }

        FormFieldGroup("Photos") {
            PostGigV1PhotosGrid(
                photos: viewModel.state.form.photos,
                canAdd: viewModel.state.form.photos.count < PostGigV1SampleData.maxPhotos,
                onAdd: { showsPhotosPicker = true },
                onRetry: { viewModel.retryUpload(id: $0) },
                onRemove: { viewModel.removePhoto(id: $0) }
            )
            .photosPicker(
                isPresented: $showsPhotosPicker,
                selection: $pickerItems,
                maxSelectionCount: max(1, PostGigV1SampleData.maxPhotos - viewModel.state.form.photos.count),
                matching: .images
            )
            .onChange(of: pickerItems) { _, newItems in
                handlePicked(newItems)
            }
        }

        FormFieldGroup("Location") {
            PantopusTextField(
                "Location",
                text: Binding(
                    get: { viewModel.state.form.location },
                    set: { viewModel.updateLocation($0) }
                ),
                placeholder: "Pearl District · NW 11th & Johnson",
                state: fieldState(.location),
                isRequired: true,
                identifier: "postGigV1_location"
            )
        }

        // A13.8 P5 — the rest of RN's editable field set, so an edit can
        // touch every column the PATCH schema accepts (`gigs.js:642`).
        FormFieldGroup("More details") {
            PostGigV1DeadlineField(
                deadline: viewModel.state.form.deadline
            ) { viewModel.updateDeadline($0) }

            PantopusTextField(
                "Estimated duration (hours)",
                text: Binding(
                    get: { viewModel.state.form.estimatedDuration },
                    set: { viewModel.updateEstimatedDuration($0) }
                ),
                placeholder: "1.5",
                state: fieldState(.estimatedDuration),
                keyboardType: .decimalPad,
                identifier: "postGigV1_estimatedDuration"
            )

            PantopusTextField(
                "Tags",
                text: Binding(
                    get: { viewModel.state.form.tags },
                    set: { viewModel.updateTags($0) }
                ),
                placeholder: "heavy lifting, weekend, two-person",
                identifier: "postGigV1_tags"
            )

            Text("Comma-separated · up to \(PostGigV1SampleData.maxTags)")
                .font(.system(size: 11, weight: .regular))
                .italic()
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityIdentifier("postGigV1_tagsHint")

            PostGigV1UrgentToggle(
                isOn: Binding(
                    get: { viewModel.state.form.isUrgent },
                    set: { viewModel.updateIsUrgent($0) }
                )
            )
        }

        FormFieldGroup("Items") {
            PostGigV1ItemsField(
                items: viewModel.state.form.items,
                canAdd: viewModel.state.form.items.count < PostGigV1SampleData.maxItems,
                onAdd: { viewModel.addItem() },
                onUpdate: { viewModel.updateItem($0) },
                onRemove: { viewModel.removeItem(id: $0) }
            )
        }

        FormFieldGroup("Cancellation") {
            PostGigV1CancellationPolicyField(
                selected: viewModel.state.form.cancellationPolicy,
                onSelect: viewModel.updateCancellationPolicy
            )
        }

        PostGigV1LegacyStamp()
    }

    private func handlePicked(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self), !data.isEmpty {
                    viewModel.addPhotoData(data)
                }
            }
            pickerItems = []
        }
    }

    private func fieldState(_ field: PostGigV1Field) -> PantopusFieldState {
        if let error = viewModel.error(for: field) {
            return .error(error)
        }
        return .default
    }

    private func commit() {
        Task {
            if let id = await viewModel.submit() {
                onPosted(id)
            }
        }
    }
}

private struct PostGigV1CategoryField: View {
    let selected: GigsCategory
    let error: String?
    let onSelect: (GigsCategory) -> Void

    private var valueLabel: String {
        selected == .moving ? "Moving & hauling" : selected.label
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            PostGigV1FieldLabel("Category", required: true)
            Menu {
                ForEach(GigsCategory.allCases.filter { $0 != .all }, id: \.self) { category in
                    Button(category == .moving ? "Moving & hauling" : category.label) {
                        onSelect(category)
                    }
                }
            } label: {
                HStack(spacing: Spacing.s2) {
                    Text(selected == .all ? "Choose a category" : valueLabel)
                        .pantopusTextStyle(.small)
                        .fontWeight(selected == .all ? .regular : .medium)
                        .foregroundStyle(selected == .all ? Theme.Color.appTextMuted : Theme.Color.appText)
                    Spacer()
                    Icon(.chevronDown, size: 16, color: Theme.Color.appTextSecondary)
                }
                .frame(minHeight: 44)
                .padding(.horizontal, Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(error == nil ? Theme.Color.appBorder : Theme.Color.error, lineWidth: error == nil ? 1 : 1.5)
                )
            }
            .accessibilityLabel("Category")
            .accessibilityIdentifier("postGigV1_category")
            if let error {
                PostGigV1InlineError(message: error)
            }
        }
    }
}

private struct PostGigV1DescriptionField: View {
    @Binding var text: String
    let error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            PostGigV1FieldLabel("Description", required: true)
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("Tell neighbors what to carry, where to meet, and any stairs or timing constraints.")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s3)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(Theme.Font.small)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(minHeight: 108)
                    .padding(Spacing.s2)
                    .scrollContentBackground(.hidden)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(error == nil ? Theme.Color.appBorder : Theme.Color.error, lineWidth: error == nil ? 1 : 1.5)
                    )
                    .accessibilityLabel(error.map { "Description, error: \($0)" } ?? "Description")
                    .accessibilityIdentifier("postGigV1_description")
            }
            HStack {
                if let error {
                    PostGigV1InlineError(message: error)
                }
                Spacer()
                Text("\(text.count) / \(PostGigV1SampleData.descriptionMaxLength)")
                    .font(.system(size: 11, weight: .regular, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .accessibilityIdentifier("postGigV1_descriptionCount")
            }
        }
    }
}

private struct PostGigV1PriceField: View {
    @Binding var value: String
    let unit: String?
    let isDisabled: Bool
    let error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            PostGigV1FieldLabel("Price", required: true)
            HStack(spacing: Spacing.s2) {
                Text("$")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(value.isEmpty ? Theme.Color.appTextMuted : Theme.Color.appTextStrong)
                TextField(isDisabled ? "Free" : "0", text: $value)
                    .keyboardType(.decimalPad)
                    .font(Theme.Font.body)
                    .fontWeight(value.isEmpty ? .regular : .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .disabled(isDisabled)
                    .accessibilityLabel(error.map { "Price, error: \($0)" } ?? (isDisabled ? "Price, disabled for free gigs" : "Price"))
                    .accessibilityIdentifier("postGigV1_price")
                if let unit {
                    Text(unit)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.leading, Spacing.s2)
                        .overlay(alignment: .leading) {
                            Rectangle()
                                .fill(Theme.Color.appBorderSubtle)
                                .frame(width: 1)
                        }
                }
            }
            .frame(minHeight: 44)
            .padding(.horizontal, Spacing.s3)
            .background(isDisabled ? Theme.Color.appSurfaceMuted : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(error == nil ? Theme.Color.appBorder : Theme.Color.error, lineWidth: error == nil ? 1 : 1.5)
            )
            .opacity(isDisabled ? 0.6 : 1)
            if let error {
                PostGigV1InlineError(message: error)
            }
        }
    }
}

private struct PostGigV1RadioRow: View {
    let selected: PostGigV1PriceType
    let onSelect: (PostGigV1PriceType) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            PostGigV1FieldLabel("Price type", required: false)
            HStack(spacing: Spacing.s5) {
                ForEach(PostGigV1PriceType.allCases) { type in
                    Button {
                        onSelect(type)
                    } label: {
                        HStack(spacing: Spacing.s2) {
                            ZStack {
                                Circle()
                                    .stroke(
                                        type == selected ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                                        lineWidth: type == selected ? 5 : 1.5
                                    )
                                    .frame(width: 18, height: 18)
                            }
                            Text(type.label)
                                .pantopusTextStyle(.caption)
                                .fontWeight(type == selected ? .semibold : .medium)
                                .foregroundStyle(Theme.Color.appText)
                        }
                        .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(type.label) price")
                    .accessibilityAddTraits(type == selected ? [.isSelected] : [])
                    .accessibilityIdentifier("postGigV1_priceType_\(type.rawValue)")
                }
            }
        }
    }
}

private struct PostGigV1DateField: View {
    @Binding var date: Date
    let label: String
    let error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            PostGigV1FieldLabel("Date & time", required: true)
            HStack(spacing: Spacing.s3) {
                Icon(.calendar, size: 16, color: Theme.Color.appTextSecondary)
                DatePicker(
                    label,
                    selection: $date,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .labelsHidden()
                .datePickerStyle(.compact)
                .tint(Theme.Color.primary600)
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronDown, size: 14, color: Theme.Color.appTextMuted)
            }
            .frame(minHeight: 44)
            .padding(.horizontal, Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(error == nil ? Theme.Color.appBorder : Theme.Color.error, lineWidth: error == nil ? 1 : 1.5)
            )
            .accessibilityLabel(error.map { "Date and time, error: \($0)" } ?? "Date and time")
            .accessibilityIdentifier("postGigV1_dateTime")
            if let error {
                PostGigV1InlineError(message: error)
            }
        }
    }
}

#Preview("Filled") {
    PostGigV1View(viewModel: PostGigV1SampleData.filledViewModel())
}

#Preview("Validation errors") {
    PostGigV1View(viewModel: PostGigV1SampleData.validationErrorViewModel())
}
