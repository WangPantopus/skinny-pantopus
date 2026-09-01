@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.marketplace

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi baselines for the T2.5 Marketplace: chip row in the
 * default state, populated 2-column grid covering a paid listing
 * (Like-new condition badge), a Free listing (success-green price,
 * no badge), a rental ("$45 / wk", no badge), empty frame with the
 * radius hint pill, and the shimmer loading skeleton.
 */
class MarketplaceSnapshotTest {
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
    fun marketplace_category_chip_row_active_all() {
        paparazzi.snapshot {
            Frame {
                MarketCategoryChips(active = MarketplaceCategory.All, onSelect = {})
            }
        }
    }

    @Test
    fun marketplace_populated_grid_with_free_and_rental_and_condition_badge() {
        paparazzi.snapshot {
            Frame { PopulatedFrame(rows = populatedRows(), isLoadingMore = false, onOpen = {}) }
        }
    }

    @Test
    fun marketplace_empty_with_radius_hint() {
        paparazzi.snapshot {
            Frame { EmptyFrame(radiusMiles = 2.0, canWiden = true, onWiden = {}, onCompose = {}) }
        }
    }

    @Test
    fun marketplace_loading_skeleton() {
        paparazzi.snapshot {
            Frame { LoadingFrame() }
        }
    }

    private fun populatedRows(): List<MarketplaceCardContent> =
        listOf(
            MarketplaceCardContent(
                id = "l1",
                title = "Mid-century sofa, walnut frame",
                imageUrl = null,
                placeholderGradient = ListingGradient.from("l1"),
                placeholderIcon = PantopusIcon.Home,
                price = "$320",
                isFree = false,
                metaLine = "0.4mi · 2h",
                conditionBadge = "Like new",
            ),
            MarketplaceCardContent(
                id = "l2",
                title = "Solid oak dining table",
                imageUrl = null,
                placeholderGradient = ListingGradient.from("l2"),
                placeholderIcon = PantopusIcon.Home,
                price = "$240",
                isFree = false,
                metaLine = "0.2mi · 1d",
                conditionBadge = "Good",
            ),
            MarketplaceCardContent(
                id = "l3",
                title = "Peloton Bike+ (rental, week)",
                imageUrl = null,
                placeholderGradient = ListingGradient.from("l3"),
                placeholderIcon = PantopusIcon.Calendar,
                price = "$45 / wk",
                isFree = false,
                metaLine = "0.8mi · 3d",
                conditionBadge = null,
            ),
            MarketplaceCardContent(
                id = "l4",
                title = "Moving boxes — bundle of 18",
                imageUrl = null,
                placeholderGradient = ListingGradient.from("l4"),
                placeholderIcon = PantopusIcon.ShoppingBag,
                price = "Free",
                isFree = true,
                metaLine = "0.1mi · now",
                conditionBadge = null,
            ),
            MarketplaceCardContent(
                id = "l5",
                title = "Kid's bike, 16-inch, training wheels",
                imageUrl = null,
                placeholderGradient = ListingGradient.from("l5"),
                placeholderIcon = PantopusIcon.Heart,
                price = "$45",
                isFree = false,
                metaLine = "0.3mi · 6h",
                conditionBadge = "Good",
            ),
            MarketplaceCardContent(
                id = "l6",
                title = "2014 Honda Fit, low miles",
                imageUrl = null,
                placeholderGradient = ListingGradient.from("l6"),
                placeholderIcon = PantopusIcon.Send,
                price = "$6,800",
                isFree = false,
                metaLine = "1.2mi · 4d",
                conditionBadge = "Good",
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
