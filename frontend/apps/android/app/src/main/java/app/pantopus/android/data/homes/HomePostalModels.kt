@file:Suppress("LongParameterList")

package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomeResidencyAddressSnapshot
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@JsonClass(generateAdapter = true)
data class HomePostalScope(val origin: String, val actorId: String, val homeId: String) {
    fun isValid(): Boolean = HomeCreationScope(origin, actorId).isValid() && homeTaskUUID(homeId)
}

@JsonClass(generateAdapter = false)
enum class HomePostalKind { Mail, Code }

/** Original JSON is retained before HTTP and never reconstructed for a retry. */
@JsonClass(generateAdapter = true)
data class PendingHomePostalCommand(
    val scope: HomePostalScope,
    val requestId: String,
    val kind: HomePostalKind,
    val postcardId: String?,
    val requestJson: String,
    val outcome: HomePostalOutcome? = null,
) {
    fun sameIntent(other: PendingHomePostalCommand): Boolean =
        scope == other.scope && requestId == other.requestId && kind == other.kind &&
            postcardId == other.postcardId && requestJson == other.requestJson
}

@JsonClass(generateAdapter = true)
data class HomePostalMailRequest(
    @Json(name = "request_id") val requestId: String,
    val address: HomeResidencyAddressSnapshot,
)

@JsonClass(generateAdapter = true)
data class HomePostalCodeRequest(
    @Json(name = "request_id") val requestId: String,
    val code: String,
)

/** Whitelist of original command proof; provider diagnostics are never retained. */
@JsonClass(generateAdapter = true)
data class HomePostalOutcome(
    val state: String,
    @Json(name = "home_id") val homeId: String,
    val command: HomeCreationOutcome.Command,
    @Json(name = "postcard_id") val postcardId: String?,
    val code: String? = null,
    @Json(name = "attempts_remaining") val attemptsRemaining: Int? = null,
    @Json(name = "verification_status") val verificationStatus: String? = null,
    @Json(name = "recorded_at") val recordedAt: String? = null,
    @Json(name = "challenge_window_ends_at") val challengeWindowEndsAt: String? = null,
    @Json(name = "current_access") val currentAccess: String? = null,
    val address: HomeResidencyAddressSnapshot? = null,
) {
    val isTerminal: Boolean get() = state in setOf("completed", "rejected", "cancelled")

    fun matches(draft: PendingHomePostalCommand): Boolean = matches(draft.scope, draft.requestId, draft.kind, draft.postcardId)

    fun matches(
        scope: HomePostalScope,
        requestId: String,
        kind: HomePostalKind,
        originalCard: String?,
    ): Boolean {
        val identityMatches =
            scope.isValid() && homeTaskUUID(requestId) && homeId == scope.homeId &&
                command.actorId == scope.actorId && command.requestId == requestId &&
                postalDate(command.createdAt) && postalDate(command.updatedAt)
        if (!identityMatches || state !in setOf("pending", "completed", "rejected", "cancelled")) return false
        return cardMatches(kind, originalCard) && validRejection() && validVerification(kind)
    }

    private fun cardMatches(
        kind: HomePostalKind,
        originalCard: String?,
    ): Boolean =
        when {
            kind == HomePostalKind.Code -> homeTaskUUID(originalCard) && postcardId == originalCard
            state == "completed" -> homeTaskUUID(postcardId)
            else -> postcardId == null
        }

    private fun validVerification(kind: HomePostalKind): Boolean =
        if (kind == HomePostalKind.Code && state == "completed") {
            verificationStatus in setOf("verified", "provisional") && postalDate(recordedAt) && currentAccess == "not_checked" &&
                (challengeWindowEndsAt == null || (verificationStatus == "provisional" && postalDate(challengeWindowEndsAt)))
        } else {
            verificationStatus == null && recordedAt == null && challengeWindowEndsAt == null
        }

    @Suppress("MagicNumber")
    private fun validRejection(): Boolean {
        if (state != "rejected") return code == null
        if (code?.matches(Regex("^(POSTCARD_[A-Z_]+|HOME_NOT_FOUND|OWNERSHIP_FLOW_REQUIRED)$")) != true) return false
        return code != "POSTCARD_WRONG_CODE" || (attemptsRemaining != null && attemptsRemaining in 0..4)
    }

    fun projected(): HomePostalOutcome = copy(address = null)

    fun sameDecision(other: HomePostalOutcome): Boolean = projected() == other.projected()
}

internal fun postalDate(value: String?): Boolean = value != null && runCatching { Instant.parse(value) }.isSuccess

/**
 * A server date as people read it: the device's time zone, a medium date and a short time, as iOS shows it.
 * Text that doesn't parse is shown as it is.
 */
internal fun reviewedDateLabel(value: String): String =
    runCatching {
        Instant.parse(value)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
    }.getOrDefault(value)
