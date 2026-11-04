//
//  InboxConversationDestination+Profile.swift
//  Pantopus
//
//  The DM a profile's Message button opens, and the chat screen's inputs for
//  a destination, for stacks that had no chat route of their own (Nearby's
//  Pulse, Plans). The older stacks keep their own copies of the mapping.
//

import Foundation

extension InboxConversationDestination {
    /// Current inbox and room payloads may omit identity_kind. Resolve that
    /// through the same public profile read/cache the profile screen uses.
    @MainActor
    func profileRoute(userId: String) async throws -> InboxRoute? {
        if identityKind == "business" { return .businessProfile(businessId: userId) }
        let scope = HomeClaimSessionScope(api: .shared)
        let store = ScreenStore.store(for: .shared)
        let generation = store.generation
        do {
            let profile = try await store.load(
                PublicProfileEndpoints.profile(id: userId), as: PublicProfile.self, kind: .otherPeople
            ).value
            guard scope.isCurrent, store.generation == generation, !Task.isCancelled else { return nil }
            return profile.accountType == "business"
                ? .businessProfile(businessId: userId)
                : .publicProfile(userId: userId)
        } catch {
            guard scope.isCurrent, store.generation == generation, !Task.isCancelled else { return nil }
            throw error
        }
    }

    /// A one-to-one chat with the person a profile shows.
    static func directMessage(with profile: PublicProfile) -> InboxConversationDestination {
        let parts = profile.displayName.split(separator: " ").prefix(2)
        let initials = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return InboxConversationDestination(
            mode: .person(otherUserId: profile.id),
            displayName: profile.displayName,
            initials: initials.isEmpty ? "··" : initials,
            identityKind: profile.accountType == "business" ? "business" : nil,
            verified: profile.hasVerifiedResidency
        )
    }

    /// The thread the chat view-model opens.
    var threadMode: ChatThreadMode {
        switch mode {
        case .ai: .ai
        case let .room(id): .room(id: id)
        case let .person(otherUserId): .person(otherUserId: otherUserId)
        }
    }

    /// Who the chat header names.
    var counterparty: ChatCounterparty {
        switch mode {
        case .ai:
            .ai(name: displayName)
        case .room:
            .group(name: displayName, memberCount: nil)
        case .person:
            .person(name: displayName, initials: initials, locality: nil, verified: verified, online: false)
        }
    }
}
