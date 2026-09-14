package app.pantopus.android.ui.screens.homes.postal

import app.pantopus.android.data.api.models.homes.HomeResidencyAddressSnapshot
import app.pantopus.android.data.homes.HomePostalKind
import app.pantopus.android.data.homes.HomePostalOutcome

object HomePostalMessages {
    fun recovery(
        sessionCurrent: Boolean,
        storageFailed: Boolean,
        hasOriginal: Boolean,
    ): String =
        when {
            !sessionCurrent -> "Your session changed. Reopen mail verification to recover the original request."
            storageFailed -> HomePostalCoordinator.STORAGE
            hasOriginal -> "The result is not confirmed. Keep the original and check again, retry it, or confirm cancellation."
            else -> "Mail verification status could not be checked. Please retry."
        }

    fun headline(
        kind: HomePostalKind,
        outcome: HomePostalOutcome?,
    ): String =
        when (outcome?.state) {
            "completed" -> if (kind == HomePostalKind.Code) "Address proof recorded" else "Mailing request recorded"
            "cancelled" -> "Original request cancelled"
            "rejected" -> "Review the recorded result"
            else -> "Recover your original request"
        }

    fun explanation(
        kind: HomePostalKind,
        outcome: HomePostalOutcome?,
    ): String =
        when (outcome?.state) {
            "completed" ->
                if (kind == HomePostalKind.Code) {
                    "Check residency status for household review and access. This result does not change current permissions."
                } else {
                    "Check current mailing status for delivery and any remaining steps. A saved request alone does not confirm mailing."
                }
            "cancelled" -> "This original request can no longer submit a new result. Review your details before starting another."
            "rejected" -> restriction(outcome.code.orEmpty())
            else -> "Your details are saved securely. Check the result, retry the same request, or confirm cancellation before editing."
        }

    fun delivery(state: String?): String =
        when (state) {
            "not_started" -> "Mailing has not started"
            "accepted" -> "Mail provider accepted the postcard"
            "unknown" -> "Mailing outcome is unknown"
            "rejected" -> "Mail provider did not accept the postcard"
            else -> "Mailing status is unavailable"
        }

    fun restriction(code: String): String =
        when (code) {
            "POSTCARD_WRONG_CODE" -> "That code did not match. Review the recorded attempt before entering a corrected code."
            "POSTCARD_ADDRESS_CHANGED" -> "The Home address changed. Confirm the street and apartment before requesting another postcard."
            "POSTCARD_EXPIRED" -> "This postcard code expired. Confirm your mailing address before requesting another."
            "POSTCARD_LOCKED" -> "This postcard has no code attempts remaining. Confirm your address before requesting another."
            "POSTCARD_ACCESS_REVIEW_REQUIRED" -> "Household access needs review. A mail code cannot restore removed or expired access."
            "POSTCARD_REVIEW_ALREADY_RECORDED" -> "Your verification is already recorded. Check residency status for current access."
            "POSTCARD_HOME_UNAVAILABLE" -> "Mail verification is unavailable for this Home right now."
            "POSTCARD_RESIDENCY_REQUEST_REQUIRED" -> "Submit your residency request before requesting a postcard."
            else -> availability(code)
        }

    private fun availability(code: String): String =
        when (code) {
            "POSTCARD_COUNTRY_UNAVAILABLE" -> "Mail verification is currently available for US addresses."
            "POSTCARD_ADDRESS_LIMIT" -> "The request limit for this address has been reached. Try again later."
            "POSTCARD_USER_LIMIT" -> "Your mail request limit has been reached. Try again later."
            "POSTCARD_NOT_DISPATCHED" -> "Mailing has not started. Continue the original request first."
            "OWNERSHIP_FLOW_REQUIRED" -> "Continue ownership verification for this Home."
            "HOME_NOT_FOUND" -> "This Home is no longer available. Check your residency status."
            else -> "Mail verification cannot continue right now. Refresh to check your current status before trying again."
        }

    fun address(value: HomeResidencyAddressSnapshot): String =
        listOf(value.line1, value.line2, value.city, value.state, value.postalCode, value.country)
            .filter { it.isNotEmpty() }.joinToString(", ")
}
