//
//  FindHomeViewModel.swift
//  Pantopus
//
//  A12.1 "Find or Add Home" discovery. Mirrors RN
//  `src/app/homes/find.tsx`:
//
//    • search public-preview homes by address  → GET /api/homes/discover
//    • tap a result                            → start an ownership claim
//    • empty state                             → "Add missing address"
//    • manual invite-code box                  → GET /api/homes/invitations/token/:token
//                                                then hand off to TokenAccept
//

import Foundation
import Observation

/// Render states for the discovery result area.
public enum FindHomeState: Sendable, Equatable {
    /// Query is shorter than the backend's 2-character minimum.
    case idle(hint: String?)
    case loading
    case loaded([DiscoveredHomeDTO])
    case empty
    case error(message: String)
}

/// Outbound navigation the host nav-stack performs.
public enum FindHomeOutboundEvent: Sendable, Equatable {
    /// Tapping a discovered home starts the ownership-claim wizard.
    case openClaimOwnership(homeId: String)
    /// Empty-state / "add manually" CTA → the Add Home wizard.
    case openAddHome
    /// Invite code resolved — hand the raw token to the shared
    /// TokenAccept surface.
    case openInviteToken(token: String)
}

@Observable
@MainActor
final class FindHomeViewModel {
    /// Minimum query length the backend accepts
    /// (`backend/routes/home.js:2308`).
    static let minimumQueryLength = 2

    // MARK: - Published state

    private(set) var state: FindHomeState = .idle(hint: nil)
    private(set) var query: String = ""

    /// Whether the collapsible invite-code drawer is open.
    var isInviteSectionExpanded: Bool = false
    private(set) var inviteCode: String = ""

    private(set) var isResolvingInvite: Bool = false
    private(set) var inviteError: String?

    var pendingEvent: FindHomeOutboundEvent?

    // MARK: - Dependencies

    private let api: APIClient
    private var searchTask: Task<Void, Never>?

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - Search

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// "Type 1 more character to search homes" — mirrors RN's
    /// `formatThresholdHint`.
    private var thresholdHint: String? {
        let remaining = Self.minimumQueryLength - trimmedQuery.count
        guard remaining > 0, !trimmedQuery.isEmpty else { return nil }
        let noun = remaining == 1 ? "character" : "characters"
        return "Type \(remaining) more \(noun) to search homes"
    }

    func updateQuery(_ value: String) {
        query = value
        queryDidChange()
    }

    func updateInviteCode(_ value: String) {
        inviteCode = value
        if inviteError != nil { inviteError = nil }
    }

    private func queryDidChange() {
        searchTask?.cancel()
        guard trimmedQuery.count >= Self.minimumQueryLength else {
            state = .idle(hint: thresholdHint)
            return
        }
        state = .loading
        searchTask = Task { [weak self] in
            // 250ms debounce so every keystroke doesn't hit the API.
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self?.search()
        }
    }

    /// Explicit submit (keyboard "Search") — bypasses the debounce.
    func submitSearch() {
        searchTask?.cancel()
        guard trimmedQuery.count >= Self.minimumQueryLength else {
            state = .idle(hint: thresholdHint)
            return
        }
        state = .loading
        searchTask = Task { [weak self] in await self?.search() }
    }

    func refresh() async {
        guard trimmedQuery.count >= Self.minimumQueryLength else {
            state = .idle(hint: thresholdHint)
            return
        }
        await search()
    }

    private func search() async {
        let term = trimmedQuery
        do {
            let response: HomeDiscoverResponse = try await api.request(
                HomeDiscoveryEndpoints.discover(query: term)
            )
            guard !Task.isCancelled, term == trimmedQuery else { return }
            state = response.homes.isEmpty ? .empty : .loaded(response.homes)
        } catch {
            guard !Task.isCancelled else { return }
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't search homes. Try again."
            )
        }
    }

    func clearQuery() {
        searchTask?.cancel()
        query = ""
        state = .idle(hint: nil)
    }

    // MARK: - Intents

    func selectHome(_ home: DiscoveredHomeDTO) {
        pendingEvent = .openClaimOwnership(homeId: home.id)
    }

    func addMissingHome() {
        pendingEvent = .openAddHome
    }

    func toggleInviteSection() {
        isInviteSectionExpanded.toggle()
        if !isInviteSectionExpanded { inviteError = nil }
    }

    /// Resolve the pasted invite code, then hand the token to the shared
    /// TokenAccept surface. Never duplicates TokenAccept's own accept /
    /// decline calls.
    func submitInviteCode() async {
        let token = inviteCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty, !isResolvingInvite else { return }
        isResolvingInvite = true
        inviteError = nil
        defer { isResolvingInvite = false }
        do {
            let response: HomeInviteResponse = try await api.request(
                TokenAcceptEndpoints.homeInvite(token: token)
            )
            if response.expired == true {
                inviteError = "That invite has expired. Ask for a new one."
                return
            }
            if response.alreadyUsed == true {
                inviteError = "That invite was already used."
                return
            }
            guard response.invitation != nil else {
                inviteError = "We couldn't find that invite code."
                return
            }
            pendingEvent = .openInviteToken(token: token)
        } catch {
            inviteError = (error as? APIError)?.errorDescription
                ?? "We couldn't find that invite code."
        }
    }

    func acknowledgePendingEvent() {
        pendingEvent = nil
    }
}
