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
 * P6.2 Paparazzi baselines for the Report-User sheet. Locks the four
 * design states: idle (no reason), reason-selected, other-requires-details
 * (with the red "Required" caption), and the failed-submission error
 * banner.
 */
class ReportUserSheetSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2_000,
                    softButtons = false,
                ),
        )

    @Test
    fun report_user_sheet_idle() {
        paparazzi.snapshot {
            Frame {
                ReportUserSheetBody(
                    handle = "alex",
                    displayName = "Alex Rivera",
                    state = ReportSheetUiState.Idle,
                    selectedReason = null,
                    details = "",
                    onSelectReason = {},
                    onDetailsChange = {},
                    onSubmit = {},
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun report_user_sheet_reason_selected() {
        paparazzi.snapshot {
            Frame {
                ReportUserSheetBody(
                    handle = "alex",
                    displayName = "Alex Rivera",
                    state = ReportSheetUiState.Idle,
                    selectedReason = ReportReason.Harassment,
                    details = "",
                    onSelectReason = {},
                    onDetailsChange = {},
                    onSubmit = {},
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun report_user_sheet_other_requires_details() {
        paparazzi.snapshot {
            Frame {
                ReportUserSheetBody(
                    handle = "alex",
                    displayName = "Alex Rivera",
                    state = ReportSheetUiState.Idle,
                    selectedReason = ReportReason.Other,
                    details = "",
                    onSelectReason = {},
                    onDetailsChange = {},
                    onSubmit = {},
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun report_user_sheet_submitting() {
        paparazzi.snapshot {
            Frame {
                ReportUserSheetBody(
                    handle = "alex",
                    displayName = "Alex Rivera",
                    state = ReportSheetUiState.Submitting,
                    selectedReason = ReportReason.Spam,
                    details = "",
                    onSelectReason = {},
                    onDetailsChange = {},
                    onSubmit = {},
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun report_user_sheet_failed() {
        paparazzi.snapshot {
            Frame {
                ReportUserSheetBody(
                    handle = "alex",
                    displayName = "Alex Rivera",
                    state = ReportSheetUiState.Failed("Couldn't submit your report."),
                    selectedReason = ReportReason.Fraud,
                    details = "Asked me to wire $400 for a rental that doesn't exist.",
                    onSelectReason = {},
                    onDetailsChange = {},
                    onSubmit = {},
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun report_user_sheet_no_handle_falls_back_to_name() {
        paparazzi.snapshot {
            Frame {
                ReportUserSheetBody(
                    handle = null,
                    displayName = "Alex Rivera",
                    state = ReportSheetUiState.Idle,
                    selectedReason = null,
                    details = "",
                    onSelectReason = {},
                    onDetailsChange = {},
                    onSubmit = {},
                    onCancel = {},
                )
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
}
