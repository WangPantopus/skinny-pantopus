@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.hub

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

class HubSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    private val summary =
        HubSummaryUi(
            bookings = 18,
            deltaPct = 24,
            upcoming = 5,
            noShows = 1,
            sparkCounts = listOf(3, 5, 4, 7, 6, 9, 8, 11, 10, 13, 12, 16, 18),
            breakdown = listOf(HubBreakdownChip("Intro call", 12), HubBreakdownChip("Consult", 4)),
        )

    @Test
    fun summary_card_data() =
        paparazzi.snapshot {
            Frame { SummaryCard(SummaryCardContent.Data(summary), SchedulingPillar.Personal, {}, {}, {}, Modifier.padding(16.dp)) }
        }

    @Test
    fun summary_card_empty() =
        paparazzi.snapshot {
            Frame { SummaryCard(SummaryCardContent.Empty, SchedulingPillar.Personal, {}, {}, {}, Modifier.padding(16.dp)) }
        }

    @Test
    fun summary_card_error() =
        paparazzi.snapshot {
            Frame { SummaryCard(SummaryCardContent.Error, SchedulingPillar.Business, {}, {}, {}, Modifier.padding(16.dp)) }
        }

    @Test
    fun hub_empty_state() =
        paparazzi.snapshot {
            Frame { Column(Modifier.padding(16.dp)) { HubEmptyState(SchedulingPillar.Personal) {} } }
        }

    @Test
    fun hub_loaded_pieces() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    BookingLinkCard(
                        pillar = SchedulingPillar.Personal,
                        displayName = "Maria K.",
                        displayRole = "30 min",
                        handle = "pantopus.com/book/maria-k",
                        isPaused = false,
                        readOnly = false,
                        onCopy = {},
                        onShare = {},
                    )
                    HubPauseRow(SchedulingPillar.Personal, isAccepting = true) {}
                    HubManageGroup(
                        rows =
                            listOf(
                                HubManageItem(
                                    "eventTypes",
                                    app.pantopus.android.ui.theme.PantopusIcon.Grid3x3,
                                    "Event types",
                                    "3 active",
                                    false,
                                    "x",
                                ),
                                HubManageItem(
                                    "bookings",
                                    app.pantopus.android.ui.theme.PantopusIcon.Inbox,
                                    "Bookings",
                                    "2 need approval",
                                    true,
                                    "x",
                                ),
                            ),
                        readOnly = false,
                        onNavigate = {},
                    )
                }
            }
        }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
