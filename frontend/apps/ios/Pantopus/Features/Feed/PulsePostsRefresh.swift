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

/// One post's new values after an action on its own page, or that it is gone.
/// The feed changes that card where it is (as web's `patchPostInFeedCaches`
/// does) instead of reading its first page again, which dropped the pages
/// below and the reader's place.
public struct PulsePostChange: Sendable {
    public let postId: String
    public var removed = false
    /// An Event's Going.
    public var isGoing: Bool?
    public var goingCount: Int?
    /// Every other post's emoji reactions.
    public var reactions: PostReactions?
    public var isSaved: Bool?
    public var commentCount: Int?

    public init(postId: String) {
        self.postId = postId
    }
}

public enum PulsePostsRefresh {
    /// Where `notifyPostChanged` puts its `PulsePostChange` in the notification.
    public static let changeKey = "change"

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

    /// One post changed on its own page: a list showing it changes that row in
    /// place (My posts still refetches); the store's copies are marked out of
    /// date as above.
    @MainActor
    public static func notifyPostChanged(_ change: PulsePostChange) {
        ScreenStore.shared.markStale(topics: [ScreenTopic.posts, ScreenTopic.post(change.postId)])
        NotificationCenter.default.post(name: .pulsePostsDidChange, object: nil, userInfo: [changeKey: change])
    }
}
