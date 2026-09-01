@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.gigs

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
 * Paparazzi snapshots for the P4.4 Gig Search surface: every phase the
 * screen produces — idle/recent, typing-shimmer, populated results (with
 * the category chip strip above the list), no-matches empty, and the
 * error-flavoured empty.
 *
 * Record new baselines: `./gradlew paparazziRecord --tests
 * "*GigSearchSnapshotTest*"`.
 */
class GigSearchSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2200,
                    softButtons = false,
                ),
        )

    @Test
    fun gig_search_idle_recent() {
        paparazzi.snapshot {
            Frame { Screen(state = GigSearchUiState.Idle, query = "") }
        }
    }

    @Test
    fun gig_search_typing_shimmer() {
        paparazzi.snapshot {
            Frame { Screen(state = GigSearchUiState.Loading, query = "shel") }
        }
    }

    @Test
    fun gig_search_results() {
        paparazzi.snapshot {
            Frame { Screen(state = GigSearchUiState.Loaded(rows()), query = "clean") }
        }
    }

    @Test
    fun gig_search_empty() {
        paparazzi.snapshot {
            Frame { Screen(state = GigSearchUiState.Empty, query = "zzzzzz") }
        }
    }

    @Test
    fun gig_search_error() {
        paparazzi.snapshot {
            Frame {
                Screen(
                    state = GigSearchUiState.Error("Network unavailable. Check your connection."),
                    query = "shelf",
                )
            }
        }
    }

    @Composable
    private fun Screen(
        state: GigSearchUiState,
        query: String,
    ) {
        GigSearchContent(
            state = state,
            query = query,
            activeCategory = GigsCategory.Cleaning,
            onQueryChange = {},
            onSelectCategory = {},
            onOpenGig = {},
            onBack = {},
        )
    }

    private fun rows(): List<GigCardContent> =
        listOf(
            GigCardContent(
                id = "g1",
                category = GigsCategory.Handyman,
                metaLine = "0.2mi · 2h ago",
                title = "Hang 3 floating shelves in living room",
                body = "Need 3 IKEA Lack shelves mounted on drywall.",
                price = "$60",
                bidCount = 4,
                distanceLabel = "0.2mi",
            ),
            GigCardContent(
                id = "g2",
                category = GigsCategory.Cleaning,
                metaLine = "0.5mi · 5h ago",
                title = "Deep clean 2BR apartment before move-out",
                body = "Kitchen, bath, baseboards, inside oven.",
                price = "$180",
                bidCount = 0,
                distanceLabel = "0.5mi",
            ),
            GigCardContent(
                id = "g3",
                category = GigsCategory.PetCare,
                metaLine = "0.3mi · 1d ago",
                title = "Midday dog walks Tue/Thu",
                body = "20-min loop, ongoing.",
                price = "$22 / walk",
                bidCount = 2,
                distanceLabel = "0.3mi",
            ),
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
