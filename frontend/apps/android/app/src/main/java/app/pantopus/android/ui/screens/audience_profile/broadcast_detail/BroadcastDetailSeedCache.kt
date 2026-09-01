@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.audience_profile.broadcast_detail

import app.pantopus.android.ui.screens.audience_profile.TierBreakdownContent
import app.pantopus.android.ui.screens.audience_profile.UpdateCardContent
import javax.inject.Inject
import javax.inject.Singleton

/**
 * P1.3 — single-entry in-memory cache that carries the broadcast
 * seed (the tapped update card + the persona's tier ladder) across
 * the navigation hop from [AudienceProfileScreen] into
 * [BroadcastDetailScreen]. iOS passes the same payload as the route's
 * associated value; on Android, routes are strings, so the seed
 * piggybacks on a Hilt-scoped singleton that the source screen sets
 * before navigating and the destination view-model consumes on init.
 *
 * `consume` returns the seed only if the requested broadcastId matches
 * the cached entry — guarding against stale seeds when the user
 * back-navigates and taps a different card.
 */
@Singleton
class BroadcastDetailSeedCache
    @Inject
    constructor() {
        data class Seed(
            val broadcastId: String,
            val card: UpdateCardContent,
            val tiers: List<TierBreakdownContent.TierSegment>,
        )

        @Volatile
        private var cached: Seed? = null

        /** Cache the seed for the next navigation hop. */
        fun cache(seed: Seed) {
            cached = seed
        }

        /** Read-and-clear the seed if it matches the requested id. */
        fun consume(broadcastId: String): Seed? {
            val current = cached
            cached = null
            return current?.takeIf { it.broadcastId == broadcastId }
        }
    }
