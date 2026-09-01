//
//  MailPartyViewModel.swift
//  Pantopus
//
//  Family Mail Party — the household co-opening surface. Two frames off
//  one view-model:
//
//    Discover — every pending / active session in the household plus the
//      Home-drawer items a new party can be started from.
//    Live session — the joined session: ephemeral reactions and a
//      hand-it-to roster that assigns the item onto a member's Counter.
//
//  Routes (`backend/routes/mailboxV2Phase2.js`, mounted at
//  `/api/mailbox/v2/p2`, `backend/app.js:316`):
//    GET  /party/active   (:926) — discover
//    POST /party/create   (:741) — start, Home-drawer items only
//    POST /party/join     (:816) — join (90s pending window)
//    POST /party/decline  (:866) — decline into solo
//    POST /party/reaction (:875) — ephemeral reaction, response carries ttl
//    POST /party/assign   (:887) — hand off + complete
//
//  Two supporting reads, both already shipped:
//    GET /api/mailbox/v2/drawer/home?tab=incoming (`mailboxV2.js:280`) —
//      the startable items. `/party/create` 400s on anything that isn't in
//      the Home drawer, so the start list is scoped to exactly that.
//    GET /api/homes/:id/occupants (`home.js:3705`) — the assign roster for
//      the session's `home_id`.
//
//  Mirrors `ui/screens/mailbox/mail_party/MailPartyViewModel.kt`.
//

// swiftlint:disable file_length

import Foundation
import Observation

/// Session lifecycle as rendered. `GET /party/active` only ever returns
/// `pending` / `active` (`mailboxV2Phase2.js:935`); `completed` /
/// `expired` rows are filtered server-side.
public enum MailPartyStatus: String, Sendable, Hashable {
    case pending
    case active

    /// Status-chip copy. Identical on Android.
    public var label: String {
        switch self {
        case .pending: "Waiting to start"
        case .active: "In progress"
        }
    }

    static func fromRaw(_ raw: String?) -> MailPartyStatus {
        MailPartyStatus(rawValue: raw ?? "") ?? .pending
    }
}

/// The reaction palette. The wire value is the glyph itself — the
/// validator caps `reaction` at 10 characters
/// (`mailboxV2Phase2.js:23`), which every glyph here clears.
public enum MailPartyReaction: String, CaseIterable, Identifiable, Sendable {
    case celebrate
    case laugh
    case wow
    case love
    case applause

    public var id: String {
        rawValue
    }

    /// Sent verbatim as the `reaction` body field.
    public var glyph: String {
        switch self {
        case .celebrate: "🎉"
        case .laugh: "😂"
        case .wow: "😮"
        case .love: "❤️"
        case .applause: "👏"
        }
    }

    /// Accessibility label — the glyph alone reads poorly.
    public var label: String {
        switch self {
        case .celebrate: "Celebrate"
        case .laugh: "Funny"
        case .wow: "Wow"
        case .love: "Love"
        case .applause: "Applause"
        }
    }
}

/// One live/pending session in the discover list.
public struct MailPartySessionCard: Sendable, Equatable, Identifiable {
    /// `MailPartySession.id`.
    public let id: String
    public let mailId: String
    public let homeId: String?
    public let title: String
    public let senderDisplay: String
    public let status: MailPartyStatus

    public init(
        id: String,
        mailId: String,
        homeId: String?,
        title: String,
        senderDisplay: String,
        status: MailPartyStatus
    ) {
        self.id = id
        self.mailId = mailId
        self.homeId = homeId
        self.title = title
        self.senderDisplay = senderDisplay
        self.status = status
    }
}

/// A Home-drawer item a party can be started from.
public struct MailPartyStartableItem: Sendable, Equatable, Identifiable {
    /// `Mail.id`.
    public let id: String
    public let title: String
    public let senderDisplay: String

    public init(id: String, title: String, senderDisplay: String) {
        self.id = id
        self.title = title
        self.senderDisplay = senderDisplay
    }
}

/// A household member the item can be handed to.
public struct MailPartyMember: Sendable, Equatable, Identifiable {
    /// `HomeOccupancy.user_id` — the `assignToUserId` the route wants.
    public let id: String
    public let name: String
    public let roleLabel: String?

    public init(id: String, name: String, roleLabel: String?) {
        self.id = id
        self.name = name
        self.roleLabel = roleLabel
    }
}

/// The session the user is currently inside.
public struct MailPartyLiveSession: Sendable, Equatable {
    public let sessionId: String
    public let mailId: String
    public let homeId: String?
    public let title: String
    public let senderDisplay: String
    public let status: MailPartyStatus
    /// Assign roster. Empty in the `.empty` state.
    public let members: [MailPartyMember]

    public init(
        sessionId: String,
        mailId: String,
        homeId: String?,
        title: String,
        senderDisplay: String,
        status: MailPartyStatus,
        members: [MailPartyMember]
    ) {
        self.sessionId = sessionId
        self.mailId = mailId
        self.homeId = homeId
        self.title = title
        self.senderDisplay = senderDisplay
        self.status = status
        self.members = members
    }
}

/// The reaction just sent, held for `ttl` seconds so the view can echo it.
public struct MailPartyReactionEcho: Sendable, Equatable, Identifiable {
    public let id: String
    public let glyph: String
    public let ttlSeconds: Int

    public init(id: String, glyph: String, ttlSeconds: Int) {
        self.id = id
        self.glyph = glyph
        self.ttlSeconds = ttlSeconds
    }
}

/// Discover-frame render state.
public enum MailPartyDiscoverState: Sendable, Equatable {
    case loading
    /// No live sessions and nothing in the Home drawer to start one from.
    case empty
    case loaded(sessions: [MailPartySessionCard], startable: [MailPartyStartableItem])
    case error(message: String)
}

/// Live-session render state. `.empty` still carries the session — the
/// party is real, there is just nobody on the roster to hand the item to.
public enum MailPartyLiveState: Sendable, Equatable {
    case loading
    case empty(MailPartyLiveSession)
    case loaded(MailPartyLiveSession)
    case error(message: String)
}

@Observable
@MainActor
public final class MailPartyViewModel {
    public private(set) var discover: MailPartyDiscoverState = .loading

    /// Non-nil while the live-session frame is on screen; nil is the
    /// discover frame.
    public private(set) var live: MailPartyLiveState?

    /// A create / join is in flight — the tapped row shows a spinner and
    /// every start affordance disables so a double tap can't open two
    /// sessions for the same item.
    public private(set) var isStarting: Bool = false
    /// The `assignToUserId` currently being handed off to, if any.
    public private(set) var assigningMemberId: String?
    /// The reaction currently in flight, so its chip can show a spinner.
    public private(set) var sendingReaction: MailPartyReaction?
    /// Last reaction the server accepted, with its ttl.
    public private(set) var reactionEcho: MailPartyReactionEcho?

    public var toast: ToastMessage?

    private let api: APIClient
    private let onOpenMail: (String) -> Void

    /// Production initializer. `APIClient` is module-internal, so this
    /// cannot be `public` (see `MailRoutingQueueViewModel.swift:118`).
    init(api: APIClient = .shared, onOpenMail: @escaping (String) -> Void = { _ in }) {
        self.api = api
        self.onOpenMail = onOpenMail
    }

    // MARK: - Derived presentation

    /// Screen subtitle — "2 happening now" once loaded.
    public var discoverSubtitle: String {
        guard case let .loaded(sessions, _) = discover, !sessions.isEmpty else {
            return "Open household mail together"
        }
        return "\(sessions.count) happening now"
    }

    /// `true` when a start affordance may fire. A create is refused by the
    /// server while another is in flight for this screen, so the whole
    /// start list disables together.
    public var canStart: Bool {
        !isStarting
    }

    public func isAssigning(_ member: MailPartyMember) -> Bool {
        assigningMemberId == member.id
    }

    // MARK: - Lifecycle

    public func load() async {
        discover = .loading
        await fetchDiscover()
    }

    public func refresh() async {
        await fetchDiscover()
    }

    private func fetchDiscover() async {
        do {
            let active: MailPartyActiveResponse = try await api.request(
                MailboxPartyEndpoints.activeSessions()
            )
            // `/party/create` 400s on anything outside the Home drawer
            // (`mailboxV2Phase2.js:751`), so the start list is exactly the
            // Home drawer's incoming window.
            let home: DrawerItemsResponse = try await api.request(
                MailboxV2Endpoints.drawer("home", tab: "incoming", limit: startableLimit)
            )
            let sessions = active.sessions.map { Self.card(from: $0) }
            let startable = home.mail.map(Self.startable)
            discover = (sessions.isEmpty && startable.isEmpty)
                ? .empty
                : .loaded(sessions: sessions, startable: startable)
        } catch {
            discover = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load mail parties."
            )
        }
    }

    // MARK: - Discover intents

    /// Open a session for a Home-drawer item and step into it.
    @discardableResult
    public func startParty(with item: MailPartyStartableItem) async -> Bool {
        guard !isStarting else { return false }
        isStarting = true
        defer { isStarting = false }
        do {
            let response: MailPartyCreateResponse = try await api.request(
                MailboxPartyEndpoints.createSession(mailId: item.id)
            )
            await enterSession(
                Self.card(
                    from: response.session,
                    knownTitle: item.title,
                    knownSender: item.senderDisplay
                )
            )
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't start the party",
                kind: .error
            )
            return false
        }
    }

    /// Join a session someone else opened. The 90-second pending window is
    /// enforced server-side (`mailboxV2Phase2.js:826`) — a late tap
    /// surfaces the server's own "Session expired" and the row is dropped.
    @discardableResult
    public func join(_ card: MailPartySessionCard) async -> Bool {
        guard !isStarting else { return false }
        isStarting = true
        defer { isStarting = false }
        do {
            let response: MailPartyJoinResponse = try await api.request(
                MailboxPartyEndpoints.joinSession(sessionId: card.id)
            )
            await enterSession(
                Self.card(
                    from: response.session,
                    knownTitle: card.title,
                    knownSender: card.senderDisplay
                )
            )
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't join the party",
                kind: .error
            )
            removeSession(card.id)
            return false
        }
    }

    /// Decline the invite and open the item solo — the server's own copy
    /// says exactly that (`mailboxV2Phase2.js:870`).
    public func decline(_ card: MailPartySessionCard) async {
        do {
            let response: MailPartyDeclineResponse = try await api.request(
                MailboxPartyEndpoints.declineSession(sessionId: card.id)
            )
            removeSession(card.id)
            toast = ToastMessage(
                text: response.message ?? "Declined. You can still open the item solo.",
                kind: .neutral
            )
            onOpenMail(card.mailId)
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't decline",
                kind: .error
            )
        }
    }

    // MARK: - Live-session intents

    /// Fetch the assign roster for the session's home and show the live
    /// frame. A session without a `home_id` has no roster to read.
    private func enterSession(_ card: MailPartySessionCard) async {
        reactionEcho = nil
        live = .loading
        guard let homeId = card.homeId else {
            live = .empty(Self.session(card, members: []))
            return
        }
        do {
            let response: OccupantsResponse = try await api.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            let members = response.occupants.filter(\.isActive).map(Self.member)
            let session = Self.session(card, members: members)
            live = members.isEmpty ? .empty(session) : .loaded(session)
        } catch {
            live = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't open the party."
            )
        }
    }

    /// Retry the roster read after a `.error` live frame.
    public func retryLiveSession() async {
        guard let card = liveCard else { return }
        await enterSession(card)
    }

    /// Leave the live frame and re-read the discover list.
    public func closeSession() async {
        live = nil
        reactionEcho = nil
        await fetchDiscover()
    }

    /// Send an ephemeral reaction. The response carries the ttl the echo
    /// chip lives for (`mailboxV2Phase2.js:882`).
    public func send(_ reaction: MailPartyReaction) async {
        guard let session = liveSession, sendingReaction == nil else { return }
        sendingReaction = reaction
        defer { sendingReaction = nil }
        do {
            let response: MailPartyReactionResponse = try await api.request(
                MailboxPartyEndpoints.sendReaction(
                    sessionId: session.sessionId,
                    reaction: reaction.glyph
                )
            )
            reactionEcho = MailPartyReactionEcho(
                id: UUID().uuidString,
                glyph: response.reaction ?? reaction.glyph,
                ttlSeconds: response.ttl ?? 0
            )
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't send that reaction",
                kind: .error
            )
        }
    }

    /// The echo's ttl elapsed — clear the chip.
    public func clearReactionEcho() {
        reactionEcho = nil
    }

    /// Hand the item to a household member. This completes the session
    /// server-side (`mailboxV2Phase2.js:903`), so the frame closes back to
    /// discover on success.
    public func assign(to member: MailPartyMember) async {
        guard let session = liveSession, assigningMemberId == nil else { return }
        assigningMemberId = member.id
        defer { assigningMemberId = nil }
        do {
            let response: MailPartyAssignResponse = try await api.request(
                MailboxPartyEndpoints.assignItem(
                    sessionId: session.sessionId,
                    mailId: session.mailId,
                    assignToUserId: member.id
                )
            )
            toast = ToastMessage(
                text: response.message ?? "Item assigned",
                kind: .success
            )
            await closeSession()
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't hand off this item",
                kind: .error
            )
        }
    }

    // MARK: - Live-session accessors

    /// The session behind the current live frame, if any.
    public var liveSession: MailPartyLiveSession? {
        guard let live else { return nil }
        switch live {
        case let .empty(session), let .loaded(session): return session
        case .loading, .error: return nil
        }
    }

    /// Card form of the live session, for a roster retry.
    private var liveCard: MailPartySessionCard? {
        guard let session = liveSession else { return nil }
        return MailPartySessionCard(
            id: session.sessionId,
            mailId: session.mailId,
            homeId: session.homeId,
            title: session.title,
            senderDisplay: session.senderDisplay,
            status: session.status
        )
    }

    // MARK: - List maintenance

    /// Drop a session from the discover list without a refetch — used when
    /// it is declined, or when a join is refused because it expired.
    private func removeSession(_ sessionId: String) {
        guard case let .loaded(sessions, startable) = discover else { return }
        let remaining = sessions.filter { $0.id != sessionId }
        discover = (remaining.isEmpty && startable.isEmpty)
            ? .empty
            : .loaded(sessions: remaining, startable: startable)
    }

    // MARK: - Projection

    /// Home-drawer window size for the start list.
    private let startableLimit = 20

    /// `/party/active` embeds the joined `Mail` row, but `/party/create`
    /// and `/party/join` return the bare `MailPartySession`
    /// (`mailboxV2Phase2.js:812` / `:846`) — so those two callers pass the
    /// title and sender they already showed the user rather than dropping
    /// to the unknown-item copy.
    static func card(
        from dto: MailPartySessionDTO,
        knownTitle: String? = nil,
        knownSender: String? = nil
    ) -> MailPartySessionCard {
        MailPartySessionCard(
            id: dto.id,
            mailId: dto.mailId,
            homeId: dto.homeId,
            title: trimmed(dto.mail?.subject) ?? knownTitle ?? "Household mail",
            senderDisplay: trimmed(dto.mail?.senderDisplay) ?? knownSender ?? "Unknown sender",
            status: MailPartyStatus.fromRaw(dto.status)
        )
    }

    static func startable(from mail: DrawerItemsResponse.DrawerMail) -> MailPartyStartableItem {
        MailPartyStartableItem(
            id: mail.item.id,
            title: trimmed(mail.item.displayTitle) ?? trimmed(mail.item.subject) ?? "Household mail",
            senderDisplay: trimmed(mail.senderDisplay) ?? "Unknown sender"
        )
    }

    static func member(from dto: OccupantDTO) -> MailPartyMember {
        MailPartyMember(
            id: dto.userId,
            name: trimmed(dto.displayName) ?? trimmed(dto.username) ?? "Household member",
            roleLabel: trimmed(dto.role).map(prettyRole)
        )
    }

    private static func session(
        _ card: MailPartySessionCard,
        members: [MailPartyMember]
    ) -> MailPartyLiveSession {
        MailPartyLiveSession(
            sessionId: card.id,
            mailId: card.mailId,
            homeId: card.homeId,
            title: card.title,
            senderDisplay: card.senderDisplay,
            status: card.status,
            members: members
        )
    }

    /// `restricted_member` → `Restricted member`.
    private static func prettyRole(_ raw: String) -> String {
        let spaced = raw.replacingOccurrences(of: "_", with: " ")
        return spaced.prefix(1).uppercased() + spaced.dropFirst()
    }

    private static func trimmed(_ value: String?) -> String? {
        guard let value else { return nil }
        let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? nil : cleaned
    }
}
