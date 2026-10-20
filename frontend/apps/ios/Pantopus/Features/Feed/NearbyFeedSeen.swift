//
//  NearbyFeedSeen.swift
//  Pantopus
//
//  The Nearby feed tells the server it was seen (AI assistant phase 2
//  contract §6.1): `POST /api/posts/feed/seen` once its posts are on screen,
//  at most every 5 minutes per account. The assistant's "What did I miss?"
//  and the morning brief catch up from that moment.
//

import Foundation

@MainActor
enum NearbyFeedSeen {
    static let interval: TimeInterval = 5 * 60
    /// When each account last marked it, this launch.
    private static var lastMarked: [String: Date] = [:]

    static func feedShown(api: APIClient = .shared, now: Date = Date()) async {
        guard case let .signedIn(user) = AuthManager.shared.state else { return }
        if let last = lastMarked[user.id], now.timeIntervalSince(last) < interval { return }
        // Counted before the call: a server without the route isn't asked on every showing.
        lastMarked[user.id] = now
        // A missed mark only makes the next catch-up a little longer.
        _ = try? await api.requestDataResponse(PostsEndpoints.feedSeen())
    }
}
