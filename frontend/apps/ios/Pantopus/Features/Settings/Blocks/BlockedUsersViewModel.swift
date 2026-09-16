//
//  BlockedUsersViewModel.swift
//  Pantopus
//
//  P8 / T6.2c — Settings → Blocked users sub-route.
//  Backs the screen with `ListOfRowsDataSource`.
//
//  N04: this is the only surface that lifts a block, so it reads BOTH
//  existing personal block contracts, which remain separate tables with
//  separate scopes:
//    • `GET /api/users/blocked` (blocks.js:138) — the `UserBlock` rows
//      that Block-on-a-profile and Block-in-a-chat write, and the ones
//      `blockService.isBlocked` reads to deny direct messages. Lifted by
//      `DELETE /api/users/:userId/block` (blocks.js:101).
//    • `GET /api/privacy/blocks` (privacy.js:154) — the Identity
//      Firewall's scoped `UserProfileBlock` rows. Lifted by
//      `DELETE /api/privacy/blocks/:blockId` (privacy.js:251).
//  Before this the screen read only the second, so a block made from a
//  profile was invisible here and could never be undone in the app.
//
//  Unblock is optimistic: the row disappears immediately and re-appears
//  if its DELETE fails.
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
    private var complete = false
    private var entries: [BlockedEntry] = []

    /// One row's worth of "someone you blocked", flattened from the two
    /// separate existing block contracts the app can produce. They stay
    /// separate tables with separate scopes; this screen is the one place
    /// the owner sees and lifts both, so it has to know which DELETE
    /// addresses which row.
    private struct BlockedEntry {
        enum Origin {
            /// `UserBlock` — written by Block on a profile or in a chat.
            /// Lifted by `DELETE /api/users/:userId/block`.
            case personal(userId: String)
            /// `UserProfileBlock` — the Identity Firewall's scoped block.
            /// Lifted by `DELETE /api/privacy/blocks/:blockId`.
            case profile
        }

        let id: String
        let name: String
        let avatarURL: URL?
        let createdAt: String?
        /// Only `UserProfileBlock` carries a scope; personal blocks are
        /// account-wide, which renders the same as the existing `full` case.
        let scope: String?
        let origin: Origin
    }

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

    /// Reads both existing block lists. Sequential, not concurrent, so the
    /// request order stays deterministic for the sequenced test transport.
    ///
    /// Only one has to answer: a personal block must still be visible (and
    /// liftable) when the Identity Firewall list is unavailable, and vice
    /// versa. The screen reports an error only when neither list loads.
    private func fetch() async {
        let personal = try? await api.request(BlocksEndpoints.blocked, as: UserBlocksResponse.self)
        let profile = try? await api.request(PrivacyEndpoints.blocks, as: PrivacyBlocksResponse.self)

        complete = personal != nil && profile != nil
        guard personal != nil || profile != nil else {
            state = .error(message: "Couldn't load your blocked list.")
            return
        }

        let personalEntries = (personal?.blocked ?? []).map { block in
            BlockedEntry(
                id: block.id,
                name: block.name
                    ?? block.username.map { "@\($0)" }
                    ?? "Blocked user",
                avatarURL: block.profilePictureUrl.flatMap(URL.init(string:)),
                createdAt: block.createdAt,
                scope: nil,
                origin: .personal(userId: block.userId)
            )
        }
        let profileEntries = (profile?.blocks ?? []).map { block in
            BlockedEntry(
                id: block.id,
                name: block.blocked?.name
                    ?? block.blocked?.username.map { "@\($0)" }
                    ?? "Blocked user",
                avatarURL: block.blocked?.profilePictureUrl.flatMap(URL.init(string:)),
                createdAt: block.createdAt,
                scope: block.blockScope,
                origin: .profile
            )
        }

        // Each route already orders its own rows newest-first, and the
        // screen has always rendered them in the order the server sent.
        // Keep that: concatenate rather than re-sort, so the existing
        // privacy-only rendering is unchanged. Personal blocks lead
        // because they are the ones that gate direct messages.
        entries = personalEntries + profileEntries
        rebuild()
    }

    /// Optimistic unblock. Removes the row immediately; restores it on
    /// network failure (kept original index so the order doesn't shuffle).
    /// The request is chosen by the row's own contract — a personal block
    /// is lifted by user id, a profile block by block id.
    public func unblock(_ blockId: String) async {
        guard let index = entries.firstIndex(where: { $0.id == blockId }) else { return }
        let removed = entries.remove(at: index)
        rebuild()
        do {
            switch removed.origin {
            case let .personal(userId):
                _ = try await api.request(BlocksEndpoints.unblock(userId: userId))
            case .profile:
                _ = try await api.request(PrivacyEndpoints.deleteBlock(blockId: blockId))
            }
        } catch {
            entries.insert(removed, at: min(index, entries.count))
            rebuild()
        }
    }

    private func rebuild() {
        if entries.isEmpty, !complete {
            state = .error(message: "Couldn't load your complete blocked list. Please retry.")
            return
        }
        guard !entries.isEmpty else {
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
        let rows = entries.map { entry -> RowModel in
            let name = entry.name
            let avatarURL = entry.avatarURL
            let blockId = entry.id
            return RowModel(
                id: blockId,
                title: name,
                subtitle: Self.blockedSubtitle(createdAt: entry.createdAt, scope: entry.scope),
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
                    header: "Blocked · \(entries.count)",
                    footer: (complete ? "" : "We couldn't load the complete list. Pull to refresh. ")
                        + "Blocked people can't message you, see your profile, or bid on "
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
