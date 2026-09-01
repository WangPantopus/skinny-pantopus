package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.RemoveRentReportResponse
import app.pantopus.android.data.api.models.place.RentReportResponse
import app.pantopus.android.data.api.models.place.SetRentReportRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Real Rent Benchmark (Wave 3) — the resident's own rent contribution.
 * Route `backend/routes/realRent.js` (mounted under `/api/homes`).
 * Reports are personal per home+user; the block aggregate is served
 * only through the intelligence contract's `real_rent` section.
 */
interface RealRentApi {
    /**
     * Contribute or update (verified T4 occupants only — 403
     * `VERIFICATION_REQUIRED` otherwise, 400 `BAD_AMOUNT` on a rent
     * outside the plausibility fence).
     * Route `backend/routes/realRent.js:31`.
     */
    @PUT("api/homes/{id}/rent-report")
    suspend fun set(
        @Path("id") homeId: String,
        @Body body: SetRentReportRequest,
    ): RentReportResponse

    /**
     * The caller's own report, or `{"report": null}`.
     * Route `backend/routes/realRent.js:70`.
     */
    @GET("api/homes/{id}/rent-report")
    suspend fun get(
        @Path("id") homeId: String,
    ): RentReportResponse

    /** Route `backend/routes/realRent.js:87`. */
    @DELETE("api/homes/{id}/rent-report")
    suspend fun remove(
        @Path("id") homeId: String,
    ): RemoveRentReportResponse
}
