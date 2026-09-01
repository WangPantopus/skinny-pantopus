@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the T6.6c (P26.5) Support Trains screen.
 *
 * Baselines are recorded on first run via `./gradlew paparazziRecord`
 * and verified on every CI run via `./gradlew paparazziVerify`.
 * Annotated `@Ignore` until baselines land so the first PR doesn't
 * fail CI on a missing image — the follow-up records baselines and
 * removes the annotation.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class SupportTrainsSnapshotTest {
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
    fun support_trains_populated_my_trains_tab() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Support trains",
                    state =
                        ListOfRowsUiState.Loaded(
                            sections = listOf(RowSection(id = "trains", rows = populatedRows())),
                            hasMore = false,
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    tabs = tabs(),
                    selectedTab = SupportTrainsTab.MINE,
                    onSelectTab = {},
                    onBack = {},
                )
            }
        }
    }

    @Test
    fun support_trains_empty_my_trains_tab() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Support trains",
                    state =
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.HandCoins,
                            headline = "No support trains yet",
                            subcopy =
                                "A support train is a calendar of neighbors taking turns helping someone " +
                                    "through a life event. Start one for someone, or join one nearby.",
                            ctaTitle = "Start a train",
                            onCta = {},
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    tabs = tabs(zeroes = true),
                    selectedTab = SupportTrainsTab.MINE,
                    onSelectTab = {},
                    onBack = {},
                )
            }
        }
    }

    private fun tabs(zeroes: Boolean = false): List<ListOfRowsTab> =
        listOf(
            ListOfRowsTab(id = SupportTrainsTab.MINE, label = "My trains", count = if (zeroes) 0 else 4),
            ListOfRowsTab(id = SupportTrainsTab.NEARBY, label = "Nearby", count = if (zeroes) 7 else 7),
            ListOfRowsTab(id = SupportTrainsTab.INVITATIONS, label = "Invitations", count = if (zeroes) 0 else 2),
        )

    private fun populatedRows(): List<RowModel> =
        listOf(
            row(
                id = "n1",
                title = "For the Chen family",
                subtitle = "Meal train · You organize",
                metaTail = "12 / 18 slots · 6 open",
                type = SupportTrainType.Meals,
                statusText = "Filling up",
                statusVariant = StatusChipVariant.Info,
            ),
            row(
                id = "n2",
                title = "For Daniel R.",
                subtitle = "Ride train · You organize",
                metaTail = "6 / 14 slots · 8 open",
                type = SupportTrainType.Rides,
                statusText = "Active",
                statusVariant = StatusChipVariant.Success,
            ),
            row(
                id = "n3",
                title = "For Mrs. Alvarez",
                subtitle = "Pet care · Helper",
                metaTail = "22 / 24 slots · 2 open",
                type = SupportTrainType.PetCare,
                statusText = "Wrapping up",
                statusVariant = StatusChipVariant.Warning,
            ),
        )

    private fun row(
        id: String,
        title: String,
        subtitle: String,
        metaTail: String,
        type: SupportTrainType,
        statusText: String,
        statusVariant: StatusChipVariant,
    ): RowModel =
        RowModel(
            id = id,
            title = title,
            subtitle = subtitle,
            template = RowTemplate.StatusChip,
            leading = RowLeading.CategoryGradientIcon(icon = type.icon, gradient = type.gradient),
            trailing = RowTrailing.Status(text = statusText, variant = statusVariant),
            metaTail = metaTail,
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

    @Suppress("UnusedPrivateMember")
    private val placeholderGradient = GradientPair(PantopusColors.primary500, PantopusColors.primary700)
}
