//
//  ActiveChatThreadTracker.swift
//  Pantopus
//
//  Tracks which chat rooms the user is currently viewing so the push
//  layer can suppress in-app banners for messages the user is already
//  reading. The conversation view-model registers its active room ids
//  (a person thread aggregates every shared room) and withdraws them on
//  teardown; `AppDelegate.willPresent` consults `isViewingRoom` for the
//  `room_id` the backend attaches to chat pushes
//  (`backend/routes/chats.js:1837`).
//

import Foundation

/// Registry of room ids visible in currently-mounted conversation
/// screens. Entries are keyed per owner (the VM instance) because
/// NavigationStack delivers the next screen's `onAppear` before the
/// previous screen's `onDisappear` — a flat set cleared on teardown
/// would wipe the new thread's registration.
@MainActor
public final class ActiveChatThreadTracker {
    public static let shared = ActiveChatThreadTracker()

    private var roomIdsByOwner: [ObjectIdentifier: Set<String>] = [:]

    public init() {}

    /// Replace the set of rooms an owner (one conversation VM) is viewing.
    public func setActiveRooms(_ roomIds: Set<String>, owner: ObjectIdentifier) {
        roomIdsByOwner[owner] = roomIds
    }

    /// Withdraw an owner's registration (conversation screen torn down).
    public func clear(owner: ObjectIdentifier) {
        roomIdsByOwner[owner] = nil
    }

    /// Whether any mounted conversation screen is showing this room.
    public func isViewingRoom(_ roomId: String) -> Bool {
        roomIdsByOwner.values.contains { $0.contains(roomId) }
    }
}
