package app.pantopus.android.ui.screens.nearby

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.core.LaunchFeature
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class NearbySocialSnapshotTest {
    @get:Rule
    val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5)

    // The launch cut hides the Beacons row and copy; the baseline pins the full door.
    @Before
    fun setUp() {
        LaunchFeatures.overrideForTesting = LaunchFeature.entries.toSet()
    }

    @After
    fun tearDown() {
        LaunchFeatures.overrideForTesting = null
    }

    @Test
    fun social_discovery_before_home_setup() {
        paparazzi.snapshot {
            PantopusTheme {
                NearbyContent(
                    state = NearbyUiState.Loaded(NeighborhoodMeter(), null),
                    onClaim = {},
                    onOpenPulse = {},
                    onOpenBeacons = {},
                    onOpenConnections = {},
                    onOpenMarketplace = {},
                    onOpenTasks = {},
                    onRetry = {},
                )
            }
        }
    }
}
