@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/mailbox/v2/resolve`. Mirrors
 * `resolveRoutingSchema` (`backend/routes/mailboxV2.js:12`).
 */
@JsonClass(generateAdapter = true)
data class ResolveRoutingRequest(
    val mailId: String,
    val drawer: String,
    val addAlias: Boolean? = null,
    val aliasString: String? = null,
)

/** Response for `POST /api/mailbox/v2/resolve` (`mailboxV2.js:604`). */
@JsonClass(generateAdapter = true)
data class ResolveRoutingResponse(
    val message: String,
    val drawer: String,
)
