package app.pantopus.android.data.scheduling

import app.pantopus.android.data.api.models.scheduling.SchedulingErrorEnvelope
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.models.scheduling.ValidationDetail
import app.pantopus.android.data.api.net.NetworkError
import com.squareup.moshi.Moshi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The typed Calendarly error the UI routes on, decoded from the raw
 * [NetworkError] taxonomy + the JSON error envelope. Built by
 * [SchedulingErrorDecoder].
 *
 * First-class non-error states ([Paused]/[Expired]/[Unavailable]/[Secret]) are
 * surfaced via `PausedExpiredUnavailableState`; [Conflict] feeds
 * `ConflictAlternativesSheet`; [Validation] maps to per-field form errors.
 */
sealed class SchedulingError {
    /** `400 { error:'Validation failed', details:[{field,message,code}] }`. */
    data class Validation(val details: List<ValidationDetail>) : SchedulingError()

    /**
     * `409 { error:'SLOT_TAKEN'|'SLOT_UNAVAILABLE'|'SLOT_FULL'|'SLOT_CONFLICT',
     * alternatives:[…] }`. Surface the nearest open times — never a dead end.
     */
    data class Conflict(val code: String, val alternatives: List<SlotDto>) : SchedulingError()

    /** The page/host is paused (`status:'paused'` or `409 PAGE_PAUSED`). */
    data object Paused : SchedulingError()

    /** A one-off/manage link expired or was already used (`status:'expired'`/`LINK_USED`). */
    data object Expired : SchedulingError()

    /** The page/link is unavailable (`status:'unavailable'`, or a bare 404 in the public flow). */
    data object Unavailable : SchedulingError()

    /** A private/secret link the invitee can't access (403). */
    data object Secret : SchedulingError()

    /** `409 SLUG_TAKEN` / check-slug — with up to 3 suggestions. */
    data class SlugTaken(val suggestions: List<String>) : SchedulingError()

    /** `501 NOT_AVAILABLE` — connected-calendar connect is "coming soon". */
    data object NotAvailable501 : SchedulingError()

    /** Anything else — carries the server code/message for display. */
    data class Generic(val code: String?, val message: String) : SchedulingError()
}

/**
 * Decodes a [NetworkError] (+ its JSON body) into a typed [SchedulingError].
 * Uses Moshi (not `org.json`) so it is exercised on the plain JVM in unit
 * tests. Every create/reschedule surface routes 409s through here for the
 * conflict-alternatives sheet.
 *
 * @param notFoundAs how to treat a body-less `404`/`NotFound` — defaults to
 *   [SchedulingError.Unavailable]; the one-off entry flow passes
 *   [SchedulingError.Expired].
 */
@Singleton
class SchedulingErrorDecoder
    @Inject
    constructor(
        moshi: Moshi,
    ) {
        private val adapter = moshi.adapter(SchedulingErrorEnvelope::class.java)

        fun decode(
            error: NetworkError,
            notFoundAs: SchedulingError = SchedulingError.Unavailable,
        ): SchedulingError =
            when (error) {
                is NetworkError.NotFound -> notFoundAs
                is NetworkError.Forbidden -> SchedulingError.Secret
                is NetworkError.ClientError ->
                    fromBody(error.code ?: 0, error.body)
                        ?: SchedulingError.Generic(error.code?.toString(), error.message)
                is NetworkError.Server ->
                    fromBody(error.code ?: 0, error.body)
                        ?: SchedulingError.Generic(error.code?.toString(), error.message)
                else -> SchedulingError.Generic(error.code?.toString(), error.message)
            }

        @Suppress("ReturnCount", "CyclomaticComplexMethod")
        private fun fromBody(
            code: Int,
            body: String?,
        ): SchedulingError? {
            val envelope =
                body?.let { runCatching { adapter.fromJson(it) }.getOrNull() }
                    ?: return if (code == CODE_NOT_IMPLEMENTED) SchedulingError.NotAvailable501 else null
            val errorCode = envelope.error
            return when {
                errorCode == CODE_NOT_AVAILABLE || code == CODE_NOT_IMPLEMENTED ->
                    SchedulingError.NotAvailable501
                !envelope.details.isNullOrEmpty() ->
                    SchedulingError.Validation(envelope.details)
                envelope.status == STATUS_PAUSED || errorCode == CODE_PAGE_PAUSED ->
                    SchedulingError.Paused
                envelope.status == STATUS_EXPIRED || errorCode in EXPIRED_CODES ->
                    SchedulingError.Expired
                envelope.status == STATUS_UNAVAILABLE ->
                    SchedulingError.Unavailable
                errorCode == CODE_SLUG_TAKEN ->
                    SchedulingError.SlugTaken(envelope.suggestions.orEmpty())
                code == CODE_CONFLICT && (envelope.alternatives != null || errorCode in SLOT_CODES) ->
                    SchedulingError.Conflict(errorCode ?: SLOT_TAKEN, envelope.alternatives.orEmpty())
                else ->
                    SchedulingError.Generic(errorCode, envelope.message ?: errorCode ?: "Something went wrong.")
            }
        }

        private companion object {
            const val CODE_CONFLICT = 409
            const val CODE_NOT_IMPLEMENTED = 501
            const val STATUS_PAUSED = "paused"
            const val STATUS_EXPIRED = "expired"
            const val STATUS_UNAVAILABLE = "unavailable"
            const val SLOT_TAKEN = "SLOT_TAKEN"
            const val CODE_PAGE_PAUSED = "PAGE_PAUSED"
            const val CODE_SLUG_TAKEN = "SLUG_TAKEN"
            const val CODE_NOT_AVAILABLE = "NOT_AVAILABLE"
            val SLOT_CODES = setOf("SLOT_TAKEN", "SLOT_UNAVAILABLE", "SLOT_FULL", "SLOT_CONFLICT")
            val EXPIRED_CODES = setOf("LINK_USED", "EXPIRED")
        }
    }
