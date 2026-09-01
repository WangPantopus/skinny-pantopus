@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.PackageBody
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * A17.8 — Package mail body. Paparazzi snapshots cover the three designed
 * delivery states plus the UPS carrier fixture, exercising the carrier
 * badge, tracking timeline, proof photo, and the Track-on-carrier +
 * Confirm-pickup split dock. Mirrors iOS `PackageBodySnapshotTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PackageBodySnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2800, softButtons = false),
        )

    @Before fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    @Test fun package_in_transit_body() {
        paparazzi.snapshot {
            Root {
                PackageBody(
                    content = MailItemSampleData.packageInTransit,
                    isReceiveEnabled = false,
                )
            }
        }
    }

    @Test fun package_out_for_delivery_body() {
        paparazzi.snapshot {
            Root {
                PackageBody(
                    content = MailItemSampleData.packageOutForDelivery,
                    isReceiveEnabled = false,
                )
            }
        }
    }

    @Test fun package_delivered_body() {
        paparazzi.snapshot {
            Root {
                PackageBody(
                    content = MailItemSampleData.packageDelivered,
                    isReceiveEnabled = true,
                )
            }
        }
    }

    @Test fun package_ups_delivered_body() {
        paparazzi.snapshot {
            Root {
                PackageBody(
                    content = MailItemSampleData.packageUpsDelivered,
                    isReceiveEnabled = true,
                )
            }
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .verticalScroll(rememberScrollState()),
        ) { content() }
    }
}
