@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import app.pantopus.android.data.api.models.scheduling.CreditPackageMeta
import app.pantopus.android.data.api.models.scheduling.MyPackagesResponse
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MyPackagesViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }
    private val relay = PackagesOwnerRelay()

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = MyPackagesViewModel(repo, errors, flags, relay)

    private fun credit(remaining: Int = 3) =
        PackageCreditDto(
            id = "c1",
            packageId = "p1",
            remaining = remaining,
            purchasedAt = "2026-01-01T00:00:00Z",
            bookingPackage = CreditPackageMeta(name = "5 cleans", sessionsCount = 5, ownerType = "business", ownerId = "biz-1"),
        )

    @Test
    fun `paid flag off shows coming soon`() =
        runTest(dispatcher) {
            flags.environment = "production"
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is MyPackagesUiState.ComingSoon)
        }

    @Test
    fun `empty when there are no credits`() =
        runTest(dispatcher) {
            coEvery { repo.getMyPackages() } returns NetworkResult.Success(MyPackagesResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is MyPackagesUiState.Empty)
        }

    @Test
    fun `loaded with credits`() =
        runTest(dispatcher) {
            coEvery { repo.getMyPackages() } returns NetworkResult.Success(MyPackagesResponse(listOf(credit())))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as MyPackagesUiState.Loaded
            assertEquals(1, loaded.credits.size)
        }

    @Test
    fun `useCredit drives the apply-credit sheet`() =
        runTest(dispatcher) {
            coEvery { repo.getMyPackages() } returns NetworkResult.Success(MyPackagesResponse(listOf(credit())))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.useCredit(credit())
            assertNotNull(model.creditForUse.value)
            model.dismissUseCredit()
            assertEquals(null, model.creditForUse.value)
        }

    @Test
    fun `buy again routes to checkout and stashes the seller owner`() =
        runTest(dispatcher) {
            val route = vm().buyAgainRoute(credit())
            assertEquals("scheduling/packages/p1/buy", route)
            assertTrue(relay.pending != null)
        }
}
