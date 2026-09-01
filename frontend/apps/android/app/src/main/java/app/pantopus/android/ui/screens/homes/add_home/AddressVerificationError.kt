@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import app.pantopus.android.data.api.net.NetworkError
import org.json.JSONObject

/**
 * A refusal from address verification, mapped to something a person can act on.
 *
 * UX-06 — neither native client had any address layer. The wizard let the user
 * complete every step, then rendered the 422 from `POST /api/homes` through the
 * generic networking path, so they saw "Request failed" with no indication of
 * what was wrong with their address or what to change. The `code` the server
 * sends was referenced nowhere in the app (audit 2026-08-22).
 *
 * Copy is kept deliberately close to the web and iOS wizards so the same
 * refusal reads the same on every platform.
 */
enum class AddressVerificationError(
    val code: String,
    /** What went wrong, in the user's terms. */
    val message: String,
    /** What to do next. Never "try again" for something retrying cannot fix. */
    val recoverySuggestion: String,
    /** Whether the address step can actually fix this. */
    val isFixableInAddressStep: Boolean,
    /** Whether retrying the identical input could ever succeed. */
    val isRetryable: Boolean = false,
) {
    MISSING_UNIT(
        code = "ADDRESS_MISSING_UNIT",
        message = "This address needs a unit or apartment number.",
        recoverySuggestion = "Add your unit or apartment number, then try again.",
        isFixableInAddressStep = true,
    ),
    NOT_HOME(
        code = "ADDRESS_NOT_HOME",
        message = "This looks like a business or office address, not a home.",
        recoverySuggestion = "Please enter the street address where you live.",
        isFixableInAddressStep = true,
    ),
    UNDELIVERABLE(
        code = "ADDRESS_UNDELIVERABLE",
        message = "We couldn't verify that mail can be delivered to this address.",
        recoverySuggestion = "Double-check the address and try again.",
        isFixableInAddressStep = true,
    ),
    CONFLICT(
        code = "ADDRESS_CONFLICT",
        message = "Someone already lives at this address on Pantopus.",
        recoverySuggestion = "Ask someone in the household to add you, or file a claim for review.",
        // Not a typo — sending the user back to edit would loop them.
        isFixableInAddressStep = false,
    ),
    LOW_CONFIDENCE(
        code = "ADDRESS_LOW_CONFIDENCE",
        message = "We couldn't verify this address with enough confidence.",
        recoverySuggestion = "Try adding more detail, like a unit number.",
        isFixableInAddressStep = true,
    ),
    AMBIGUOUS(
        code = "ADDRESS_AMBIGUOUS",
        message = "This address matched more than one location.",
        recoverySuggestion = "Try adding more detail, like a unit number.",
        isFixableInAddressStep = true,
    ),
    PO_BOX(
        code = "ADDRESS_PO_BOX",
        message = "A PO Box can't be used as a home address.",
        recoverySuggestion = "Please enter the street address where you live.",
        isFixableInAddressStep = true,
    ),
    MISSING_STREET_NUMBER(
        code = "ADDRESS_MISSING_STREET_NUMBER",
        message = "This address is missing a street number.",
        recoverySuggestion = "Double-check the address and try again.",
        isFixableInAddressStep = true,
    ),
    UNVERIFIED_STREET_NUMBER(
        code = "ADDRESS_UNVERIFIED_STREET_NUMBER",
        message = "We couldn't confirm that street number on this street.",
        recoverySuggestion = "Double-check the address and try again.",
        isFixableInAddressStep = true,
    ),
    STEP_UP_REQUIRED(
        code = "ADDRESS_STEP_UP_REQUIRED",
        message = "This building has both homes and businesses, so we need to confirm you live here.",
        recoverySuggestion = "We'll send a code to this address to confirm.",
        isFixableInAddressStep = false,
    ),
    UNAVAILABLE(
        code = "ADDRESS_VALIDATION_UNAVAILABLE",
        message = "Address verification is temporarily unavailable.",
        recoverySuggestion = "This one is on us — please try again in a few minutes.",
        isFixableInAddressStep = false,
        isRetryable = true,
    ),
    ;

    /** Message plus next step, as shown to the user. */
    val displayMessage: String get() = "$message $recoverySuggestion"

    companion object {
        private val byCode = entries.associateBy { it.code }

        /**
         * Extract an address refusal from a network error, if that is what it is.
         *
         * Server errors are inspected too: ADDRESS_VALIDATION_UNAVAILABLE — the
         * one retryable case, the provider outage — arrives as HTTP 503, which
         * the networking layer surfaces as [NetworkError.Server], not
         * [NetworkError.ClientError]. Matching only client errors made the
         * outage code unreachable during the exact incident it exists for.
         */
        fun from(error: NetworkError): AddressVerificationError? {
            val body =
                when (error) {
                    is NetworkError.ClientError -> error.body
                    is NetworkError.Server -> error.body
                    else -> null
                } ?: return null
            val code =
                runCatching { JSONObject(body).optString("code") }
                    .getOrNull()
                    ?.takeIf { it.isNotBlank() }
                    ?: return null
            return byCode[code]
        }
    }
}
