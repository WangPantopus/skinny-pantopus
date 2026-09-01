@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.wallet.scheduling

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

/**
 * Opens a Stripe-hosted URL (Connect Account Link or Express dashboard) in a
 * Custom Tab, falling back to a plain `ACTION_VIEW` intent. Mirrors the gig
 * Wallet's `openStripeHostedUrl` so Calendarly payment surfaces (G6 Payments
 * Setup, G7 Payouts & Earnings) launch Connect identically without modifying
 * the existing Wallet screen. The owner returns to the app via the configured
 * return/refresh URLs; callers re-read status on `ON_RESUME`.
 */
internal fun openStripeHostedUrl(
    context: Context,
    url: String,
) {
    val uri = Uri.parse(url)
    runCatching {
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(context, uri)
    }.getOrElse {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }
}

/** One-shot effect emitted by the payment view-models to open a Stripe URL. */
data class OpenStripeUrl(
    val url: String,
    /** Re-read status when the user returns from the Stripe-hosted flow. */
    val refreshOnReturn: Boolean,
)
