//
//  MailboxSearchViewModel.swift
//  Pantopus
//
//  P4.2 — Backs `MailboxSearchView`. Fetches the user's mailbox once
//  (`GET /api/mailbox`, route `backend/routes/mailbox.js:1306`) and
//  filters that corpus client-side across sender, subject, body, and
//  category. The V1 list route has no `q` parameter yet, so search is
//  local. Rows project through `MailboxListViewModel.makeRow` so each
//  result is identical to a row on the Mailbox list.
//
//  Drives the shared `SearchListShell` (P4.1): the shell owns the search
//  bar + debounce + four lifecycle phases (recent / typing / results /
//  empty); this VM just supplies `query`, `results`, and `isLoading`.
//

import Foundation
import Observation

@Observable
@MainActor
final class MailboxSearchViewModel {
    /// Bound to the shell's search field. `didSet` re-filters the cached
    /// corpus synchronously — the corpus is a single fetched page.
    var query: String = "" {
        didSet { recompute() }
    }

    private(set) var results: [MailItem] = []

    /// True until the corpus fetch settles. Gates the shell's
    /// typing-shimmer: while mail is still loading and the user has typed,
    /// the shell shows the skeleton instead of a false "no matches".
    private(set) var isLoading: Bool = true

    /// No-results payload for the shell's empty phase.
    let emptyState = EmptyStateContent(
        icon: .search,
        headline: "No matching mail",
        subcopy: "Try a different sender, subject, or category."
    )

    /// Pop the search surface — wired to the shell's back control.
    let onCancel: @Sendable () -> Void

    private var corpus: [MailItem] = []
    private var didLoad = false

    private let api: APIClient
    private let onOpenMail: @Sendable (String) -> Void
    private let corpusLimit = 100

    init(
        api: APIClient = .shared,
        onOpenMail: @escaping @Sendable (String) -> Void = { _ in },
        onCancel: @escaping @Sendable () -> Void = {}
    ) {
        self.api = api
        self.onOpenMail = onOpenMail
        self.onCancel = onCancel
    }

    /// Fetch the corpus once. Repeat calls (e.g. a re-entered `.task`)
    /// are no-ops so typing doesn't trigger refetches.
    func load() async {
        guard !didLoad else { return }
        isLoading = true
        do {
            let response: MailboxListResponse = try await api.request(
                MailboxEndpoints.list(archived: false, limit: corpusLimit, offset: 0)
            )
            corpus = response.mail
        } catch {
            // The shell has no error phase; an unreachable mailbox simply
            // yields no matches rather than spinning forever.
            corpus = []
        }
        didLoad = true
        isLoading = false
        recompute()
    }

    /// Build a result row identical to the Mailbox list row, routing taps
    /// to this surface's `onOpenMail`.
    func rowModel(for mail: MailItem) -> RowModel {
        MailboxListViewModel.makeRow(for: mail, onOpenMail: onOpenMail)
    }

    private func recompute() {
        results = Self.filter(corpus, query: query)
    }

    // MARK: - Pure search (tested directly)

    /// Filter the corpus by a free-text query. Returns `[]` for a blank
    /// query so the shell falls back to its recent/empty canvas.
    static func filter(_ mail: [MailItem], query: String) -> [MailItem] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        return mail.filter { matches($0, query: trimmed) }
    }

    /// Case-insensitive substring match across the four fields the prompt
    /// calls out: sender, subject/title, body, and category label.
    static func matches(_ mail: MailItem, query: String) -> Bool {
        let needle = query.lowercased()
        let category = MailItemCategory.fromRaw(mail.mailType ?? mail.type)
        let fields: [String?] = [
            mail.senderBusinessName,
            mail.senderAddress,
            mail.subject,
            mail.displayTitle,
            mail.previewText,
            mail.content,
            category.label
        ]
        return fields.contains { $0?.lowercased().contains(needle) == true }
    }
}
