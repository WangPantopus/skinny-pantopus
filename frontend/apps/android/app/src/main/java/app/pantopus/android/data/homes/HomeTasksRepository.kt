package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskCreationResponse
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceState
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeTasksApi
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.Stored
import com.squareup.moshi.JsonDataException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * T6.3c / P11 - thin wrapper around per-home household task endpoints.
 * Kept separate from [HomesRepository] so the broader homes facade does
 * not grow with each home sub-surface.
 */
@Singleton
open class HomeTasksRepository
    @Inject
    constructor(
        private val api: HomeTasksApi,
        private val store: ScreenStore,
    ) {
        open suspend fun getRecurrence(
            homeId: String,
            taskId: String,
            session: String,
        ): NetworkResult<HomeTaskRecurrenceState> = safeApiCall { api.getRecurrence(homeId, taskId, session) }

        open suspend fun changeRecurrence(
            homeId: String,
            taskId: String,
            request: HomeTaskRecurrenceRequest,
            session: String,
        ): NetworkResult<HomeTaskRecurrenceState> =
            safeApiCall { api.changeRecurrence(homeId, taskId, request, session) }.also { changed(homeId, it) }

        /** `GET /api/homes/:id/tasks`. */
        open suspend fun getHomeTasks(
            homeId: String,
            expectedSession: String? = null,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<GetHomeTasksResponse> = safeApiCall { api.getHomeTasks(homeId, expectedSession, dispatchGuard) }

        /** [getHomeTasks] through the screens' store: a fresh copy answers without a request. */
        open suspend fun getHomeTasksStored(
            homeId: String,
            expectedSession: String?,
            dispatchGuard: AuthenticatedDispatchGuard?,
            force: Boolean = false,
        ): Stored<GetHomeTasksResponse> =
            store.read(HomeStoreKeys.tasks(homeId), force) { etag ->
                conditionalApiCall { api.getHomeTasksConditional(homeId, expectedSession, dispatchGuard, etag) }
            }

        /** The stored task list, without a request. */
        open fun storedHomeTasks(homeId: String): GetHomeTasksResponse? = store.peek(HomeStoreKeys.tasks(homeId)).data

        /** Capture before a direct list read; Clear cache, account changes and newer edits retire this callback. */
        open fun homeTasksWriter(homeId: String): (GetHomeTasksResponse) -> Unit = store.writer(HomeStoreKeys.tasks(homeId))

        /** Capture before a direct task read, then call only after the session and exact task are validated. */
        open fun homeTaskWriter(
            homeId: String,
            taskId: String,
        ): (HomeTaskResponse) -> Unit = store.writer(HomeStoreKeys.task(homeId, taskId))

        /** A list just read directly (for example after an own edit) becomes the stored copy. */
        open fun rememberHomeTasks(
            homeId: String,
            response: GetHomeTasksResponse,
        ) = store.put(HomeStoreKeys.tasks(homeId), response)

        /** A task just read directly becomes the stored copy. */
        open fun rememberHomeTask(
            homeId: String,
            taskId: String,
            response: HomeTaskResponse,
        ) = store.put(HomeStoreKeys.task(homeId, taskId), response)

        open suspend fun getHomeTask(
            homeId: String,
            taskId: String,
            expectedSession: String? = null,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.getHomeTask(homeId, taskId, expectedSession, dispatchGuard) }

        /** [getHomeTask] through the screens' store: a fresh copy answers without a request. */
        open suspend fun getHomeTaskStored(
            homeId: String,
            taskId: String,
            expectedSession: String?,
            dispatchGuard: AuthenticatedDispatchGuard?,
            force: Boolean = false,
        ): Stored<HomeTaskResponse> =
            store.read(HomeStoreKeys.task(homeId, taskId), force) { etag ->
                conditionalApiCall { api.getHomeTaskConditional(homeId, taskId, expectedSession, dispatchGuard, etag) }
            }

        /** The stored task, without a request. */
        open fun storedHomeTask(
            homeId: String,
            taskId: String,
        ): HomeTaskResponse? = store.peek(HomeStoreKeys.task(homeId, taskId)).data

        /** `POST /api/homes/:id/tasks`. */
        open suspend fun createHomeTask(
            homeId: String,
            request: CreateHomeTaskRequest,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.createHomeTask(homeId, request) }.also { changed(homeId, it) }

        open suspend fun createHomeTaskWithReceipt(
            homeId: String,
            request: CreateHomeTaskRequest,
            expectedSession: String,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<HomeTaskCreationResponse> =
            safeApiCall {
                api.createHomeTaskWithReceipt(
                    homeId,
                    request,
                    expectedSession,
                    dispatchGuard,
                )
            }.also { changed(homeId, it) }

        open suspend fun patchHomeTask(
            homeId: String,
            taskId: String,
            patch: HomeTaskEditPatch,
            expectedSession: String,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<HomeTaskResponse> =
            safeApiCall { api.patchHomeTask(homeId, taskId, patch.body(), expectedSession, dispatchGuard) }.also { changed(homeId, it) }

        /** `PUT /api/homes/:id/tasks/:taskId`. */
        open suspend fun updateHomeTask(
            homeId: String,
            taskId: String,
            request: UpdateHomeTaskRequest,
            expectedSession: String? = null,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<HomeTaskResponse> =
            safeApiCall { api.updateHomeTask(homeId, taskId, request, expectedSession, dispatchGuard) }.also { changed(homeId, it) }

        /** `DELETE /api/homes/:id/tasks/:taskId`. */
        open suspend fun deleteHomeTask(
            homeId: String,
            taskId: String,
            expectedSession: String? = null,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<Unit> =
            safeApiCall {
                val response = api.deleteHomeTask(homeId, taskId, expectedSession, dispatchGuard)
                if (response.message != "Task deleted") throw JsonDataException("The task deletion was not confirmed.")
            }.also {
                changed(homeId, it)
                // The deleted task's own copy goes at once instead of showing until its next read answers 404.
                if (it is NetworkResult.Success) store.remove(HomeStoreKeys.task(homeId, taskId))
            }

        /** Own edit (contract §8 "a task is created, changed, done or deleted"): the Home's screens and Today read again. */
        private fun changed(
            homeId: String,
            result: NetworkResult<*>,
        ) {
            if (result !is NetworkResult.Success) return
            store.markStale("home:$homeId")
            store.markStale("today")
        }
    }
