//
//  FeedModerationStore.swift
//  Pantopus
//
//  App-wide client-side mute / hide layer.
//
//  RN keeps this in `PantopusProvider` — `mutedEntities` (users *and*
//  businesses) plus `hiddenPostIds`, exposed through `useFeedPrefs`
//  (`src/contexts/PantopusContext.tsx:160-164, 869-884`) — so a mute or a
//  hide takes effect across the whole app the instant it is made, before any
//  refetch and without waiting for the server to start filtering.
//
//  Native had the same optimistic filter but scoped to a single
//  `PulseFeedViewModel` instance, so muting an author on Nearby left their
//  posts on Connections / Beacon Updates, and hiding a post un-hid it the
//  moment the surface toggled (`selectSurface` cleared the local set). This
//  store lifts that state to the session, exactly like RN's context.
//
//  Session-scoped by design: RN's context state is memory-only too, and the
//  server owns the durable mute list. `clear()` runs on sign-out.
//
//  Android mirrors this with `data/feed/FeedModerationStore.kt`.
//

import Foundation
import Observation

/// One muted author — a user or a business. Mirrors RN's `MutedEntity`
/// (`PantopusContext.tsx:130`).
public struct FeedMutedEntity: Hashable, Sendable {
    public let entityType: FeedMuteEntityType
    public let entityId: String

    public init(entityType: FeedMuteEntityType, entityId: String) {
        self.entityType = entityType
        self.entityId = entityId
    }
}

@Observable
@MainActor
public final class FeedModerationStore {
    public static let shared = FeedModerationStore()

    /// Muted authors, both kinds. RN's `mutedEntities`.
    public private(set) var mutedEntities: Set<FeedMutedEntity> = []
    /// Posts the viewer hid. RN's `hiddenPostIds`.
    public private(set) var hiddenPostIds: Set<String> = []

    public init() {}

    // MARK: - Reads

    public func isMuted(entityType: FeedMuteEntityType, entityId: String) -> Bool {
        mutedEntities.contains(FeedMutedEntity(entityType: entityType, entityId: entityId))
    }

    public func isHidden(postId: String) -> Bool {
        hiddenPostIds.contains(postId)
    }

    /// Whether a feed row survives the mute/hide layer. Business authorship
    /// wins when both ids are present — that is the identity the mute call
    /// sends.
    public func isVisible(postId: String, userId: String?, businessAuthorId: String?) -> Bool {
        if hiddenPostIds.contains(postId) { return false }
        if let businessAuthorId, isMuted(entityType: .business, entityId: businessAuthorId) {
            return false
        }
        if let userId, isMuted(entityType: .user, entityId: userId) { return false }
        return true
    }

    // MARK: - Writes

    public func addMute(entityType: FeedMuteEntityType, entityId: String) {
        mutedEntities.insert(FeedMutedEntity(entityType: entityType, entityId: entityId))
    }

    public func removeMute(entityType: FeedMuteEntityType, entityId: String) {
        mutedEntities.remove(FeedMutedEntity(entityType: entityType, entityId: entityId))
    }

    public func addHiddenPost(_ postId: String) {
        hiddenPostIds.insert(postId)
    }

    public func removeHiddenPost(_ postId: String) {
        hiddenPostIds.remove(postId)
    }

    /// Drop everything — called on sign-out so one account's mutes never
    /// filter another's feed.
    public func clear() {
        mutedEntities = []
        hiddenPostIds = []
    }
}
