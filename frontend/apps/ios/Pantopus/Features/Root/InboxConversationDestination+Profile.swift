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
    /// A one-to-one chat with the person a profile shows.
    static func directMessage(with profile: PublicProfile) -> InboxConversationDestination {
        let parts = profile.displayName.split(separator: " ").prefix(2)
        let initials = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return InboxConversationDestination(
            mode: .person(otherUserId: profile.id),
            displayName: profile.displayName,
            initials: initials.isEmpty ? "··" : initials,
            identityKind: nil,
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
