@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile

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
 * B.2 (A10.5) — Paparazzi snapshots for the canonical neighbor profile's
 * two design frames: Derek (populated) and Sasha (new neighbor).
 */
class PublicProfileNeighborSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false),
        )

    @Test
    fun neighbor_populated_about() {
        paparazzi.snapshot {
            Frame { layout(PublicProfileSampleData.derekPopulated, NeighborProfileTab.About) }
        }
    }

    @Test
    fun neighbor_populated_reviews() {
        paparazzi.snapshot {
            Frame { layout(PublicProfileSampleData.derekPopulated, NeighborProfileTab.Reviews) }
        }
    }

    @Test
    fun neighbor_populated_verifications() {
        paparazzi.snapshot {
            Frame { layout(PublicProfileSampleData.derekPopulated, NeighborProfileTab.Verifications) }
        }
    }

    @Test
    fun neighbor_new_neighbor_reviews() {
        paparazzi.snapshot {
            Frame { layout(PublicProfileSampleData.sashaNewNeighbor, NeighborProfileTab.Reviews) }
        }
    }

    @Composable
    private fun layout(
        content: NeighborProfileContent,
        tab: NeighborProfileTab,
    ) {
        NeighborProfileLayout(
            content = content,
            selectedTab = tab,
            connectState = PublicProfileActionState.Idle,
            onBack = {},
            onSelectTab = {},
            onMessage = {},
            onConnect = {},
            onReport = {},
            onBlock = {},
            onOverflow = {},
        )
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
