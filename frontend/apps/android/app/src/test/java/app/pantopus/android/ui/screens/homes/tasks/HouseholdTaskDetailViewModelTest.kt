@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomeTaskCapabilitiesDto
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HouseholdTaskDetailViewModelTest {
    private val repository = mockk<HomeTasksRepository>()
    private val identity = HomeClaimScopeTestFixture()
    private val server = HomeTaskSessionDto("user-1", "home", "a".repeat(64))
    private val task = HomeTaskDto("task", "home", "chore", "Private title", capabilities = HomeTaskCapabilitiesDto(true, true, true))
    private lateinit var model: HouseholdTaskDetailViewModel

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        model =
            HouseholdTaskDetailViewModel(
                HomeTaskAccessFactory(repository, claimScopeFactory(identity)),
                SavedStateHandle(mapOf("homeId" to "home", "taskId" to "task")),
            )
        coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(task, server))
    }

    @After fun teardown() {
        Dispatchers.resetMain()
    }

    @Test fun exact_read_only_task_remains_visible_without_any_action() =
        runTest {
            val readonly = task.copy(capabilities = HomeTaskCapabilitiesDto())
            coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(readonly, server))
            model.reload()
            assertEquals(readonly, model.state.value.task)
            model.complete()
            model.delete()
            var opened = false
            model.edit { opened = true }
            assertFalse(opened)
            coVerify(exactly = 0) { repository.updateHomeTask(any(), any(), any(), any()) }
            coVerify(exactly = 0) { repository.deleteHomeTask(any(), any(), any()) }
        }

    @Test fun revocation_after_open_clears_private_metadata() =
        runTest {
            model.reload()
            coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(403, "Denied"))
            model.reload()
            assertNull(model.state.value.task)
            assertNotNull(model.state.value.error)
        }

    @Test fun failed_transport_recheck_also_hides_previous_content() =
        runTest {
            model.reload()
            coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(503, "Retry"))
            model.reload()
            assertNull(model.state.value.task)
            assertNotNull(model.state.value.error)
        }

    @Test fun changed_capabilities_block_a_stale_edit_callback() =
        runTest {
            model.reload()
            coEvery { repository.getHomeTask(any(), any(), any()) } returns
                NetworkResult.Success(
                    HomeTaskResponse(task.copy(capabilities = HomeTaskCapabilitiesDto()), server),
                )
            var opened = false
            model.edit { opened = true }
            assertFalse(opened)
            assertNull(model.state.value.task)
        }

    @Test fun exact_edit_rechecks_then_opens_the_form() =
        runTest {
            model.reload()
            var opened = false
            model.edit { opened = true }
            assertTrue(opened)
            coVerify(exactly = 2) { repository.getHomeTask("home", "task", any()) }
        }

    @Test fun same_turn_completion_taps_issue_only_one_write() =
        runTest {
            model.reload()
            val pending = CompletableDeferred<NetworkResult<HomeTaskResponse>>()
            coEvery { repository.updateHomeTask(any(), any(), any(), any()) } coAnswers { pending.await() }
            model.complete()
            model.complete()
            model.delete()
            coVerify(exactly = 1) { repository.updateHomeTask(any(), any(), any(), any()) }
            coVerify(exactly = 0) { repository.deleteHomeTask(any(), any(), any()) }
            pending.complete(NetworkResult.Success(HomeTaskResponse(task)))
            assertFalse(model.state.value.busy)
        }

    @Test fun unknown_delete_outcome_never_reports_success_or_restores_stale_task() =
        runTest {
            model.reload()
            coEvery { repository.deleteHomeTask(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(503, "Unknown"))
            model.delete()
            assertFalse(model.state.value.deleted)
            assertNull(model.state.value.task)
            assertNotNull(model.state.value.error)
        }

    @Test fun deletion_waits_for_exact_success() =
        runTest {
            model.reload()
            coEvery { repository.deleteHomeTask(any(), any(), any()) } returns NetworkResult.Success(Unit)
            model.delete()
            assertTrue(model.state.value.deleted)
            assertNull(model.state.value.task)
        }

    @Test fun account_change_immediately_retires_open_metadata() =
        runTest {
            model.reload()
            identity.accounts.value = "another-user"
            assertNull(model.state.value.task)
            model.complete()
            coVerify(exactly = 0) { repository.updateHomeTask(any(), any(), any(), any()) }
        }

    @Test fun late_same_account_login_response_cannot_repopulate_detail() =
        runTest {
            coEvery { repository.getHomeTask(any(), any(), any()) } answers {
                identity.storedToken = "replacement"
                NetworkResult.Success(HomeTaskResponse(task, server))
            }
            model.reload()
            assertNull(model.state.value.task)
            assertFalse(model.state.value.loading)
        }

    @Test fun leaving_detail_during_edit_authorization_never_navigates_later() =
        runTest {
            model.reload()
            val pending = CompletableDeferred<NetworkResult<HomeTaskResponse>>()
            coEvery { repository.getHomeTask(any(), any(), any()) } coAnswers { withContext(NonCancellable) { pending.await() } }
            var opened = false
            model.edit { opened = true }
            model.pause()
            pending.complete(NetworkResult.Success(HomeTaskResponse(task, server)))
            assertFalse(opened)
            assertNull(model.state.value.task)
        }

    @Test fun late_read_after_leaving_never_repopulates_metadata() =
        runTest {
            val pending = CompletableDeferred<NetworkResult<HomeTaskResponse>>()
            coEvery { repository.getHomeTask(any(), any(), any()) } coAnswers { withContext(NonCancellable) { pending.await() } }
            model.reload()
            model.pause()
            pending.complete(NetworkResult.Success(HomeTaskResponse(task, server)))
            assertNull(model.state.value.task)
        }

    @Test fun late_mutation_after_leaving_never_publishes_content_or_success() =
        runTest {
            model.reload()
            val pending = CompletableDeferred<NetworkResult<Unit>>()
            coEvery { repository.deleteHomeTask(any(), any(), any()) } coAnswers { withContext(NonCancellable) { pending.await() } }
            model.delete()
            model.pause()
            pending.complete(NetworkResult.Success(Unit))
            assertFalse(model.state.value.deleted)
            assertNull(model.state.value.task)
        }

    @Test fun resume_refuses_a_replacement_account() =
        runTest {
            model.reload()
            model.pause()
            identity.accounts.value = "another-user"
            model.resume()
            assertNull(model.state.value.task)
            assertNotNull(model.state.value.error)
            coVerify(exactly = 1) { repository.getHomeTask(any(), any(), any()) }
        }
}
