//
//  BlockedUsersViewModel.swift
//  Pantopus
//
//  P8 / T6.2c — Settings → Blocked users sub-route.
//  Backs the screen with `ListOfRowsDataSource`. Reads
//  `GET /api/privacy/blocks` (privacy.js:154) and unblocks via
//  `DELETE /api/privacy/blocks/:blockId` (privacy.js:251). Unblock is
//  optimistic: the row disappears immediately and re-appears if the
//  DELETE fails.
//

import Foundation
import Observation

@Observable
@MainActor
public final class BlockedUsersViewModel: ListOfRowsDataSource {
    public var title: String {
        "Blocked users"
    }

    public var topBarAction: TopBarAction? {
        nil
    }

    public var tabs: [ListOfRowsTab] {
        []
    }

    public var selectedTab: String = ""
    public var fab: FABAction? {
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    /// A14.4 MonoFooter — signed-in user's name · short ID, same
    /// pattern as the Settings index / Payments mono footers.
    public var monoFooter: String? {
        guard case let .signedIn(user) = auth.state else { return nil }
        let name = user.displayName ?? user.email
        return "\(name) · ID \(String(user.id.prefix(8)))"
    }

    private let api: APIClient
    private let auth: AuthManager
    private var blocks: [PrivacyBlock] = []

    init(api: APIClient = .shared, auth: AuthManager = .shared) {
        self.api = api
        self.auth = auth
    }

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {}

    private func fetch() async {
        do {
            let response: PrivacyBlocksResponse = try await api.request(PrivacyEndpoints.blocks)
            blocks = response.blocks
            rebuild()
        } catch {
            state = .error(message: "Couldn't load your blocked list.")
        }
    }

    /// Optimistic unblock. Removes the row immediately; restores it on
    /// network failure (kept original index so the order doesn't shuffle).
    public func unblock(_ blockId: String) async {
        guard let index = blocks.firstIndex(where: { $0.id == blockId }) else { return }
        let removed = blocks.remove(at: index)
        rebuild()
        do {
            _ = try await api.request(PrivacyEndpoints.deleteBlock(blockId: blockId))
        } catch {
            blocks.insert(removed, at: min(index, blocks.count))
            rebuild()
        }
    }

    private func rebuild() {
        guard !blocks.isEmpty else {
            // A14.4 empty hero — neutral grey disc + user-minus glyph
            // (the design's `user-x`; `userMinus` is the in-inventory
            // person-with-negation glyph) + reassurance about silence.
            state = .empty(.init(
                icon: .userMinus,
                headline: "No one blocked",
                subcopy: "When you block someone, they'll appear here. "
                    + "They won't be notified, and you can unblock them anytime.",
                tint: Theme.Color.appSurfaceSunken,
                accent: Theme.Color.appTextSecondary
            ))
            return
        }
        let rows = blocks.map { block -> RowModel in
            let name = block.blocked?.name
                ?? block.blocked?.username.map { "@\($0)" }
                ?? "Blocked user"
            let avatarURL = block.blocked?.profilePictureUrl.flatMap(URL.init(string:))
            let blockId = block.id
            return RowModel(
                id: blockId,
                title: name,
                subtitle: Self.blockedSubtitle(createdAt: block.createdAt, scope: block.blockScope),
                template: .avatarKebab,
                leading: .avatarWithBadge(
                    name: name,
                    imageURL: avatarURL,
                    background: .solid(Theme.Color.appSurfaceSunken),
                    size: .small,
                    verified: false
                ),
                trailing: .pillButton(label: "Unblock", tone: .neutral) { [weak self] in
                    Task { @MainActor in await self?.unblock(blockId) }
                }
            ) {}
        }
        state = .loaded(
            sections: [
                RowSection(
                    id: "blocked",
                    header: "Blocked · \(blocks.count)",
                    footer: "Blocked people can't message you, see your profile, or bid on "
                        + "your tasks. Unblocking doesn't notify them.",
                    rows: rows,
                    style: .card
                )
            ],
            hasMore: false
        )
    }

    /// `Blocked <date> · <context>` — the design's source-context line.
    /// `created_at` drives the date; `block_scope` drives the context
    /// suffix (the backend has no origin-surface column, so the scope the
    /// block was created with is the "source" context we can surface).
    private static func blockedSubtitle(createdAt: String?, scope: String?) -> String? {
        guard let date = formattedBlockedDate(createdAt) else {
            // No parseable date — fall back to the scope label alone.
            return scopeLabel(scope)
        }
        if let context = scopeContext(scope) {
            return "Blocked \(date) · \(context)"
        }
        return "Blocked \(date)"
    }

    /// Context suffix from `block_scope`. `full` / `nil` carry no suffix
    /// (the block is account-wide); the scoped variants name where it
    /// applies.
    private static func scopeContext(_ scope: String?) -> String? {
        switch scope {
        case "search_only": "Search only"
        case "business_context": "Business contexts"
        case "full", nil: nil
        default: scope?.capitalized
        }
    }

    /// Standalone scope label — used only when there's no parseable date.
    private static func scopeLabel(_ scope: String?) -> String? {
        switch scope {
        case "search_only": "Hidden from search"
        case "business_context": "Blocked in business contexts"
        case "full", nil: "Blocked"
        default: scope?.capitalized
        }
    }

    private static let isoParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// UTC-pinned so the rendered day matches the stored calendar date
    /// (and stays deterministic across CI time zones).
    private static let blockedDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d, yyyy"
        return formatter
    }()

    private static func formattedBlockedDate(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        if let date = isoParser.date(from: iso) {
            return blockedDateFormatter.string(from: date)
        }
        // Date-only fallback ("yyyy-MM-dd").
        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.timeZone = TimeZone(secondsFromGMT: 0)
        dateOnly.dateFormat = "yyyy-MM-dd"
        if let date = dateOnly.date(from: String(iso.prefix(10))) {
            return blockedDateFormatter.string(from: date)
        }
        return nil
    }
}
