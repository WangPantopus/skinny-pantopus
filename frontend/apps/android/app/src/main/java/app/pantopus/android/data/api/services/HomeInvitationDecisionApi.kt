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

interface HomeInvitationDecisionApi {
    @GET("api/homes/invitations/token/{token}")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun preview(
        @Path("token") token: String,
    ): Response<ResponseBody>

    @GET("api/homes/invitations/decisions/session")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun session(): Response<ResponseBody>

    @GET("api/homes/invitations/token/{token}/decision-context")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun context(
        @Path("token") token: String,
        @Header("X-Pantopus-Session-Scope") session: String,
    ): Response<ResponseBody>

    @GET("api/homes/invitations/decisions/{request}")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun read(
        @Path("request") request: String,
        @Header("X-Pantopus-Session-Scope") session: String,
    ): Response<ResponseBody>

    @POST("api/homes/invitations/decisions")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun submit(
        @Body body: RequestBody,
        @Header("X-Pantopus-Session-Scope") session: String,
    ): Response<ResponseBody>

    @POST("api/homes/invitations/decisions/{request}/cancel")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun cancel(
        @Path("request") request: String,
        @Body body: RequestBody,
        @Header("X-Pantopus-Session-Scope") session: String,
    ): Response<ResponseBody>
}
