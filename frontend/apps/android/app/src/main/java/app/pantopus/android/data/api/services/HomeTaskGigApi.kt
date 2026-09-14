package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeTaskGigRequest
import app.pantopus.android.data.api.models.homes.HomeTaskGigResponse
import app.pantopus.android.data.api.models.homes.HomeTaskGigState
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path

/** Source reads use Home authority; publication uses the ordinary atomic Gig route. */
interface HomeTaskGigApi {
    @GET("api/homes/{home}/tasks/{task}/gig-publication")
    @Headers("Cache-Control: no-store")
    suspend fun read(
        @Path("home") home: String,
        @Path("task") task: String,
        @Header("x-pantopus-session-scope") session: String,
    ): HomeTaskGigState

    @POST("api/gigs")
    @Headers("Cache-Control: no-store")
    suspend fun publish(
        @Body request: HomeTaskGigRequest,
        @Header("x-pantopus-session-scope") session: String,
    ): HomeTaskGigResponse
}
