@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.SavedStateHandle
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * A12.6 Paparazzi snapshots for the verify-landlord Details step —
 * populated and error variants.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VerifyLandlordDetailsSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private class SnapshotVm(
        networkMonitor: NetworkMonitor,
        handle: SavedStateHandle,
    ) : VerifyLandlordWizardViewModel(
            networkMonitor,
            handle,
            mockk(relaxed = true),
            mockk(relaxed = true),
        ) {
        override val submitDelayMillis: Long = 0L
    }

    private fun seededVm(form: VerifyLandlordForm): SnapshotVm {
        val vm =
            SnapshotVm(
                networkMonitor = networkMonitor,
                handle = SavedStateHandle(mapOf(VERIFY_LANDLORD_HOME_ID_KEY to "home-snapshot")),
            )
        vm.onPrimary() // -> Details
        with(form) {
            vm.setOwnerName(ownerName)
            vm.setContactName(contactName)
            vm.setEmail(email)
            vm.setPhone(phone)
            vm.setLease(lease)
            vm.setPMEnabled(pmEnabled)
            if (pmEnabled) {
                vm.setPMName(pmName)
                vm.setPMEmail(pmEmail)
                vm.setPMPhone(pmPhone)
            }
            vm.setMoveInDate(moveInDate)
            vm.setMessageToLandlord(messageToLandlord)
        }
        return vm
    }

    @Test
    fun verify_landlord_details_populated() {
        val vm = seededVm(VerifyLandlordSampleData.populatedForm)
        paparazzi.snapshot {
            Frame(chrome = SnapshotDetailsChrome.enabled) {
                DetailsStep(state = vm.state.value, viewModel = vm)
            }
        }
    }

    @Test
    fun verify_landlord_details_errors() {
        val vm = seededVm(VerifyLandlordSampleData.errorForm)
        // Drive a submit attempt so the VM materialises validation
        // errors. `submitDelayMillis = 0` plus the `UnconfinedTest
        // Dispatcher` set in `@Before` means the launch dispatched
        // by `onPrimary()` runs synchronously, so the next snapshot
        // sees the populated `errors` state.
        vm.onPrimary()
        paparazzi.snapshot {
            Frame(chrome = SnapshotDetailsChrome.disabled) {
                DetailsStep(state = vm.state.value, viewModel = vm)
            }
        }
    }

    @Composable
    private fun Frame(
        chrome: WizardModel,
        content: @Composable () -> Unit,
    ) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) {
                WizardShell(model = chrome, content = content)
            }
        }
    }
}

private object SnapshotDetailsChrome {
    val enabled: WizardModel =
        object : WizardModel {
            override val chrome: WizardChrome =
                WizardChrome(
                    title = "Verify landlord",
                    progressLabel = WizardProgressLabel.StepOf(2, 3),
                    progressFraction = 2f / 3f,
                    leading = WizardLeadingControl.Back,
                    primaryCtaLabel = "Submit",
                    primaryCtaEnabled = true,
                    dirty = true,
                    showsProgressBar = true,
                )

            override fun onLeading() = Unit

            override fun onDiscard() = Unit

            override fun onPrimary() = Unit
        }

    val disabled: WizardModel =
        object : WizardModel {
            override val chrome: WizardChrome =
                WizardChrome(
                    title = "Verify landlord",
                    progressLabel = WizardProgressLabel.StepOf(2, 3),
                    progressFraction = 2f / 3f,
                    leading = WizardLeadingControl.Back,
                    primaryCtaLabel = "Submit",
                    primaryCtaEnabled = false,
                    dirty = true,
                    showsProgressBar = true,
                )

            override fun onLeading() = Unit

            override fun onDiscard() = Unit

            override fun onPrimary() = Unit
        }
}
