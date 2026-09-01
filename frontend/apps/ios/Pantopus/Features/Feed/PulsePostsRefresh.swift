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
    public static func notifyPostsDidChange() {
        NotificationCenter.default.post(name: .pulsePostsDidChange, object: nil)
    }
}
