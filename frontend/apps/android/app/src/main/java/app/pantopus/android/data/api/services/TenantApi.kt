package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.tenant.TenantHomeStatusResponse
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileRemoval
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileResponse
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileSession
import app.pantopus.android.data.api.models.tenant.TenantMoveOutRequest
import app.pantopus.android.data.api.models.tenant.TenantMoveOutResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

/**
 * Tenant-side landlord flows. `backend/routes/landlordTenant.js` is
 * mounted at `/api/v1` (`backend/app.js:397`), so the tenant routes
 * resolve to `/api/v1/tenant/…`.
 *
 * Submission reads the existing status route first. The request-cancellation
 * route is not yet consumed by this native wizard.
 */
interface TenantApi {
    @GET("api/v1/tenant/home/{homeId}/status")
    suspend fun homeStatus(
        @Path("homeId") homeId: String,
    ): TenantHomeStatusResponse

    /**
     * `POST /api/v1/tenant/request-approval` — route
     * `backend/routes/landlordTenant.js:483`. Creates a pending
     * `HomeLease` addressed to the home's verified landlord authority.
     *
     * Known non-2xx answers the caller should branch on:
     *  - 400 includes validation/unavailable errors; only the explicit
     *    "This property has no verified landlord…" response selects mail review.
     *  - 409 "You already have a pending request for this home" (:527)
     *  - 409 "You already have an active lease at this home" (:540)
     */
    @POST("api/v1/tenant/request-approval")
    suspend fun requestApproval(
        @Body body: TenantRequestApprovalRequest,
    ): TenantRequestApprovalResponse

    /**
     * `POST /api/v1/tenant/move-out` — route
     * `backend/routes/landlordTenant.js:643`. Ends the caller's own
     * active lease.
     */
    @POST("api/v1/tenant/move-out")
    suspend fun moveOut(
        @Body body: TenantMoveOutRequest,
    ): TenantMoveOutResponse

    @Headers("Cache-Control: no-store")
    @GET("api/v1/tenant/home/{homeId}/lease-files/session")
    suspend fun leaseFileSession(
        @Path("homeId") homeId: String,
        @Header("x-pantopus-session-scope") expectedSession: String? = null,
    ): TenantLeaseFileSession

    @Headers("Cache-Control: no-store")
    @Multipart
    @POST("api/v1/tenant/home/{homeId}/lease-files")
    suspend fun uploadLeaseFile(
        @Path("homeId") homeId: String,
        @Header("x-pantopus-session-scope") sessionScope: String,
        @Part("upload_id") uploadId: RequestBody,
        @Part("request_context") context: RequestBody,
        @Part file: MultipartBody.Part,
    ): TenantLeaseFileResponse

    @Headers("Cache-Control: no-store")
    @DELETE("api/v1/tenant/home/{homeId}/lease-files/{fileId}")
    suspend fun removeLeaseFile(
        @Path("homeId") homeId: String,
        @Path("fileId") fileId: String,
        @Header("x-pantopus-session-scope") sessionScope: String,
    ): TenantLeaseFileRemoval

    @POST("api/v1/tenant/request-approval")
    suspend fun requestApprovalWithLease(
        @Body body: TenantRequestApprovalRequest,
        @Header("x-pantopus-session-scope") sessionScope: String,
    ): TenantRequestApprovalResponse
}
