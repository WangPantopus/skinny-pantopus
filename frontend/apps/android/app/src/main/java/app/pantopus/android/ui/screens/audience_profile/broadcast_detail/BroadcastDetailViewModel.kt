@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.audience_profile.broadcast_detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.ui.screens.audience_profile.TierBreakdownContent
import app.pantopus.android.ui.screens.audience_profile.UpdateCardContent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.floor
import kotlin.math.roundToInt

/** Nav-arg key for the broadcast id read off the back-stack handle. */
const val BROADCAST_DETAIL_ID_KEY = "broadcastId"

/**
 * P1.3 — Backs the Broadcast detail full-screen takeover. The route
 * carries only the broadcast id (`broadcasts/{broadcastId}`); the
 * tapped row's snapshot (visibility, body, counts) + the persona's
 * tier ladder hop across the navigation boundary via
 * [BroadcastDetailSeedCache]. Without a seed (e.g. deep-link, or the
 * cache was cleared by an intervening pop), the VM lands in
 * `.Error` — once the backend exposes a per-broadcast detail route
 * the fetch will replace the seed-projection fallback.
 */
@HiltViewModel
class BroadcastDetailViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val seedCache: BroadcastDetailSeedCache,
    ) : ViewModel() {
        private val broadcastId: String =
            savedStateHandle[BROADCAST_DETAIL_ID_KEY]
                ?: error("BROADCAST_DETAIL_ID_KEY missing from SavedStateHandle")

        private val _state = MutableStateFlow<BroadcastDetailUiState>(BroadcastDetailUiState.Loading)
        val state: StateFlow<BroadcastDetailUiState> = _state.asStateFlow()

        fun load() {
            _state.value = BroadcastDetailUiState.Loading
            viewModelScope.launch {
                val seed = seedCache.consume(broadcastId)
                if (seed == null) {
                    _state.value = BroadcastDetailUiState.Error("Couldn't load this broadcast.")
                    return@launch
                }
                _state.value =
                    BroadcastDetailUiState.Loaded(
                        project(
                            broadcastId = broadcastId,
                            card = seed.card,
                            tiers = seed.tiers,
                        ),
                    )
            }
        }

        companion object {
            internal fun project(
                broadcastId: String,
                card: UpdateCardContent,
                tiers: List<TierBreakdownContent.TierSegment>,
            ): BroadcastDetailLoaded {
                val hero =
                    BroadcastDetailHero(
                        body = card.body,
                        visibility = card.visibility,
                        targetTierRank = card.targetTierRank,
                        timestamp = card.timeAgo,
                        mediaUrl = null,
                    )
                return BroadcastDetailLoaded(
                    broadcastId = broadcastId,
                    hero = hero,
                    analyticsCells = analyticsCells(card),
                    tierBreakdown = tierBreakdown(card, tiers),
                    replies = emptyList(),
                    totalReplies = 0,
                )
            }

            private fun analyticsCells(card: UpdateCardContent): List<BroadcastAnalyticsCell> {
                val readRate: String? =
                    if (card.deliveredCount > 0) {
                        val pct = ((card.readCount.toDouble() / card.deliveredCount.toDouble()) * 100.0).roundToInt()
                        "$pct%"
                    } else {
                        null
                    }
                return listOf(
                    BroadcastAnalyticsCell(id = "delivered", label = "Delivered", value = shortCount(card.deliveredCount)),
                    BroadcastAnalyticsCell(id = "read", label = "Read", value = shortCount(card.readCount), sub = readRate),
                    BroadcastAnalyticsCell(id = "reactions", label = "Reactions", value = "0"),
                    BroadcastAnalyticsCell(id = "replies", label = "Replies", value = "0"),
                )
            }

            /**
             * Largest-remainder allocation across the persona's tier
             * ladder so the segments sum back to [card.readCount]
             * exactly (no half-integer drift in the rendered bar).
             */
            internal fun tierBreakdown(
                card: UpdateCardContent,
                tiers: List<TierBreakdownContent.TierSegment>,
            ): BroadcastTierBreakdown {
                if (tiers.isEmpty()) return BroadcastTierBreakdown(total = 0, segments = emptyList())
                val audienceTotal = tiers.sumOf { it.count }
                if (audienceTotal <= 0) {
                    val zeroed =
                        tiers.map {
                            BroadcastTierBreakdown.Segment(
                                id = it.id,
                                rank = it.rank,
                                name = it.name,
                                count = 0,
                            )
                        }
                    return BroadcastTierBreakdown(total = 0, segments = zeroed)
                }
                val read = card.readCount.coerceAtLeast(0)
                val exacts = tiers.map { (it.count.toDouble() / audienceTotal.toDouble()) * read.toDouble() }
                val floors = exacts.map { floor(it).toInt() }
                val counts = floors.toMutableList()
                var remaining = read - floors.sum()
                if (remaining > 0) {
                    val sorted =
                        exacts.mapIndexed { index, value -> index to (value - floor(value)) }
                            .sortedByDescending { it.second }
                    for ((index, _) in sorted) {
                        if (remaining <= 0) break
                        counts[index] = counts[index] + 1
                        remaining -= 1
                    }
                }
                val segments =
                    tiers.mapIndexed { index, tier ->
                        BroadcastTierBreakdown.Segment(
                            id = tier.id,
                            rank = tier.rank,
                            name = tier.name,
                            count = counts[index],
                        )
                    }
                return BroadcastTierBreakdown(total = segments.sumOf { it.count }, segments = segments)
            }

            private fun shortCount(count: Int): String {
                if (count < 1_000) return "$count"
                val thousands = count / 1_000.0
                if (count < 10_000) {
                    return String.format(java.util.Locale.US, "%.1fK", thousands)
                }
                return "${thousands.roundToInt()}K"
            }
        }
    }
