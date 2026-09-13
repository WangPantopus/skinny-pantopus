package app.pantopus.android.data.api.services

import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path

/** Prepared current review and original decision: backend/routes/home.js. */
interface HomeResidencyReviewApi {
    @GET("api/homes/{home}/claim/{claim}/review")
    @Headers("Cache-Control: no-store")
    suspend fun read(
        @Path("home") home: String,
        @Path("claim") claim: String,
        @Header("X-Pantopus-Session-Scope") session: String?,
    ): Response<ResponseBody>

    @POST("api/homes/{home}/claim/{claim}/{action}")
    @Headers("Cache-Control: no-store")
    suspend fun decide(
        @Path("home") home: String,
        @Path("claim") claim: String,
        @Path("action") action: String,
        @Body command: RequestBody,
        @Header("X-Pantopus-Session-Scope") session: String,
    ): Response<ResponseBody>
}
