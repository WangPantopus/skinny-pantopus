package app.pantopus.android.ui.screens.homes.postal

import app.pantopus.android.data.api.models.homes.HomeResidencyAddressSnapshot
import app.pantopus.android.data.homes.HomePostalKind
import app.pantopus.android.data.homes.HomePostalOutcome

object HomePostalMessages {
    fun postcardStatus(raw: String?): String =
        when (raw) {
            "pending" -> "Waiting for your code"
            "verified" -> "Verified"
            "expired" -> "Code expired"
            "cancelled" -> "No longer active"
            "locked" -> "No tries left"
            else -> "Status unavailable"
        }

    fun recovery(
        sessionCurrent: Boolean,
        storageFailed: Boolean,
        hasOriginal: Boolean,
    ): String =
        when {
            !sessionCurrent -> "Your sign-in changed. Reload to check your last attempt."
            storageFailed -> HomePostalCoordinator.STORAGE
            hasOriginal -> "We couldn't confirm the result. Check again, try again, or discard this attempt."
            else -> "Couldn't check your postcard status. Try again."
        }

    fun headline(
        kind: HomePostalKind,
        outcome: HomePostalOutcome?,
    ): String =
        when (outcome?.state) {
            "completed" -> if (kind == HomePostalKind.Code) "Code accepted" else "Postcard requested"
            "cancelled" -> "Attempt discarded"
            "rejected" -> "Couldn't finish this"
            else -> "Check your last attempt"
        }

    fun explanation(
        kind: HomePostalKind,
        outcome: HomePostalOutcome?,
    ): String =
        when (outcome?.state) {
            "completed" ->
                if (kind == HomePostalKind.Code) {
                    "Your code was accepted. Residency status shows your access and anything still waiting on the household."
                } else {
                    "We'll mail it to this address. When it arrives, enter the code here."
                }
            "cancelled" -> "Nothing changed. This attempt was discarded before it took effect."
            "rejected" -> restriction(outcome.code.orEmpty())
            else -> "We couldn't confirm whether this went through. Check again, or try again."
        }

    /** Once a postcard is verified, expired or replaced, how it travelled no longer matters. */
    fun postcardEnded(status: String?): Boolean = status in setOf("verified", "expired", "cancelled")

    fun postcardHeadline(
        status: String?,
        deliveryState: String?,
    ): String =
        when (status) {
            "verified" -> "Address verified by mail"
            "expired" -> "Postcard code expired"
            "cancelled" -> "Postcard no longer active"
            else -> delivery(deliveryState)
        }

    fun delivery(state: String?): String =
        when (state) {
            "not_started" -> "Your postcard hasn't been sent yet"
            "accepted" -> "Your postcard is on its way"
            "unknown" -> "We couldn't confirm your postcard was sent"
            "rejected" -> "The mail service couldn't send your postcard"
            else -> "Postcard status unavailable"
        }

    fun restriction(code: String): String =
        when (code) {
            "POSTCARD_WRONG_CODE" -> "That code didn't match this postcard. Check it and try again."
            "POSTCARD_ADDRESS_CHANGED" -> "This address doesn't match the one saved for this Home. Check the street, apartment and ZIP."
            "POSTCARD_EXPIRED" -> "This postcard's code has expired. Request a new postcard."
            "POSTCARD_LOCKED" -> "No tries left for this postcard. Request a new one."
            "POSTCARD_ACCESS_REVIEW_REQUIRED" ->
                "A mail code can't restore access that was removed or has ended. Ask someone in the household to invite you again."
            "POSTCARD_REVIEW_ALREADY_RECORDED" -> "You're already verified. Residency status shows your access."
            "POSTCARD_HOME_UNAVAILABLE" -> "Mail verification is unavailable for this Home right now."
            "POSTCARD_RESIDENCY_REQUEST_REQUIRED" -> "Submit your residency request before requesting a postcard."
            else -> availability(code)
        }

    private fun availability(code: String): String =
        when (code) {
            "POSTCARD_COUNTRY_UNAVAILABLE" -> "Mail verification is currently available for US addresses."
            "POSTCARD_ADDRESS_LIMIT" -> "Too many postcards have been requested for this address. Try again later."
            "POSTCARD_USER_LIMIT" -> "You've asked for too many postcards in the last hour. Try again later."
            "POSTCARD_NOT_DISPATCHED" -> "Your postcard hasn't been sent yet. Send it first."
            "OWNERSHIP_FLOW_REQUIRED" -> "Continue ownership verification for this Home."
            "HOME_NOT_FOUND" -> "This Home is no longer available. Check your residency status."
            else -> "This couldn't be completed. Check your status and try again."
        }

    fun address(value: HomeResidencyAddressSnapshot): String =
        listOf(value.line1, value.line2, value.city, value.state, value.postalCode, value.country)
            .filter { it.isNotEmpty() }.joinToString(", ")
}
