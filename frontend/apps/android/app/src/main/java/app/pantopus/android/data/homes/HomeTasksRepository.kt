package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeTasksApi
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
        /** `GET /api/homes/:id/tasks`. */
        open suspend fun getHomeTasks(
            homeId: String,
            expectedSession: String? = null,
        ): NetworkResult<GetHomeTasksResponse> = safeApiCall { api.getHomeTasks(homeId, expectedSession) }

        open suspend fun getHomeTask(
            homeId: String,
            taskId: String,
            expectedSession: String? = null,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.getHomeTask(homeId, taskId, expectedSession) }

        /** `POST /api/homes/:id/tasks`. */
        open suspend fun createHomeTask(
            homeId: String,
            request: CreateHomeTaskRequest,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.createHomeTask(homeId, request) }

        /** `PUT /api/homes/:id/tasks/:taskId`. */
        open suspend fun updateHomeTask(
            homeId: String,
            taskId: String,
            request: UpdateHomeTaskRequest,
            expectedSession: String? = null,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.updateHomeTask(homeId, taskId, request, expectedSession) }

        /** `DELETE /api/homes/:id/tasks/:taskId`. */
        open suspend fun deleteHomeTask(
            homeId: String,
            taskId: String,
            expectedSession: String? = null,
        ): NetworkResult<Unit> =
            safeApiCall {
                val response = api.deleteHomeTask(homeId, taskId, expectedSession)
                if (response.message != "Task deleted") throw JsonDataException("The task deletion was not confirmed.")
            }
    }
