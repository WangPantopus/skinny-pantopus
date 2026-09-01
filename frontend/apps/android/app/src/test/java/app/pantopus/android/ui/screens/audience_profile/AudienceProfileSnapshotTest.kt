@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.audience_profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for T3.3 Public Profile management. Three
 * frames mirror iOS: Updates tab (composer + recent updates), the
 * Followers tab (analytics + tier chips + follower rows), and the
 * Threads tab (one unread thread).
 */
class AudienceProfileSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun audience_profile_a22_populated() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state = sampleFrameState(activeTab = AudienceProfileTab.Updates),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_a22_empty() {
        paparazzi.snapshot {
            Frame {
                EmptyFrame(
                    message = "Set up payments, invite your first followers, and send a broadcast when you're ready.",
                    onSetup = {},
                    onTellPeople = {},
                )
            }
        }
    }

    @Test
    fun audience_profile_updates_tab() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state = sampleFrameState(activeTab = AudienceProfileTab.Updates),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_followers_tab() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state = sampleFrameState(activeTab = AudienceProfileTab.Followers),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_followers_sort_highest_tier() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        sampleFrameState(
                            activeTab = AudienceProfileTab.Followers,
                            followerSort = FollowerSort.HighestTier,
                            visibleFollowers =
                                AudienceProfileViewModel.sortFollowers(
                                    sampleLoaded().followers,
                                    FollowerSort.HighestTier,
                                ),
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_followers_search_populated() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        sampleFrameState(
                            activeTab = AudienceProfileTab.Followers,
                            searchText = "billie",
                            visibleFollowers =
                                sampleLoaded().followers.filter {
                                    it.displayName.contains("Billie", true) ||
                                        it.handle.contains("billie", true)
                                },
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_followers_search_empty() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        sampleFrameState(
                            activeTab = AudienceProfileTab.Followers,
                            searchText = "zzz",
                            visibleFollowers = emptyList(),
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_threads_tab() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        sampleFrameState(
                            activeTab = AudienceProfileTab.Threads,
                            visibleFollowers = emptyList(),
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_threads_filter_unread() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        sampleFrameState(
                            activeTab = AudienceProfileTab.Threads,
                            visibleFollowers = emptyList(),
                            activeThreadFilter = ThreadsFilter.Unread,
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_threads_filter_bronze_plus() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        sampleFrameState(
                            activeTab = AudienceProfileTab.Threads,
                            visibleFollowers = emptyList(),
                            activeThreadFilter = ThreadsFilter.BronzePlus,
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_threads_filter_flagged() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        sampleFrameState(
                            activeTab = AudienceProfileTab.Threads,
                            visibleFollowers = emptyList(),
                            activeThreadFilter = ThreadsFilter.Flagged,
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    @Test
    fun audience_profile_threads_filter_empty() {
        // Bronze+ filter applied to a roster of tier-1 threads — exercises
        // the filtered-empty branch (threads exist but the filter drops all).
        val loaded = sampleLoaded()
        val tierOneOnly =
            loaded.threads.map { it.copy(tierRank = 1, tierName = "Followers", flagged = false) }
        val tweaked =
            loaded.copy(
                threads = tierOneOnly,
                threadsFilterChips =
                    listOf(
                        ThreadsFilterChipContent(
                            id = ThreadsFilter.All.key,
                            filter = ThreadsFilter.All,
                            label = ThreadsFilter.All.title,
                            count = tierOneOnly.size,
                        ),
                        ThreadsFilterChipContent(
                            id = ThreadsFilter.Unread.key,
                            filter = ThreadsFilter.Unread,
                            label = ThreadsFilter.Unread.title,
                            count = tierOneOnly.count { it.unreadCount > 0 },
                        ),
                        ThreadsFilterChipContent(
                            id = ThreadsFilter.BronzePlus.key,
                            filter = ThreadsFilter.BronzePlus,
                            label = ThreadsFilter.BronzePlus.title,
                            count = 0,
                        ),
                        ThreadsFilterChipContent(
                            id = ThreadsFilter.Flagged.key,
                            filter = ThreadsFilter.Flagged,
                            label = ThreadsFilter.Flagged.title,
                            count = null,
                        ),
                    ),
            )
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    state =
                        AudienceProfileLoadedFrameState(
                            loaded = tweaked,
                            activeTab = AudienceProfileTab.Threads,
                            composer = UpdateComposerState(),
                            selectedTier = null,
                            visibleFollowers = emptyList(),
                            activeThreadFilter = ThreadsFilter.BronzePlus,
                            visibleThreads = emptyList(),
                        ),
                    actions = sampleFrameActions(),
                )
            }
        }
    }

    private fun sampleFrameState(
        activeTab: AudienceProfileTab,
        followerSort: FollowerSort = FollowerSort.NewestActive,
        searchText: String = "",
        visibleFollowers: List<FollowerRowContent> = sampleLoaded().followers,
        activeThreadFilter: ThreadsFilter = ThreadsFilter.All,
    ): AudienceProfileLoadedFrameState {
        val loaded = sampleLoaded()
        val visibleThreads =
            loaded.threads.filter { row ->
                when (activeThreadFilter) {
                    ThreadsFilter.All -> true
                    ThreadsFilter.Unread -> row.unreadCount > 0
                    ThreadsFilter.BronzePlus -> row.tierRank >= 2
                    ThreadsFilter.Flagged -> row.flagged
                }
            }
        return AudienceProfileLoadedFrameState(
            loaded = loaded,
            activeTab = activeTab,
            composer = UpdateComposerState(),
            selectedTier = null,
            followerSearchText = searchText,
            followerSort = followerSort,
            visibleFollowers = visibleFollowers,
            activeThreadFilter = activeThreadFilter,
            visibleThreads = visibleThreads,
        )
    }

    private fun sampleFrameActions(): AudienceProfileLoadedFrameActions =
        AudienceProfileLoadedFrameActions(
            onSelectTab = {},
            onSelectTier = {},
            onFollowerSearch = {},
            onFollowerSort = {},
            onSelectThreadFilter = {},
            composer =
                AudienceProfileComposerActions(
                    onText = {},
                    onVisibility = {},
                    onTier = {},
                    onSubmit = {},
                ),
            navigation =
                AudienceProfileNavigationActions(
                    onOpenFollower = {},
                    onOpenThread = {},
                    onOpenBroadcast = { _, _ -> },
                ),
        )

    private fun sampleLoaded(): AudienceProfileLoaded =
        AudienceProfileLoaded(
            header =
                AudienceHeaderContent(
                    displayName = "Maria K.",
                    handle = "@mariak",
                    followerCount = 1247,
                    newThisWeek = 3,
                    postCount = 42,
                ),
            updates =
                listOf(
                    UpdateCardContent(
                        id = "u1",
                        body =
                            "Today's loaf has a crumb you could read poetry through. " +
                                "I'll set a few aside if you want to swing by the stoop between 4–6.",
                        timeAgo = "2h",
                        visibility = UpdateVisibility.Public,
                        targetTierRank = null,
                        deliveredCount = 1200,
                        readCount = 892,
                    ),
                    UpdateCardContent(
                        id = "u2",
                        body =
                            "Full hydration chart for the country boule. " +
                                "Six months of notebook scans + my fold timing for high-humidity weeks.",
                        timeAgo = "Yesterday",
                        visibility = UpdateVisibility.TierOrAbove,
                        targetTierRank = 2,
                        deliveredCount = 284,
                        readCount = 221,
                    ),
                    UpdateCardContent(
                        id = "u3",
                        body =
                            "Tuesday market field notes — that new cheese stall is the real deal. " +
                                "Avoid the third tomato bin from the left.",
                        timeAgo = "3d",
                        visibility = UpdateVisibility.Public,
                        targetTierRank = null,
                        deliveredCount = 1100,
                        readCount = 804,
                    ),
                    UpdateCardContent(
                        id = "u4",
                        body = "Silver+ Q&A recording is up. Trimmed to 22 min, timestamps in the notes. Next live: Thursday 7pm.",
                        timeAgo = "1w",
                        visibility = UpdateVisibility.TierOrAbove,
                        targetTierRank = 3,
                        deliveredCount = 78,
                        readCount = 64,
                    ),
                ),
            analyticsCells =
                listOf(
                    AnalyticsCellContent(id = "followers", label = "Followers", value = "1,247"),
                    AnalyticsCellContent(id = "members", label = "Bronze", value = "284"),
                    AnalyticsCellContent(id = "insiders", label = "Silver", value = "78"),
                    AnalyticsCellContent(id = "direct", label = "Gold", value = "12"),
                ),
            tierBreakdown =
                TierBreakdownContent(
                    total = 1247,
                    segments =
                        listOf(
                            TierBreakdownContent.TierSegment("t1", 1, "Free", 873),
                            TierBreakdownContent.TierSegment("t2", 2, "Bronze", 284),
                            TierBreakdownContent.TierSegment("t3", 3, "Silver", 78),
                            TierBreakdownContent.TierSegment("t4", 4, "Gold", 12),
                        ),
                ),
            tierChips =
                listOf(
                    TierChipContent(id = "all", rank = null, label = "All", count = 1247),
                    TierChipContent(id = "tier_1", rank = 1, label = "Free", count = 873),
                    TierChipContent(id = "tier_2", rank = 2, label = "Bronze", count = 284),
                    TierChipContent(id = "tier_3", rank = 3, label = "Silver", count = 78),
                    TierChipContent(id = "tier_4", rank = 4, label = "Gold", count = 12),
                ),
            followers =
                listOf(
                    FollowerRowContent(
                        id = "m1",
                        displayName = "Ari M.",
                        handle = "@ari",
                        avatarUrl = null,
                        tierName = "Free",
                        tierRank = 1,
                        tenureLabel = "3 mo.",
                        tenureMonths = 3,
                        joinedMonth = "2026-02",
                        verifiedLocal = true,
                    ),
                    FollowerRowContent(
                        id = "m2",
                        displayName = "Billie B.",
                        handle = "@billie",
                        avatarUrl = null,
                        tierName = "Bronze",
                        tierRank = 2,
                        tenureLabel = "12 mo.",
                        tenureMonths = 12,
                        joinedMonth = "2025-05",
                        verifiedLocal = false,
                    ),
                    FollowerRowContent(
                        id = "m3",
                        displayName = "Casey K.",
                        handle = "@casey",
                        avatarUrl = null,
                        tierName = "Silver",
                        tierRank = 3,
                        tenureLabel = "6 mo.",
                        tenureMonths = 6,
                        joinedMonth = "2025-11",
                        verifiedLocal = false,
                    ),
                    FollowerRowContent(
                        id = "m4",
                        displayName = "Dev R.",
                        handle = "@dev",
                        avatarUrl = null,
                        tierName = "Gold",
                        tierRank = 4,
                        tenureLabel = "9 mo.",
                        tenureMonths = 9,
                        joinedMonth = "2025-08",
                        verifiedLocal = false,
                    ),
                    FollowerRowContent(
                        id = "m5",
                        displayName = "Eli S.",
                        handle = "@eli",
                        avatarUrl = null,
                        tierName = "Bronze",
                        tierRank = 2,
                        tenureLabel = "1 mo.",
                        tenureMonths = 1,
                        joinedMonth = "2026-04",
                        verifiedLocal = true,
                    ),
                ),
            threads =
                listOf(
                    ThreadRowContent(
                        id = "th1",
                        displayName = "Alex M.",
                        handle = "@alex",
                        avatarUrl = null,
                        tierName = "Members",
                        tierRank = 2,
                        preview = "Loved the workshop! Any plans for July?",
                        timeAgo = "5h ago",
                        unreadCount = 2,
                        flagged = false,
                    ),
                    ThreadRowContent(
                        id = "th2",
                        displayName = "Billie B.",
                        handle = "@billie",
                        avatarUrl = null,
                        tierName = "Insiders",
                        tierRank = 3,
                        preview = "Question on step 4 — does the fold count depend on flour?",
                        timeAgo = "18m",
                        unreadCount = 1,
                        flagged = true,
                    ),
                    ThreadRowContent(
                        id = "th3",
                        displayName = "Junie L.",
                        handle = "@junie",
                        avatarUrl = null,
                        tierName = "Followers",
                        tierRank = 1,
                        preview = "Following from the market! Will swing by next time.",
                        timeAgo = "3d",
                        unreadCount = 0,
                        flagged = false,
                    ),
                ),
            threadsFilterChips =
                listOf(
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.All.key,
                        filter = ThreadsFilter.All,
                        label = ThreadsFilter.All.title,
                        count = 3,
                    ),
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.Unread.key,
                        filter = ThreadsFilter.Unread,
                        label = ThreadsFilter.Unread.title,
                        count = 2,
                    ),
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.BronzePlus.key,
                        filter = ThreadsFilter.BronzePlus,
                        label = ThreadsFilter.BronzePlus.title,
                        count = 2,
                    ),
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.Flagged.key,
                        filter = ThreadsFilter.Flagged,
                        label = ThreadsFilter.Flagged.title,
                        count = null,
                    ),
                ),
            channelId = "ch_demo",
        )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
