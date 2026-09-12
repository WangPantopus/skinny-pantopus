@file:Suppress("LongParameterList")

package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeRequest
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
) {
    fun sameIntent(other: PendingHomeCreation): Boolean =
        scope == other.scope && requestId == other.requestId && requestJson == other.requestJson && form == other.form
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

    fun matches(
        draft: PendingHomeCreation,
        request: CreateHomeRequest,
    ): Boolean {
        if (state !in setOf("pending", "completed", "cancelled", "rejected")) return false
        if (command.actorId != draft.scope.actorId || command.requestId != draft.requestId) return false
        if (!listOf(command.createdAt, command.updatedAt).all { runCatching { Instant.parse(it) }.isSuccess }) return false
        return if (state == "completed") {
            matchesCompleted(request)
        } else {
            val noCommittedRecords = home == null && ownershipClaimId == null && accessSecretIds == null
            val validRejection = state != "rejected" || code?.matches(Regex("^[A-Z][A-Z0-9_]{1,79}$")) == true
            noCommittedRecords && validRejection
        }
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
            role == other.role && (state != "rejected" || code == other.code)
}

class HomeCreationCodec(moshi: Moshi) {
    private val requests = moshi.adapter(CreateHomeRequest::class.java)
    private val outcomes = moshi.adapter(HomeCreationOutcome::class.java)

    fun encode(request: CreateHomeRequest): String = requests.toJson(request)

    fun request(draft: PendingHomeCreation): CreateHomeRequest = checkNotNull(requests.fromJson(draft.requestJson))

    fun outcome(json: String): HomeCreationOutcome = checkNotNull(outcomes.fromJson(json))

    fun valid(
        draft: PendingHomeCreation,
        scope: HomeCreationScope,
    ): Boolean =
        runCatching {
            if (draft.scope != scope || !scope.isValid() || !homeTaskUUID(draft.requestId)) return false
            val request = request(draft)
            if (request.requestId != draft.requestId || !homeTaskUUID(request.addressId) || request.address.isBlank()) return false
            if (request.role !in setOf("owner", "renter", "household") || draft.form["role"] != request.role) return false
            if (!validForm(draft.form, request)) return false
            val access = request.accessSecrets.orEmpty()
            if (access.size > HomeCreationLimits.MAX_ACCESS_RECORDS || !access.all(::validAccess)) return false
            draft.outcome == null || draft.outcome.matches(draft, request)
        }.getOrDefault(false)

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
        val keys =
            setOf(
                "street", "unit", "city", "state", "zip", "role", "nickname", "homeType", "justMoved",
                "bedrooms", "bathrooms", "sqFt", "lotSqFt", "yearBuilt", "description",
            )
        if (form.keys != keys || form["justMoved"] !in setOf("true", "false")) return false
        val homeTypes = setOf("house", "apartment", "condo", "townhouse", "studio", "multi_unit", "mobile_home", "rv", "trailer", "other")
        if (form["homeType"] !in homeTypes) return false
        return form["street"] == request.address && form["unit"].orEmpty() == request.unitNumber.orEmpty() &&
            form["city"] == request.city && form["state"] == request.state && form["zip"] == request.zipCode &&
            form["homeType"] == request.homeType
    }
}

/** Optional access limits from the atomic Home creation contract, measured in UTF-16 code units. */
object HomeCreationLimits {
    const val MAX_ACCESS_RECORDS = 20
    const val MAX_LABEL_LENGTH = 200
    const val MAX_VALUE_LENGTH = 2048
}
