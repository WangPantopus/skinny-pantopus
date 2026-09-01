//
//  CreatorInboxViewModel.swift
//  Pantopus
//
//  Backs the P1.2 Creator Inbox screen. Loads the owner persona +
//  followers DM threads from the same endpoints the Audience Profile
//  Threads tab uses (`/api/personas/me` + `/api/personas/:id/dms/threads`)
//  and projects them into filter-aware row models. Filter chip counts
//  derive from the loaded thread list so they always match what the
//  user sees.
//
//  Row taps route into `PersonaDmThreadView` by (personaId, threadId).
//  They do **not** push generic chat: the persona-DM serializer carries
//  no `user_id` for either side, so there is no counterparty user id to
//  route on (`backend/routes/personaDms.js:56`).
//

import Foundation
import Observation

@Observable
@MainActor
public final class CreatorInboxViewModel {
    public private(set) var state: CreatorInboxState = .loading
    public var activeFilter: CreatorInboxFilter = .all

    private let api: APIClient
    private var threads: [PersonaThreadDTO] = []
    /// Persona whose inbox this is — the `:id` path segment every
    /// `/api/personas/:id/dms/...` call from a row needs.
    private var personaId: String = ""
    private var header = CreatorInboxHeader(
        title: "Creator Inbox",
        handle: nil,
        isCrossPersona: false
    )

    public init() {
        api = .shared
    }

    init(api: APIClient) {
        self.api = api
    }

    public func load() async {
        state = .loading
        do {
            let me: PersonaMeResponse = try await api.request(AudienceProfileEndpoints.me)
            guard let persona = me.persona, let handle = persona.handle else {
                let emptyHeader = CreatorInboxHeader(
                    title: "Creator Inbox",
                    handle: nil,
                    isCrossPersona: false
                )
                header = emptyHeader
                state = .empty(header: emptyHeader)
                return
            }
            let resolvedHeader = CreatorInboxHeader(
                title: "Creator Inbox",
                handle: "@\(handle)",
                isCrossPersona: false
            )
            header = resolvedHeader
            personaId = persona.id
            let response: PersonaThreadsResponse =
                try await api.request(PersonaDmEndpoints.threads(personaId: persona.id))
            threads = response.threads
            rebuild()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load your inbox."
            state = .error(message: message)
        }
    }

    public func refresh() async {
        await load()
    }

    public func selectFilter(_ filter: CreatorInboxFilter) {
        activeFilter = filter
        rebuild()
    }

    /// Resolve a row into the persona-DM thread push.
    ///
    /// The row id **is** the `PersonaDmThread` id — persona DMs carry no
    /// counterparty user id, so there is nothing to fall back to and
    /// nothing that could masquerade as one.
    public func threadDestination(for row: CreatorInboxRowContent) -> CreatorInboxThreadDestination {
        CreatorInboxThreadDestination(
            personaId: row.personaId.isEmpty ? personaId : row.personaId,
            threadId: row.id,
            displayName: row.displayName.isEmpty ? row.handle : row.displayName,
            initials: row.initials,
            verified: row.verifiedLocal,
            tierName: row.tierName ?? "Free",
            tierRank: row.tierRank
        )
    }

    // MARK: - Projection

    private func rebuild() {
        if threads.isEmpty {
            state = .empty(header: header)
            return
        }
        let rows = threads.compactMap { Self.row($0, personaId: personaId) }
        let counts = CreatorInboxCounts(
            total: rows.count,
            unread: rows.filter(\.unread).count,
            flagged: rows.filter(\.flagged).count
        )
        let chips = Self.chips(rows: rows, counts: counts)
        let filtered = rows.filter { Self.matches($0, filter: activeFilter) }
        let loaded = CreatorInboxLoaded(
            header: header,
            rows: filtered,
            counts: counts,
            chips: chips
        )
        state = .loaded(loaded)
    }

    static func chips(rows: [CreatorInboxRowContent], counts: CreatorInboxCounts) -> [CreatorInboxChipContent] {
        let bronzePlus = rows.filter { $0.tierRank >= 2 }.count
        return [
            CreatorInboxChipContent(filter: .all, count: counts.total),
            CreatorInboxChipContent(filter: .unread, count: counts.unread),
            CreatorInboxChipContent(filter: .bronzePlus, count: bronzePlus),
            CreatorInboxChipContent(filter: .flagged, count: counts.flagged)
        ]
    }

    static func matches(_ row: CreatorInboxRowContent, filter: CreatorInboxFilter) -> Bool {
        switch filter {
        case .all: true
        case .unread: row.unread
        case .bronzePlus: row.tierRank >= 2
        case .flagged: row.flagged
        }
    }

    static func row(_ dto: PersonaThreadDTO, personaId: String) -> CreatorInboxRowContent? {
        let handle = dto.fanHandle ?? ""
        let displayName = dto.fanDisplayName ?? (handle.isEmpty ? "Follower" : handle)
        let initials = initials(of: displayName, handle: handle)
        return CreatorInboxRowContent(
            id: dto.id,
            displayName: displayName,
            handle: handle.isEmpty ? "" : "@\(handle)",
            initials: initials,
            avatarUrl: dto.fanAvatarUrl,
            tierName: dto.tier?.name,
            tierRank: dto.tier?.rank ?? 1,
            preview: dto.lastMessagePreview ?? "",
            timeAgo: timeAgo(from: dto.lastMessageAt),
            unread: (dto.unreadCount ?? 0) > 0,
            flagged: dto.flagged ?? false,
            verifiedLocal: dto.verifiedLocal ?? false,
            counterpartyUserId: dto.counterpartyUserId,
            personaChip: nil,
            personaId: personaId,
            membershipId: dto.membershipId
        )
    }

    static func initials(of name: String, handle: String) -> String {
        let source = name.isEmpty ? handle : name
        let parts = source.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        if !letters.isEmpty { return letters }
        return String(source.prefix(2)).uppercased()
    }

    static func timeAgo(from iso: String?) -> String {
        guard let iso, let date = ISO8601DateFormatter().date(from: iso) else { return "" }
        let interval = Date().timeIntervalSince(date)
        let minutes = Int(interval / 60)
        if minutes < 1 { return "Just now" }
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        if days < 7 { return days == 1 ? "Yesterday" : "\(days)d" }
        let weeks = days / 7
        return "\(weeks)w"
    }
}
