package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.GigStopCommand
import app.pantopus.android.data.api.models.gigs.GigStopPreview
import app.pantopus.android.data.api.models.gigs.GigStopProgress
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface GigStopApi {
    @GET("api/gigs/{gigId}/stop-preview")
    suspend fun preview(
        @Path("gigId") gigId: String,
        @Query("action") action: String,
    ): GigStopPreview

    @GET("api/gigs/{gigId}/stop-requests/{requestId}")
    suspend fun request(
        @Path("gigId") gigId: String,
        @Path("requestId") requestId: String,
    ): GigStopProgress

    @POST("api/gigs/{gigId}/stop-requests")
    suspend fun submit(
        @Path("gigId") gigId: String,
        @Body command: GigStopCommand,
    ): GigStopProgress
}
