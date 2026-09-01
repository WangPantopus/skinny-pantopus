@file:Suppress("MatchingDeclarationName", "PackageNaming")

package app.pantopus.android.data.api.models.broadcast

import com.squareup.moshi.JsonClass

/**
 * `POST /api/broadcast/messages/:messageId/read` echoes the updated
 * broadcast under `message`. The client only needs the ack, so the nested
 * object is deliberately not modelled — Moshi ignores unknown keys.
 * Route `backend/routes/broadcastChannels.js:657`.
 */
@JsonClass(generateAdapter = true)
data class BroadcastReadResponse(
    val status: String? = null,
)
