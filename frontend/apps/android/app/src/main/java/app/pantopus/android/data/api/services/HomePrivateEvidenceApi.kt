package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeEvidenceVerifyReceipt
import app.pantopus.android.data.api.models.homes.HomeEvidenceVerifyRequest
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceList
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

/** Exact private evidence routes in backend/routes/homeClaimEvidenceRoutes.js. */
interface HomePrivateEvidenceApi {
    @GET("api/upload/home-claim-evidence/{home}/{claim}")
    suspend fun list(
        @Path("home") homeId: String,
        @Path("claim") claimId: String,
        @Header("x-pantopus-session-scope") session: String?,
        @Query("review") review: String,
    ): HomePrivateEvidenceList

    @Multipart
    @POST("api/upload/ownership-evidence/{home}/{claim}")
    suspend fun upload(
        @Path("home") homeId: String,
        @Path("claim") claimId: String,
        @Header("x-pantopus-session-scope") session: String,
        @Part("upload_id") uploadId: RequestBody,
        @Part("evidence_type") evidenceType: RequestBody,
        @Part file: MultipartBody.Part,
    ): HomePrivateEvidenceResponse

    @Streaming
    @GET("api/upload/home-claim-evidence/{home}/{claim}/{evidence}/download")
    suspend fun download(
        @Path("home") homeId: String,
        @Path("claim") claimId: String,
        @Path("evidence") evidenceId: String,
        @Header("x-pantopus-session-scope") session: String,
        @Query("review") review: String,
        @Query("review_token") reviewToken: String?,
    ): Response<ResponseBody>

    @POST("api/upload/home-claim-evidence/{home}/{claim}/{evidence}/verify")
    suspend fun verify(
        @Path("home") homeId: String,
        @Path("claim") claimId: String,
        @Path("evidence") evidenceId: String,
        @Header("x-pantopus-session-scope") session: String,
        @Query("review") review: String,
        @Body request: HomeEvidenceVerifyRequest,
    ): HomeEvidenceVerifyReceipt

    @DELETE("api/upload/home-claim-evidence/{home}/{claim}/{evidence}")
    suspend fun remove(
        @Path("home") homeId: String,
        @Path("claim") claimId: String,
        @Path("evidence") evidenceId: String,
        @Header("x-pantopus-session-scope") session: String,
    ): HomePrivateEvidenceResponse
}
