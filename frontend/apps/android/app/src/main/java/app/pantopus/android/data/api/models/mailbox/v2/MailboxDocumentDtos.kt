package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Wire models for the document-artefact routes on the phase-2 mailbox
 * router — the booklet PDF download and the certified-mail legal
 * delivery proof. Both handlers build their response as a JS object
 * literal, so (unlike the `Mail` row DTOs) the keys are already
 * camelCase.
 */

/**
 * `POST api/mailbox/v2/p2/booklet/:mailId/download` — route
 * `backend/routes/mailboxV2Phase2.js:447`.
 */
@JsonClass(generateAdapter = true)
data class BookletDownloadResponse(
    /** Signed URL for the generated PDF. */
    @Json(name = "downloadUrl") val downloadUrl: String?,
    /**
     * File size in bytes — RN reports it as MB in the confirmation
     * (`src/app/mailbox/booklet.tsx:47`).
     */
    @Json(name = "sizeBytes") val sizeBytes: Long?,
)

/**
 * `GET api/mailbox/v2/p2/certified/:mailId/proof` — route
 * `backend/routes/mailboxV2Phase2.js:705`.
 */
@JsonClass(generateAdapter = true)
data class CertifiedProofResponse(
    val proof: CertifiedProofDto?,
)

/** The legal delivery proof the backend assembles from the `Mail` row. */
@JsonClass(generateAdapter = true)
data class CertifiedProofDto(
    @Json(name = "mailId") val mailId: String?,
    val sender: String?,
    @Json(name = "senderTrust") val senderTrust: String?,
    @Json(name = "deliveredAt") val deliveredAt: String?,
    @Json(name = "acknowledgedAt") val acknowledgedAt: String?,
    @Json(name = "acknowledgedBy") val acknowledgedBy: String?,
    @Json(name = "legalTimestamp") val legalTimestamp: String?,
)
