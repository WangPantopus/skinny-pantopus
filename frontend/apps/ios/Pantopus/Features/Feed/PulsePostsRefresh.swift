//
//  PulsePostsRefresh.swift
//  Pantopus
//
//  Broadcast when a Pulse post is created or edited so feed + My Posts
//  lists refetch without holding shared view-model references.
//

import Foundation

public extension Notification.Name {
    static let pulsePostsDidChange = Notification.Name("pulsePostsDidChange")
}

public enum PulsePostsRefresh {
    /// Lists on screen refetch; the store's copies of post lists are marked
    /// out of date, so a list opened later reads again too.
    @MainActor
    public static func notifyPostsDidChange() {
        ScreenStore.shared.markStale(topics: [ScreenTopic.posts])
        NotificationCenter.default.post(name: .pulsePostsDidChange, object: nil)
    }
}
