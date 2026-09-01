@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.settings.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowPillTone
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the A14.4 Blocked users screen (both states).
 *
 * Baselines are recorded on first run via `./gradlew paparazziRecord`
 * and verified on every CI run via `./gradlew paparazziVerify`. Annotated
 * `@Ignore` until baselines land so the first PR doesn't fail CI on a
 * missing image — the follow-up records baselines and removes the
 * annotation. Mirrors the iOS `BlockedUsersSnapshotTests` tripwire.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class BlockedUsersSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    @Test
    fun blocked_users_populated() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Blocked users",
                    state =
                        ListOfRowsUiState.Loaded(
                            sections =
                                listOf(
                                    RowSection(
                                        id = "blocked",
                                        footer =
                                            "Blocked people can't message you, see your profile, or bid on " +
                                                "your tasks. Unblocking doesn't notify them.",
                                        rows = blockedRows(),
                                        style = SectionStyle.Card,
                                    ),
                                ),
                            hasMore = false,
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                )
            }
        }
    }

    @Test
    fun blocked_users_empty() {
        paparazzi.snapshot {
            Frame {
                ListOfRowsScreen(
                    title = "Blocked users",
                    state =
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.UserMinus,
                            headline = "No one blocked",
                            subcopy =
                                "When you block someone, they'll appear here. " +
                                    "They won't be notified, and you can unblock them anytime.",
                            tint = PantopusColors.appSurfaceSunken,
                            accent = PantopusColors.appTextSecondary,
                        ),
                    onRefresh = {},
                    onEndReached = {},
                    onBack = {},
                )
            }
        }
    }

    /**
     * Fixture rows mirroring the design's mixed-tenure list, rendered with
     * the implemented recipe: 36dp avatar · "Blocked <date>" + scope
     * context · neutral Unblock pill.
     */
    private fun blockedRows(): List<RowModel> =
        listOf(
            blockedRow("b1", "Greg Anders", "Blocked Apr 3, 2024"),
            blockedRow("b2", "Priya Sengupta", "Blocked Feb 19, 2024 · Search only"),
            blockedRow("b3", "Tomás Rivera", "Blocked Jan 28, 2024 · Business contexts"),
            blockedRow("b4", "Annika Bauer", "Blocked Nov 12, 2023"),
            blockedRow("b5", "Devon Khoury", "Blocked Sep 7, 2023"),
        )

    private fun blockedRow(
        id: String,
        name: String,
        subtitle: String,
    ): RowModel =
        RowModel(
            id = id,
            title = name,
            subtitle = subtitle,
            template = RowTemplate.AvatarKebab,
            leading =
                RowLeading.AvatarWithBadge(
                    name = name,
                    imageUrl = null,
                    background = AvatarBackground.Solid(PantopusColors.appSurfaceSunken),
                    size = AvatarBadgeSize.Small,
                    verified = false,
                ),
            trailing =
                RowTrailing.PillButton(
                    label = "Unblock",
                    tone = RowPillTone.Neutral,
                    onClick = {},
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
