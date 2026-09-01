@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.payments

import android.content.Context
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult

/**
 * Shared Stripe PaymentSheet helpers reused across Phase 3 (3A–3D). Builds
 * the [PaymentSheet.Configuration] from the server-supplied customer +
 * ephemeral key, and maps Stripe's [PaymentSheetResult] into the SDK-free
 * [AddCardOutcome] the view-model consumes.
 *
 * We never build card-entry UI — PaymentSheet collects the card, handles
 * SCA/3-D Secure, and reports the result.
 */
object StripePaymentSheets {
    private const val MERCHANT_DISPLAY_NAME = "Pantopus"

    fun configurePublishableKey(
        context: Context,
        publishableKey: String?,
    ) {
        val key = publishableKey?.trim().orEmpty()
        // Skip blanks and the committed pk_test_/pk_live_REPLACE_ME + $(…)
        // placeholders so a fake key is never registered.
        if (key.isBlank() || key.contains("REPLACE_ME") || key.startsWith("$(")) return
        PaymentConfiguration.init(context.applicationContext, key)
    }

    fun configuration(
        context: Context,
        customerId: String,
        ephemeralKey: String,
        publishableKey: String? = null,
    ): PaymentSheet.Configuration {
        configurePublishableKey(context, publishableKey)
        return PaymentSheet.Configuration(
            merchantDisplayName = MERCHANT_DISPLAY_NAME,
            customer =
                PaymentSheet.CustomerConfiguration(
                    id = customerId,
                    ephemeralKeySecret = ephemeralKey,
                ),
        )
    }

    /**
     * Configuration for a one-off checkout (Block 3B). The customer +
     * ephemeral key are best-effort: when the backend couldn't mint a key we
     * still collect a card against the client secret rather than failing.
     */
    fun paymentConfiguration(
        context: Context,
        customerId: String?,
        ephemeralKey: String?,
        publishableKey: String? = null,
    ): PaymentSheet.Configuration {
        configurePublishableKey(context, publishableKey)
        val customer =
            if (!customerId.isNullOrBlank() && !ephemeralKey.isNullOrBlank()) {
                PaymentSheet.CustomerConfiguration(id = customerId, ephemeralKeySecret = ephemeralKey)
            } else {
                null
            }
        return PaymentSheet.Configuration(
            merchantDisplayName = MERCHANT_DISPLAY_NAME,
            customer = customer,
        )
    }

    fun outcome(result: PaymentSheetResult): AddCardOutcome =
        when (result) {
            is PaymentSheetResult.Completed -> AddCardOutcome.Completed
            is PaymentSheetResult.Canceled -> AddCardOutcome.Canceled
            is PaymentSheetResult.Failed -> AddCardOutcome.Failed(result.error.message)
        }

    /** Map Stripe's result into the SDK-free [CheckoutOutcome] the VM consumes. */
    fun checkoutOutcome(result: PaymentSheetResult): CheckoutOutcome =
        when (result) {
            is PaymentSheetResult.Completed -> CheckoutOutcome.Paid
            is PaymentSheetResult.Canceled -> CheckoutOutcome.Canceled
            is PaymentSheetResult.Failed -> CheckoutOutcome.Declined(result.error.message)
        }
}

/**
 * Result of a checkout PaymentSheet, mapped from Stripe's `PaymentSheetResult`
 * in the screen so the view-model stays SDK-free. Mirrors iOS `CheckoutOutcome`.
 */
sealed interface CheckoutOutcome {
    /** PaymentSheet completed — re-read server state. */
    data object Paid : CheckoutOutcome

    /** Buyer dismissed the sheet without paying. */
    data object Canceled : CheckoutOutcome

    /** Card declined / SCA failed. */
    data class Declined(val message: String?) : CheckoutOutcome
}
