@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.audience_profile.broadcast_detail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.ui.screens.audience_profile.TierBreakdownContent
import app.pantopus.android.ui.screens.audience_profile.UpdateCardContent
import app.pantopus.android.ui.screens.audience_profile.UpdateVisibility
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors `BroadcastDetailViewModelTests` (iOS): seed → loaded;
 * missing seed → error; analytics cells cover delivered/read/reactions/
 * replies; tier breakdown sums to seed.readCount with no rounding drift.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class BroadcastDetailViewModelTest {
    private val seedCache = BroadcastDetailSeedCache()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun seedCard(
        delivered: Int = 1247,
        read: Int = 892,
    ): UpdateCardContent =
        UpdateCardContent(
            id = "b_demo",
            body = "Today's loaf has a crumb you could read poetry through.",
            timeAgo = "Today · 9:14am",
            visibility = UpdateVisibility.Public,
            targetTierRank = null,
            deliveredCount = delivered,
            readCount = read,
        )

    private fun tiers(): List<TierBreakdownContent.TierSegment> =
        listOf(
            TierBreakdownContent.TierSegment("t1", 1, "Followers", 374),
            TierBreakdownContent.TierSegment("t2", 2, "Members", 276),
            TierBreakdownContent.TierSegment("t3", 3, "Insiders", 160),
            TierBreakdownContent.TierSegment("t4", 4, "Direct", 82),
        )

    private fun makeVm(broadcastId: String = "b_demo"): BroadcastDetailViewModel {
        val handle =
            SavedStateHandle().apply {
                set(BROADCAST_DETAIL_ID_KEY, broadcastId)
            }
        return BroadcastDetailViewModel(handle, seedCache)
    }

    @Test
    fun load_with_seed_transitions_to_loaded() =
        runTest {
            seedCache.cache(
                BroadcastDetailSeedCache.Seed(broadcastId = "b_demo", card = seedCard(), tiers = tiers()),
            )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is BroadcastDetailUiState.Loaded)
            val loaded = (state as BroadcastDetailUiState.Loaded).content
            assertEquals("b_demo", loaded.broadcastId)
            assertEquals("All beacons", loaded.hero.visibilityLabel)
        }

    @Test
    fun load_without_seed_transitions_to_error() =
        runTest {
            val vm = makeVm("b_missing")
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Error, got $state", state is BroadcastDetailUiState.Error)
        }

    @Test
    fun analytics_cells_cover_delivered_read_reactions_replies() =
        runTest {
            seedCache.cache(
                BroadcastDetailSeedCache.Seed(broadcastId = "b_demo", card = seedCard(), tiers = tiers()),
            )
            val vm = makeVm()
            vm.load()
            val cells = (vm.state.value as BroadcastDetailUiState.Loaded).content.analyticsCells
            assertEquals(4, cells.size)
            assertEquals("delivered", cells[0].id)
            assertEquals("read", cells[1].id)
            assertEquals("reactions", cells[2].id)
            assertEquals("replies", cells[3].id)
            // 892 / 1247 ≈ 71.5% → roundToInt = 72
            assertEquals("72%", cells[1].sub)
        }

    @Test
    fun tier_breakdown_segments_sum_to_seed_read_count() =
        runTest {
            seedCache.cache(
                BroadcastDetailSeedCache.Seed(broadcastId = "b_demo", card = seedCard(), tiers = tiers()),
            )
            val vm = makeVm()
            vm.load()
            val breakdown =
                (vm.state.value as BroadcastDetailUiState.Loaded).content.tierBreakdown
            assertEquals(4, breakdown.segments.size)
            assertEquals(892, breakdown.total)
            assertEquals(892, breakdown.segments.sumOf { it.count })
        }

    @Test
    fun tier_breakdown_with_zero_audience_produces_zeroed_segments() =
        runTest {
            val zeroed =
                listOf(
                    TierBreakdownContent.TierSegment("t1", 1, "Followers", 0),
                    TierBreakdownContent.TierSegment("t2", 2, "Members", 0),
                )
            seedCache.cache(
                BroadcastDetailSeedCache.Seed(broadcastId = "b_demo", card = seedCard(), tiers = zeroed),
            )
            val vm = makeVm()
            vm.load()
            val breakdown =
                (vm.state.value as BroadcastDetailUiState.Loaded).content.tierBreakdown
            assertEquals(0, breakdown.total)
            assertTrue(breakdown.segments.all { it.count == 0 })
        }

    @Test
    fun replies_start_empty_for_freshly_loaded_broadcast() =
        runTest {
            seedCache.cache(
                BroadcastDetailSeedCache.Seed(broadcastId = "b_demo", card = seedCard(), tiers = tiers()),
            )
            val vm = makeVm()
            vm.load()
            val loaded = (vm.state.value as BroadcastDetailUiState.Loaded).content
            assertTrue(loaded.replies.isEmpty())
            assertEquals(0, loaded.totalReplies)
        }

    @Test
    fun seed_cache_consume_returns_null_for_mismatched_id() {
        val cache = BroadcastDetailSeedCache()
        cache.cache(BroadcastDetailSeedCache.Seed(broadcastId = "a", card = seedCard(), tiers = tiers()))
        assertEquals(null, cache.consume("b"))
        // The seed should still be consumed even on a mismatched id (read-and-clear).
        cache.cache(BroadcastDetailSeedCache.Seed(broadcastId = "a", card = seedCard(), tiers = tiers()))
        assertEquals(null, cache.consume("b"))
        assertEquals(null, cache.consume("a"))
    }
}
