package app.pantopus.android.data.api.services

import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path

/** Raw response envelopes retain rejected/cancelled command proof at every status. */
interface HomeCreationApi {
    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes")
    suspend fun submit(
        @Body body: RequestBody,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @GET("api/homes/create-commands/{id}")
    suspend fun status(
        @Path("id") id: String,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes/create-commands/{id}/cancel")
    suspend fun cancel(
        @Path("id") id: String,
    ): Response<ResponseBody>
}
