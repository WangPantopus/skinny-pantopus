package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeRelationshipCommand
import app.pantopus.android.data.api.models.homes.HomeRelationshipResponse
import app.pantopus.android.data.api.models.homes.HomeRelationshipReview
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path

interface HomeRelationshipApi {
    @GET("api/homes/{home}/ownership-claims/{claim}/relationship-decision")
    @Headers("Cache-Control: no-store")
    suspend fun read(
        @Path("home") home: String,
        @Path("claim") claim: String,
        @Header("x-pantopus-session-scope") session: String?,
    ): HomeRelationshipReview

    @POST("api/homes/{home}/ownership-claims/{claim}/resolve-relationship")
    @Headers("Cache-Control: no-store")
    suspend fun decide(
        @Path("home") home: String,
        @Path("claim") claim: String,
        @Body command: HomeRelationshipCommand,
        @Header("x-pantopus-session-scope") session: String,
    ): HomeRelationshipResponse
}
