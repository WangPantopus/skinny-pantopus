@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord.postcard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.SavedStateHandle
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import io.mockk.mockk
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
 * A12.7 Paparazzi snapshots — in-transit and delivered variants of the
 * standalone postcard verification surface.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PostcardVerificationSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private class TestVm(
        handle: SavedStateHandle,
    ) : PostcardVerificationViewModel(handle, mockk(relaxed = true)) {
        override val submitDelayMillis: Long = 0L
        override val expectedCode: String = DEFAULT_EXPECTED_CODE
    }

    private fun vm(homeId: String): TestVm = TestVm(SavedStateHandle(mapOf(POSTCARD_VERIFICATION_HOME_ID_KEY to homeId)))

    @Test
    fun postcard_in_transit() {
        paparazzi.snapshot {
            Frame {
                PostcardVerificationScreen(
                    onDismiss = {},
                    onVerified = {},
                    viewModel = vm("home-in-transit"),
                )
            }
        }
    }

    @Test
    fun postcard_delivered() {
        val instance = vm("home-delivered")
        instance.setStage(PostcardDeliveryStage.Delivered)
        instance.updateCode("4Q2K7B")
        paparazzi.snapshot {
            Frame {
                PostcardVerificationScreen(
                    onDismiss = {},
                    onVerified = {},
                    viewModel = instance,
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
            ) {
                content()
            }
        }
    }
}
