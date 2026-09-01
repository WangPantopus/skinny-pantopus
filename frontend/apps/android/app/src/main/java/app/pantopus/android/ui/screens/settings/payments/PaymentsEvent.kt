@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.payments

import app.pantopus.android.data.api.models.payments.AddCardSheetParamsDto

/**
 * One-shot effects the [PaymentsViewModel] asks the screen to perform.
 * PaymentSheet presentation must happen in the composable (it needs the
 * Activity's `ActivityResultRegistry`), so the VM emits the params and the
 * screen drives the SDK — keeping the VM free of Stripe types and testable
 * on the JVM.
 */
sealed interface PaymentsEvent {
    /** Present Stripe PaymentSheet in SetupIntent mode to add a card. */
    data class PresentAddCardSheet(val params: AddCardSheetParamsDto) : PaymentsEvent

    /** Surface a transient message (toast) — declined / network errors. */
    data class ShowMessage(val text: String) : PaymentsEvent
}

/**
 * Result of presenting the add-card PaymentSheet, mapped from Stripe's
 * `PaymentSheetResult` in the screen so the VM stays SDK-free.
 */
sealed interface AddCardOutcome {
    data object Completed : AddCardOutcome

    data object Canceled : AddCardOutcome

    data class Failed(val message: String?) : AddCardOutcome
}
