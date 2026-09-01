@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Bespoke, non-token swatches for the Calendarly scheduling surfaces.
 *
 * These are deliberately NOT [PantopusColors] design tokens — they are fixed
 * third-party brand marks (Stripe, the calendar providers) plus the arbitrary
 * swatch ramp the event-type editor offers as a colour picker. Per the
 * [SpeciesPalette] precedent they live in `ui/theme/` so the literals stay
 * out of feature code (and clear of the CI hex-grep / `verifyPantopusTokens`
 * guards). Mirrors the equivalent scheduling brand colours on iOS.
 */
object SchedulingPalette {
    // ── Stripe brand mark (Connect / Payments cards) ────────────────────────
    /** Stripe brand indigo — used for the Stripe glyph tile / disc. */
    val stripeBrand = Color(0xFF635BFF)

    /** Stripe-violet card fill behind the Connect-Stripe cards and disc. */
    val stripeBg = Color(0xFFF5F4FF)

    /** Stripe-violet hairline border for the Connect-Stripe card. */
    val stripeBorder = Color(0xFFE0DDFF)

    // ── Calendar provider brand tiles (design connected-calendars PROVIDERS) ─
    val calendarGoogle = Color(0xFF1A73E8)
    val calendarApple = Color(0xFF1D1D1F)
    val calendarOutlook = Color(0xFF0F6CBD)

    /**
     * Per-event-type colour ramp, as backend-wire `#rrggbb` strings — the
     * event-type editor stores the selected swatch verbatim as the bookable's
     * `color`, so these must stay hex strings rather than [Color]s. Kept in
     * the theme layer so the literals never appear in feature code.
     */
    val eventTypeSwatchHex: List<String> =
        listOf(
            "#2980b9",
            "#0284c7",
            "#16a34a",
            "#0d9488",
            "#7c3aed",
            "#d97706",
            "#f97316",
            "#e11d48",
        )
}
