@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.audience_profile.broadcast_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.audience_profile.UpdateVisibility
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for P1.3 Broadcast detail full-screen takeover.
 * Two frames mirror the iOS snapshot lockfile: populated (delivered /
 * read counts + tier bar + 3 reply rows) and empty-replies (analytics
 * and tier bar present but the replies section renders its
 * empty-state card).
 */
class BroadcastDetailSnapshotTest {
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
    fun broadcast_detail_populated() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = populatedLoaded(),
                    onReply = {},
                    onBoost = {},
                    onPin = {},
                )
            }
        }
    }

    @Test
    fun broadcast_detail_empty_replies() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = populatedLoaded().copy(replies = emptyList(), totalReplies = 0),
                    onReply = {},
                    onBoost = {},
                    onPin = {},
                )
            }
        }
    }

    private fun populatedLoaded(): BroadcastDetailLoaded =
        BroadcastDetailLoaded(
            broadcastId = "b_demo",
            hero =
                BroadcastDetailHero(
                    body =
                        "Today's loaf has a crumb you could read poetry through. I'll set a few aside if " +
                            "you want to swing by the stoop between 4–6.",
                    visibility = UpdateVisibility.Public,
                    targetTierRank = null,
                    timestamp = "Today · 9:14am",
                    mediaUrl = null,
                ),
            analyticsCells =
                listOf(
                    BroadcastAnalyticsCell(id = "delivered", label = "Delivered", value = "1.2K"),
                    BroadcastAnalyticsCell(id = "read", label = "Read", value = "892", sub = "72%"),
                    BroadcastAnalyticsCell(id = "reactions", label = "Reactions", value = "134"),
                    BroadcastAnalyticsCell(id = "replies", label = "Replies", value = "28"),
                ),
            tierBreakdown =
                BroadcastTierBreakdown(
                    total = 892,
                    segments =
                        listOf(
                            BroadcastTierBreakdown.Segment("t1", 1, "Followers", 374),
                            BroadcastTierBreakdown.Segment("t2", 2, "Members", 276),
                            BroadcastTierBreakdown.Segment("t3", 3, "Insiders", 160),
                            BroadcastTierBreakdown.Segment("t4", 4, "Direct", 82),
                        ),
                ),
            replies =
                listOf(
                    BroadcastReplyRow(
                        id = "r1",
                        displayName = "Derek Tan",
                        handle = "@derek_tan",
                        avatarUrl = null,
                        tierName = "Direct",
                        tierRank = 4,
                        body = "On my way. Bringing the linen bag back, finally.",
                        timeAgo = "2h",
                    ),
                    BroadcastReplyRow(
                        id = "r2",
                        displayName = "Lena Pap",
                        handle = "@lenapap",
                        avatarUrl = null,
                        tierName = "Insiders",
                        tierRank = 3,
                        body = "Saving you a slice means you better not eat ALL of it.",
                        timeAgo = "1h",
                    ),
                    BroadcastReplyRow(
                        id = "r3",
                        displayName = "Ravi Desai",
                        handle = "@ravidesai",
                        avatarUrl = null,
                        tierName = "Members",
                        tierRank = 2,
                        body = "Crumb shot or it didn't happen.",
                        timeAgo = "42m",
                    ),
                ),
            totalReplies = 28,
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
