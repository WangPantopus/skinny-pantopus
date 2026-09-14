package app.pantopus.android.data.api.services

import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path

interface HomePostalApi {
    @Headers("Cache-Control: no-cache, no-store")
    @GET("api/homes/{home}/postcard-status")
    suspend fun current(
        @Path("home") home: String,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes/{home}/postcard-requests")
    suspend fun submitMail(
        @Path("home") home: String,
        @Body body: RequestBody,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @GET("api/homes/{home}/postcard-requests/{request}")
    suspend fun readMail(
        @Path("home") home: String,
        @Path("request") request: String,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes/{home}/postcard-requests/{request}/cancel")
    suspend fun cancelMail(
        @Path("home") home: String,
        @Path("request") request: String,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes/{home}/postcards/{card}/verifications")
    suspend fun submitCode(
        @Path("home") home: String,
        @Path("card") card: String,
        @Body body: RequestBody,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @GET("api/homes/{home}/postcards/{card}/verifications/{request}")
    suspend fun readCode(
        @Path("home") home: String,
        @Path("card") card: String,
        @Path("request") request: String,
    ): Response<ResponseBody>

    @Headers("Cache-Control: no-cache, no-store")
    @POST("api/homes/{home}/postcards/{card}/verifications/{request}/cancel")
    suspend fun cancelCode(
        @Path("home") home: String,
        @Path("card") card: String,
        @Path("request") request: String,
    ): Response<ResponseBody>
}
