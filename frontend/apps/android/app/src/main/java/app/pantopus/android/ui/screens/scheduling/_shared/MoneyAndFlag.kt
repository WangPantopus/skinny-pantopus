@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.runtime.Composable
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Price formatting for `price_cents`/`currency` + the paid-surface gate.
 *
 * Paid surfaces (priced event types, packages, invoices, payouts, Stripe
 * checkout) call [PaidGate] with `SchedulingFeatureFlags.paidSchedulingEnabled`
 * so they vanish in production until payout settlement ships.
 */
object MoneyAndFlag {
    /**
     * Format minor units to a localized currency string. `null`/`0` → "Free".
     * Falls back to "<amount> <code>" if the currency code is unknown.
     */
    fun formatPrice(
        priceCents: Int?,
        currency: String? = DEFAULT_CURRENCY,
    ): String {
        if (priceCents == null || priceCents <= 0) return "Free"
        val code = currency?.takeIf { it.isNotBlank() }?.uppercase() ?: DEFAULT_CURRENCY
        val amount = priceCents / CENTS_PER_UNIT
        return runCatching {
            NumberFormat.getCurrencyInstance(Locale.US).apply {
                this.currency = Currency.getInstance(code)
            }.format(amount)
        }.getOrElse { "%.2f %s".format(amount, code) }
    }

    /**
     * Parse a user-typed price string ("$240.00", "240", "240.5", "240,50") to
     * cents. Decimal-aware: the last `.`/`,` followed by 1–2 digits is the
     * decimal separator; any other `.`/`,` is a thousands separator. Returns
     * null when the field is empty / unparseable.
     */
    fun parseCents(raw: String): Int? {
        val cleaned = raw.filter { it.isDigit() || it == '.' || it == ',' }
        if (cleaned.none { it.isDigit() }) return null
        val lastSep = cleaned.indexOfLast { it == '.' || it == ',' }
        val fractionDigits = if (lastSep >= 0) cleaned.length - lastSep - 1 else 0
        val normalized =
            if (lastSep >= 0 && fractionDigits in 1..MAX_DECIMAL_DIGITS) {
                cleaned.take(lastSep).filter { it.isDigit() } + "." + cleaned.drop(lastSep + 1)
            } else {
                cleaned.filter { it.isDigit() }
            }
        val value = normalized.toDoubleOrNull() ?: return null
        return (value * CENTS_PER_UNIT).roundToInt()
    }

    /**
     * Seed text for an editable money field: whole dollars render bare ("49"),
     * fractional amounts render with two Locale.US decimals ("49.50") so no
     * cents are silently truncated and the text round-trips through
     * [parseCents] in every device locale.
     */
    fun editText(cents: Int): String =
        if (cents % CENTS_PER_UNIT_INT == 0) {
            (cents / CENTS_PER_UNIT_INT).toString()
        } else {
            String.format(Locale.US, "%.2f", cents / CENTS_PER_UNIT)
        }

    private const val DEFAULT_CURRENCY = "USD"
    private const val CENTS_PER_UNIT = 100.0
    private const val CENTS_PER_UNIT_INT = 100
    private const val MAX_DECIMAL_DIGITS = 2
}

/**
 * Renders [content] only when paid scheduling is [enabled]; otherwise renders
 * [fallback] (nothing by default). The caller passes
 * `SchedulingFeatureFlags.paidSchedulingEnabled`.
 */
@Composable
fun PaidGate(
    enabled: Boolean,
    fallback: @Composable () -> Unit = {},
    content: @Composable () -> Unit,
) {
    if (enabled) content() else fallback()
}
