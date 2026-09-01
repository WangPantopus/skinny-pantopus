@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.creator_inbox

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
 * Paparazzi snapshots for P1.2 Creator Inbox. Covers every state +
 * each filter selection to mirror the iOS snapshot battery
 * (`CreatorInboxSnapshotTests`).
 */
class CreatorInboxSnapshotTest {
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
    fun creator_inbox_populated() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = sampleLoaded(activeFilter = CreatorInboxFilter.All),
                    activeFilter = CreatorInboxFilter.All,
                    onSelectFilter = {},
                    onOpenThread = {},
                    onOpenSettings = {},
                )
            }
        }
    }

    @Test
    fun creator_inbox_loading() {
        paparazzi.snapshot {
            Frame { LoadingFrame() }
        }
    }

    @Test
    fun creator_inbox_filter_unread() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = sampleLoaded(activeFilter = CreatorInboxFilter.Unread),
                    activeFilter = CreatorInboxFilter.Unread,
                    onSelectFilter = {},
                    onOpenThread = {},
                    onOpenSettings = {},
                )
            }
        }
    }

    @Test
    fun creator_inbox_filter_bronze_plus() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = sampleLoaded(activeFilter = CreatorInboxFilter.BronzePlus),
                    activeFilter = CreatorInboxFilter.BronzePlus,
                    onSelectFilter = {},
                    onOpenThread = {},
                    onOpenSettings = {},
                )
            }
        }
    }

    @Test
    fun creator_inbox_filter_flagged() {
        paparazzi.snapshot {
            Frame {
                LoadedFrame(
                    loaded = sampleLoaded(activeFilter = CreatorInboxFilter.Flagged),
                    activeFilter = CreatorInboxFilter.Flagged,
                    onSelectFilter = {},
                    onOpenThread = {},
                    onOpenSettings = {},
                )
            }
        }
    }

    private fun sampleLoaded(activeFilter: CreatorInboxFilter): CreatorInboxLoaded {
        val rows =
            listOf(
                CreatorInboxRowContent(
                    id = "th_gold",
                    displayName = "Derek Tan",
                    handle = "@derek_tan",
                    initials = "DT",
                    avatarUrl = null,
                    tierName = "Gold",
                    tierRank = 4,
                    preview = "Hey — could I commission a custom loaf for my partner's birthday?",
                    timeAgo = "2m",
                    unread = true,
                    flagged = false,
                    verifiedLocal = true,
                    counterpartyUserId = "u_derek",
                    personaChip = null,
                ),
                CreatorInboxRowContent(
                    id = "th_silver",
                    displayName = "Lena P.",
                    handle = "@lenapap",
                    initials = "LP",
                    avatarUrl = null,
                    tierName = "Silver",
                    tierRank = 3,
                    preview = "The hydration chart is incredible. Question on step 4.",
                    timeAgo = "18m",
                    unread = true,
                    flagged = false,
                    verifiedLocal = true,
                    counterpartyUserId = "u_lena",
                    personaChip = null,
                ),
                CreatorInboxRowContent(
                    id = "th_bronze_unread",
                    displayName = "Ravi Desai",
                    handle = "@ravidesai",
                    initials = "RD",
                    avatarUrl = null,
                    tierName = "Bronze",
                    tierRank = 2,
                    preview = "Voice message · 0:42",
                    timeAgo = "1h",
                    unread = true,
                    flagged = false,
                    verifiedLocal = false,
                    counterpartyUserId = "u_ravi",
                    personaChip = null,
                ),
                CreatorInboxRowContent(
                    id = "th_flagged",
                    displayName = "Marco K.",
                    handle = "@marcok",
                    initials = "MK",
                    avatarUrl = null,
                    tierName = "Bronze",
                    tierRank = 2,
                    preview = "Quick heads up — got a DM from someone using your name.",
                    timeAgo = "Yesterday",
                    unread = false,
                    flagged = true,
                    verifiedLocal = true,
                    counterpartyUserId = "u_marco",
                    personaChip = null,
                ),
                CreatorInboxRowContent(
                    id = "th_free",
                    displayName = "Junie L.",
                    handle = "@junie_l",
                    initials = "JL",
                    avatarUrl = null,
                    tierName = "Free",
                    tierRank = 1,
                    preview = "Following from the market! Will swing by the stoop next time.",
                    timeAgo = "3d",
                    unread = false,
                    flagged = false,
                    verifiedLocal = false,
                    counterpartyUserId = "u_junie",
                    personaChip = null,
                ),
            )
        val filtered = rows.filter { CreatorInboxViewModel.matches(it, activeFilter) }
        val counts =
            CreatorInboxCounts(
                total = rows.size,
                unread = rows.count { it.unread },
                flagged = rows.count { it.flagged },
            )
        return CreatorInboxLoaded(
            header =
                CreatorInboxHeader(
                    title = "Creator inbox",
                    handle = "@mariak",
                    isCrossPersona = false,
                ),
            rows = filtered,
            counts = counts,
            chips = CreatorInboxViewModel.chips(rows = rows, counts = counts),
        )
    }

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
