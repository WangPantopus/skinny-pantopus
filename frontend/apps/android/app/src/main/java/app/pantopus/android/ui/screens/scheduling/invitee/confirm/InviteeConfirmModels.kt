@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.data.scheduling.SchedulingError

/**
 * Models shared by the A6 invitee commit flow (D1 intake → D2 review → D3
 * confirmed) and the D4 manage surface. Kept Compose-free so the view-model and
 * `ConfirmUtils` can be unit-tested on the JVM.
 */

/** The host's intake question schema (forward-compatible — see `ConfirmUtils`). */
enum class IntakeFieldType { Text, Textarea, Select, Multiselect, Checkbox, Phone }

data class IntakeQuestion(
    val id: String? = null,
    val label: String,
    val fieldType: IntakeFieldType = IntakeFieldType.Text,
    val options: List<String> = emptyList(),
    val required: Boolean = false,
    val sortOrder: Int = 0,
)

/** A single answer value — text, multi-select choices, or a checkbox flag. */
sealed interface AnswerValue {
    data class Text(val value: String) : AnswerValue

    data class Choices(val value: List<String>) : AnswerValue

    data class Flag(val value: Boolean) : AnswerValue
}

/**
 * Optional signed-in invitee identity used to prefill D1 ("Booking as …").
 * Mirrors iOS `InviteePrefill`; supplied by the slot-picker hand-off when a
 * booker is signed in. Absent for the anonymous public path (the common case).
 */
data class InviteePrefill(
    val name: String,
    val email: String,
)

/** The controlled intake form state. */
data class IntakeValues(
    val firstName: String = "",
    val lastName: String = "",
    val email: String = "",
    val phone: String = "",
    /** Keyed by `ConfirmUtils.questionKey(q, i)`. */
    val answers: Map<String, AnswerValue> = emptyMap(),
    /** Optional guest emails (sent inside `answers.guest_emails`). */
    val guests: List<String> = emptyList(),
    /**
     * True while a signed-in identity is prefilled — collapses the editable
     * name/email fields into the "Booking as" chip. Cleared by "Not you?".
     */
    val isPrefilled: Boolean = false,
)

/** The step the single-destination commit flow is on. */
enum class ConfirmStep { Details, Review, Payment, Confirmed }

/**
 * Everything A5's slot picker hands to the A6 commit flow. Passed as an
 * in-process composable argument (the flow is a local step of A5's
 * `book/{slug}` destination — there is no separate route, so the DTOs travel as
 * objects, not nav-arg strings).
 */
data class InviteeConfirmArgs(
    val slug: String? = null,
    val eventTypeSlug: String? = null,
    val oneOffToken: String? = null,
    val eventType: PublicEventTypeView,
    val page: PublicPageView? = null,
    val hostName: String,
    val ownerType: String? = null,
    val cancellationPolicy: String? = null,
    val questions: List<IntakeQuestion> = emptyList(),
    val startAtUtc: String,
    val endAtUtc: String? = null,
    val tz: String,
    /** Signed-in invitee identity to prefill D1, when one is known. */
    val prefill: InviteePrefill? = null,
)

/** The terminal D3 payload, set once the booking is created. */
data class ConfirmedData(
    val bookingId: String,
    val manageToken: String?,
    val sentToEmail: String,
    val requiresApproval: Boolean,
    val confirmationMessage: String?,
    /** Non-null for priced bookings (paid flag + Stripe test mode). */
    val paid: PaidConfirmInfo? = null,
)

/** Receipt summary for the confirmed-paid / deposit-paid variants. */
data class PaidConfirmInfo(
    val mode: PriceMode,
    val amountPaidCents: Int,
    val balanceCents: Int,
    val currency: String?,
    /** The monospace transaction/timestamp line shown above the divider. */
    val txnLine: String? = null,
    /** True while the receipt email is still in flight (FrameEmailSending). */
    val processing: Boolean = false,
)

/**
 * The full commit-flow state — a single data class (rather than a sealed
 * Loading/Loaded set) because the flow is seeded with its data up front and is
 * a multi-step form, not a fetchable surface. The fetchable A6 surface (D4
 * manage) uses the sealed [ManageBookingUiState] instead.
 */
data class ConfirmFlowState(
    val step: ConfirmStep = ConfirmStep.Details,
    val values: IntakeValues = IntakeValues(),
    val shownErrors: Map<String, String> = emptyMap(),
    val slotStartUtc: String = "",
    val slotEndUtc: String? = null,
    val tz: String = "UTC",
    val submitting: Boolean = false,
    val conflict: SchedulingError.Conflict? = null,
    val errorMessage: String? = null,
    val holdSecondsLeft: Int = HOLD_SECONDS,
    val clientSecret: String? = null,
    val manageToken: String? = null,
    /**
     * The id of the booking `submit()` created — stashed even when the flow
     * detours through [ConfirmStep.Payment] (where [confirmed] isn't built yet)
     * so the post-payment [ConfirmedData] and its receipt/nav carry the real id.
     */
    val createdBookingId: String? = null,
    val confirmed: ConfirmedData? = null,
    /**
     * True when the entered email resolves to an existing account — surfaces the
     * D1 "You have an account" info banner. No public lookup endpoint exists yet,
     * so this stays false today (deferred backend signal).
     */
    val existingAccount: Boolean = false,
) {
    val holdExpired: Boolean get() = holdSecondsLeft <= 0

    companion object {
        const val HOLD_SECONDS = 5 * 60
    }
}

// ─── D4 manage state ─────────────────────────────────────────────────────────

/** The four-state idiom for the fetchable D4 manage surface. */
sealed interface ManageBookingUiState {
    data object Loading : ManageBookingUiState

    /** Token expired / invalid — the TokenAccept-style error halo. */
    data object Expired : ManageBookingUiState

    data class Error(val message: String) : ManageBookingUiState

    data class Loaded(val data: ManageBookingData) : ManageBookingUiState
}

/** Lifecycle status the manage surface renders a badge + actions for. */
enum class ManageStatus { Confirmed, Pending, Past, Cancelled }

data class ManageBookingData(
    val token: String,
    val status: ManageStatus,
    val eventName: String,
    val hostName: String,
    val ownerType: String?,
    val startUtc: String?,
    val endUtc: String?,
    val whenLabel: String,
    val tzLabel: String,
    val locationLabel: String,
    val locationSub: String?,
    val inviteeName: String?,
    val cancelledOnLabel: String?,
    val cancellationPolicy: String?,
    val pageSlug: String?,
    val canReschedule: Boolean,
    val canCancel: Boolean,
    /** Active but both actions are gated by the cutoff/policy window. */
    val windowClosed: Boolean,
    val refundEstimateCents: Int?,
    val currency: String?,
)
