package app.pantopus.android.data.feed

import app.pantopus.android.data.api.models.feed.FeedMuteEntityType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One muted author — a user or a business. Mirrors RN's `MutedEntity`
 * (`src/contexts/PantopusContext.tsx:130`) and iOS `FeedMutedEntity`.
 */
data class FeedMutedEntity(
    val entityType: FeedMuteEntityType,
    val entityId: String,
)

/**
 * App-wide client-side mute / hide layer.
 *
 * RN keeps this in `PantopusProvider` — `mutedEntities` (users *and*
 * businesses) plus `hiddenPostIds`, exposed through `useFeedPrefs`
 * (`src/contexts/PantopusContext.tsx:160-164, 869-884`) — so a mute or a hide
 * takes effect across the whole app the instant it is made, before any
 * refetch and without waiting for the server to start filtering.
 *
 * Native had the same optimistic filter but scoped to a single
 * `PulseFeedViewModel` instance, so muting an author on Nearby left their
 * posts on Connections / Beacon Updates, and hiding a post un-hid it the
 * moment the surface toggled (`selectSurface` cleared the local set). This
 * store lifts that state to the process, exactly like RN's context.
 *
 * Session-scoped by design: RN's context state is memory-only too, and the
 * server owns the durable mute list. [clear] runs on sign-out.
 *
 * iOS mirrors this with `Features/Feed/FeedModerationStore.swift`.
 */
@Singleton
class FeedModerationStore
    @Inject
    constructor() {
        /** Muted authors, both kinds. RN's `mutedEntities`. */
        private val _mutedEntities = MutableStateFlow<Set<FeedMutedEntity>>(emptySet())
        val mutedEntities: StateFlow<Set<FeedMutedEntity>> = _mutedEntities.asStateFlow()

        /** Posts the viewer hid. RN's `hiddenPostIds`. */
        private val _hiddenPostIds = MutableStateFlow<Set<String>>(emptySet())
        val hiddenPostIds: StateFlow<Set<String>> = _hiddenPostIds.asStateFlow()

        fun isMuted(
            entityType: FeedMuteEntityType,
            entityId: String,
        ): Boolean = FeedMutedEntity(entityType, entityId) in _mutedEntities.value

        fun isHidden(postId: String): Boolean = postId in _hiddenPostIds.value

        /**
         * Whether a feed row survives the mute/hide layer. Business authorship
         * wins when both ids are present — that is the identity the mute call
         * sends.
         */
        fun isVisible(
            postId: String,
            userId: String?,
            businessAuthorId: String?,
        ): Boolean {
            if (isHidden(postId)) return false
            if (businessAuthorId != null && isMuted(FeedMuteEntityType.Business, businessAuthorId)) return false
            if (userId != null && isMuted(FeedMuteEntityType.User, userId)) return false
            return true
        }

        fun addMute(
            entityType: FeedMuteEntityType,
            entityId: String,
        ) {
            _mutedEntities.value = _mutedEntities.value + FeedMutedEntity(entityType, entityId)
        }

        fun removeMute(
            entityType: FeedMuteEntityType,
            entityId: String,
        ) {
            _mutedEntities.value = _mutedEntities.value - FeedMutedEntity(entityType, entityId)
        }

        fun addHiddenPost(postId: String) {
            _hiddenPostIds.value = _hiddenPostIds.value + postId
        }

        fun removeHiddenPost(postId: String) {
            _hiddenPostIds.value = _hiddenPostIds.value - postId
        }

        /**
         * Drop everything — called on sign-out so one account's mutes never
         * filter another's feed.
         */
        fun clear() {
            _mutedEntities.value = emptySet()
            _hiddenPostIds.value = emptySet()
        }
    }
