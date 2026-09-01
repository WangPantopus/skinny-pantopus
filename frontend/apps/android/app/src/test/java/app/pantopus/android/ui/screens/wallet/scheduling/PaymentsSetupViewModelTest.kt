@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.wallet.scheduling

import app.cash.turbine.test
import app.pantopus.android.data.api.models.connect.ConnectCreateAccountResponse
import app.pantopus.android.data.api.models.connect.ConnectOnboardingResponse
import app.pantopus.android.data.api.models.scheduling.PaymentStatusResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PaymentsSetupViewModelTest {
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val connect: ConnectRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()

    @Before
    fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun flags(enabled: Boolean) = SchedulingFeatureFlags().apply { environment = if (enabled) "development" else "production" }

    private fun vm(enabled: Boolean = true) = PaymentsSetupViewModel(repo, connect, flags(enabled), auth)

    private fun status(
        applicable: Boolean = true,
        connected: Boolean = false,
        charges: Boolean? = null,
        payouts: Boolean? = null,
    ) = PaymentStatusResponse(applicable = applicable, connected = connected, chargesEnabled = charges, payoutsEnabled = payouts)

    // ─── Pure projection ───────────────────────────────────────────────────

    @Test
    fun `setup derives the four frames`() {
        val c = PaymentsSetupViewModel
        assertEquals(PaymentsSetupViewModel.Setup.NotConnected, c.setupOf(status(connected = false)))
        assertEquals(PaymentsSetupViewModel.Setup.Incomplete, c.setupOf(status(connected = true, charges = false)))
        assertEquals(PaymentsSetupViewModel.Setup.Restricted, c.setupOf(status(connected = true, charges = true, payouts = false)))
        assertEquals(PaymentsSetupViewModel.Setup.Ready, c.setupOf(status(connected = true, charges = true, payouts = true)))
    }

    @Test
    fun `pills reflect readiness`() {
        val c = PaymentsSetupViewModel
        val ready = status(connected = true, charges = true, payouts = true)
        assertEquals(PaymentsSetupViewModel.PillState.On, c.chargesPill(ready))
        assertEquals(PaymentsSetupViewModel.PillState.On, c.payoutsPill(ready))
        assertEquals(PaymentsSetupViewModel.PillState.On, c.detailsPill(ready))

        val restricted = status(connected = true, charges = true, payouts = false)
        assertEquals(PaymentsSetupViewModel.PillState.On, c.chargesPill(restricted))
        assertEquals(PaymentsSetupViewModel.PillState.Warn, c.payoutsPill(restricted))
        assertEquals(PaymentsSetupViewModel.PillState.Warn, c.detailsPill(restricted))

        val off = status(connected = false)
        assertEquals(PaymentsSetupViewModel.PillState.Off, c.chargesPill(off))
        assertEquals(PaymentsSetupViewModel.PillState.Off, c.payoutsPill(off))
        assertEquals(PaymentsSetupViewModel.PillState.Off, c.detailsPill(off))
    }

    // ─── Load ──────────────────────────────────────────────────────────────

    @Test
    fun `flag off yields NotEnabled`() =
        runTest {
            val vm = vm(enabled = false)
            vm.load()
            assertEquals(PaymentsSetupUiState.NotEnabled, vm.state.value)
        }

    @Test
    fun `applicable false yields NotApplicable`() =
        runTest {
            coEvery { repo.getPaymentsStatus(any()) } returns NetworkResult.Success(status(applicable = false))
            val vm = vm()
            vm.load()
            assertEquals(PaymentsSetupUiState.NotApplicable, vm.state.value)
        }

    @Test
    fun `connected ready yields Loaded ready`() =
        runTest {
            coEvery { repo.getPaymentsStatus(any()) } returns
                NetworkResult.Success(status(connected = true, charges = true, payouts = true))
            val vm = vm()
            vm.load()
            val loaded = vm.state.value as PaymentsSetupUiState.Loaded
            assertEquals(PaymentsSetupViewModel.Setup.Ready, loaded.model.setup)
            assertTrue(loaded.model.isConnected)
        }

    @Test
    fun `failure yields Error`() =
        runTest {
            coEvery { repo.getPaymentsStatus(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.load()
            assertTrue(vm.state.value is PaymentsSetupUiState.Error)
        }

    @Test
    fun `beginConnect opens the onboarding url`() =
        runTest {
            coEvery { connect.createAccount() } returns NetworkResult.Success(ConnectCreateAccountResponse())
            coEvery { connect.onboarding() } returns
                NetworkResult.Success(ConnectOnboardingResponse(onboardingUrl = "https://stripe.test/onboard"))
            val vm = vm()
            vm.events.test {
                vm.beginConnect()
                val event = awaitItem()
                assertEquals("https://stripe.test/onboard", event.url)
                assertTrue(event.refreshOnReturn)
                cancelAndIgnoreRemainingEvents()
            }
        }
}
