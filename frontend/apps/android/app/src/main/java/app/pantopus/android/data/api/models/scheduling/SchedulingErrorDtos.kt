@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.JsonClass

/**
 * The Calendarly error envelope, shared by every scheduling endpoint.
 *
 * Backend convention (`reference/calendarly-backend-api.md` §Conventions):
 *  - generic: `{ error:'CODE', message }`
 *  - validation: `400 { error:'Validation failed', details:[{field,message,code}] }`
 *  - slot conflict: `409 { error:'SLOT_TAKEN'|'SLOT_UNAVAILABLE'|'SLOT_FULL',
 *    message, alternatives:[{start,end,startLocal}] }`
 *  - terminal/non-error states ride on a `status` field
 *    (`'paused'|'expired'|'unavailable'`) inside an otherwise 4xx body.
 *  - 501: `{ error:'NOT_AVAILABLE', message }` for connected-calendars connect.
 *
 * This is the on-the-wire shape; [app.pantopus.android.data.scheduling.SchedulingError]
 * is the typed decode the UI routes on.
 */
@JsonClass(generateAdapter = true)
data class SchedulingErrorEnvelope(
    val error: String? = null,
    val message: String? = null,
    /** `status:'paused'|'expired'|'unavailable'` on first-class non-error responses. */
    val status: String? = null,
    /** Present on `400 Validation failed`. */
    val details: List<ValidationDetail>? = null,
    /** Present on `409` slot conflicts — nearest open times. */
    val alternatives: List<SlotDto>? = null,
    /** Present on `409 SLUG_TAKEN` / check-slug responses. */
    val suggestions: List<String>? = null,
)

/** One field-level validation failure inside a `400 Validation failed`. */
@JsonClass(generateAdapter = true)
data class ValidationDetail(
    val field: String? = null,
    val message: String? = null,
    val code: String? = null,
)

/** `{ ok: true }` — the response shape for every delete / action endpoint. */
@JsonClass(generateAdapter = true)
data class SchedulingOkResponse(
    val ok: Boolean = true,
)
