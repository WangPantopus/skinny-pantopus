@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.unmockkObject
import io.mockk.verify
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskNotificationArrivalTest {
    private val home = "a1000000-0000-4000-8000-000000000001"
    private val task = "b1000000-0000-4000-8000-000000000002"
    private val destination = DeepLinkRouter.Destination.HomeTask(home, task)
    private val identity = HomeClaimScopeTestFixture()
    private val repo = mockk<HomeTasksRepository>()
    private lateinit var model: HouseholdTaskDetailViewModel
    private val response =
        HomeTaskResponse(
            HomeTaskDto(task, home, "chore", "Current task"),
            HomeTaskSessionDto("user-1", home, "a".repeat(64)),
        )

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        mockkObject(DeepLinkRouter)
        every { DeepLinkRouter.completeArrival(any()) } returns Unit
        coEvery { repo.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(response)
        model =
            HouseholdTaskDetailViewModel(
                HomeTaskAccessFactory(repo, claimScopeFactory(identity)),
                SavedStateHandle(mapOf("homeId" to home, "taskId" to task)),
            )
    }

    @After fun teardown() {
        unmockkObject(DeepLinkRouter)
        Dispatchers.resetMain()
    }

    @Test fun exact_current_read_completes_only_its_task_arrival() =
        runTest {
            model.reload()
            assertEquals("Current task", model.state.value.task?.title)
            verify(exactly = 1) { DeepLinkRouter.completeArrival(destination) }
        }

    @Test fun current_denial_hides_content_and_finishes_the_arrival() =
        runTest {
            coEvery { repo.getHomeTask(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            model.reload()
            assertNull(model.state.value.task)
            verify(exactly = 1) { DeepLinkRouter.completeArrival(destination) }
        }

    @Test fun suspended_background_read_keeps_arrival_until_actual_departure() =
        runTest {
            val gate = CompletableDeferred<NetworkResult<HomeTaskResponse>>()
            coEvery { repo.getHomeTask(any(), any(), any()) } coAnswers { gate.await() }
            model.reload()
            model.pause()
            verify(exactly = 0) { DeepLinkRouter.completeArrival(any()) }
            model.finishArrival()
            verify(exactly = 1) { DeepLinkRouter.completeArrival(destination) }
            gate.complete(NetworkResult.Success(response))
            assertNull(model.state.value.task)
        }

    @Test fun session_loss_does_not_consume_a_reauthentication_arrival() =
        runTest {
            identity.accounts.value = "replacement"
            model.finishArrival()
            model.reload()
            assertNull(model.state.value.task)
            verify(exactly = 0) { DeepLinkRouter.completeArrival(any()) }
        }
}
