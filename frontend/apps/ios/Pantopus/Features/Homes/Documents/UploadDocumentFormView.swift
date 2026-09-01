//
//  UploadDocumentFormView.swift
//  Pantopus
//
//  P2.10 — Single-page form for uploading a document into a home's
//  vault. Built on the shared `FormShell` archetype.
//
// swiftlint:disable file_length

import Foundation
import SwiftUI
import UniformTypeIdentifiers

/// Allowed picker types — PDF, image, .doc/.docx, .xls/.xlsx.
private let allowedUploadTypes: [UTType] = {
    var types: [UTType] = [.pdf, .image]
    if let docx = UTType(filenameExtension: "docx") { types.append(docx) }
    if let doc = UTType(filenameExtension: "doc") { types.append(doc) }
    if let xlsx = UTType(filenameExtension: "xlsx") { types.append(xlsx) }
    if let xls = UTType(filenameExtension: "xls") { types.append(xls) }
    return types
}()

@MainActor
public struct UploadDocumentFormView: View {
    @State private var viewModel: UploadDocumentFormViewModel
    @State private var showsFilePicker = false
    @State private var showsLinkPicker = false
    @Environment(\.dismiss) private var dismiss
    private let onClose: @MainActor () -> Void

    public init(
        homeId: String,
        onClose: @escaping @MainActor () -> Void = {},
        onUploaded: @escaping @Sendable (HomeDocumentDTO) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: UploadDocumentFormViewModel(
            homeId: homeId,
            onUploaded: onUploaded
        ))
        self.onClose = onClose
    }

    public var body: some View {
        FormShell(
            title: "Upload document",
            rightActionLabel: "Upload",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: handleClose,
            onCommit: { Task { await viewModel.submit() } },
            content: {
                fileSection
                titleSection
                categorySection
                tagsSection
                linkedSection
                visibilitySection
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .accessibilityIdentifier("uploadDocumentShell")
        .fileImporter(
            isPresented: $showsFilePicker,
            allowedContentTypes: allowedUploadTypes,
            allowsMultipleSelection: false
        ) { result in
            handlePicked(result: result)
        }
        .sheet(isPresented: $showsLinkPicker) {
            LinkedEntityPickerSheet(viewModel: viewModel) {
                showsLinkPicker = false
            }
        }
        .overlay(alignment: .bottom) { toastOverlay }
        .onChange(of: viewModel.shouldDismiss) { _, dismissNow in
            guard dismissNow else { return }
            viewModel.acknowledgeDismiss()
            Task {
                try? await Task.sleep(nanoseconds: 700_000_000)
                handleClose()
            }
        }
    }

    private func handleClose() {
        onClose()
        dismiss()
    }

    private func handlePicked(result: Result<[URL], any Error>) {
        switch result {
        case let .success(urls):
            guard let url = urls.first else { return }
            let didStart = url.startAccessingSecurityScopedResource()
            defer { if didStart { url.stopAccessingSecurityScopedResource() } }
            viewModel.acceptPicked(url: url)
        case let .failure(error):
            viewModel.toast = ToastMessage(
                text: error.localizedDescription,
                kind: .error
            )
        }
    }

    // MARK: - Sections

    private var fileSection: some View {
        FormFieldGroup("File") {
            if let file = viewModel.pickedFile {
                PickedFileCard(file: file) {
                    showsFilePicker = true
                } onRemove: {
                    viewModel.clearPickedFile()
                }
            } else {
                FilePickerCTA { showsFilePicker = true }
            }
        }
    }

    private var titleSection: some View {
        FormFieldGroup("Title") {
            PantopusTextField(
                "Document title",
                text: Binding(
                    get: { viewModel.titleField.value },
                    set: { viewModel.updateTitle($0) }
                ),
                placeholder: "Lease — 412 Birch Ln",
                state: titleFieldState,
                identifier: "uploadDocumentTitleField"
            )
        }
    }

    private var titleFieldState: PantopusFieldState {
        if let error = viewModel.titleField.error, viewModel.titleField.touched {
            return .error(error)
        }
        if viewModel.titleField.touched, !viewModel.titleField.value.isEmpty {
            return .valid
        }
        return .default
    }

    private var categorySection: some View {
        FormFieldGroup("Category") {
            CategoryChipGrid(
                selected: viewModel.category,
                onSelect: viewModel.selectCategory
            )
        }
    }

    private var tagsSection: some View {
        FormFieldGroup("Tags") {
            TagsEditor(
                tags: viewModel.tags,
                draft: Binding(
                    get: { viewModel.tagDraft },
                    set: { viewModel.tagDraft = $0 }
                ),
                onCommit: viewModel.commitTagDraft,
                onRemove: viewModel.removeTag
            )
        }
    }

    private var linkedSection: some View {
        FormFieldGroup("Linked to") {
            if let linked = viewModel.linkedEntity {
                LinkedRow(link: linked) {
                    viewModel.clearLinkedEntity()
                }
            } else {
                Button {
                    showsLinkPicker = true
                    Task { await viewModel.loadLinkOptionsIfNeeded() }
                } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(.link, size: 16, color: Theme.Color.primary600)
                        Text("Add a link")
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.primary600)
                        Spacer()
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
                    }
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("uploadDocumentLinkButton")
                .accessibilityLabel("Add link to bill, maintenance task, or pet")
            }
        }
    }

    private var visibilitySection: some View {
        FormFieldGroup("Visibility") {
            VisibilityPicker(
                selected: viewModel.visibility,
                onSelect: viewModel.selectVisibility
            )
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
        }
    }
}

// MARK: - File picker CTA

private struct FilePickerCTA: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: Spacing.s2) {
                Icon(.upload, size: 28, color: Theme.Color.home)
                Text("Choose a file")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Text("PDF · JPG · PNG · DOC · DOCX · XLSX")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.vertical, Spacing.s5)
            .frame(maxWidth: .infinity, minHeight: 96)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .strokeBorder(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("uploadDocumentFileCTA")
        .accessibilityLabel("Choose a file to upload")
    }
}

private struct PickedFileCard: View {
    let file: PickedFile
    let onReplace: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            FileTypeTile(fileType: file.fileType)
            VStack(alignment: .leading, spacing: 2) {
                Text(file.filename)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                if let label = sizeLabel {
                    Text(label)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onRemove) {
                Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .accessibilityIdentifier("uploadDocumentRemoveFile")
            .accessibilityLabel("Remove file")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(alignment: .bottomTrailing) {
            Button(action: onReplace) {
                HStack(spacing: Spacing.s1) {
                    Icon(.refreshCw, size: 12, color: Theme.Color.primary600)
                    Text("Replace")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.primary600)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
            }
            .accessibilityIdentifier("uploadDocumentReplaceFile")
            .accessibilityLabel("Replace file")
        }
    }

    private var sizeLabel: String? {
        guard let bytes = file.sizeBytes, bytes > 0 else { return nil }
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - FileType tile (shared with Document detail header)

struct FileTypeTile: View {
    let fileType: DocumentFileType
    var width: CGFloat = 40
    var height: CGFloat = 48

    var body: some View {
        VStack(spacing: 2) {
            Icon(fileType.icon, size: 20, color: fileType.foreground)
            Text(fileType.stamp)
                .font(.system(size: 8, weight: .heavy))
                .foregroundStyle(fileType.foreground)
        }
        .frame(width: width, height: height)
        .background(fileType.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
        .accessibilityHidden(true)
    }
}

// MARK: - Category chips

private struct CategoryChipGrid: View {
    let selected: UploadDocumentCategory
    let onSelect: (UploadDocumentCategory) -> Void

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: Spacing.s2)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: Spacing.s2) {
            ForEach(UploadDocumentCategory.allCases) { category in
                CategoryChip(
                    category: category,
                    isSelected: category == selected
                ) {
                    onSelect(category)
                }
            }
        }
    }
}

private struct CategoryChip: View {
    let category: UploadDocumentCategory
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s1) {
                Icon(category.palette.icon, size: 12, color: foreground)
                Text(category.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(foreground)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill)
                    .stroke(
                        isSelected ? category.palette.foreground : Theme.Color.appBorder,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("uploadDocumentCategoryChip_\(category.id)")
        .accessibilityLabel(category.label)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var foreground: Color {
        isSelected ? category.palette.foreground : Theme.Color.appText
    }

    private var background: Color {
        isSelected ? category.palette.background : Theme.Color.appSurface
    }
}

// MARK: - Tags

private struct TagsEditor: View {
    let tags: [String]
    @Binding var draft: String
    let onCommit: () -> Void
    let onRemove: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if !tags.isEmpty {
                UploadTagsFlowLayout(spacing: Spacing.s1) {
                    ForEach(tags, id: \.self) { tag in
                        TagChip(tag: tag) { onRemove(tag) }
                    }
                }
            }
            HStack(spacing: Spacing.s2) {
                TextField("Add tag", text: $draft)
                    .font(Theme.Font.body)
                    .submitLabel(.done)
                    .onSubmit(onCommit)
                    .accessibilityIdentifier("uploadDocumentTagField")
                Button(action: onCommit) {
                    Icon(.plusCircle, size: 20, color: draft.isEmpty ? Theme.Color.appTextMuted : Theme.Color.primary600)
                }
                .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityIdentifier("uploadDocumentTagCommit")
                .accessibilityLabel("Add tag")
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        }
    }
}

private struct TagChip: View {
    let tag: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Text(tag)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appText)
            Button(action: onRemove) {
                Icon(.x, size: 10, color: Theme.Color.appTextSecondary)
            }
            .accessibilityLabel("Remove tag \(tag)")
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

/// Minimal flow layout — wraps chips to multiple lines.
private struct UploadTagsFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let result = arrangement(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        let result = arrangement(proposal: proposal, subviews: subviews)
        for (offset, sub) in zip(result.positions, subviews) {
            sub.place(at: CGPoint(x: bounds.minX + offset.x, y: bounds.minY + offset.y), proposal: .unspecified)
        }
    }

    private func arrangement(proposal: ProposedViewSize, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalWidth: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            totalWidth = max(totalWidth, x)
        }
        return (positions, CGSize(width: totalWidth, height: y + lineHeight))
    }
}

// MARK: - Linked-to row

private struct LinkedRow: View {
    let link: UploadDocumentLinkOption
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(link.kind.icon, size: 16, color: Theme.Color.home)
            VStack(alignment: .leading, spacing: 2) {
                Text(link.title)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(linkSubtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            Button(action: onClear) {
                Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .accessibilityIdentifier("uploadDocumentLinkClear")
            .accessibilityLabel("Remove linked entity")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
    }

    private var linkSubtitle: String {
        if let subtitle = link.subtitle, !subtitle.isEmpty {
            return "\(link.kind.label) · \(subtitle)"
        }
        return link.kind.label
    }
}

// MARK: - Linked-entity picker sheet

private struct LinkedEntityPickerSheet: View {
    @Bindable var viewModel: UploadDocumentFormViewModel
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Text("Link to…")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: onDismiss) {
                    Text("Cancel")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.primary600)
                }
                .accessibilityIdentifier("uploadDocumentLinkSheetCancel")
            }
            .padding(Spacing.s4)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("uploadDocumentLinkSheet")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.linkOptionsState {
        case .idle, .loading:
            VStack(spacing: Spacing.s3) {
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(height: 56, cornerRadius: Radii.md)
                }
            }
            .padding(Spacing.s4)
        case let .loaded(options):
            if options.isEmpty {
                EmptyState(
                    icon: .link,
                    headline: "Nothing to link yet",
                    subcopy: "Add a bill, maintenance task, or pet to this home first."
                )
            } else {
                ScrollView {
                    VStack(spacing: Spacing.s2) {
                        ForEach(UploadDocumentLinkKind.allCases, id: \.self) { kind in
                            let filtered = options.filter { $0.kind == kind }
                            if !filtered.isEmpty {
                                section(title: kind.label, options: filtered)
                            }
                        }
                    }
                    .padding(Spacing.s4)
                }
            }
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load options",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") {
                    await viewModel.loadLinkOptionsIfNeeded()
                }
            )
        }
    }

    private func section(title: String, options: [UploadDocumentLinkOption]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title.uppercased())
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            VStack(spacing: Spacing.s1) {
                ForEach(options) { option in
                    LinkOptionRow(option: option) {
                        viewModel.selectLink(option)
                        onDismiss()
                    }
                }
            }
        }
    }
}

private struct LinkOptionRow: View {
    let option: UploadDocumentLinkOption
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Icon(option.kind.icon, size: 16, color: Theme.Color.home)
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.title)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let subtitle = option.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer()
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s3)
            .frame(minHeight: 56)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("uploadDocumentLinkOption_\(option.kind.rawValue)_\(option.id)")
        .accessibilityLabel("\(option.kind.label) \(option.title)")
    }
}

// MARK: - Visibility picker

private struct VisibilityPicker: View {
    let selected: UploadDocumentVisibility
    let onSelect: (UploadDocumentVisibility) -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(UploadDocumentVisibility.allCases, id: \.self) { choice in
                VisibilityRow(choice: choice, isSelected: choice == selected) {
                    onSelect(choice)
                }
            }
        }
    }
}

private struct VisibilityRow: View {
    let choice: UploadDocumentVisibility
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                Icon(choice == .owners ? .lock : .users, size: 16, color: Theme.Color.home)
                VStack(alignment: .leading, spacing: 2) {
                    Text(choice.label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                radio
            }
            .padding(Spacing.s3)
            .frame(minHeight: 56)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(isSelected ? Theme.Color.home : Theme.Color.appBorder, lineWidth: isSelected ? 1.5 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("uploadDocumentVisibility_\(choice.rawValue)")
        .accessibilityLabel("\(choice.label), \(subtitle)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var subtitle: String {
        switch choice {
        case .owners: "Only owners and managers can read this."
        case .allMembers: "Everyone with access to the home."
        }
    }

    private var radio: some View {
        ZStack {
            Circle()
                .stroke(isSelected ? Theme.Color.home : Theme.Color.appBorderStrong, lineWidth: isSelected ? 6 : 2)
                .frame(width: 22, height: 22)
            if isSelected {
                Circle().fill(Theme.Color.appSurface).frame(width: 8, height: 8)
            }
        }
    }
}

#Preview {
    UploadDocumentFormView(homeId: "preview-home")
}
