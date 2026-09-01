@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.review_signups

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.ChipStripConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
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
 * Paparazzi snapshots for the T6.6c (P26.5) Review Signups screen.
 *
 * Baselines are recorded on first run via `./gradlew paparazziRecord`
 * and verified on every CI run via `./gradlew paparazziVerify`.
 * Annotated `@Ignore` until baselines land so the first PR doesn't
 * fail CI on a missing image.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class ReviewSignupsSnapshotTest {
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
    fun review_signups_populated_all_filter() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Review signups",
                    state =
                        ListOfRowsUiState.Loaded(
                            sections = listOf(RowSection(id = "signups", rows = populatedRows())),
                            hasMore = false,
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                    chipStrip = chipStrip(),
                )
            }
        }
    }

    @Test
    fun review_signups_empty_all_filter() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Review signups",
                    state =
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.ClipboardList,
                            headline = "No signups yet",
                            subcopy =
                                "Share the train so neighbors can grab a slot. You'll see new signups here " +
                                    "for review before they're confirmed.",
                            ctaTitle = "Share train",
                            onCta = {},
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                    chipStrip = chipStrip(),
                )
            }
        }
    }

    private fun chipStrip(): ChipStripConfig =
        ChipStripConfig(
            chips =
                listOf(
                    ChipStripConfig.Chip(id = ReviewSignupsFilter.ALL, label = "All", icon = PantopusIcon.ListChecks),
                    ChipStripConfig.Chip(id = ReviewSignupsFilter.PENDING, label = "Pending", icon = PantopusIcon.Clock),
                    ChipStripConfig.Chip(id = ReviewSignupsFilter.CONFIRMED, label = "Confirmed", icon = PantopusIcon.Check),
                    ChipStripConfig.Chip(id = ReviewSignupsFilter.EDITED, label = "Edited", icon = PantopusIcon.Pencil),
                    ChipStripConfig.Chip(id = ReviewSignupsFilter.CANCELED, label = "Canceled", icon = PantopusIcon.X),
                ),
            selectedId = ReviewSignupsFilter.ALL,
            onSelect = {},
        )

    private fun populatedRows(): List<RowModel> =
        listOf(
            pendingRow(),
            confirmedEditedRow(),
        )

    private fun pendingRow(): RowModel =
        RowModel(
            id = "r1",
            title = "Lena Park",
            subtitle = "Veggie chili + cornbread",
            template = RowTemplate.StatusChip,
            leading =
                RowLeading.AvatarWithBadge(
                    name = "Lena Park",
                    imageUrl = null,
                    background = AvatarBackground.Gradient(GradientPair(PantopusColors.success, PantopusColors.home)),
                    size = AvatarBadgeSize.Medium,
                    verified = false,
                ),
            trailing = RowTrailing.Status(text = "Pending", variant = StatusChipVariant.Warning),
            body = "“I'll knock when I'm there”",
            metaTail = "Drop 6:00 PM",
            timeMeta = "Tue May 22",
            footer =
                RowFooter(
                    actions =
                        listOf(
                            RowFooterAction(
                                title = "Confirm",
                                icon = PantopusIcon.Check,
                                variant = CompactButtonVariant.Primary,
                            ) {},
                            RowFooterAction(
                                title = "Edit",
                                icon = PantopusIcon.Pencil,
                                variant = CompactButtonVariant.Ghost,
                            ) {},
                        ),
                ),
        )

    private fun confirmedEditedRow(): RowModel =
        RowModel(
            id = "r2",
            title = "Marcus Knowles",
            subtitle = "Butternut squash soup",
            template = RowTemplate.StatusChip,
            leading =
                RowLeading.AvatarWithBadge(
                    name = "Marcus Knowles",
                    imageUrl = null,
                    background = AvatarBackground.Gradient(GradientPair(PantopusColors.business, PantopusColors.goods)),
                    size = AvatarBadgeSize.Medium,
                    verified = false,
                ),
            trailing = RowTrailing.Status(text = "Edited", variant = StatusChipVariant.Info),
            body = "“Switching from beef stew to soup — easier on a new mom.”",
            metaTail = "Drop 5:30 PM",
            timeMeta = "Wed May 23",
            footer =
                RowFooter(
                    actions =
                        listOf(
                            RowFooterAction(
                                title = "Message",
                                icon = PantopusIcon.MessageCircle,
                                variant = CompactButtonVariant.Ghost,
                            ) {},
                        ),
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
