@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto

/**
 * Block 3D — tip status + one-shot event for the gig-detail tip flow. The
 * poster tips the worker; the VM creates the tip payment and asks the screen to
 * present PaymentSheet, then reconciles via refresh-status. Mirrors iOS
 * `GigDetailViewModel.TipStatus`.
 */
sealed interface TipStatus {
    data object Idle : TipStatus

    data object Sending : TipStatus

    data object Succeeded : TipStatus

    data object Canceled : TipStatus

    data class Failed(val message: String) : TipStatus
}

/** One-shot effect: present Stripe PaymentSheet for the created tip payment. */
sealed interface GigTipEvent {
    data class PresentTipSheet(val params: PaymentIntentSheetParamsDto) : GigTipEvent
}

/** One-shot effect: navigate to the gig chat room after `GET /chat-room`. */
data class GigOpenChatEvent(
    val roomId: String,
    val displayName: String,
    val initials: String,
    val verified: Boolean,
)

/**
 * Phase 5 — one-shot effects for the lifecycle checkout flows (owner
 * accept-bid, helper instant-accept) plus transient toasts. The screen
 * presents PaymentSheet with [GigLifecycleEvent.PresentPaymentSheet.params]
 * and routes the Stripe result back via `onLifecycleCheckoutOutcome`.
 */
sealed interface GigLifecycleEvent {
    data class PresentPaymentSheet(val params: PaymentIntentSheetParamsDto) : GigLifecycleEvent

    data class Toast(val text: String, val isError: Boolean = false) : GigLifecycleEvent
}

/** Review affordance state on a completed gig (Phase 5, work item 5). */
sealed interface GigReviewState {
    /** Gig isn't completed or the viewer isn't a participant. */
    data object Hidden : GigReviewState

    /** Viewer may review; carries the reviewee from `my-pending`. */
    data class Available(val revieweeId: String, val revieweeName: String?) : GigReviewState

    /** Viewer already reviewed this gig — "Reviewed ✓". */
    data object Submitted : GigReviewState
}
