package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskCreationResponse
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceState
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeTasksApi
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
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
        ): NetworkResult<HomeTaskRecurrenceState> = safeApiCall { api.changeRecurrence(homeId, taskId, request, session) }

        /** `GET /api/homes/:id/tasks`. */
        open suspend fun getHomeTasks(
            homeId: String,
            expectedSession: String? = null,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<GetHomeTasksResponse> = safeApiCall { api.getHomeTasks(homeId, expectedSession, dispatchGuard) }

        open suspend fun getHomeTask(
            homeId: String,
            taskId: String,
            expectedSession: String? = null,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.getHomeTask(homeId, taskId, expectedSession, dispatchGuard) }

        /** `POST /api/homes/:id/tasks`. */
        open suspend fun createHomeTask(
            homeId: String,
            request: CreateHomeTaskRequest,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.createHomeTask(homeId, request) }

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
            }

        open suspend fun patchHomeTask(
            homeId: String,
            taskId: String,
            patch: HomeTaskEditPatch,
            expectedSession: String,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.patchHomeTask(homeId, taskId, patch.body(), expectedSession, dispatchGuard) }

        /** `PUT /api/homes/:id/tasks/:taskId`. */
        open suspend fun updateHomeTask(
            homeId: String,
            taskId: String,
            request: UpdateHomeTaskRequest,
            expectedSession: String? = null,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.updateHomeTask(homeId, taskId, request, expectedSession, dispatchGuard) }

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
            }
    }
