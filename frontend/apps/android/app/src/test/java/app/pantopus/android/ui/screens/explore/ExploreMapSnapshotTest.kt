@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.explore

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi coverage for A11.2 Explore pieces that do not require the
 * GoogleMap SurfaceView: mixed pins, mixed rail cards, and the four sheet
 * states (loading / empty / populated / error).
 */
class ExploreMapSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 600,
                    softButtons = false,
                ),
        )

    @Test
    fun mixed_pin_types_confirmed_pending_active_and_user_dot() {
        paparazzi.snapshot {
            Frame {
                Row(
                    modifier = Modifier.padding(20.dp).fillMaxSize(),
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    ExploreTypedPin(entity = entity("t1", ExploreKind.Task, ExploreEntityState.Confirmed), isActive = true)
                    ExploreTypedPin(entity = entity("i1", ExploreKind.Item, ExploreEntityState.Pending), isActive = false)
                    ExploreTypedPin(entity = entity("p1", ExploreKind.Post, ExploreEntityState.Confirmed), isActive = false)
                    ExploreTypedPin(entity = entity("s1", ExploreKind.Spot, ExploreEntityState.Confirmed), isActive = false)
                    ExploreYouAreHereDot()
                }
            }
        }
    }

    @Test
    fun mixed_cluster_dots() {
        paparazzi.snapshot {
            Frame {
                Row(
                    modifier = Modifier.padding(20.dp).fillMaxSize(),
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    ExploreClusterDot(cluster = cluster(count = 4, kind = ExploreKind.Item))
                    ExploreClusterDot(cluster = cluster(count = 12, kind = ExploreKind.Task))
                    ExploreClusterDot(cluster = cluster(count = 47, kind = ExploreKind.Spot))
                }
            }
        }
    }

    @Test
    fun populated_mixed_rail_cards() {
        val entities = ExploreMapSampleData.entities(ExploreScenario.Populated).take(4)
        paparazzi.snapshot {
            Frame {
                Row(
                    modifier = Modifier.padding(16.dp).fillMaxSize(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    entities.forEachIndexed { index, entity ->
                        ExploreEntityCard(
                            entity = entity,
                            selected = index == 0,
                            isSaved = false,
                            onTap = {},
                            onToggleSave = {},
                        )
                    }
                }
            }
        }
    }

    @Test
    fun loading_sheet_state() {
        paparazzi.snapshot {
            Frame {
                Column(modifier = Modifier.padding(top = 20.dp)) {
                    ExploreSkeletonRail()
                }
            }
        }
    }

    @Test
    fun empty_sheet_state() {
        paparazzi.snapshot {
            Frame {
                ExploreEmptyBody(onClearFilters = {}, onWidenArea = {})
            }
        }
    }

    @Test
    fun error_sheet_state() {
        paparazzi.snapshot {
            Frame {
                ExploreSheetError(message = "Couldn't load the map.", onRetry = {})
            }
        }
    }

    private fun entity(
        id: String,
        kind: ExploreKind,
        state: ExploreEntityState,
    ): ExploreEntity =
        ExploreEntity(
            id = id,
            kind = kind,
            state = state,
            latitude = 40.7484,
            longitude = -73.9857,
            title = "Sample ${kind.singularLabel}",
            metaLead =
                when (kind) {
                    ExploreKind.Task -> "$60"
                    ExploreKind.Item -> "$420"
                    ExploreKind.Post -> "Asked 2h ago"
                    ExploreKind.Spot -> "Open"
                    ExploreKind.Home -> "Home"
                },
            distanceLabel = "0.2 mi",
            distanceMiles = 0.2,
            badge =
                when (kind) {
                    ExploreKind.Task -> ExploreBadge("4 bids", ExploreBadgeTone.Bids)
                    ExploreKind.Item -> ExploreBadge("New", ExploreBadgeTone.New)
                    ExploreKind.Post -> ExploreBadge("8 replies", ExploreBadgeTone.Replies)
                    ExploreKind.Spot -> ExploreBadge("4.8★", ExploreBadgeTone.Rating)
                    ExploreKind.Home -> null
                },
            verified = true,
            openNow = true,
        )

    private fun cluster(
        count: Int,
        kind: ExploreKind,
    ): ExploreCluster =
        ExploreCluster(
            id = "c$count",
            latitude = 40.7484,
            longitude = -73.9857,
            kind = kind,
            count = count,
            entityIds = List(count) { "e$it" },
            minLatitude = 40.747,
            maxLatitude = 40.750,
            minLongitude = -73.987,
            maxLongitude = -73.984,
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
