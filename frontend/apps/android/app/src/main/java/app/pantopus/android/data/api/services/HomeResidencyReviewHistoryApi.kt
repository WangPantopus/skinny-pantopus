package app.pantopus.android.data.api.services

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.Path
import retrofit2.http.Query

/** Own saved decisions require current Home review authority on every history read. */
interface HomeResidencyReviewHistoryApi {
    @GET("api/homes/residency-review-history/session")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun session(): Response<ResponseBody>

    @GET("api/homes/residency-review-history/{home}")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun list(
        @Path("home") home: String,
        @Header("X-Pantopus-Session-Scope") session: String,
        @Query("after") after: String?,
    ): Response<ResponseBody>

    @GET("api/homes/residency-review-history/{home}/{receipt}")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun read(
        @Path("home") home: String,
        @Path("receipt") receipt: String,
        @Header("X-Pantopus-Session-Scope") session: String,
    ): Response<ResponseBody>
}
