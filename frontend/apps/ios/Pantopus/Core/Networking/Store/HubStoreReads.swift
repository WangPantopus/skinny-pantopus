//
//  HubStoreReads.swift
//  Pantopus
//
//  `GET /api/hub` through the screen store. The Hub and Recent activity read
//  the same overview, so they share one copy, one kind and one set of topics.
//

import Foundation

@MainActor
enum HubStoreReads {
    static var overview: Endpoint {
        HubEndpoints.overview()
    }

    /// The overview is the account's own Homes-level summary: the Homes
    /// window (2 minutes), marked out of date by any of its parts changing.
    static let kind: ScreenDataKind = .homes
    static let topics: Set<String> = [ScreenTopic.homes, ScreenTopic.notifications, ScreenTopic.chats, ScreenTopic.today]
}
