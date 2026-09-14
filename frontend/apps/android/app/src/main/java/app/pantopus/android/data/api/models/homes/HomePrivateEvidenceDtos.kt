package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class HomeEvidenceSessionDto(
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "session_scope") val sessionScope: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claim_id") val claimId: String,
)

@JsonClass(generateAdapter = true)
data class HomePrivateEvidenceDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claim_id") val claimId: String,
    @Json(name = "evidence_type") val evidenceType: String,
    @Json(name = "file_name") val fileName: String,
    @Json(name = "file_size") val fileSize: Long,
    @Json(name = "mime_type") val mimeType: String,
    val status: String,
    val state: String,
    val available: Boolean,
    @Json(name = "eligible_for_review") val eligibleForReview: Boolean,
    @Json(name = "cleanup_pending") val cleanupPending: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class HomePrivateEvidenceList(
    val evidence: List<HomePrivateEvidenceDto>,
    @Json(name = "claim_session") val claimSession: HomeEvidenceSessionDto,
    @Json(name = "can_verify") val canVerify: Boolean,
    @Json(name = "review_token") val reviewToken: String?,
)

@JsonClass(generateAdapter = true)
data class HomePrivateEvidenceResponse(val evidence: HomePrivateEvidenceDto)

@JsonClass(generateAdapter = true)
data class HomeEvidenceVerifyRequest(
    @Json(name = "review_token") val reviewToken: String,
    val inspection: String,
)

@JsonClass(generateAdapter = true)
data class HomeEvidenceVerifyReceipt(
    val ok: Boolean,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claim_id") val claimId: String,
    @Json(name = "upload_id") val uploadId: String,
    val action: String,
    @Json(name = "review_token") val reviewToken: String,
    val record: HomePrivateEvidenceDto,
    val replayed: Boolean,
)
