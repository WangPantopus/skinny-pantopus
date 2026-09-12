package app.pantopus.android.data.api.models.homes

import app.pantopus.android.data.homes.homeTaskUUID
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant

@JsonClass(generateAdapter = true)
data class PersonalHomeResidencyRequest(
    val id: String,
    @Json(name = "home_id") val homeId: String?,
    @Json(name = "submitted_address") val submittedAddress: String?,
    @Json(name = "claimed_role") val claimedRole: String?,
    val status: String,
    @Json(name = "reviewed_at") val reviewedAt: String?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?,
) {
    fun isValid(): Boolean =
        homeTaskUUID(id) && (homeId == null || homeTaskUUID(homeId)) &&
            status in setOf("pending", "verified", "rejected") &&
            listOf(reviewedAt, createdAt, updatedAt).all { it == null || runCatching { Instant.parse(it) }.isSuccess }

    val label: String get() = submittedAddress?.trim()?.takeIf(String::isNotBlank) ?: "Residency request · ${id.takeLast(8)}"
    val reviewLabel: String get() =
        when (status) {
            "verified" -> "Review recorded"
            "rejected" -> "Request not approved"
            else -> "Request pending"
        }
}

@JsonClass(generateAdapter = true)
data class PersonalHomeResidencyPage(
    val requests: List<PersonalHomeResidencyRequest>,
    // A missing cursor is invalid, not permission to silently truncate history.
    @Json(name = "next_cursor") val nextCursor: String? = "",
) {
    @Suppress("MagicNumber")
    fun follows(cursor: String?): Boolean {
        val ids = requests.map { it.id.lowercase() }
        return requests.size <= 50 && requests.all { it.isValid() } && ids.distinct().size == ids.size && ids == ids.sorted() &&
            (cursor == null || ids.all { it > cursor.lowercase() }) &&
            (nextCursor == null || (homeTaskUUID(nextCursor) && nextCursor.lowercase() == ids.lastOrNull()))
    }
}

@JsonClass(generateAdapter = true)
data class PersonalHomeResidencyProgress(
    @Json(name = "home_id") val homeId: String,
    val request: PersonalHomeResidencyRequest?,
    @Json(name = "current_access") val currentAccess: String,
    @Json(name = "next_step") val nextStep: String,
) {
    fun matches(home: String): Boolean =
        homeId == home && homeTaskUUID(homeId) &&
            currentAccess in setOf("shared", "private_setup", "none") &&
            nextStep in
            setOf(
                "home", "household_review", "address_verification", "resubmit", "access_review", "ownership_verification", "unavailable",
            ) &&
            (nextStep == "home") == (currentAccess == "shared") &&
            (request == null || (request.isValid() && request.homeId == homeId))

    val needsResidencyRequest: Boolean get() = nextStep == "address_verification" && request == null

    val title: String get() =
        when (nextStep) {
            "home" -> "Household access is available"
            "household_review" -> "Waiting for household review"
            "address_verification" -> if (needsResidencyRequest) "Request residency review" else "Address verification is required"
            "resubmit" -> "Review your request"
            "access_review" -> "Household access needs review"
            "ownership_verification" -> "Continue ownership verification"
            else -> "Verification is unavailable for this Home"
        }

    val explanation: String get() =
        when (nextStep) {
            "home" -> "Your current access allows you to open this Home. Your role and permissions still apply."
            "household_review" ->
                "Your request is saved for a household reviewer. You do not need to upload an ownership document for this step. " +
                    "Refresh to check for a decision."
            "address_verification" ->
                if (needsResidencyRequest) {
                    "Confirm this Home’s address, apartment and your relationship before submitting a residency request. " +
                        "Checking an address does not grant household access or send mail."
                } else {
                    "Saving a request does not request a postcard or verify residency. " +
                        "Review mail verification to check for an existing request and its delivery status."
                }
            "resubmit" ->
                "Check your street, apartment and relationship before submitting again. " +
                    "A new request does not restore previous household access."
            "access_review" ->
                "A saved residency record does not grant current household access. " +
                    "A household reviewer must resolve your access before it can be restored."
            "ownership_verification" -> "Ownership has a separate review. Residency verification cannot grant or restore ownership."
            else -> "Your personal request remains visible. This Home cannot continue the verification flow right now."
        }
}
