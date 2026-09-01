//
//  DocumentSearchViewModel.swift
//  Pantopus
//
//  P4.5 — Backs `DocumentSearchView`. Fetches the home's documents once
//  (`GET /api/homes/:id/documents`, route `backend/routes/home.js:4944`)
//  and filters the corpus client-side across title, tags, and category.
//  Rows are projected through `DocumentsViewModel.makeRow` so each result
//  is byte-identical to a row on the Documents list, plus matched-tag
//  chips appended inline.
//
//  Drives the shared `SearchListShell` (P4.1): the shell owns the search
//  bar + debounce + four lifecycle phases (recent / typing / results /
//  empty); this VM just supplies `query`, `results`, and `isLoading`.
//

import Foundation
import Observation

@Observable
@MainActor
final class DocumentSearchViewModel {
    /// Bound to the shell's search field. `didSet` re-filters the cached
    /// corpus synchronously — the corpus is per-home and small.
    var query: String = "" {
        didSet { recompute() }
    }

    private(set) var results: [HomeDocumentDTO] = []

    /// True until the corpus fetch settles. Gates the shell's
    /// typing-shimmer: while the documents are still loading and the user
    /// has typed, the shell shows the skeleton instead of a false "no
    /// matches".
    private(set) var isLoading: Bool = true

    /// No-results payload for the shell's empty phase.
    let emptyState = EmptyStateContent(
        icon: .search,
        headline: "No documents match",
        subcopy: "Try a different title, tag, or category."
    )

    /// Pop the search surface — wired to the shell's back control.
    let onCancel: @Sendable () -> Void

    private var corpus: [HomeDocumentDTO] = []
    private var didLoad = false

    private let homeId: String
    private let api: APIClient
    private let onOpenDocument: @Sendable (HomeDocumentDTO) -> Void
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenDocument: @escaping @Sendable (HomeDocumentDTO) -> Void = { _ in },
        onCancel: @escaping @Sendable () -> Void = {},
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenDocument = onOpenDocument
        self.onCancel = onCancel
        self.now = now
    }

    /// Fetch the corpus once. Repeat calls (e.g. a re-entered `.task`)
    /// are no-ops so typing doesn't trigger refetches.
    func load() async {
        guard !didLoad else { return }
        isLoading = true
        do {
            let response: GetHomeDocumentsResponse = try await api.request(
                HomesEndpoints.documents(homeId: homeId)
            )
            corpus = response.documents
        } catch {
            // The shell has no error phase; an unreachable vault simply
            // yields no matches rather than spinning forever.
            corpus = []
        }
        didLoad = true
        isLoading = false
        recompute()
    }

    /// Build a result row identical to the Documents list row, with the
    /// document's tags appended as inline chips so the match is legible.
    func rowModel(for dto: HomeDocumentDTO) -> RowModel {
        let dtoCopy = dto
        return DocumentsViewModel.makeRow(
            dto: dto,
            now: now(),
            extraChips: Self.tagChips(for: dto),
            onOpen: { [onOpenDocument] in onOpenDocument(dtoCopy) },
            onSecondary: { [onOpenDocument] in onOpenDocument(dtoCopy) }
        )
    }

    private func recompute() {
        results = Self.filter(corpus, query: query)
    }

    // MARK: - Pure search (tested directly)

    /// Filter the corpus by a free-text query. Returns `[]` for a blank
    /// query so the shell falls back to its recent/empty canvas.
    static func filter(_ documents: [HomeDocumentDTO], query: String) -> [HomeDocumentDTO] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        return documents.filter { matches($0, query: trimmed) }
    }

    /// Case-insensitive substring match across title, category label, and
    /// the document's free-form tags.
    static func matches(_ dto: HomeDocumentDTO, query: String) -> Bool {
        let needle = query.lowercased()
        if dto.title.lowercased().contains(needle) { return true }
        if DocumentCategory.from(docType: dto.docType).label.lowercased().contains(needle) {
            return true
        }
        let tags = DocumentDetailView.parseTags(from: dto.details)
        return tags.contains { $0.lowercased().contains(needle) }
    }

    /// One neutral pill per tag, rendered after the reused row's
    /// category / expiry chips.
    static func tagChips(for dto: HomeDocumentDTO) -> [RowChip] {
        DocumentDetailView.parseTags(from: dto.details).map { tag in
            RowChip(text: tag, icon: .tag, tint: .status(.neutral))
        }
    }
}
