@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.support_trains.manage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.support_trains.manage.components.CloseTrainSheet
import app.pantopus.android.ui.screens.support_trains.manage.components.OrganizeSection
import app.pantopus.android.ui.screens.support_trains.manage.components.SendUpdateForm
import app.pantopus.android.ui.screens.support_trains.manage.components.SlotPreview
import app.pantopus.android.ui.screens.support_trains.manage.components.StatCellContent
import app.pantopus.android.ui.screens.support_trains.manage.components.StatCellRow
import app.pantopus.android.ui.screens.support_trains.manage.components.StatCellTone
import app.pantopus.android.ui.screens.support_trains.manage.components.TrainContextStrip
import app.pantopus.android.ui.screens.support_trains.manage.components.WindDownSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the P4.3 / A13.13 Manage train surface.
 * Two states:
 *  - active mid-edit (Murphy meal train, day 12/21, send-update enabled)
 *  - closing-sheet (3-cell summary + thank-you note + destructive CTA)
 *
 * `@Ignore`'d until baselines land — same pattern as
 * [EditSignupSnapshotTest]. Use `./gradlew paparazziRecord` to capture;
 * `./gradlew paparazziVerify` runs in CI.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class ManageTrainSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun manage_train_active() {
        paparazzi.snapshot {
            Frame {
                ActiveBody(content = ManageTrainSampleData.active)
            }
        }
    }

    @Test
    fun manage_train_closing() {
        paparazzi.snapshot {
            Frame {
                Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appText.copy(alpha = 0.45f))) {
                    CloseTrainSheet(
                        content = ManageTrainSampleData.active.close,
                        thankYouNote = "",
                        onUpdateThankYouNote = {},
                        onCancel = {},
                        onConfirm = {},
                        modifier =
                            Modifier
                                .padding(top = 320.dp)
                                .background(PantopusColors.appSurface),
                    )
                }
            }
        }
    }

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

    @Composable
    private fun ActiveBody(content: ManageTrainContent) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            TrainContextStrip(
                title = content.title,
                dateRangeLabel = content.dateRangeLabel,
                isActive = content.isActive,
            )
            StatCellRow(
                cells =
                    listOf(
                        StatCellContent("slots", content.slotFillValue, "Slots", StatCellTone.SUCCESS),
                        StatCellContent("helpers", content.helpersValue, "Helpers", StatCellTone.NEUTRAL),
                        StatCellContent("left", content.daysLeftValue, "Left", StatCellTone.NEUTRAL),
                        StatCellContent("drop", content.dropoutValue, "Dropout", StatCellTone.WARN),
                    ),
            )
            SlotPreview(
                filled = content.slotsFilled,
                dropout = content.slotsDropout,
                open = content.slotsOpen,
                total = content.slotsTotal,
                caption = content.slotFillCaption,
            )
            SendUpdateForm(
                chips = content.audienceChips,
                message = content.draftMessage,
                onMessageChange = {},
                selectedAudienceId = content.selectedAudienceId,
                onSelectAudience = {},
                pushToPhones = content.pushToPhones,
                onTogglePush = {},
                counterLabel = "168 / 500",
                isOverLimit = false,
            )
            OrganizeSection(rows = content.organizeRows, onTapRow = {})
            WindDownSection(row = content.closeRow, onTap = {})
        }
    }
}
