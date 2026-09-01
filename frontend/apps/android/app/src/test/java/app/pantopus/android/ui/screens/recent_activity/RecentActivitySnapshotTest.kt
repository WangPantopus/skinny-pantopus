@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.recent_activity

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.hub.HubActivityItem
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test
import java.time.Instant

/**
 * Paparazzi snapshots for the P1.5 Recent Activity log screen.
 *
 * Baselines are recorded on first run via `./gradlew paparazziRecord`
 * and verified on every CI run via `./gradlew paparazziVerify`.
 * Annotated `@Ignore` until baselines land so the first PR doesn't fail
 * CI on a missing image — the follow-up records baselines and removes
 * the annotation.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class RecentActivitySnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    @Test
    fun recent_activity_loading() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Recent activity",
                    state = ListOfRowsUiState.Loading,
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                )
            }
        }
    }

    @Test
    fun recent_activity_empty() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Recent activity",
                    state =
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.Bell,
                            headline = "No activity yet",
                            subcopy =
                                "Check back later — replies, claims, gigs, and " +
                                    "mail events will show up here.",
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                )
            }
        }
    }

    @Test
    fun recent_activity_populated() {
        val now = Instant.parse("2026-05-15T12:00:00Z")
        val items =
            listOf(
                HubActivityItem(
                    id = "a1",
                    pillar = "personal",
                    title = "Maria replied to your gig",
                    at = "2026-05-15T11:48:00Z",
                    read = false,
                    route = "/posts/p_1",
                ),
                HubActivityItem(
                    id = "a2",
                    pillar = "personal",
                    title = "Task posted: Mow front lawn",
                    at = "2026-05-15T09:00:00Z",
                    read = true,
                    route = "/gigs/g_1",
                ),
                HubActivityItem(
                    id = "a3",
                    pillar = "home",
                    title = "Package arrived for Maria",
                    at = "2026-05-14T16:00:00Z",
                    read = true,
                    route = "/app/homes/h_1/packages",
                ),
                HubActivityItem(
                    id = "a4",
                    pillar = "business",
                    title = "New offer on TV listing",
                    at = "2026-05-13T08:30:00Z",
                    read = true,
                    route = "/listings/l_3",
                ),
            )
        val rows = items.map { RecentActivityViewModel.row(it, now) {} }
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Recent activity",
                    state =
                        ListOfRowsUiState.Loaded(
                            sections = listOf(RowSection(id = "all", rows = rows)),
                            hasMore = false,
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                )
            }
        }
    }

    @Test
    fun recent_activity_error() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Recent activity",
                    state = ListOfRowsUiState.Error(message = "Couldn't load activity."),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                )
            }
        }
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
