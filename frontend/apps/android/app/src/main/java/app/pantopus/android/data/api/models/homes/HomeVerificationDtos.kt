@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Verification-facing slice of the viewer's own home-access record —
 * `GET /api/homes/:id/me` (route `backend/routes/homeIam.js:51`).
 *
 * [HomeAccessDto] models the fields the Members roster needs. The
 * Verification Center branches on a different slice of the same payload
 * — `verification_status`, the challenge window, and the pending
 * postcard's expiry — so it decodes into its own DTO rather than growing
 * the roster's. Mirrors iOS `HomeVerificationAccessDTO`.
 *
 * Every field carries a default: the handler's 403 branch
 * (`homeIam.js:59-63`) returns a much smaller object and must still
 * decode.
 */
@JsonClass(generateAdapter = true)
data class HomeVerificationAccessDto(
    val hasAccess: Boolean = false,
    /**
     * `occupancy.verification_status` — `unverified` when the row
     * carries none (`homeIam.js:126`).
     */
    @Json(name = "verification_status") val verificationStatus: String = "unverified",
    /**
     * `true` while `verification_status == "provisional"` and
     * `challenge_window_ends_at` is still in the future.
     */
    @Json(name = "is_in_challenge_window") val isInChallengeWindow: Boolean = false,
    @Json(name = "challenge_window_ends_at") val challengeWindowEndsAt: String? = null,
    /**
     * Expiry of the caller's `pending` `HomePostcardCode` row, or null
     * when none is outstanding (`homeIam.js:82-89`).
     */
    @Json(name = "postcard_expires_at") val postcardExpiresAt: String? = null,
) {
    /**
     * Whether the caller still owes the home a verification step.
     * Mirrors RN's `needsVerification` (`src/hooks/useHomeAccess.ts:97`).
     */
    val needsVerification: Boolean
        get() = verificationStatus != "verified"
}
