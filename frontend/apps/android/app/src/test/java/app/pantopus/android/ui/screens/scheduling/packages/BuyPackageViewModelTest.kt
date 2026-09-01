@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BuyPackageResponse
import app.pantopus.android.data.api.models.scheduling.GetPackagesResponse
import app.pantopus.android.data.api.models.scheduling.MyPackagesResponse
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.data.api.models.scheduling.PackageDto
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BuyPackageViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }
    private val relay = PackagesOwnerRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedIn(user()))
        coEvery { repo.getMyPackages() } returns NetworkResult.Success(MyPackagesResponse(emptyList()))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun user() = UserDto(id = "biz-1", email = "a@b.com", displayName = "A", avatarUrl = null)

    private fun handle(id: String) = SavedStateHandle(mapOf(SchedulingRoutes.ARG_PACKAGE_ID to id))

    private fun vm(id: String = "p1") = BuyPackageViewModel(handle(id), repo, auth, errors, flags, relay)

    private fun pkg(priceCents: Int) =
        PackageDto(id = "p1", name = "5 cleans", sessionsCount = 5, priceCents = priceCents, currency = "USD")

    @Test
    fun `paid flag off shows coming soon`() =
        runTest(dispatcher) {
            flags.environment = "production"
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is BuyPackageUiState.ComingSoon)
        }

    @Test
    fun `loads the package summary`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(listOf(pkg(22000))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val ready = model.state.value as BuyPackageUiState.Ready
            assertEquals("5 cleans", ready.pkg?.name)
            assertTrue(ready.isPriced)
        }

    @Test
    fun `free package is granted without a payment sheet`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(listOf(pkg(0))))
            coEvery { repo.buyPackage(any(), "p1") } returns NetworkResult.Success(BuyPackageResponse(credit(), clientSecret = null))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.pay()
            advanceUntilIdle()
            val ready = model.state.value as BuyPackageUiState.Ready
            assertTrue(ready.payState is PayState.Paid)
            assertNull(model.presentSecret.value)
        }

    @Test
    fun `priced package emits a client secret to present`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(listOf(pkg(22000))))
            coEvery { repo.buyPackage(any(), "p1") } returns
                NetworkResult.Success(BuyPackageResponse(credit(), clientSecret = "pi_secret"))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.pay()
            advanceUntilIdle()
            assertEquals("pi_secret", model.presentSecret.value)
            val ready = model.state.value as BuyPackageUiState.Ready
            assertTrue(ready.payState is PayState.Paying)
        }

    @Test
    fun `a declined payment surfaces the declined state`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(listOf(pkg(22000))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.onPaymentResult(CheckoutOutcome.Declined("Card declined"))
            val ready = model.state.value as BuyPackageUiState.Ready
            assertTrue(ready.payState is PayState.Declined)
            assertEquals("Card declined", (ready.payState as PayState.Declined).message)
        }

    private fun credit() = PackageCreditDto(id = "c1", packageId = "p1", remaining = 5)
}
