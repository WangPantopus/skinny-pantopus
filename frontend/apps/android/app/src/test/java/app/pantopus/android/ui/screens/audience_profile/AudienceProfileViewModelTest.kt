@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.audience_profile

import app.pantopus.android.data.api.models.audience.AudienceCountsDto
import app.pantopus.android.data.api.models.audience.AudienceListResponse
import app.pantopus.android.data.api.models.audience.BroadcastChannelDto
import app.pantopus.android.data.api.models.audience.BroadcastMessageDto
import app.pantopus.android.data.api.models.audience.FanDto
import app.pantopus.android.data.api.models.audience.FanTierBadgeDto
import app.pantopus.android.data.api.models.audience.MembershipStatsCountsDto
import app.pantopus.android.data.api.models.audience.MembershipStatsResponse
import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaPostDto
import app.pantopus.android.data.api.models.audience.PersonaPostsResponse
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PersonaThreadDto
import app.pantopus.android.data.api.models.audience.PersonaThreadsResponse
import app.pantopus.android.data.api.models.audience.PersonaTierDto
import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.audience.PublishUpdateBody
import app.pantopus.android.data.api.models.audience.PublishUpdateResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import app.pantopus.android.ui.screens.audience_profile.broadcast_detail.BroadcastDetailSeedCache
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors [AudienceProfileViewModelTests] (iOS): load → loaded /
 * empty / error, composer canSubmit gating, optimistic clear on
 * post success, error on post failure, tier filter narrows the
 * follower list, and the projection hits all branches (Live tier
 * label, persona-count fallback, etc.).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AudienceProfileViewModelTest {
    private val repository: AudienceProfileRepository = mockk()
    private val seedCache: BroadcastDetailSeedCache = BroadcastDetailSeedCache()

    private fun makeVm(): AudienceProfileViewModel = AudienceProfileViewModel(repository, seedCache)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun fullPersona(): PersonaSummaryDto =
        PersonaSummaryDto(
            id = "p_demo",
            handle = "mayabuilds",
            displayName = "Maya Builds",
            audienceLabel = "followers",
            followerCount = 42,
            postCount = 7,
        )

    private fun stubLoaded() {
        coEvery { repository.me() } returns
            NetworkResult.Success(
                PersonaMeResponse(
                    persona = fullPersona(),
                    channel = BroadcastChannelDto(id = "ch_demo", title = "Maya Broadcast", status = "active"),
                ),
            )
        coEvery { repository.audience() } returns
            NetworkResult.Success(
                AudienceListResponse(
                    persona = null,
                    items =
                        listOf(
                            FanDto(
                                membershipId = "m1",
                                fanHandle = "alex",
                                fanDisplayName = "Alex",
                                status = "active",
                                tier = FanTierBadgeDto(rank = 1, name = "Followers"),
                                verifiedLocal = true,
                                tenureMonths = 3,
                                joinedMonth = "2026-02",
                            ),
                            FanDto(
                                membershipId = "m2",
                                fanHandle = "billie",
                                fanDisplayName = "Billie B.",
                                status = "active",
                                tier = FanTierBadgeDto(rank = 2, name = "Members"),
                                tenureMonths = 12,
                                joinedMonth = "2025-05",
                            ),
                            FanDto(
                                membershipId = "m3",
                                fanHandle = "cory",
                                fanDisplayName = "Cory K.",
                                status = "active",
                                tier = FanTierBadgeDto(rank = 3, name = "Insiders"),
                                tenureMonths = 1,
                                joinedMonth = "2026-04",
                            ),
                        ),
                    counts =
                        AudienceCountsDto(
                            totalActive = 12,
                            pending = 3,
                            byTier = mapOf("1" to 8, "2" to 3, "3" to 1, "4" to 0),
                        ),
                ),
            )
        coEvery { repository.posts(any()) } returns
            NetworkResult.Success(
                PersonaPostsResponse(
                    posts =
                        listOf(
                            PersonaPostDto(
                                id = "u1",
                                body = "New mural going up next week.",
                                createdAt = "2026-05-14T18:00:00Z",
                                visibility = "followers",
                                deliveredCount = 40,
                                readCount = 31,
                            ),
                            PersonaPostDto(
                                id = "u2",
                                body = "Workshop seats open.",
                                createdAt = "2026-05-13T09:00:00Z",
                                visibility = "tier_or_above",
                                targetTierRank = 2,
                                deliveredCount = 3,
                                readCount = 2,
                            ),
                        ),
                ),
            )
        coEvery { repository.tiers(any()) } returns
            NetworkResult.Success(
                PersonaTiersResponse(
                    tiers =
                        listOf(
                            PersonaTierDto(id = "t1", rank = 1, name = "Followers", priceCents = 0, currency = "usd"),
                            PersonaTierDto(id = "t2", rank = 2, name = "Members", priceCents = 500, currency = "usd"),
                            PersonaTierDto(id = "t3", rank = 3, name = "Insiders", priceCents = 2500, currency = "usd"),
                        ),
                ),
            )
        coEvery { repository.membershipStats(any()) } returns
            NetworkResult.Success(
                MembershipStatsResponse(
                    counts = MembershipStatsCountsDto(followers = 8, members = 3, insiders = 1, direct = 0),
                ),
            )
        coEvery { repository.threads(any()) } returns
            NetworkResult.Success(
                PersonaThreadsResponse(
                    threads =
                        listOf(
                            PersonaThreadDto(
                                id = "th1",
                                membershipId = "m1",
                                fanHandle = "alex",
                                fanDisplayName = "Alex",
                                tier = FanTierBadgeDto(rank = 2, name = "Members"),
                                lastMessagePreview = "Loved the workshop",
                                lastMessageAt = "2026-05-15T10:00:00Z",
                                unreadCount = 2,
                                flagged = false,
                            ),
                            PersonaThreadDto(
                                id = "th2",
                                membershipId = "m2",
                                fanHandle = "billie",
                                fanDisplayName = "Billie B.",
                                tier = FanTierBadgeDto(rank = 3, name = "Insiders"),
                                lastMessagePreview = "Question on step 4",
                                lastMessageAt = "2026-05-15T08:00:00Z",
                                unreadCount = 1,
                                flagged = true,
                            ),
                            PersonaThreadDto(
                                id = "th3",
                                membershipId = "m3",
                                fanHandle = "junie",
                                fanDisplayName = "Junie L.",
                                tier = FanTierBadgeDto(rank = 1, name = "Followers"),
                                lastMessagePreview = "Following from the market!",
                                lastMessageAt = "2026-05-12T08:00:00Z",
                                unreadCount = 0,
                                flagged = false,
                            ),
                        ),
                ),
            )
    }

    @Test fun load_projects_header_updates_followers_threads() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as AudienceProfileUiState.Loaded
            assertEquals("Maya Builds", loaded.content.header.displayName)
            assertEquals("@mayabuilds", loaded.content.header.handle)
            assertEquals(12, loaded.content.header.followerCount)
            assertEquals(3, loaded.content.header.newThisWeek)
            assertEquals(2, loaded.content.updates.size)
            assertEquals(UpdateVisibility.Followers, loaded.content.updates[0].visibility)
            assertEquals(UpdateVisibility.TierOrAbove, loaded.content.updates[1].visibility)
            assertEquals(2, loaded.content.updates[1].targetTierRank)
            assertEquals(3, loaded.content.followers.size)
            assertEquals(3, loaded.content.followers[0].tenureMonths)
            assertEquals("2026-02", loaded.content.followers[0].joinedMonth)
            assertEquals(3, loaded.content.threads.size)
            assertEquals(2, loaded.content.threads[0].unreadCount)
            assertEquals(2, loaded.content.threads[0].tierRank)
            assertEquals(true, loaded.content.threads.first { it.id == "th2" }.flagged)
            assertEquals("ch_demo", loaded.content.channelId)
        }

    @Test fun load_projects_analytics_cells_and_stacked_bar() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as AudienceProfileUiState.Loaded
            assertEquals(4, loaded.content.analyticsCells.size)
            assertEquals("8", loaded.content.analyticsCells.first { it.id == "followers" }.value)
            assertEquals("0", loaded.content.analyticsCells.first { it.id == "direct" }.value)
            assertEquals(12, loaded.content.tierBreakdown.total)
            assertEquals(3, loaded.content.tierBreakdown.segments.size)
            assertEquals(8, loaded.content.tierBreakdown.segments[0].count)
            assertEquals(4, loaded.content.tierChips.size)
            assertEquals("all", loaded.content.tierChips.first().id)
            assertEquals(12, loaded.content.tierChips.first().count)
        }

    @Test fun empty_persona_transitions_to_empty() =
        runTest {
            coEvery { repository.me() } returns
                NetworkResult.Success(PersonaMeResponse(persona = null, channel = null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is AudienceProfileUiState.Empty)
        }

    @Test fun load_failure_transitions_error() =
        runTest {
            coEvery { repository.me() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is AudienceProfileUiState.Error)
        }

    @Test fun submitUpdate_requires_non_empty_body() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.onComposerText("   ")
            assertTrue(!vm.composer.value.canSubmit)
            vm.submitUpdate()
            assertEquals("   ", vm.composer.value.text)
        }

    @Test fun submitUpdate_tier_or_above_requires_rank() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.onComposerText("Hello tier 2")
            vm.onComposerVisibility(UpdateVisibility.TierOrAbove)
            assertTrue(!vm.composer.value.canSubmit)
            vm.onComposerTier(2)
            assertTrue(vm.composer.value.canSubmit)
        }

    @Test fun submitUpdate_success_clears_composer_and_reloads() =
        runTest {
            stubLoaded()
            val captured = slot<PublishUpdateBody>()
            coEvery { repository.publishUpdate(any(), capture(captured)) } returns
                NetworkResult.Success(
                    PublishUpdateResponse(
                        message = BroadcastMessageDto(id = "new1", body = "Hello", visibility = "followers"),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.onComposerText("Hello")
            vm.onComposerVisibility(UpdateVisibility.Followers)
            vm.submitUpdate()
            assertEquals("", vm.composer.value.text)
            assertNull(vm.composer.value.error)
            assertEquals(false, vm.composer.value.isSubmitting)
            assertEquals("Hello", captured.captured.body)
            assertEquals("followers", captured.captured.visibility)
            assertNull(captured.captured.targetTierRank)
            assertTrue(vm.state.value is AudienceProfileUiState.Loaded)
        }

    @Test fun submitUpdate_failure_populates_error_and_keeps_text() =
        runTest {
            stubLoaded()
            coEvery { repository.publishUpdate(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.onComposerText("Hello")
            vm.submitUpdate()
            assertNotNull(vm.composer.value.error)
            assertEquals(false, vm.composer.value.isSubmitting)
            assertEquals("Hello", vm.composer.value.text)
        }

    @Test fun submitUpdate_tier_or_above_sends_target_rank() =
        runTest {
            stubLoaded()
            val captured = slot<PublishUpdateBody>()
            coEvery { repository.publishUpdate(any(), capture(captured)) } returns
                NetworkResult.Success(PublishUpdateResponse(message = null))
            val vm = makeVm()
            vm.load()
            vm.onComposerText("Members only")
            vm.onComposerVisibility(UpdateVisibility.TierOrAbove)
            vm.onComposerTier(2)
            vm.submitUpdate()
            assertEquals("tier_or_above", captured.captured.visibility)
            assertEquals(2, captured.captured.targetTierRank)
        }

    @Test fun tier_filter_reduces_visible_followers() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            assertEquals(3, vm.visibleFollowers().size)
            vm.selectTierFilter(2)
            assertEquals(1, vm.visibleFollowers().size)
            assertEquals(2, vm.visibleFollowers().first().tierRank)
            vm.selectTierFilter(null)
            assertEquals(3, vm.visibleFollowers().size)
        }

    @Test fun search_filters_followers_by_display_name_and_handle() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.onFollowerSearchText("billie")
            assertEquals(1, vm.visibleFollowers().size)
            assertEquals("@billie", vm.visibleFollowers().first().handle)
            // Display name match (case-insensitive).
            vm.onFollowerSearchText("CoRy")
            assertEquals(1, vm.visibleFollowers().size)
            assertEquals("@cory", vm.visibleFollowers().first().handle)
            // Handle prefix match (no @).
            vm.onFollowerSearchText("ale")
            assertEquals(1, vm.visibleFollowers().size)
            assertEquals("@alex", vm.visibleFollowers().first().handle)
            // Whitespace-only query returns all.
            vm.onFollowerSearchText("  ")
            assertEquals(3, vm.visibleFollowers().size)
            // No match yields empty.
            vm.onFollowerSearchText("zzz")
            assertEquals(0, vm.visibleFollowers().size)
        }

    @Test fun sort_defaults_to_newest_active_preserving_api_order() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            assertEquals(FollowerSort.NewestActive, vm.followerSort.value)
            assertEquals(listOf("@alex", "@billie", "@cory"), vm.visibleFollowers().map { it.handle })
        }

    @Test fun sort_highest_tier_orders_by_tier_rank_descending() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.selectFollowerSort(FollowerSort.HighestTier)
            assertEquals(listOf("@cory", "@billie", "@alex"), vm.visibleFollowers().map { it.handle })
        }

    @Test fun sort_recently_joined_orders_by_tenure_ascending() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.selectFollowerSort(FollowerSort.RecentlyJoined)
            // tenureMonths: alex=3, billie=12, cory=1 → cory, alex, billie.
            assertEquals(listOf("@cory", "@alex", "@billie"), vm.visibleFollowers().map { it.handle })
        }

    @Test fun sort_most_engaged_favours_higher_tier_then_longer_tenure() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.selectFollowerSort(FollowerSort.MostEngaged)
            // No tie on tier rank here, so order matches highest-tier.
            assertEquals(listOf("@cory", "@billie", "@alex"), vm.visibleFollowers().map { it.handle })
        }

    @Test fun sort_most_engaged_tie_breaks_on_longer_tenure() {
        val rows =
            listOf(
                FollowerRowContent(
                    id = "a",
                    displayName = "A",
                    handle = "@a",
                    avatarUrl = null,
                    tierName = "Members",
                    tierRank = 2,
                    tenureLabel = "1 mo.",
                    tenureMonths = 1,
                    joinedMonth = null,
                    verifiedLocal = false,
                ),
                FollowerRowContent(
                    id = "b",
                    displayName = "B",
                    handle = "@b",
                    avatarUrl = null,
                    tierName = "Members",
                    tierRank = 2,
                    tenureLabel = "9 mo.",
                    tenureMonths = 9,
                    joinedMonth = null,
                    verifiedLocal = false,
                ),
            )
        val sorted =
            AudienceProfileViewModel.sortFollowers(rows, FollowerSort.MostEngaged)
        assertEquals(listOf("b", "a"), sorted.map { it.id })
    }

    @Test fun search_and_sort_combine_with_tier_filter() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.selectTierFilter(2)
            vm.onFollowerSearchText("billie")
            vm.selectFollowerSort(FollowerSort.HighestTier)
            assertEquals(1, vm.visibleFollowers().size)
            assertEquals("@billie", vm.visibleFollowers().first().handle)
        }

    @Test fun active_tab_defaults_to_updates() =
        runTest {
            val vm = makeVm()
            assertEquals(AudienceProfileTab.Updates, vm.activeTab.value)
            vm.selectTab(AudienceProfileTab.Followers)
            assertEquals(AudienceProfileTab.Followers, vm.activeTab.value)
        }

    @Test fun update_card_visibility_label_for_tier_includes_rank() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as AudienceProfileUiState.Loaded
            assertEquals("Followers", loaded.content.updates.first { it.id == "u1" }.visibilityLabel)
            assertEquals("Tier 2+", loaded.content.updates.first { it.id == "u2" }.visibilityLabel)
        }

    @Test fun tier_chip_for_rank_1_surfaces_correct_count() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as AudienceProfileUiState.Loaded
            assertEquals(8, loaded.content.tierChips.first { it.id == "tier_1" }.count)
        }

    @Test fun threads_filter_chips_surface_correct_counts() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as AudienceProfileUiState.Loaded
            val chips = loaded.content.threadsFilterChips
            assertEquals(
                listOf(ThreadsFilter.All, ThreadsFilter.Unread, ThreadsFilter.BronzePlus, ThreadsFilter.Flagged),
                chips.map { it.filter },
            )
            assertEquals(3, chips.first { it.filter == ThreadsFilter.All }.count)
            assertEquals(2, chips.first { it.filter == ThreadsFilter.Unread }.count)
            assertEquals(2, chips.first { it.filter == ThreadsFilter.BronzePlus }.count)
            assertNull(chips.first { it.filter == ThreadsFilter.Flagged }.count)
        }

    @Test fun thread_filter_all_shows_every_thread() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            assertEquals(ThreadsFilter.All, vm.activeThreadFilter.value)
            assertEquals(3, vm.visibleThreads().size)
        }

    @Test fun thread_filter_unread_drops_read_threads() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.selectThreadFilter(ThreadsFilter.Unread)
            assertEquals(ThreadsFilter.Unread, vm.activeThreadFilter.value)
            assertEquals(listOf("th1", "th2"), vm.visibleThreads().map { it.id })
        }

    @Test fun thread_filter_bronze_plus_drops_tier_1_threads() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.selectThreadFilter(ThreadsFilter.BronzePlus)
            assertEquals(listOf("th1", "th2"), vm.visibleThreads().map { it.id })
        }

    @Test fun thread_filter_flagged_keeps_only_flagged_threads() =
        runTest {
            stubLoaded()
            val vm = makeVm()
            vm.load()
            vm.selectThreadFilter(ThreadsFilter.Flagged)
            assertEquals(listOf("th2"), vm.visibleThreads().map { it.id })
        }
}
