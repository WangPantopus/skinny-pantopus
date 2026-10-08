package app.pantopus.android.data.api.services

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.Path

interface HomeResidencyQueueApi {
    @GET("api/homes/residency-claims/session")
    @Headers("Cache-Control: no-cache, no-store")
    suspend fun session(): Response<ResponseBody>

    // The server names each applicant (display_name) only when asked: older builds check these keys exactly.
    @GET("api/homes/{home}/claims")
    @Headers("Cache-Control: no-cache, no-store", "X-Pantopus-Display-Names: 1")
    suspend fun list(
        @Path("home") home: String,
        @Header("X-Pantopus-Session-Scope") session: String,
    ): Response<ResponseBody>
}
