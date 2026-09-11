//
//  DocumentDetailView.swift
//  Pantopus
//
//  P2.10 — Document detail. Reads one row from the home documents
//  list, renders a preview pane (PDF via PDFKit, image via AsyncImage,
//  unsupported-fallback otherwise), a metadata grid, and a sticky
//  footer with four actions: Open externally · Share · Replace ·
//  Delete.
//
//  Backend has no GET-by-id today, so we re-fetch the parent list and
//  find the matching row by id — same pattern as `PackageDetailView`.
//
// swiftlint:disable file_length

import Foundation
import Observation
import PDFKit
import SwiftUI

// MARK: - View-model

@Observable
@MainActor
final class DocumentDetailViewModel {
    enum State: Equatable {
        case loading
        case loaded(HomeDocumentDTO)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var content: Data?
    private var loadId = UUID()
    private var exportDirectory: URL?
    private var deleted = false
    private var replacementDocument: HomeDocumentDTO?
    private var replacementSelection = UUID()
    private struct ReplacementAttempt {
        let file: PickedFile
        let version: String
        let id: String
    }

    private var replacementAttempt: ReplacementAttempt?
    private(set) var replacementFile: PickedFile?
    private(set) var isMutating: Bool = false
    var toast: ToastMessage?
    private(set) var shouldDismiss: Bool = false

    private let homeId: String
    private let documentId: String
    private let api: APIClient
    private let uploader: MultipartUploader
    private let onChanged: @Sendable () -> Void

    init(
        homeId: String,
        documentId: String,
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.documentId = documentId
        self.api = api
        self.uploader = uploader
        self.onChanged = onChanged
    }

    /// If the caller already has the DTO (e.g. from the list row tap),
    /// pre-seed it so the screen renders instantly. The next `load()`
    /// call refreshes against the server.
    func seed(_ dto: HomeDocumentDTO) {
        // A list row is presentation context, never proof of current file access.
        if dto.id != documentId { return }
    }

    func clearContent() {
        loadId = UUID()
        content = nil
        state = .loading
    }

    func load() async {
        guard !deleted, !isMutating else { return }
        clearContent()
        let requestId = loadId
        do {
            let response: GetHomeDocumentsResponse = try await api.request(
                HomesEndpoints.documents(homeId: homeId)
            )
            guard requestId == loadId else { return }
            guard let dto = response.documents.first(where: { $0.id.lowercased() == documentId.lowercased() }) else {
                state = .error(message: "This document is no longer available.")
                return
            }
            var bytes: Data?
            if dto.contentURL != nil {
                // Construct the path from this Home and document, not a response URL.
                bytes = try await api.requestData(HomesEndpoints.documentContent(homeId: homeId, documentId: documentId))
            }
            guard requestId == loadId else { return }
            content = bytes
            state = .loaded(dto)
        } catch {
            guard requestId == loadId else { return }
            content = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this document."
            )
        }
    }

    func clearExport() {
        if let exportDirectory { try? FileManager.default.removeItem(at: exportDirectory) }
        exportDirectory = nil
    }

    /// Recheck current access before handing a private copy to another app.
    func exportFile() async -> URL? {
        await load()
        guard case let .loaded(dto) = state, let content else { return nil }
        clearExport()
        do {
            let directory = try HomeDocumentTemporaryFiles.makeDirectory()
            exportDirectory = directory
            let original = dto.details["original_filename"] ?? dto.title
            let filename = original.components(separatedBy: CharacterSet(charactersIn: "/\\\r\n")).joined(separator: "_")
            let url = directory.appendingPathComponent(filename.isEmpty ? "document" : filename)
            try content.write(to: url, options: [.atomic, .completeFileProtection])
            return url
        } catch {
            clearExport()
            toast = ToastMessage(text: "Couldn't prepare this file. Try again.", kind: .error)
            return nil
        }
    }

    func refresh() async {
        await load()
    }

    func beginReplacement() -> Bool {
        guard !isMutating, !deleted, case let .loaded(document) = state,
              document.fileVersion != nil, document.contentURL != nil else { return false }
        replacementSelection = UUID()
        replacementDocument = document
        replacementFile = nil
        return true
    }

    func pickReplacement(url: URL) async {
        let selection = replacementSelection
        guard replacementDocument != nil else { return }
        do {
            let file = try await Task.detached(priority: .userInitiated) { try DocumentFileReader.read(url) }.value
            guard selection == replacementSelection else { return }
            replacementFile = file
        } catch {
            guard selection == replacementSelection else { return }
            toast = ToastMessage(text: (error as? APIError)?.errorDescription ?? "Couldn't read that file. Choose it again.", kind: .error)
        }
    }

    func cancelReplacement() {
        replacementSelection = UUID()
        replacementDocument = nil
        replacementFile = nil
        replacementAttempt = nil
    }

    func replace() async {
        guard !isMutating, !deleted, let original = replacementDocument,
              let version = original.fileVersion, let file = replacementFile, let bytes = file.data else { return }
        let previous = replacementAttempt
        let uploadId: String = if let previous, previous.file == file, previous.version == version {
            previous.id
        } else {
            UUID().uuidString.lowercased()
        }
        replacementAttempt = ReplacementAttempt(file: file, version: version, id: uploadId)
        isMutating = true
        loadId = UUID()
        content = nil
        clearExport()
        defer { isMutating = false }
        do {
            let response = try await uploader.replaceHomeDocument(
                homeId: homeId,
                documentId: documentId,
                uploadId: uploadId,
                expectedVersion: version,
                file: MultipartFile(
                    fieldName: "file",
                    filename: file.filename,
                    mimeType: file.mimeType ?? "application/octet-stream",
                    data: bytes
                )
            )
            guard response.document.id.lowercased() == documentId.lowercased(),
                  response.document.fileId?.lowercased() == documentId.lowercased(),
                  response.document.fileVersion?.lowercased() == uploadId,
                  response.document.contentURL != nil else {
                state = .error(message: "Couldn't confirm replacement. Reload this document.")
                return
            }
            cancelReplacement()
            isMutating = false
            onChanged()
            await load()
            if case let .loaded(current) = state, current.fileVersion?.lowercased() == uploadId, content != nil {
                toast = ToastMessage(text: "File replaced.", kind: .success)
            }
        } catch {
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't replace this file. Try again.")
        }
    }

    func delete() async {
        guard !deleted, !isMutating, case .loaded = state else { return }
        isMutating = true
        cancelReplacement()
        loadId = UUID()
        content = nil
        clearExport()
        defer { isMutating = false }
        do {
            let response: DeleteDocumentResponse = try await api.request(
                HomesEndpoints.deleteDocument(homeId: homeId, documentId: documentId)
            )
            guard response.deleted else {
                state = .error(message: "Couldn't delete this document. Try again.")
                return
            }
            deleted = true
            clearContent()
            onChanged()
            shouldDismiss = true
        } catch {
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't delete this document. Try again.")
        }
    }

    func acknowledgeDismiss() {
        shouldDismiss = false
    }
}

// MARK: - View

public struct DocumentDetailView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel: DocumentDetailViewModel
    @State private var showsDeleteConfirm = false
    @State private var showsReplacementPicker = false
    @State private var showsReplacementConfirm = false
    @State private var shareItem: ShareItem?
    private let onBack: () -> Void
    private let onOpenExternally: (HomeDocumentDTO) -> Void

    public init(
        homeId: String,
        documentId: String,
        seedDocument: HomeDocumentDTO? = nil,
        onBack: @escaping () -> Void = {},
        onOpenExternally: @escaping (HomeDocumentDTO) -> Void = { _ in }
    ) {
        let vm = DocumentDetailViewModel(homeId: homeId, documentId: documentId)
        if let seedDocument {
            vm.seed(seedDocument)
        }
        _viewModel = State(initialValue: vm)
        self.onBack = onBack
        self.onOpenExternally = onOpenExternally
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingShell(onBack: onBack)
            case let .loaded(dto):
                LoadedShell(
                    dto: dto,
                    content: viewModel.content,
                    isMutating: viewModel.isMutating,
                    onBack: onBack,
                    onOpenExternally: { Task { await exportFile() } },
                    onShare: { Task { await exportFile() } },
                    onReplace: { if viewModel.beginReplacement() { showsReplacementPicker = true } },
                    onDelete: { showsDeleteConfirm = true }
                )
            case let .error(message):
                ErrorShell(message: message, onBack: onBack) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("documentDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .onChange(of: viewModel.shouldDismiss) { _, dismiss in
            if dismiss {
                viewModel.acknowledgeDismiss()
                onBack()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { viewModel.clearContent() }
            if phase == .active { Task { await viewModel.load() } }
        }
        .onDisappear { viewModel.clearContent()
            viewModel.clearExport()
        }
        .fileImporter(isPresented: $showsReplacementPicker, allowedContentTypes: allowedUploadTypes) { result in
            switch result {
            case let .success(url): Task { await viewModel.pickReplacement(url: url) }
            case .failure: viewModel.cancelReplacement()
            }
        }
        .onChange(of: viewModel.replacementFile) { _, file in
            if file != nil { showsReplacementConfirm = true }
        }
        .confirmationDialog("Replace this file?", isPresented: $showsReplacementConfirm, titleVisibility: .visible) {
            Button("Replace file") { Task { await viewModel.replace() } }
            Button("Cancel", role: .cancel) { viewModel.cancelReplacement() }
        } message: {
            Text("The document link and details will stay the same.")
        }
        .confirmationDialog(
            "Delete this document?",
            isPresented: $showsDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { await viewModel.delete() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The file will be removed from this home's vault.")
        }
        // swiftlint:disable:next multiple_closures_with_trailing_closure
        .sheet(item: $shareItem, onDismiss: { viewModel.clearExport() }) { item in
            ShareSheet(items: [item.url])
        }
        .overlay(alignment: .bottom) {
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

    private func exportFile() async {
        if let url = await viewModel.exportFile() { shareItem = ShareItem(url: url) }
    }
}

// MARK: - Loading / Error shells

private struct LoadingShell: View {
    let onBack: () -> Void

    var body: some View {
        ContentDetailShell(
            title: "Document",
            onBack: onBack,
            header: {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    Shimmer(height: 60, cornerRadius: Radii.lg)
                    Shimmer(height: 260, cornerRadius: Radii.lg)
                }
                .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 56, cornerRadius: Radii.md)
                    Shimmer(height: 56, cornerRadius: Radii.md)
                    Shimmer(height: 56, cornerRadius: Radii.md)
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
            title: "Document",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this document",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") { onRetry() }
                )
                .frame(height: 400)
            }
        )
    }
}

// MARK: - Loaded shell

private struct LoadedShell: View {
    let dto: HomeDocumentDTO
    let content: Data?
    let isMutating: Bool
    let onBack: () -> Void
    let onOpenExternally: () -> Void
    let onShare: () -> Void
    let onReplace: () -> Void
    let onDelete: () -> Void

    var body: some View {
        let fileType = DocumentFileType.from(mimeType: dto.mimeType, filename: dto.title)
        let category = DocumentCategory.from(docType: dto.docType)
        let projection = DocumentsViewModel.project(dto: dto, now: Date())
        let tags = DocumentDetailView.parseTags(from: dto.details)
        let linked = DocumentLinkedEntity.from(details: dto.details)

        return ContentDetailShell(
            title: "Document",
            onBack: onBack,
            header: {
                DocumentHeaderCard(
                    dto: dto,
                    fileType: fileType,
                    category: category
                )
                .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    PreviewPane(dto: dto, fileType: fileType, bytes: content) { onOpenExternally() }
                        .padding(.horizontal, Spacing.s4)
                    MetadataGrid(dto: dto, projection: projection)
                        .padding(.horizontal, Spacing.s4)
                    if !tags.isEmpty {
                        TagsRow(tags: tags)
                            .padding(.horizontal, Spacing.s4)
                    }
                    if let linked {
                        LinkedToCard(link: linked)
                            .padding(.horizontal, Spacing.s4)
                    }
                    Color.clear.frame(height: Spacing.s16)
                }
            },
            cta: {
                StickyActionFooter(
                    isMutating: isMutating,
                    hasFile: content != nil,
                    canReplace: dto.fileVersion != nil,
                    onOpenExternally: onOpenExternally,
                    onShare: onShare,
                    onReplace: onReplace,
                    onDelete: onDelete
                )
            }
        )
    }
}

// MARK: - Header card

private struct DocumentHeaderCard: View {
    let dto: HomeDocumentDTO
    let fileType: DocumentFileType
    let category: DocumentCategory

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            FileTypeTile(fileType: fileType, width: 48, height: 56)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(dto.title)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("documentDetailTitle")
                HStack(spacing: Spacing.s2) {
                    CategoryChipBadge(category: category)
                    if let label = sizeLabel {
                        Text(label)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private var sizeLabel: String? {
        guard let bytes = dto.sizeBytes, bytes > 0 else { return nil }
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

private struct CategoryChipBadge: View {
    let category: DocumentCategory

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(category.icon, size: 12, color: category.foreground)
            Text(category.label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(category.foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(category.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .accessibilityLabel("Category \(category.label)")
    }
}

// MARK: - Preview pane

private struct PreviewPane: View {
    let dto: HomeDocumentDTO
    let fileType: DocumentFileType
    let bytes: Data?
    let onOpenExternally: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                Theme.Color.appSurfaceSunken
                content
            }
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("documentDetailPreview")
        }
    }

    @ViewBuilder private var content: some View {
        if let bytes {
            switch fileType {
            case .pdf, .scan:
                PDFPreview(data: bytes)
                    .accessibilityLabel("PDF preview of \(dto.title)")
            case .image:
                ImagePreview(data: bytes)
                    .accessibilityLabel("Image preview of \(dto.title)")
            case .doc, .sheet, .archive:
                UnsupportedPreview(fileType: fileType, onOpenExternally: onOpenExternally)
            }
        } else {
            UnsupportedPreview(fileType: fileType, onOpenExternally: onOpenExternally)
        }
    }
}

private struct PDFPreview: UIViewRepresentable {
    let data: Data

    func makeUIView(context _: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = true
        return view
    }

    func updateUIView(_ uiView: PDFView, context _: Context) {
        uiView.document = PDFDocument(data: data)
    }
}

private struct ImagePreview: View {
    let data: Data

    var body: some View {
        if let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Text("Image unavailable").pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }
}

private struct UnsupportedPreview: View {
    let fileType: DocumentFileType
    let onOpenExternally: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            FileTypeTile(fileType: fileType, width: 56, height: 68)
            Text("Preview not supported")
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
            Text("Open the file in another app to view its contents.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s5)
            Button(action: onOpenExternally) {
                HStack(spacing: Spacing.s1) {
                    Icon(.externalLink, size: 14, color: Theme.Color.primary600)
                    Text("Open externally")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.primary600)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            .accessibilityIdentifier("documentDetailPreviewOpenExternally")
        }
        .padding(Spacing.s5)
    }
}

// MARK: - Metadata grid

private struct MetadataGrid: View {
    let dto: HomeDocumentDTO
    let projection: DocumentRowProjection

    var body: some View {
        VStack(spacing: Spacing.s0) {
            row(label: "Uploaded by", value: uploadedByLabel)
            divider
            row(label: "Uploaded", value: uploadedLabel)
            if let expires = projection.expiresLabel {
                divider
                row(label: "Expires", value: expires, valueColor: projection.expiresUrgent ? Theme.Color.warning : nil)
            }
            divider
            row(label: "Visibility", value: visibilityLabel)
            if let size = sizeLabel {
                divider
                row(label: "Size", value: size)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }

    private func row(label: String, value: String, valueColor: Color? = nil) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(width: 110, alignment: .leading)
            Text(value)
                .pantopusTextStyle(.body)
                .foregroundStyle(valueColor ?? Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .multilineTextAlignment(.leading)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(value)")
    }

    private var uploadedByLabel: String {
        if let uploader = dto.details["uploaded_by"], !uploader.isEmpty { return uploader }
        return dto.createdBy ?? "—"
    }

    private var uploadedLabel: String {
        projection.uploadedLabel ?? "—"
    }

    private var visibilityLabel: String {
        switch dto.visibility {
        case "managers": "Managers and owners"
        case "members": "All members"
        case "private": "Private"
        case "public": "Public"
        default: dto.visibility.capitalized
        }
    }

    private var sizeLabel: String? {
        guard let bytes = dto.sizeBytes, bytes > 0 else { return nil }
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Tags + linked-to

private struct TagsRow: View {
    let tags: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Tags", style: .overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s1) {
                    ForEach(tags, id: \.self) { tag in
                        Text(tag)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appText)
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
            }
        }
        .accessibilityIdentifier("documentDetailTags")
    }
}

private struct LinkedToCard: View {
    let link: DocumentLinkedEntity

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Linked to", style: .overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                Icon(link.kind.icon, size: 16, color: Theme.Color.home)
                VStack(alignment: .leading, spacing: 2) {
                    Text(link.title)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(link.kind.label)
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
        }
        .accessibilityIdentifier("documentDetailLinkedTo")
    }
}

// MARK: - Sticky action footer

private struct StickyActionFooter: View {
    let isMutating: Bool
    let hasFile: Bool
    let canReplace: Bool
    let onOpenExternally: () -> Void
    let onShare: () -> Void
    let onReplace: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            HStack(spacing: Spacing.s0) {
                FooterButton(
                    icon: .externalLink,
                    label: "Open",
                    accessibilityLabel: "Open externally",
                    identifier: "documentDetailOpenExternally",
                    action: onOpenExternally
                ).disabled(!hasFile)
                FooterButton(
                    icon: .share,
                    label: "Share",
                    accessibilityLabel: "Share document",
                    identifier: "documentDetailShare",
                    action: onShare
                ).disabled(!hasFile)
                FooterButton(
                    icon: .refreshCw,
                    label: "Replace",
                    accessibilityLabel: "Replace file",
                    identifier: "documentDetailReplace",
                    action: onReplace
                ).disabled(!canReplace)
                FooterButton(
                    icon: .trash2,
                    label: "Delete",
                    accessibilityLabel: "Delete document",
                    identifier: "documentDetailDelete",
                    tint: Theme.Color.error,
                    action: onDelete
                )
            }
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
        }
        .frame(maxWidth: .infinity)
        .opacity(isMutating ? 0.6 : 1)
        .allowsHitTesting(!isMutating)
    }
}

private struct FooterButton: View {
    let icon: PantopusIcon
    let label: String
    let accessibilityLabel: String
    let identifier: String
    var tint: Color = Theme.Color.appText
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 18, color: tint)
                Text(label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(tint)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: - Detail-only projection (tags + linked-to)

struct DocumentLinkedEntity: Equatable {
    enum Kind: String {
        case bill, maintenance, pet

        var label: String {
            switch self {
            case .bill: "Bill"
            case .maintenance: "Maintenance"
            case .pet: "Pet"
            }
        }

        var icon: PantopusIcon {
            switch self {
            case .bill: .receiptText
            case .maintenance: .hammer
            case .pet: .pawPrint
            }
        }
    }

    let kind: Kind
    let title: String

    static func from(details: [String: String]) -> DocumentLinkedEntity? {
        guard let kindRaw = details["linked_entity_kind"],
              let kind = Kind(rawValue: kindRaw),
              let title = details["linked_entity_title"], !title.isEmpty
        else { return nil }
        return DocumentLinkedEntity(kind: kind, title: title)
    }
}

public extension DocumentDetailView {
    /// Pure helper exposed for tests — pulls the comma-separated `tags`
    /// payload out of the document's free-form `details` map.
    static func parseTags(from details: [String: String]) -> [String] {
        guard let raw = details["tags"], !raw.isEmpty else { return [] }
        return raw
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
}

// MARK: - Share

private struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context _: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}

#Preview {
    DocumentDetailView(
        homeId: "preview-home",
        documentId: "preview-doc"
    )
}
