@file:Suppress("LongParameterList")

package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.models.homes.HomeResidencySubmissionRequest
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import java.net.URI
import java.time.Instant

@JsonClass(generateAdapter = true)
data class HomeCreationScope(val origin: String, val actorId: String) {
    fun isValid(): Boolean =
        homeTaskUUID(actorId) &&
            runCatching { URI(origin).let { it.scheme in setOf("https", "http") && !it.host.isNullOrBlank() } }.getOrDefault(false)
}

/** The immutable JSON bytes include the request UUID and optional access records. */
@JsonClass(generateAdapter = true)
data class PendingHomeCreation(
    val scope: HomeCreationScope,
    val requestId: String,
    val requestJson: String,
    val form: Map<String, String>,
    val outcome: HomeCreationOutcome? = null,
    val residencyHomeId: String? = null,
) {
    fun sameIntent(other: PendingHomeCreation): Boolean =
        scope == other.scope && requestId == other.requestId && requestJson == other.requestJson && form == other.form &&
            residencyHomeId == other.residencyHomeId
}

/** A retained command result is not a current Home or an access grant. */
@JsonClass(generateAdapter = true)
data class HomeCreationOutcome(
    val state: String,
    val command: Command,
    val home: Home? = null,
    @Json(name = "ownership_claim_id") val ownershipClaimId: String? = null,
    @Json(name = "access_secret_ids") val accessSecretIds: List<String>? = null,
    val role: String? = null,
    @Json(name = "requires_verification") val requiresVerification: Boolean? = null,
    @Json(name = "verification_type") val verificationType: String? = null,
    @Json(name = "current_access") val currentAccess: String? = null,
    val code: String? = null,
    val error: String? = null,
    val message: String? = null,
    @Json(name = "home_id") val residencyHomeId: String? = null,
    @Json(name = "claim_id") val claimId: String? = null,
    @Json(name = "occupancy_id") val occupancyId: String? = null,
    @Json(name = "claimed_role") val claimedRole: String? = null,
    val routing: String? = null,
    @Json(name = "next_step") val nextStep: String? = null,
    @Json(name = "postcard_requested") val postcardRequested: Boolean? = null,
) {
    @JsonClass(generateAdapter = true)
    data class Command(
        @Json(name = "actor_id") val actorId: String,
        @Json(name = "request_id") val requestId: String,
        @Json(name = "created_at") val createdAt: String,
        @Json(name = "updated_at") val updatedAt: String,
    )

    @JsonClass(generateAdapter = true)
    data class Home(val id: String)

    val isTerminal: Boolean get() = state in setOf("completed", "cancelled", "rejected")

    private fun matchesCommand(draft: PendingHomeCreation): Boolean =
        state in setOf("pending", "completed", "cancelled", "rejected") &&
            command.actorId == draft.scope.actorId && command.requestId == draft.requestId &&
            listOf(command.createdAt, command.updatedAt).all { runCatching { Instant.parse(it) }.isSuccess }

    private fun validRejection(): Boolean = state != "rejected" || code?.matches(Regex("^[A-Z][A-Z0-9_]{1,79}$")) == true

    private fun hasNoCreationRecords(): Boolean = home == null && ownershipClaimId == null && accessSecretIds == null

    private fun hasNoResidencyRecords(): Boolean = listOf(residencyHomeId, claimId, occupancyId).all { it == null }

    fun matches(
        draft: PendingHomeCreation,
        request: CreateHomeRequest,
    ): Boolean {
        if (draft.residencyHomeId != null || !hasNoResidencyRecords() || !matchesCommand(draft)) return false
        return if (state == "completed") matchesCompleted(request) else hasNoCreationRecords() && validRejection()
    }

    fun matches(
        draft: PendingHomeCreation,
        request: HomeResidencySubmissionRequest,
    ): Boolean {
        val homeMatches = residencyHomeId == draft.residencyHomeId && homeTaskUUID(residencyHomeId)
        if (!matchesCommand(draft) || !homeMatches || !hasNoCreationRecords()) return false
        return if (state == "completed") {
            matchesResidencyCompletion(request)
        } else {
            listOf(claimId, occupancyId, claimedRole, routing).all { it == null } && validRejection()
        }
    }

    private fun matchesResidencyCompletion(request: HomeResidencySubmissionRequest): Boolean {
        val recordsMatch = homeTaskUUID(claimId) && homeTaskUUID(occupancyId) && claimedRole == request.claimedRole
        val routingMatches =
            routing in setOf("household_review", "self_bootstrap", "external_postcard", "stale_authority_postcard") &&
                nextStep == (if (routing == "household_review") "household_review" else "address_verification")
        val noAccessGrant = requiresVerification == true && currentAccess == "not_checked" && postcardRequested == false
        return recordsMatch && routingMatches && noAccessGrant
    }

    private fun matchesCompleted(request: CreateHomeRequest): Boolean {
        val ids = accessSecretIds ?: return false
        val homeReady = homeTaskUUID(home?.id) && requiresVerification == true && currentAccess == "not_checked"
        val expectedVerification = if (role == "owner") "ownership" else "residency"
        if (!homeReady || role != request.role || verificationType != expectedVerification) return false
        val accessMatches = ids.size == request.accessSecrets.orEmpty().size && ids.distinct().size == ids.size && ids.all(::homeTaskUUID)
        val ownershipMatches = if (role == "owner") homeTaskUUID(ownershipClaimId) else ownershipClaimId == null
        return accessMatches && ownershipMatches
    }

    fun sameDecision(other: HomeCreationOutcome): Boolean =
        state == other.state && command.actorId == other.command.actorId && command.requestId == other.command.requestId &&
            home == other.home && ownershipClaimId == other.ownershipClaimId && accessSecretIds == other.accessSecretIds &&
            role == other.role && (state != "rejected" || code == other.code) &&
            residencyHomeId == other.residencyHomeId && claimId == other.claimId && occupancyId == other.occupancyId &&
            claimedRole == other.claimedRole && routing == other.routing && nextStep == other.nextStep &&
            postcardRequested == other.postcardRequested
}

class HomeCreationCodec(moshi: Moshi) {
    private val requests = moshi.adapter(CreateHomeRequest::class.java)
    private val outcomes = moshi.adapter(HomeCreationOutcome::class.java)
    private val submissions = moshi.adapter(HomeResidencySubmissionRequest::class.java).failOnUnknown()

    fun encode(request: CreateHomeRequest): String = requests.toJson(request)

    fun request(draft: PendingHomeCreation): CreateHomeRequest = checkNotNull(requests.fromJson(draft.requestJson))

    fun encode(request: HomeResidencySubmissionRequest): String = submissions.toJson(request)

    fun matches(
        outcome: HomeCreationOutcome,
        draft: PendingHomeCreation,
    ): Boolean =
        if (draft.residencyHomeId == null) {
            outcome.matches(draft, request(draft))
        } else {
            outcome.matches(draft, checkNotNull(submissions.fromJson(draft.requestJson)))
        }

    fun outcome(json: String): HomeCreationOutcome = checkNotNull(outcomes.fromJson(json))

    fun valid(
        draft: PendingHomeCreation,
        scope: HomeCreationScope,
    ): Boolean =
        runCatching {
            if (draft.scope != scope || !scope.isValid() || !homeTaskUUID(draft.requestId)) return false
            if (draft.residencyHomeId != null) return validResidency(draft)
            val request = request(draft)
            if (request.requestId != draft.requestId || !homeTaskUUID(request.addressId) || request.address.isBlank()) return false
            if (request.role !in setOf("owner", "renter", "household") || draft.form["role"] != request.role) return false
            if (!validForm(draft.form, request)) return false
            val access = request.accessSecrets.orEmpty()
            if (access.size > HomeCreationLimits.MAX_ACCESS_RECORDS || !access.all(::validAccess)) return false
            draft.outcome == null || draft.outcome.matches(draft, request)
        }.getOrDefault(false)

    private fun validResidency(draft: PendingHomeCreation): Boolean {
        val request = checkNotNull(submissions.fromJson(draft.requestJson))
        val address = request.address
        val identityMatches = homeTaskUUID(draft.residencyHomeId) && request.requestId == draft.requestId && address.isValid()
        val roleMatches = request.claimedRole in setOf("renter", "household") && draft.form["role"] == request.claimedRole
        val expectedAddress =
            mapOf(
                "street" to address.line1,
                "unit" to address.line2,
                "city" to address.city,
                "state" to address.state,
                "zip" to address.postalCode,
            )
        val formMatches = validFormMetadata(draft.form) && expectedAddress.all { (key, value) -> draft.form[key] == value }
        val outcomeMatches = draft.outcome == null || draft.outcome.matches(draft, request)
        return identityMatches && roleMatches && formMatches && outcomeMatches
    }

    private fun validAccess(access: app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest): Boolean {
        val typeValid = access.accessType in setOf("wifi", "door_code", "gate_code", "lockbox", "garage", "alarm", "other")
        val labelValid = access.label.isNotBlank() && access.label.length <= HomeCreationLimits.MAX_LABEL_LENGTH
        val valueValid = access.secretValue.isNotBlank() && access.secretValue.length <= HomeCreationLimits.MAX_VALUE_LENGTH
        return typeValid && labelValid && valueValid
    }

    private fun validForm(
        form: Map<String, String>,
        request: CreateHomeRequest,
    ): Boolean {
        if (!validFormMetadata(form)) return false
        return form["street"] == request.address && form["unit"].orEmpty() == request.unitNumber.orEmpty() &&
            form["city"] == request.city && form["state"] == request.state && form["zip"] == request.zipCode &&
            form["homeType"] == request.homeType
    }

    private fun validFormMetadata(form: Map<String, String>): Boolean {
        val keys =
            setOf(
                "street", "unit", "city", "state", "zip", "role", "nickname", "homeType", "justMoved",
                "bedrooms", "bathrooms", "sqFt", "lotSqFt", "yearBuilt", "description",
            )
        if (form.keys != keys || form["justMoved"] !in setOf("true", "false")) return false
        val homeTypes = setOf("house", "apartment", "condo", "townhouse", "studio", "multi_unit", "mobile_home", "rv", "trailer", "other")
        if (form["homeType"] !in homeTypes) return false
        return true
    }
}

/** Optional access limits from the atomic Home creation contract, measured in UTF-16 code units. */
object HomeCreationLimits {
    const val MAX_ACCESS_RECORDS = 20
    const val MAX_LABEL_LENGTH = 200
    const val MAX_VALUE_LENGTH = 2048
}
