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
    /// out of date, so a list opened later reads again too. A saved post's
    /// `postId` marks its own page's copy as well, so going back to that
    /// page after an edit shows the saved values.
    @MainActor
    public static func notifyPostsDidChange(postId: String? = nil) {
        var topics: Set<String> = [ScreenTopic.posts]
        if let postId { topics.insert(ScreenTopic.post(postId)) }
        ScreenStore.shared.markStale(topics: topics)
        NotificationCenter.default.post(name: .pulsePostsDidChange, object: nil)
    }
}
