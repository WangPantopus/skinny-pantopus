@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.PackageBody
import app.pantopus.android.ui.theme.PantopusColors
import org.junit.Rule
import org.junit.Test

/** A17.8 Paparazzi snapshots for the Package-category detail shell. */
class MailboxItemDetailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 3600, softButtons = false),
        )

    @Test fun package_in_transit_shell() {
        snapshotPackage(MailItemSampleData.packageInTransit, receiveEnabled = false)
    }

    @Test fun package_out_for_delivery_shell() {
        snapshotPackage(MailItemSampleData.packageOutForDelivery, receiveEnabled = false)
    }

    @Test fun package_delivered_shell() {
        snapshotPackage(MailItemSampleData.packageDelivered, receiveEnabled = true)
    }

    private fun snapshotPackage(
        packageInfo: PackageBodyContent,
        receiveEnabled: Boolean,
    ) {
        paparazzi.snapshot {
            Root {
                MailboxItemDetailShell(
                    category = MailItemCategory.Package,
                    trust = MailTrust.Verified,
                    sender = SenderBlockContent("Lerina Books", "12m ago", "LB"),
                    keyFacts =
                        listOf(
                            app.pantopus.android.ui.components.KeyFactRow(
                                label = "Tracking #",
                                value = packageInfo.trackingNumber ?: "Pending",
                                isCode = true,
                            ),
                            app.pantopus.android.ui.components.KeyFactRow(label = "Sender", value = "Lerina Books"),
                            app.pantopus.android.ui.components.KeyFactRow(label = "Carrier", value = packageInfo.carrier),
                        ),
                    onBack = {},
                ) {
                    PackageBody(content = packageInfo, isReceiveEnabled = receiveEnabled)
                }
            }
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
    }
}
