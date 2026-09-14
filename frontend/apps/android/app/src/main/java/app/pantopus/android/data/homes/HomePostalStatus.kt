@file:Suppress("LongParameterList")

package app.pantopus.android.data.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Current status is separate from a retained historical command decision. */
@JsonClass(generateAdapter = true)
data class HomePostalStatus(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "checked_at") val checkedAt: String,
    @Json(name = "current_access") val currentAccess: String,
    @Json(name = "can_request") val canRequest: Boolean,
    @Json(name = "can_resume") val canResume: Boolean,
    @Json(name = "can_verify") val canVerify: Boolean,
    val restriction: String?,
    @Json(name = "restriction_message") val restrictionMessage: String?,
    val postcard: Postcard?,
    val request: HomePostalOutcome?,
) {
    @JsonClass(generateAdapter = true)
    data class Postcard(
        val id: String,
        @Json(name = "requested_at") val requestedAt: String,
        @Json(name = "expires_at") val expiresAt: String,
        val status: String,
        val delivery: String,
        @Json(name = "attempts_remaining") val attemptsRemaining: Int,
    ) {
        @Suppress("MagicNumber")
        fun isValid(): Boolean =
            homeTaskUUID(id) && postalDate(requestedAt) && postalDate(expiresAt) &&
                status in setOf("pending", "verified", "expired", "cancelled") &&
                delivery in setOf("not_started", "accepted", "unknown", "rejected") && attemptsRemaining in 0..5
    }

    fun matches(scope: HomePostalScope): Boolean {
        val identityMatches =
            scope.isValid() && homeId == scope.homeId && actorId == scope.actorId &&
                postalDate(checkedAt) && currentAccess == "not_checked"
        return identityMatches && postcard?.isValid() != false && requestMatches(scope) && actionsMatch()
    }

    private fun requestMatches(scope: HomePostalScope): Boolean {
        val original = request ?: return true
        return original.state == "completed" && original.address?.isValid() == true &&
            original.postcardId == postcard?.id && original.matches(scope, original.command.requestId, HomePostalKind.Mail, null)
    }

    private fun actionsMatch(): Boolean {
        val resumeReady = request != null && postcard?.status == "pending" && postcard.delivery == "not_started"
        val codeReady =
            postcard != null && postcard.status == "pending" &&
                postcard.delivery in setOf("accepted", "unknown") && postcard.attemptsRemaining > 0
        val exclusiveRequest = !canRequest || (!canResume && !canVerify)
        return (!canResume || resumeReady) && (!canVerify || codeReady) && exclusiveRequest
    }
}
