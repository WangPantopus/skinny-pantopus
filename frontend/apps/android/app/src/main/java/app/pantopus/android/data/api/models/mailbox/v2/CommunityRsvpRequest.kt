@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/mailbox/v2/community/rsvp`. Mirrors
 * `rsvpSchema` (`backend/routes/mailboxV2Phase3.js:56`).
 */
@JsonClass(generateAdapter = true)
data class CommunityRsvpRequest(
    val communityItemId: String,
)

/** Response for `POST /api/mailbox/v2/community/rsvp` (`mailboxV2Phase3.js:782`). */
@JsonClass(generateAdapter = true)
data class CommunityRsvpResponse(
    val message: String? = null,
    val rsvpCount: Int? = null,
)
