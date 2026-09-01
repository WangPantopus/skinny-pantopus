@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.wallet

/**
 * Block 3C — payout action + one-shot event types for the Wallet screen.
 * Withdraw and Stripe Connect onboarding/dashboard live here so the
 * [WalletViewModel] stays SDK/Activity-free: the screen opens hosted URLs and
 * re-reads Connect status on return. Mirrors iOS `WalletViewModel.Action`.
 */

/** Transient status for a payout action, surfaced by the screen as a toast. */
sealed interface WalletAction {
    data object Idle : WalletAction

    data object Withdrawing : WalletAction

    data class WithdrawSucceeded(val message: String) : WalletAction

    data class WithdrawFailed(val message: String) : WalletAction

    /** Opening the Stripe-hosted onboarding / dashboard. */
    data object Connecting : WalletAction

    data class ActionFailed(val message: String) : WalletAction
}

/** One-shot effects the [WalletViewModel] asks the screen to perform. */
sealed interface WalletEvent {
    /**
     * Open a Stripe-hosted URL (Account Link onboarding or Express dashboard)
     * in the browser. [refreshOnReturn] tells the screen to re-read Connect
     * status when the seller returns to the app (onboarding only).
     */
    data class OpenUrl(val url: String, val refreshOnReturn: Boolean) : WalletEvent
}
