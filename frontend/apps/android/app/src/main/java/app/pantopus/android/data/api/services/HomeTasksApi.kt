package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Home tasks endpoints from `backend/routes/home.js`. Kept separate
 * from [HomesApi] to mirror the [HomePetsApi] split — the household
 * chore list is a self-contained feature with its own DTO bag.
 *
 * NOT to be confused with the gigs API — these are HOUSEHOLD tasks
 * (per-home chores), not the posted-to-neighbours gig list reached
 * via `me.gigs`.
 */
interface HomeTasksApi {
    /** `GET /api/homes/:id/tasks` — route `backend/routes/home.js:4170`. */
    @GET("api/homes/{id}/tasks")
    suspend fun getHomeTasks(
        @Path("id") homeId: String,
    ): GetHomeTasksResponse

    /** `POST /api/homes/:id/tasks` — route `backend/routes/home.js:4238`. */
    @POST("api/homes/{id}/tasks")
    suspend fun createHomeTask(
        @Path("id") homeId: String,
        @Body body: CreateHomeTaskRequest,
    ): HomeTaskResponse

    /** `PUT /api/homes/:id/tasks/:taskId` — route `backend/routes/home.js:4308`. */
    @PUT("api/homes/{id}/tasks/{taskId}")
    suspend fun updateHomeTask(
        @Path("id") homeId: String,
        @Path("taskId") taskId: String,
        @Body body: UpdateHomeTaskRequest,
    ): HomeTaskResponse

    /** `DELETE /api/homes/:id/tasks/:taskId` — route `backend/routes/home.js:4354`. */
    @DELETE("api/homes/{id}/tasks/{taskId}")
    suspend fun deleteHomeTask(
        @Path("id") homeId: String,
        @Path("taskId") taskId: String,
    )
}
