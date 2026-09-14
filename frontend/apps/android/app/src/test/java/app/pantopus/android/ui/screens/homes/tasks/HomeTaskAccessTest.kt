@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskCapabilitiesDto
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskEditPatch
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskAccessTest {
    private val repository = mockk<HomeTasksRepository>()
    private val identity = HomeClaimScopeTestFixture()
    private lateinit var scope: CoroutineScope
    private lateinit var access: HomeTaskAccess
    private val server = HomeTaskSessionDto("user-1", "home", "a".repeat(64))
    private val task = HomeTaskDto("task", "home", "chore", "Private task", capabilities = HomeTaskCapabilitiesDto(true, true, true))

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        access = HomeTaskAccessFactory(repository, claimScopeFactory(identity)).create("home", scope)
        coEvery { repository.getHomeTasks(any(), any()) } returns
            NetworkResult.Success(
                GetHomeTasksResponse(listOf(task), taskSession = server),
            )
        coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(task, server))
    }

    @After fun teardown() {
        scope.cancel()
        Dispatchers.resetMain()
    }

    private suspend fun denied(action: suspend () -> Unit) {
        var error: IllegalStateException? = null
        try {
            action()
        } catch (caught: IllegalStateException) {
            error = caught
        }
        assertNotNull(error)
    }

    @Test fun exact_collection_then_detail_keeps_opening_session() =
        runTest {
            access.list()
            assertEquals(task, access.read("task"))
            coVerify { repository.getHomeTasks("home", null) }
            coVerify { repository.getHomeTask("home", "task", server.sessionScope) }
        }

    @Test fun standalone_detail_binds_current_actor_without_collection() =
        runTest {
            assertEquals(task, access.read("task"))
            coVerify(exactly = 0) { repository.getHomeTasks(any(), any()) }
        }

    @Test fun missing_or_wrong_scope_cannot_bind() =
        runTest {
            for (wrong in listOf(null, server.copy(homeId = "other"), server.copy(actorId = "other"), server.copy(sessionScope = "bad"))) {
                coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(task, wrong))
                denied { access.read("task") }
            }
        }

    @Test fun foreign_task_or_home_never_reaches_detail() =
        runTest {
            for (wrong in listOf(task.copy(id = "other"), task.copy(homeId = "other"))) {
                coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(wrong, server))
                denied { access.read("task") }
            }
        }

    @Test fun foreign_collection_record_is_rejected() =
        runTest {
            coEvery { repository.getHomeTasks(any(), any()) } returns
                NetworkResult.Success(
                    GetHomeTasksResponse(listOf(task.copy(homeId = "other")), taskSession = server),
                )
            denied { access.list() }
        }

    @Test fun delayed_initial_response_cannot_adopt_replacement_login() =
        runTest {
            coEvery { repository.getHomeTask(any(), any(), any()) } answers {
                identity.storedToken = "replacement"
                NetworkResult.Success(HomeTaskResponse(task, server))
            }
            denied { access.read("task") }
        }

    @Test fun later_fingerprint_drift_is_not_adopted() =
        runTest {
            access.read("task")
            coEvery { repository.getHomeTask(any(), any(), any()) } returns
                NetworkResult.Success(
                    HomeTaskResponse(task, server.copy(sessionScope = "b".repeat(64))),
                )
            denied { access.read("task") }
        }

    @Test fun absent_or_denied_capabilities_prevent_both_writes() =
        runTest {
            for (caps in listOf(null, HomeTaskCapabilitiesDto(canEdit = true))) {
                coEvery { repository.getHomeTask(any(), any(), any()) } returns
                    NetworkResult.Success(
                        HomeTaskResponse(task.copy(capabilities = caps), server),
                    )
                denied { access.complete("task", true) }
                denied { access.delete("task") }
            }
            coVerify(exactly = 0) { repository.updateHomeTask(any(), any(), any(), any()) }
            coVerify(exactly = 0) { repository.deleteHomeTask(any(), any(), any()) }
        }

    @Test fun completion_sends_only_status_and_returns_current_projection() =
        runTest {
            val updated = task.copy(status = "done", capabilities = HomeTaskCapabilitiesDto())
            coEvery { repository.updateHomeTask(any(), any(), any(), any()) } answers {
                coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(updated, server))
                NetworkResult.Success(HomeTaskResponse(updated.copy(capabilities = null)))
            }
            assertEquals(updated, access.complete("task", true))
            coVerify { repository.updateHomeTask("home", "task", UpdateHomeTaskRequest(status = "done"), server.sessionScope) }
        }

    @Test fun foreign_mutation_receipt_is_rejected_before_success() =
        runTest {
            coEvery { repository.updateHomeTask(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    HomeTaskResponse(task.copy(id = "other")),
                )
            denied { access.complete("task", true) }
        }

    @Test fun local_relogin_during_mutation_drops_late_success() =
        runTest {
            coEvery { repository.updateHomeTask(any(), any(), any(), any()) } answers {
                identity.storedToken = "replacement"
                NetworkResult.Success(HomeTaskResponse(task))
            }
            denied { access.complete("task", true) }
        }

    @Test fun deletion_uses_exact_current_session() =
        runTest {
            coEvery { repository.deleteHomeTask(any(), any(), any()) } returns NetworkResult.Success(Unit)
            access.delete("task")
            coVerify { repository.deleteHomeTask("home", "task", server.sessionScope) }
        }

    @Test fun current_403_is_not_converted_to_empty_success() =
        runTest {
            val error = NetworkError.Server(403, "Denied")
            coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Failure(error)
            var caught: NetworkError? = null
            try {
                access.read("task")
            } catch (failure: NetworkError) {
                caught = failure
            }
            assertEquals(error, caught)
        }

    @Test fun completion_permission_never_substitutes_for_edit_permission() =
        runTest {
            coEvery { repository.getHomeTask(any(), any(), any()) } returns
                NetworkResult.Success(
                    HomeTaskResponse(task.copy(capabilities = HomeTaskCapabilitiesDto(canComplete = true)), server),
                )
            denied { access.edit("task", HomeTaskEditPatch(mapOf("title" to "Changed"))) }
            coVerify(exactly = 0) { repository.patchHomeTask(any(), any(), any(), any()) }
        }

    @Test fun edit_rechecks_current_permission_and_returns_post_save_projection() =
        runTest {
            val patch = HomeTaskEditPatch(mapOf("description" to null))
            val updated = task.copy(description = null, capabilities = HomeTaskCapabilitiesDto())
            coEvery { repository.patchHomeTask(any(), any(), any(), any()) } answers {
                coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(updated, server))
                NetworkResult.Success(HomeTaskResponse(updated.copy(capabilities = null)))
            }
            assertEquals(updated, access.edit("task", patch))
            coVerify { repository.patchHomeTask("home", "task", patch, server.sessionScope) }
        }

    @Test fun edit_rejects_foreign_receipt_and_replaced_local_session() =
        runTest {
            val patch = HomeTaskEditPatch(mapOf("title" to "Changed"))
            coEvery { repository.patchHomeTask(any(), any(), any(), any()) } returns
                NetworkResult.Success(HomeTaskResponse(task.copy(id = "foreign")))
            denied { access.edit("task", patch) }
            coEvery { repository.patchHomeTask(any(), any(), any(), any()) } answers {
                identity.storedToken = "replacement"
                NetworkResult.Success(HomeTaskResponse(task))
            }
            denied { access.edit("task", patch) }
        }

    @Test fun unchanged_response_cannot_confirm_requested_title_or_null_clears() =
        runTest {
            val existing =
                task.copy(
                    description = "Keep",
                    assignedTo = "member",
                    dueAt = "2026-09-10T12:00:00Z",
                    recurrenceRule = "FREQ=WEEKLY",
                )
            coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(existing, server))
            coEvery { repository.patchHomeTask(any(), any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(existing))
            for (patch in listOf(
                mapOf("title" to "Changed"),
                mapOf("description" to null),
                mapOf("assigned_to" to null),
                mapOf("due_at" to null),
                mapOf("recurrence_rule" to null),
            )) {
                denied { access.edit("task", HomeTaskEditPatch(patch)) }
            }
        }

    @Test fun equivalent_due_date_normalization_confirms_an_actual_edit() =
        runTest {
            val updated = task.copy(dueAt = "2026-09-11T01:32:00Z")
            coEvery { repository.patchHomeTask(any(), any(), any(), any()) } answers {
                coEvery { repository.getHomeTask(any(), any(), any()) } returns NetworkResult.Success(HomeTaskResponse(updated, server))
                NetworkResult.Success(HomeTaskResponse(updated))
            }
            assertEquals(updated, access.edit("task", HomeTaskEditPatch(mapOf("due_at" to "2026-09-10T18:32:00-07:00"))))
        }
}
