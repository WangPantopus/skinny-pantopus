package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeTasksApi
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
        open suspend fun getHomeTasks(homeId: String): NetworkResult<GetHomeTasksResponse> = safeApiCall { api.getHomeTasks(homeId) }

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
        ): NetworkResult<HomeTaskResponse> = safeApiCall { api.updateHomeTask(homeId, taskId, request) }

        /** `DELETE /api/homes/:id/tasks/:taskId`. */
        open suspend fun deleteHomeTask(
            homeId: String,
            taskId: String,
        ): NetworkResult<Unit> = safeApiCall { api.deleteHomeTask(homeId, taskId) }
    }
