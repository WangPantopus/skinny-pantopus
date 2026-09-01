@file:Suppress("CyclomaticComplexMethod", "PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

/**
 * Steps the A12.5 / A12.6 verify-landlord wizard owns. The third leg
 * of the flow (A12.7 Postcard verification) lives outside this state
 * machine; the wizard advertises "1 of 3" / "2 of 3" purely so the
 * user understands where they are in the broader flow.
 */
enum class VerifyLandlordStep {
    Start,
    Details,

    /**
     * Terminal confirmation rendered after
     * `POST /api/v1/tenant/request-approval` resolved — the landlord
     * now has the request and can approve or deny it.
     */
    Sent,
}

/**
 * Outcome of the tenant approval submit. Every field is copied out of
 * the backend's answer — nothing here is synthesised client-side.
 * Mirror of iOS `VerifyLandlordApprovalResult`.
 */
data class VerifyLandlordApprovalResult(
    val kind: Kind,
    /** `HomeLease.created_at` from the 201 body. */
    val submittedAt: String? = null,
    /** `HomeLease.start_at` — the move-in date the tenant asked for. */
    val requestedStartAt: String? = null,
    /** `HomeLease.metadata.message` echoed back. */
    val message: String? = null,
    /** The server's own sentence, surfaced verbatim on the 409 paths. */
    val serverMessage: String? = null,
) {
    enum class Kind {
        /** 201 — a fresh pending `HomeLease` was created. */
        Submitted,

        /** 409 — "You already have a pending request for this home". */
        AlreadyPending,

        /** 409 — "You already have an active lease at this home". */
        AlreadyActive,
    }

    val headline: String
        get() =
            when (kind) {
                Kind.Submitted -> "Request sent"
                Kind.AlreadyPending -> "Waiting for approval"
                Kind.AlreadyActive -> "You're already a verified tenant"
            }

    val body: String
        get() =
            when (kind) {
                Kind.Submitted ->
                    "Your request has been sent to the landlord. They'll review and approve your tenancy."
                Kind.AlreadyPending ->
                    serverMessage ?: "You already have a pending request for this home."
                Kind.AlreadyActive ->
                    serverMessage ?: "You already have an active lease at this home."
            }
}

/**
 * Which Start variant the wizard renders. The fast-track path is
 * surfaced when 2+ other tenants in the building have already
 * verified the same landlord; we skip the email confirmation in that
 * case.
 */
enum class VerifyLandlordVariant { Canonical, FastTrack }

/**
 * Submit-time state machine — shared shape between iOS + Android.
 */
sealed interface VerifyLandlordSubmitState {
    data object Idle : VerifyLandlordSubmitState

    data object Submitting : VerifyLandlordSubmitState

    data object Submitted : VerifyLandlordSubmitState

    data class Error(val message: String) : VerifyLandlordSubmitState
}

/** Detected attributes from a lease upload — drives the done / warn
 *  DLeaseUpload variants and the unit-mismatch validation. */
data class VerifyLandlordLeaseFile(
    val filename: String,
    val sizeLabel: String,
    val pageCount: Int,
    val detectedOwner: String?,
    val detectedUnit: String?,
)

/**
 * Per-slot validation messages surfaced in the A12.6 error frame
 * (per-field chips) and aggregated into the top error-summary banner.
 */
data class VerifyLandlordValidationErrors(
    val ownerName: String? = null,
    val contactName: String? = null,
    val email: String? = null,
    val lease: String? = null,
    val pmName: String? = null,
    val pmEmail: String? = null,
    /**
     * A12.6 "Your tenancy" — the move-in date only errors when it's
     * present but not `YYYY-MM-DD` (the field itself is optional).
     */
    val moveInDate: String? = null,
) {
    /** Used by the error-summary banner ("Fix N things to submit"). */
    val count: Int
        get() = listOfNotNull(ownerName, contactName, email, lease, pmName, pmEmail, moveInDate).size

    /**
     * Compact dot-separated list rendered as the banner sub-label —
     * matches iOS' `compactSummary` output character-for-character.
     */
    val compactSummary: String
        get() =
            buildList {
                if (email != null) add("Email format")
                if (lease != null) add("Lease unit mismatch")
                if (ownerName != null) add("Owner name")
                if (contactName != null) add("Contact name")
                if (pmName != null) add("PM name")
                if (pmEmail != null) add("PM email")
                if (moveInDate != null) add("Move-in date")
            }.joinToString(" · ")

    val isEmpty: Boolean get() = count == 0
}

/**
 * The full A12.6 form state. Held inside the wizard VM and projected
 * into per-field views on the Details step.
 */
data class VerifyLandlordForm(
    val ownerName: String = "",
    val contactName: String = "",
    val email: String = "",
    val phone: String = "",
    val lease: VerifyLandlordLeaseFile? = null,
    val pmEnabled: Boolean = false,
    val pmName: String = "",
    val pmEmail: String = "",
    val pmPhone: String = "",
    /**
     * A12.6 "Your tenancy" — `YYYY-MM-DD`, sent as `start_at` on
     * `POST /api/v1/tenant/request-approval`.
     */
    val moveInDate: String = "",
    /**
     * Free-text note forwarded to the landlord as the request
     * `message` (capped at 1000 chars server-side).
     */
    val messageToLandlord: String = "",
    /** Registered unit on the home record — drives the lease unit
     *  mismatch validation when the OCR'd unit doesn't agree. */
    val registeredUnit: String = "",
) {
    /**
     * Pure validation projection — same logic on iOS + Android. The
     * three contracts from the audit:
     *  1. Email must be RFC-shaped (`x@y.z`).
     *  2. The lease's detected unit must match `registeredUnit` when
     *     OCR was able to read one.
     *  3. When the PM toggle is on, PM name + PM email are both
     *     required (PM phone stays optional).
     */
    fun validate(): VerifyLandlordValidationErrors {
        val ownerNameError = if (ownerName.trim().isEmpty()) "Required" else null
        val contactNameError = if (contactName.trim().isEmpty()) "Required" else null
        val trimmedEmail = email.trim()
        val emailError =
            when {
                trimmedEmail.isEmpty() -> "Required"
                !looksLikeEmail(trimmedEmail) -> "Missing top-level domain"
                else -> null
            }
        val leaseError =
            when {
                lease == null -> "Required"
                lease.detectedUnit != null &&
                    registeredUnit.isNotEmpty() &&
                    !lease.detectedUnit.equals(registeredUnit, ignoreCase = true) -> "Unit mismatch"
                else -> null
            }
        val pmNameError: String?
        val pmEmailError: String?
        if (pmEnabled) {
            pmNameError = if (pmName.trim().isEmpty()) "Required" else null
            val trimmedPmEmail = pmEmail.trim()
            pmEmailError =
                when {
                    trimmedPmEmail.isEmpty() -> "Required"
                    !looksLikeEmail(trimmedPmEmail) -> "Missing top-level domain"
                    else -> null
                }
        } else {
            pmNameError = null
            pmEmailError = null
        }
        val trimmedMoveIn = moveInDate.trim()
        val moveInError =
            if (trimmedMoveIn.isNotEmpty() && !looksLikeISODate(trimmedMoveIn)) "Use YYYY-MM-DD" else null
        return VerifyLandlordValidationErrors(
            ownerName = ownerNameError,
            contactName = contactNameError,
            email = emailError,
            lease = leaseError,
            pmName = pmNameError,
            pmEmail = pmEmailError,
            moveInDate = moveInError,
        )
    }

    /**
     * Widen `YYYY-MM-DD` into the ISO-8601 timestamp Joi's `.isoDate()`
     * expects. Null when the field is blank or malformed.
     */
    val startAtISO: String?
        get() {
            val trimmed = moveInDate.trim()
            if (trimmed.isEmpty() || !looksLikeISODate(trimmed)) return null
            return "${trimmed}T00:00:00.000Z"
        }

    /**
     * The message forwarded to the landlord. The tenant's own note
     * leads; the landlord / PM details they filled in are appended so
     * the wizard no longer throws them away (the backend has no
     * structured column for them — `tenantRequestSchema` accepts
     * `message` only).
     */
    val composedMessage: String?
        get() {
            val lines =
                buildList {
                    val note = messageToLandlord.trim()
                    if (note.isNotEmpty()) add(note)
                    val landlordParts =
                        listOf(ownerName, contactName, email, phone)
                            .map { it.trim() }
                            .filter { it.isNotEmpty() }
                    if (landlordParts.isNotEmpty()) add("Landlord: " + landlordParts.joinToString(" · "))
                    if (pmEnabled) {
                        val pmParts = listOf(pmName, pmEmail, pmPhone).map { it.trim() }.filter { it.isNotEmpty() }
                        if (pmParts.isNotEmpty()) add("Property manager: " + pmParts.joinToString(" · "))
                    }
                    lease?.let { add("Lease on file: ${it.filename}") }
                }
            if (lines.isEmpty()) return null
            val joined = lines.joinToString("\n")
            return if (joined.length > MESSAGE_MAX_LENGTH) joined.take(MESSAGE_MAX_LENGTH) else joined
        }

    companion object {
        /**
         * Maximum length the backend accepts for the request message
         * (`tenantRequestSchema`, `backend/routes/landlordTenant.js:64`).
         */
        const val MESSAGE_MAX_LENGTH: Int = 1000

        /**
         * `YYYY-MM-DD` as an ISO calendar date. Sent to the backend as
         * `start_at` after being widened to a full ISO-8601 timestamp.
         */
        @Suppress("MagicNumber", "ReturnCount")
        internal fun looksLikeISODate(candidate: String): Boolean {
            val parts = candidate.split('-')
            if (parts.size != 3) return false
            if (parts[0].length != 4 || parts[1].length != 2 || parts[2].length != 2) return false
            val year = parts[0].toIntOrNull() ?: return false
            val month = parts[1].toIntOrNull() ?: return false
            val day = parts[2].toIntOrNull() ?: return false
            return year >= 1900 && month in 1..12 && day in 1..31
        }

        /**
         * Lightweight client-side email check — catches the missing-TLD
         * case from the design ("mira@elmstholdings"). Server-side
         * still runs the authoritative validation.
         */
        internal fun looksLikeEmail(candidate: String): Boolean {
            val at = candidate.indexOf('@')
            if (at <= 0 || at == candidate.lastIndex) return false
            val local = candidate.substring(0, at)
            val domain = candidate.substring(at + 1)
            if (local.isEmpty() || !domain.contains('.')) return false
            val parts = domain.split('.')
            val tld = parts.lastOrNull() ?: return false
            return parts.size >= 2 && tld.isNotEmpty()
        }
    }
}

/** Outbound events the wizard view needs the host nav stack to act on. */
sealed interface VerifyLandlordOutboundEvent {
    /** Pop the wizard with no further navigation. */
    data object Dismiss : VerifyLandlordOutboundEvent

    /**
     * Submit succeeded — pop the wizard and push the standalone A12.7
     * Postcard verification screen so the user can track delivery.
     */
    data class OpenPostcardVerification(val homeId: String) : VerifyLandlordOutboundEvent
}
