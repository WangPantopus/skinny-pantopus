package app.pantopus.android.ui.screens.nearby

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

class NearbySocialSnapshotTest {
    @get:Rule
    val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5)

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
