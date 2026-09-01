@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.nearby.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi baselines for the T2.4 Nearby map glyphs. The full
 * GoogleMap render can't run in Paparazzi (it needs a Maps API key
 * and the SurfaceView), so we capture the markers, cluster glyph,
 * and "you are here" disc in isolation.
 */
class NearbyMapSnapshotTest {
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
    fun map_pin_states_confirmed_pending_active_and_you_are_here() {
        paparazzi.snapshot {
            Frame {
                Row(
                    modifier = Modifier.padding(20.dp).fillMaxSize(),
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    MapPinDot(entity = entity(state = MapEntityState.Confirmed), isActive = false)
                    MapPinDot(entity = entity(state = MapEntityState.Pending), isActive = false)
                    MapPinDot(entity = entity(state = MapEntityState.Confirmed), isActive = true)
                    YouAreHereDot()
                }
            }
        }
    }

    @Test
    fun map_cluster_dots_varying_count() {
        paparazzi.snapshot {
            Frame {
                Row(
                    modifier = Modifier.padding(20.dp).fillMaxSize(),
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    MapClusterDot(cluster = cluster(count = 3, category = GigsCategory.Handyman))
                    MapClusterDot(cluster = cluster(count = 12, category = GigsCategory.Cleaning))
                    MapClusterDot(cluster = cluster(count = 48, category = GigsCategory.Moving))
                }
            }
        }
    }

    private fun entity(state: MapEntityState): MapEntity =
        MapEntity(
            id = "e1",
            kind = MapEntityKind.Gig,
            category = GigsCategory.Handyman,
            state = state,
            latitude = 40.7484,
            longitude = -73.9857,
            title = "Sample",
            summary = null,
            price = null,
            distanceLabel = null,
            bidCount = 0,
        )

    private fun cluster(
        count: Int,
        category: GigsCategory,
    ): MapCluster =
        MapCluster(
            id = "c1",
            latitude = 40.7484,
            longitude = -73.9857,
            category = category,
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
