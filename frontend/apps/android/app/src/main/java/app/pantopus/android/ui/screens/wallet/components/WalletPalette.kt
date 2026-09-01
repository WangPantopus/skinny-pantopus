@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.wallet.components

import androidx.compose.ui.graphics.Color

/**
 * A10.10 — bespoke Wallet swatches that don't map 1:1 onto the
 * design-system palette. The callouts are intentional design
 * decisions logged in `docs/token-drift-color.md`:
 *
 *   * [amberDeep] (Tailwind amber-800 92400E) sits between
 *     `warning` (D97706) and `warmAmber` (B45309) — used for
 *     the pending chip text + amber-row amount.
 *   * [chaseBlueDark] / [chaseBlueLight] (Tailwind blue-900 → blue-600)
 *     render the "physical Chase debit card" gradient; the
 *     sky-primary scale reads as a brand surface, not a real card.
 *
 * Both colors live in a dedicated palette file so the hex-grep guard
 * has a single documented exemption per the established convention
 * (mirrors `ui/screens/homes/bills/UtilityCategoryPalette.kt` &c.).
 */
object WalletPalette {
    /** Tailwind amber-800 92400E. Pending-chip foreground and
     *  amber-row amount colour in the wallet design. */
    val amberDeep: Color = Color(0xFF92400E)

    /** Chase card gradient dark stop — Tailwind blue-900 1E3A8A. */
    val chaseBlueDark: Color = Color(0xFF1E3A8A)

    /** Chase card gradient light stop — Tailwind blue-600 2563EB. */
    val chaseBlueLight: Color = Color(0xFF2563EB)
}
