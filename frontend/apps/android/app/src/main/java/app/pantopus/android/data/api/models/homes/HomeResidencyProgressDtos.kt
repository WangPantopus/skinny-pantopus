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
            "verified" -> "Approved"
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
    /**
     * Probation (home claims PR 4), for a request nobody in the household answered in 7 days: "active" until someone
     * there says yes or the address is verified by mail, "ended" after a no (proof by mail is the way back), "review"
     * while Pantopus reviews that proof, and "declined" when Pantopus kept the household's no (new proof by mail opens
     * another review; an approval restores the membership instead). It has its own field because [nextStep] stays
     * what older apps know. Older servers omit it, and a value this app doesn't know falls back to [nextStep].
     */
    val probation: String? = null,
) {
    /** Proof by mail ends probation, and it's the way back after a no (Pantopus reviews it then, again if needed). */
    val verifiesOnProbation: Boolean get() = probation in setOf("active", "ended", "declined")

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
        when (probation) {
            "active" -> "You're on probation"
            "ended" -> "The household said no"
            "review" -> "Pantopus is reviewing your proof"
            "declined" -> "Pantopus kept the household's answer"
            else -> stepTitle
        }

    val explanation: String get() =
        when (probation) {
            "active" ->
                "Nobody in the household answered your request in 7 days, so you're on probation. " +
                    "Household records stay private until someone there says yes or you verify your address by mail."
            "ended" ->
                "Someone in the household said you don't live here, so your probation ended. If you do live here, " +
                    "verify your address by mail. Pantopus will review your proof, and your access stays off until then."
            "review" ->
                "You verified this address by mail after the household said no. Pantopus is reviewing it, " +
                    "and your access stays off until then."
            "declined" ->
                "Pantopus reviewed your proof of this address and kept the household's no. If you have new proof, " +
                    "you can verify by mail again and Pantopus will take another look."
            else -> stepExplanation
        }

    // What next_step alone says. Moshi's generated adapter needs every property visible, so these aren't private.
    val stepTitle: String get() =
        when (nextStep) {
            "home" -> "You're part of this household"
            "household_review" -> "Waiting for household review"
            "address_verification" -> if (needsResidencyRequest) "Confirm your address" else "Your address isn't verified yet"
            "resubmit" -> "Send your request again"
            "access_review" -> "You don't have household access"
            "ownership_verification" -> "Continue ownership verification"
            else -> "This Home can't be verified right now"
        }

    val stepExplanation: String get() =
        when (nextStep) {
            "home" -> "Open the Home to see your household. What you can see and change depends on your role."
            "household_review" ->
                "Someone in the household will review your request. You don't need to upload any documents. " +
                    "Check back here for their answer."
            "address_verification" ->
                if (needsResidencyRequest) {
                    "Check this Home’s address, apartment and how you live here, then send your request. " +
                        "We don't mail anything until you ask for a postcard."
                } else {
                    "Your request is saved. To finish, verify your address by mail: request a postcard, " +
                        "then enter the code printed on it."
                }
            "resubmit" -> "Check the street, apartment and how you live here, then send your request again."
            "access_review" -> "To come back, add this Home again or ask someone in the household to invite you."
            "ownership_verification" -> "Ownership has its own review. Verifying your address by mail doesn't make you an owner."
            else -> "This Home isn't accepting changes right now. Your request is still saved."
        }
}
