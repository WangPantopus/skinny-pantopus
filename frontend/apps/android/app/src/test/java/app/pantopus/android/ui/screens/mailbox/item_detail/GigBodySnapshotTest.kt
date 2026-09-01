@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.GigBody
import app.pantopus.android.ui.theme.PantopusColors
import org.junit.Rule
import org.junit.Test

/**
 * A17.6 — Gig mail body. Paparazzi snapshots of the full item-detail shell
 * with `GigBody` in both designed states: incoming bid (three-way action
 * row + other-bids strip) and accepted (next-steps timeline + Open thread).
 */
class GigBodySnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 3600, softButtons = false),
        )

    @Test fun gig_received_shell() {
        paparazzi.snapshot {
            Root {
                MailboxItemDetailShell(
                    category = MailItemCategory.Gig,
                    trust = MailTrust.Verified,
                    sender = SenderBlockContent("Marcus T.", "12m ago", "MT"),
                    onBack = {},
                ) {
                    GigBody(gig = MailItemSampleData.gigReceived)
                }
            }
        }
    }

    @Test fun gig_accepted_shell() {
        paparazzi.snapshot {
            Root {
                MailboxItemDetailShell(
                    category = MailItemCategory.Gig,
                    trust = MailTrust.Verified,
                    sender = SenderBlockContent("Marcus T.", "12m ago", "MT"),
                    onBack = {},
                ) {
                    GigBody(gig = MailItemSampleData.gigAccepted)
                }
            }
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
    }
}
