@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCard
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.shared.feed.FeedChipItem
import app.pantopus.android.ui.screens.shared.feed.FeedChipRow
import app.pantopus.android.ui.screens.shared.feed.FeedSkeletonCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the A03 feed archetype — A03.1 Pulse and A03.2
 * Beacons, populated + empty, plus the shared chip row and loading
 * skeleton. The full screen is too tall for a single PNG on a Pixel 5
 * frame, so the populated feeds render as a card column and the empty
 * states render the `FeedEmptyState` composable directly.
 *
 * Re-record baselines after any card / palette change with
 * `./gradlew recordPaparazziDebug`.
 */
class PulseFeedSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1500,
                    softButtons = false,
                ),
        )

    // The recorded golden holds the pre-parity six-chip row. `PulseIntent`
    // now carries ten values (Alert / Deal / Wins / Guide were split back out
    // of Announce), so the baseline is stale until it is re-recorded with
    // `./gradlew recordPaparazziDebug` — same holding pattern as the four
    // full-frame baselines below.
    @Ignore("Chip-row baseline pending — re-record after the 10-way PulseIntent split")
    @Test
    fun pulse_intent_chip_row() {
        paparazzi.snapshot {
            Frame {
                FeedChipRow(
                    chips = PulseIntent.entries.map { FeedChipItem(id = it.key, label = it.label) },
                    activeId = PulseIntent.All.key,
                    onSelect = {},
                )
            }
        }
    }

    // The four full-frame baselines below are recorded with
    // `./gradlew recordPaparazziDebug` (needs the Android SDK). They are
    // @Ignore'd until that follow-up commit so CI stays green meanwhile —
    // the Android mirror of the iOS `XCTSkip` baseline-pending gate.
    @Ignore("A03 baseline pending — run ./gradlew recordPaparazziDebug")
    @Test
    fun pulse_populated_feed() {
        paparazzi.snapshot {
            Frame { CardColumn(FeedSampleData.pulsePosts) }
        }
    }

    @Ignore("A03 baseline pending — run ./gradlew recordPaparazziDebug")
    @Test
    fun pulse_empty() {
        paparazzi.snapshot {
            Frame {
                FeedEmptyState(
                    content = FeedSurface.Pulse.emptyContent(scopeLabel = "Elm Park", followCount = 0),
                    onCta = {},
                )
            }
        }
    }

    @Ignore("A03 baseline pending — run ./gradlew recordPaparazziDebug")
    @Test
    fun beacons_populated_feed() {
        paparazzi.snapshot {
            Frame { CardColumn(FeedSampleData.beaconPosts) }
        }
    }

    @Ignore("A03 baseline pending — run ./gradlew recordPaparazziDebug")
    @Test
    fun beacons_empty() {
        paparazzi.snapshot {
            Frame {
                FeedEmptyState(
                    content = FeedSurface.Beacons.emptyContent(scopeLabel = null, followCount = 0),
                    onCta = {},
                )
            }
        }
    }

    @Test
    fun pulse_loading_skeleton() {
        paparazzi.snapshot {
            Frame {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    FeedSkeletonCard()
                    FeedSkeletonCard(withTitle = true)
                    FeedSkeletonCard()
                }
            }
        }
    }

    @Composable
    private fun CardColumn(rows: List<PulsePostCardContent>) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            rows.forEach { row ->
                PulsePostCard(
                    content = row,
                    onTap = {},
                    onPrimaryReaction = {},
                    onRSVP = if (row.attendees == null) null else ({}),
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            androidx.compose.foundation.layout.Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
