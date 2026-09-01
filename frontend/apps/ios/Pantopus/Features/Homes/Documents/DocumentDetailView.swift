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
    private(set) var isMutating: Bool = false
    var toast: ToastMessage?
    private(set) var shouldDismiss: Bool = false

    private let homeId: String
    private let documentId: String
    private let api: APIClient
    private let onChanged: @Sendable () -> Void

    init(
        homeId: String,
        documentId: String,
        api: APIClient = .shared,
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.documentId = documentId
        self.api = api
        self.onChanged = onChanged
    }

    /// If the caller already has the DTO (e.g. from the list row tap),
    /// pre-seed it so the screen renders instantly. The next `load()`
    /// call refreshes against the server.
    func seed(_ dto: HomeDocumentDTO) {
        state = .loaded(dto)
    }

    func load() async {
        if case .loaded = state {} else { state = .loading }
        do {
            let response: GetHomeDocumentsResponse = try await api.request(
                HomesEndpoints.documents(homeId: homeId)
            )
            guard let dto = response.documents.first(where: { $0.id == documentId }) else {
                state = .error(message: "This document is no longer available.")
                return
            }
            state = .loaded(dto)
        } catch {
            // Preserve a seeded payload on transient error.
            if case .loaded = state { return }
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this document."
            )
        }
    }

    func refresh() async {
        await load()
    }

    /// Soft-delete: the backend has no DELETE handler for documents
    /// today, so the action shows a stub toast. Real deletion lands
    /// in a follow-up patch once `DELETE /api/homes/:id/documents/:id`
    /// ships.
    func delete() async {
        isMutating = true
        defer { isMutating = false }
        toast = ToastMessage(
            text: "Delete will be available once the server ships its handler.",
            kind: .neutral
        )
    }

    func acknowledgeDismiss() {
        shouldDismiss = false
    }
}

// MARK: - View

public struct DocumentDetailView: View {
    @State private var viewModel: DocumentDetailViewModel
    @State private var showsDeleteConfirm = false
    @State private var shareItem: ShareItem?
    private let onBack: () -> Void
    private let onReplace: () -> Void
    private let onOpenExternally: (HomeDocumentDTO) -> Void

    public init(
        homeId: String,
        documentId: String,
        seedDocument: HomeDocumentDTO? = nil,
        onBack: @escaping () -> Void = {},
        onReplace: @escaping () -> Void = {},
        onOpenExternally: @escaping (HomeDocumentDTO) -> Void = { _ in }
    ) {
        let vm = DocumentDetailViewModel(homeId: homeId, documentId: documentId)
        if let seedDocument {
            vm.seed(seedDocument)
        }
        _viewModel = State(initialValue: vm)
        self.onBack = onBack
        self.onReplace = onReplace
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
                    isMutating: viewModel.isMutating,
                    onBack: onBack,
                    onOpenExternally: { onOpenExternally(dto) },
                    onShare: { shareItem = ShareItem(document: dto) },
                    onReplace: onReplace,
                    // swiftlint:disable:next trailing_closure
                    onDelete: { showsDeleteConfirm = true }
                )
            case let .error(message):
                ErrorShell(message: message, onBack: onBack) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .accessibilityIdentifier("documentDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
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
        .sheet(item: $shareItem) { item in
            ShareSheet(items: [item.subject])
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
                    PreviewPane(dto: dto, fileType: fileType) { onOpenExternally() }
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
        if let url = previewURL {
            switch fileType {
            case .pdf, .scan:
                PDFPreview(url: url)
                    .accessibilityLabel("PDF preview of \(dto.title)")
            case .image:
                ImagePreview(url: url)
                    .accessibilityLabel("Image preview of \(dto.title)")
            case .doc, .sheet, .archive:
                UnsupportedPreview(fileType: fileType, onOpenExternally: onOpenExternally)
            }
        } else {
            UnsupportedPreview(fileType: fileType, onOpenExternally: onOpenExternally)
        }
    }

    private var previewURL: URL? {
        // The backend may surface a signed URL in `details["preview_url"]`
        // once storage signing lands; until then we honor any URL that
        // happens to ride on `storage_path` (treat as a direct link).
        if let raw = dto.details["preview_url"], let url = URL(string: raw) { return url }
        if let raw = dto.storagePath, raw.hasPrefix("http"), let url = URL(string: raw) { return url }
        return nil
    }
}

private struct PDFPreview: UIViewRepresentable {
    let url: URL

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
        if uiView.document?.documentURL != url {
            uiView.document = PDFDocument(url: url)
        }
    }
}

private struct ImagePreview: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case let .success(image):
                image
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failure:
                fallback
            case .empty:
                Shimmer(height: 220, cornerRadius: Radii.md)
                    .padding(Spacing.s4)
            @unknown default:
                fallback
            }
        }
    }

    private var fallback: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.image, size: 32, color: Theme.Color.appTextMuted)
            Text("Image unavailable")
                .pantopusTextStyle(.caption)
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
        case "managers": "Owners only"
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
            Text("TAGS")
                .pantopusTextStyle(.overline)
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
            Text("LINKED TO")
                .pantopusTextStyle(.overline)
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
                )
                FooterButton(
                    icon: .share,
                    label: "Share",
                    accessibilityLabel: "Share document",
                    identifier: "documentDetailShare",
                    action: onShare
                )
                FooterButton(
                    icon: .refreshCw,
                    label: "Replace",
                    accessibilityLabel: "Replace file",
                    identifier: "documentDetailReplace",
                    action: onReplace
                )
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
    let document: HomeDocumentDTO

    /// Best-effort string handed to UIActivityViewController. Falls back
    /// to the document title when no storage URL has been persisted.
    var subject: String {
        if let raw = document.details["preview_url"], !raw.isEmpty { return raw }
        if let raw = document.storagePath, !raw.isEmpty { return raw }
        return document.title
    }
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
