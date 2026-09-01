@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.visits

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.scheduling.CreateVisitRequest
import app.pantopus.android.data.api.models.scheduling.VisitDto
import app.pantopus.android.data.api.models.scheduling.VisitResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling.resources.VisitKind
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class VisitSetupViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk(relaxed = true)
    private val members: HomeMembersRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() {
        Dispatchers.setMain(dispatcher)
        val home = mockk<MyHome>(relaxed = true)
        every { home.id } returns "home-1"
        every { home.isPrimaryOwner } returns true
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(listOf(home), null))
        coEvery { members.listOccupants(any()) } returns
            NetworkResult.Success(OccupantsResponse(listOf(OccupantDto(id = "o1", userId = "u1", displayName = "Dad"))))
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(routeHomeId: String? = null) =
        VisitSetupViewModel(
            repo,
            homes,
            members,
            errors,
            SavedStateHandle(
                buildMap {
                    routeHomeId?.let {
                        put(app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes.ARG_HOME_ID, it)
                    }
                },
            ),
        )

    @Test
    fun `invalid until a title and at least one host are chosen`() =
        runTest(dispatcher) {
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.loadState.value is VisitSetupLoadState.Ready)
            assertFalse(model.isValid)
            model.setTitle("Plumber visit")
            assertFalse(model.isValid)
            model.toggleHost("u1")
            assertTrue(model.isValid)
        }

    @Test
    fun `save creates a vendor visit and returns the new id`() =
        runTest(dispatcher) {
            coEvery { repo.createVisit(any(), any()) } returns
                NetworkResult.Success(VisitResponse(VisitDto(id = "v1")))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.setTitle("Plumber visit")
            model.setKind(VisitKind.Vendor)
            model.toggleHost("u1")

            val id = model.save()

            assertEquals("v1", id)
            coVerify {
                repo.createVisit(
                    any(),
                    match<CreateVisitRequest> { it.title == "Plumber visit" && it.visitType == "vendor" && it.whoIsHome == listOf("u1") },
                )
            }
        }

    @Test
    fun `bad range yields a friendly 30-day message`() =
        runTest(dispatcher) {
            coEvery { repo.createVisit(any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(400, "{\"error\":\"BAD_RANGE\"}"))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.setTitle("Plumber visit")
            model.toggleHost("u1")

            val id = model.save()

            assertEquals(null, id)
            assertTrue(model.saveError.value?.contains("30-day") == true)
        }
}
