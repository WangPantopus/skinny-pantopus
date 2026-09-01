package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The Real Rent CONTRIBUTION (Wave 3) — the resident's own report,
 * which rides `backend/routes/realRent.js`. The block AGGREGATE never
 * comes through here: it rides the intelligence contract's `real_rent`
 * section ([PlaceRealRentData]) behind the same k>=10 floor.
 *
 * Writing is hard-gated to a VERIFIED occupant (403
 * `VERIFICATION_REQUIRED`) — "ten neighbors who proved they live here"
 * is the entire difference between this and a listings-site estimate.
 * Reading the caller's OWN report needs only home access; it is their
 * figure.
 */
@JsonClass(generateAdapter = true)
data class RentReport(
    /** Whole dollars per month, as the caller entered it. */
    @Json(name = "monthly_rent") val monthlyRent: Int,
    val bedrooms: Int? = null,
    @Json(name = "reported_at") val reportedAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class SetRentReportRequest(
    @Json(name = "monthly_rent") val monthlyRent: Int,
    /** Omitted ⇒ the server falls back to the home's own bedroom count. */
    val bedrooms: Int? = null,
)

@JsonClass(generateAdapter = true)
data class RentReportResponse(
    /** Null on GET when this resident has not reported yet. */
    val report: RentReport? = null,
)

@JsonClass(generateAdapter = true)
data class RemoveRentReportResponse(
    val removed: Boolean = false,
)
