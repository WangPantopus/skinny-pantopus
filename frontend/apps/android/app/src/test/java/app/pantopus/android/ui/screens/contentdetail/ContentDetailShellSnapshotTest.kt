@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.contentdetail

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
 * Paparazzi baselines for the A09 transactional-detail frames — all four
 * screens × every designed state (gig V2 populated/no-bids, gig V1
 * populated/awarded, listing populated/sold, invoice due/paid). Record
 * with `./gradlew paparazziRecord`.
 */
class ContentDetailShellSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test fun task_v2_populated() = snapshot(GigDetailSampleData.taskV2Populated)

    @Test fun task_v2_no_bids() = snapshot(GigDetailSampleData.taskV2NoBids)

    @Test fun gig_v1_populated() = snapshot(GigDetailSampleData.gigV1Populated)

    @Test fun gig_v1_awarded() = snapshot(GigDetailSampleData.gigV1Awarded)

    @Test fun listing_populated() = snapshot(ListingDetailSampleData.populated)

    @Test fun listing_sold() = snapshot(ListingDetailSampleData.sold)

    @Test fun invoice_due() = snapshot(InvoiceDetailSampleData.due)

    @Test fun invoice_paid() = snapshot(InvoiceDetailSampleData.paid)

    private fun snapshot(content: ContentDetailContent) {
        paparazzi.snapshot {
            Frame {
                ContentDetailShell(
                    state = ContentDetailUiState.Loaded(content),
                    onBack = {},
                    onPrimaryAction = {},
                    onSecondaryAction = {},
                    onMessageCounterparty = {},
                    renderLocationMaps = false,
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
