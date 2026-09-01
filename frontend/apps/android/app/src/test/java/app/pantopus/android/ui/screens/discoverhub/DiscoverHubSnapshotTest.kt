@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.discoverhub

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * A11.3 Discover magazine Paparazzi frames: populated compact map with
 * three grouped rails, and empty anchor-only map with empty hero plus
 * skeleton rail stand-ins.
 */
class DiscoverHubSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 900,
                    softButtons = false,
                ),
        )

    @Test
    fun discover_hub_populated() {
        paparazzi.snapshot {
            PantopusTheme {
                DiscoverHubMagazineScreen(
                    state = DiscoverHubMagazineUiState.Populated(DiscoverHubSampleData.populated),
                    selectedFilter = null,
                    onBack = {},
                    onOpenMap = {},
                    onSelectFilter = {},
                    onSelectTask = {},
                    onSelectMarketplace = {},
                    onSelectPost = {},
                    onSeeAllTasks = {},
                    onSeeAllMarketplace = {},
                    onSeeAllPosts = {},
                    onRetry = {},
                    onNotify = {},
                )
            }
        }
    }

    @Test
    fun discover_hub_empty() {
        paparazzi.snapshot {
            PantopusTheme {
                DiscoverHubMagazineScreen(
                    state = DiscoverHubMagazineUiState.Empty,
                    selectedFilter = null,
                    onBack = {},
                    onOpenMap = {},
                    onSelectFilter = {},
                    onSelectTask = {},
                    onSelectMarketplace = {},
                    onSelectPost = {},
                    onSeeAllTasks = {},
                    onSeeAllMarketplace = {},
                    onSeeAllPosts = {},
                    onRetry = {},
                    onNotify = {},
                )
            }
        }
    }
}
