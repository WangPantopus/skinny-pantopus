//
//  MailboxSearchViewModel.swift
//  Pantopus
//
//  P4.2 — Backs `MailboxSearchView`. Searches everything this person can
//  read on the server (`GET /api/mailbox/v2/search`, Mail build contract,
//  SRV-3): Me, Home after proof, and Biz, filed and archived included. It
//  used to filter only the newest 100 personal letters on the phone.
//
//  Drives the shared `SearchListShell` (P4.1): the shell owns the search
//  bar and its phases (recent / typing / results / empty); this view model
//  asks the server a moment after typing stops and supplies `results`,
//  `isLoading` and what to say when nothing came back.
//

import Foundation
import Observation

@Observable
@MainActor
final class MailboxSearchViewModel {
    /// Bound to the shell's search field. Each change asks the server again
    /// once typing pauses.
    var query: String = "" {
        didSet { if query != oldValue { scheduleSearch() } }
    }

    private(set) var results: [DrawerItemsResponse.DrawerMail] = []

    /// True while a search is on its way, so the shell shows its typing
    /// shimmer instead of a false "no matches".
    private(set) var isLoading = false
    private(set) var isLoadingMore = false
    private(set) var hasMore = false
    private var nextOffset = 0

    /// Why the last search came back with nothing, when it failed.
    private(set) var failureMessage: String?

    var emptyState: EmptyStateContent {
        if let failureMessage {
            return EmptyStateContent(icon: .alertCircle, headline: "Couldn't search your mail", subcopy: failureMessage)
        }
        return EmptyStateContent(
            icon: .search,
            headline: "No matching mail",
            subcopy: "Search looks through all your mail, filed and archived too. Try a sender or a word from the letter."
        )
    }

    /// Pop the search surface — wired to the shell's back control.
    let onCancel: @Sendable () -> Void

    private let api: APIClient
    private let onOpenMail: @Sendable (String) -> Void
    private var searchTask: Task<Void, Never>?
    /// The Homes this person lives at, so Home mail is addressed to its Home.
    private var homes: [DrawerListResponse.MailboxHome] = []
    /// The server's page size limit.
    private let pageSize = 50
    /// Longer text is refused by the server (`MAIL_SEARCH_INVALID`).
    private let maxQueryLength = 100

    init(
        api: APIClient = .shared,
        onOpenMail: @escaping @Sendable (String) -> Void = { _ in },
        onCancel: @escaping @Sendable () -> Void = {}
    ) {
        self.api = api
        self.onOpenMail = onOpenMail
        self.onCancel = onCancel
    }

    /// Search asks the server as the person types; up front only the Homes,
    /// to address Home mail. Without them a piece is addressed to the person.
    func load() async {
        guard homes.isEmpty else { return }
        let response: DrawerListResponse? = try? await api.request(MailboxV2Endpoints.drawers())
        homes = response?.homes ?? []
    }

    func open(_ mail: DrawerItemsResponse.DrawerMail) {
        onOpenMail(mail.id)
    }

    /// A result drawn as the piece it is.
    func piece(for mail: DrawerItemsResponse.DrawerMail) -> MailPieceModel {
        MailPieceModel(
            mail: mail,
            recipient: MailPieceRecipient.of(mail, homeMail: false, homes: homes, personName: MailPieceRecipient.personName),
            opened: mail.item.viewed,
            clock: .current
        )
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        failureMessage = nil
        results = []
        isLoadingMore = false
        hasMore = false
        nextOffset = 0
        guard !text.isEmpty else {
            results = []
            isLoading = false
            return
        }
        guard text.count <= maxQueryLength else {
            results = []
            isLoading = false
            failureMessage = "That's longer than search takes. Try a few words."
            return
        }
        isLoading = true
        searchTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await self?.search(text)
        }
    }

    func loadMore() {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isLoadingMore = true
        failureMessage = nil
        searchTask = Task { [weak self] in await self?.search(text, loadMore: true) }
    }

    private func search(_ text: String, loadMore: Bool = false) async {
        do {
            let response: MailSearchResponse = try await api.request(
                MailboxV2Endpoints.search(query: text, limit: pageSize, offset: loadMore ? nextOffset : 0)
            )
            guard !Task.isCancelled, text == query.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
            let existing = loadMore ? results : []
            let seen = Set(existing.map(\.id))
            results = existing + response.mail.filter { !seen.contains($0.id) }
            nextOffset = (loadMore ? nextOffset : 0) + response.mail.count
            hasMore = !response.mail.isEmpty && (response.total.map { nextOffset < $0 } ?? (response.mail.count == pageSize))
            failureMessage = nil
        } catch {
            guard !Task.isCancelled, text == query.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
            if !loadMore { results = [] }
            failureMessage = Self.message(for: error)
        }
        isLoading = false
        isLoadingMore = false
    }

    /// Offline, server trouble or the server's own sentence, told apart.
    private static func message(for error: Error) -> String {
        switch error as? APIError {
        case .transport:
            "You're offline. Check your connection and try again."
        case let .clientError(_, message):
            message ?? "Search couldn't use that text. Try different words."
        case .server, .retriesExhausted:
            "Search isn't working right now. Try again in a moment."
        default:
            (error as? APIError)?.errorDescription ?? "Search isn't working right now. Try again in a moment."
        }
    }
}

/// `GET /api/mailbox/v2/search` — the drawer list's row shape.
struct MailSearchResponse: Decodable {
    let mail: [DrawerItemsResponse.DrawerMail]
    let total: Int?
}
