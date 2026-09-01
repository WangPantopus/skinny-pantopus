@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import app.pantopus.android.data.api.models.scheduling.GetPackagesResponse
import app.pantopus.android.data.api.models.scheduling.PackageDto
import app.pantopus.android.data.api.models.scheduling.PaymentStatusResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PackagesListViewModelTest {
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
        coEvery { repo.getPaymentsStatus(any()) } returns
            NetworkResult.Success(PaymentStatusResponse(applicable = true, connected = true))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun user() = UserDto(id = "biz-1", email = "a@b.com", displayName = "A", avatarUrl = null)

    private fun pkg(
        id: String,
        active: Boolean = true,
        sold: Int? = 12,
    ) = PackageDto(
        id = id,
        name = "5-session cleaning",
        sessionsCount = 5,
        priceCents = 22000,
        currency = "USD",
        isActive = active,
        soldCount = sold,
    )

    private fun vm() = PackagesListViewModel(repo, auth, errors, flags, relay)

    @Test
    fun `paid flag off shows coming soon`() =
        runTest(dispatcher) {
            flags.environment = "production"
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is PackagesListUiState.ComingSoon)
        }

    @Test
    fun `splits active and archived`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns
                NetworkResult.Success(GetPackagesResponse(listOf(pkg("p1"), pkg("p2"), pkg("p3", active = false))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as PackagesListUiState.Loaded
            assertEquals(2, loaded.active.size)
            assertEquals(1, loaded.archived.size)
        }

    @Test
    fun `payouts gate shows when no active packages and payments not connected`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(emptyList()))
            coEvery { repo.getPaymentsStatus(any()) } returns
                NetworkResult.Success(PaymentStatusResponse(applicable = true, connected = false))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as PackagesListUiState.Loaded
            assertTrue(loaded.showsPayoutsGate)
        }

    @Test
    fun `archive soft-deletes then reloads`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(listOf(pkg("p1"))))
            coEvery { repo.deletePackage(any(), "p1") } returns NetworkResult.Success(SchedulingOkResponse())
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.archive("p1")
            advanceUntilIdle()
            coVerify { repo.deletePackage(any(), "p1") }
        }

    @Test
    fun `create route stashes owner on the relay`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val route = model.createRoute()
            assertEquals("scheduling/packages/new/edit", route)
            assertTrue(relay.pending != null)
        }
}
