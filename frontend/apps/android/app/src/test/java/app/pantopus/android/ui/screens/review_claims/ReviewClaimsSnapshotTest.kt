@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.review_claims

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
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
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
 * Paparazzi snapshots for the P1.1 Review Claims screen. Mirrors the
 * `ReviewSignupsSnapshotTest` "baselines-recorded-in-follow-up" pattern
 * — annotated `@Ignore` until baselines land so the first PR doesn't
 * fail CI on a missing image.
 *
 * Covers the four list states (loading / empty / populated / error)
 * plus an admin-banner variant on the Pending tab.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class ReviewClaimsSnapshotTest {
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
    fun review_claims_loading_pending_tab() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Review claims",
                    state = ListOfRowsUiState.Loading,
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                    tabs = tabsWithCounts(),
                    selectedTab = ReviewClaimsTab.PENDING,
                )
            }
        }
    }

    @Test
    fun review_claims_populated_pending_tab() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Review claims",
                    state =
                        ListOfRowsUiState.Loaded(
                            sections = listOf(RowSection(id = "claims", rows = populatedRows())),
                            hasMore = false,
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                    tabs = tabsWithCounts(),
                    selectedTab = ReviewClaimsTab.PENDING,
                    banner =
                        BannerConfig(
                            icon = PantopusIcon.Gavel,
                            title = "4 claims awaiting review",
                            subtitle = "Oldest in queue: 10d",
                            tint = BannerCtaTint.Warning,
                        ),
                )
            }
        }
    }

    @Test
    fun review_claims_empty_pending_tab() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Review claims",
                    state =
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.CheckCheck,
                            headline = "No claims to review",
                            subcopy =
                                "You're all caught up. New ownership claims will appear here when " +
                                    "neighbors submit address verification.",
                            ctaTitle = "View approved",
                            onCta = {},
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                    tabs = tabsWithCounts(),
                    selectedTab = ReviewClaimsTab.PENDING,
                )
            }
        }
    }

    @Test
    fun review_claims_error_pending_tab() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Review claims",
                    state = ListOfRowsUiState.Error("Couldn't load claims. Try again."),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                    tabs = tabsWithCounts(),
                    selectedTab = ReviewClaimsTab.PENDING,
                )
            }
        }
    }

    @Test
    fun review_claims_rejected_tab_muted_row() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Review claims",
                    state =
                        ListOfRowsUiState.Loaded(
                            sections = listOf(RowSection(id = "claims", rows = listOf(rejectedRow()))),
                            hasMore = false,
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                    tabs = tabsWithCounts(),
                    selectedTab = ReviewClaimsTab.REJECTED,
                )
            }
        }
    }

    // MARK: - Fixtures

    private fun tabsWithCounts(): List<ListOfRowsTab> =
        listOf(
            ListOfRowsTab(id = ReviewClaimsTab.PENDING, label = "Pending", count = 4),
            ListOfRowsTab(id = ReviewClaimsTab.APPROVED, label = "Approved", count = 38),
            ListOfRowsTab(id = ReviewClaimsTab.REJECTED, label = "Rejected", count = 3),
        )

    private fun populatedRows(): List<RowModel> = listOf(newClaimRow(), agingClaimRow())

    private fun newClaimRow(): RowModel =
        RowModel(
            id = "c_new",
            title = "Riya Patel",
            subtitle = "12 Elm Street, Pittsburgh, PA",
            template = RowTemplate.StatusChip,
            leading =
                RowLeading.AvatarWithBadge(
                    name = "Riya Patel",
                    imageUrl = null,
                    background =
                        AvatarBackground.Gradient(
                            GradientPair(PantopusColors.primary500, PantopusColors.primary700),
                        ),
                    size = AvatarBadgeSize.Medium,
                    verified = false,
                ),
            trailing = RowTrailing.None,
            chips =
                listOf(
                    RowChip("New", icon = PantopusIcon.Sparkles, tint = RowChip.Tint.Status(StatusChipVariant.Info)),
                    RowChip("3 docs", icon = PantopusIcon.Paperclip, tint = RowChip.Tint.Status(StatusChipVariant.Neutral)),
                ),
            timeMeta = "filed 2d ago",
            footer =
                RowFooter(
                    actions =
                        listOf(
                            RowFooterAction(
                                title = "Review claim",
                                icon = PantopusIcon.ArrowRight,
                                variant = CompactButtonVariant.Primary,
                            ) {},
                        ),
                ),
        )

    private fun agingClaimRow(): RowModel =
        RowModel(
            id = "c_old",
            title = "Sam Reyes",
            subtitle = "88 Pinecrest Ln, Pittsburgh, PA",
            template = RowTemplate.StatusChip,
            leading =
                RowLeading.AvatarWithBadge(
                    name = "Sam Reyes",
                    imageUrl = null,
                    background =
                        AvatarBackground.Gradient(
                            GradientPair(PantopusColors.warning, PantopusColors.handyman),
                        ),
                    size = AvatarBadgeSize.Medium,
                    verified = false,
                ),
            trailing = RowTrailing.None,
            chips =
                listOf(
                    RowChip("Aging · 10d", icon = PantopusIcon.Clock, tint = RowChip.Tint.Status(StatusChipVariant.Warning)),
                    RowChip("5 docs", icon = PantopusIcon.Paperclip, tint = RowChip.Tint.Status(StatusChipVariant.Neutral)),
                ),
            timeMeta = "filed 10d ago",
            footer =
                RowFooter(
                    actions =
                        listOf(
                            RowFooterAction(
                                title = "Review claim",
                                icon = PantopusIcon.ArrowRight,
                                variant = CompactButtonVariant.Primary,
                            ) {},
                        ),
                ),
        )

    private fun rejectedRow(): RowModel =
        RowModel(
            id = "c_rej1",
            title = "Alex Chen",
            subtitle = "56 Maple Ave, Pittsburgh, PA",
            template = RowTemplate.StatusChip,
            leading =
                RowLeading.AvatarWithBadge(
                    name = "Alex Chen",
                    imageUrl = null,
                    background =
                        AvatarBackground.Gradient(
                            GradientPair(PantopusColors.error, PantopusColors.business),
                        ),
                    size = AvatarBadgeSize.Medium,
                    verified = false,
                ),
            trailing = RowTrailing.None,
            chips =
                listOf(
                    RowChip("Rejected", icon = PantopusIcon.CircleSlash, tint = RowChip.Tint.Status(StatusChipVariant.ErrorVariant)),
                    RowChip("0 docs", icon = PantopusIcon.Paperclip, tint = RowChip.Tint.Status(StatusChipVariant.Neutral)),
                ),
            timeMeta = "filed 78d ago",
            highlight = RowHighlight.Muted,
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
