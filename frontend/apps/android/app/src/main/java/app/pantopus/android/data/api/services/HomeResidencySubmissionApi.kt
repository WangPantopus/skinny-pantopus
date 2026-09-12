package app.pantopus.android.data.api.services

import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path

interface HomeResidencySubmissionApi {
    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes/{home}/residency-submissions")
    suspend fun submit(
        @Path("home") home: String,
        @Body body: RequestBody,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @GET("api/homes/{home}/residency-submissions/{request}")
    suspend fun status(
        @Path("home") home: String,
        @Path("request") request: String,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes/{home}/residency-submissions/{request}/cancel")
    suspend fun cancel(
        @Path("home") home: String,
        @Path("request") request: String,
    ): Response<ResponseBody>
}
