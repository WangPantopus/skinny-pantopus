@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.accesscodes

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.4a — Per-category visual tokens for the Access codes row. Lifted
 * from the design at `access-frames.jsx:47-54`, extended with the
 * `SmartLock` category called out in the T6.4a brief.
 *
 * Feature code (AccessCodesViewModel, etc.) references these typed
 * swatches; no hex literal appears elsewhere in the feature screen tree.
 * Same rationale as `UtilityCategoryPalette`: per-category chip pairs
 * don't fit `PantopusColors`'s single-color semantic-token model.
 */
enum class AccessCategory(
    val wire: String,
) {
    /** Raw values match the backend `HomeAccessSecret.access_type` enum. */
    Wifi("wifi"),
    Alarm("alarm"),
    Gate("gate"),
    Lockbox("lockbox"),
    Garage("garage"),
    SmartLock("smart_lock"),
    ;

    /** User-facing label. */
    val label: String
        get() =
            when (this) {
                Wifi -> "Wi-Fi"
                Alarm -> "Alarm"
                Gate -> "Gate"
                Lockbox -> "Lockbox"
                Garage -> "Garage"
                SmartLock -> "Smart lock"
            }

    /**
     * Lucide-equivalent icon glyph for the 40dp category tile. Maps to
     * the closest available `PantopusIcon` case — visual signal is
     * reinforced by the per-category background tint.
     */
    val icon: PantopusIcon
        get() =
            when (this) {
                Wifi -> PantopusIcon.Wifi
                Alarm -> PantopusIcon.ShieldAlert
                Gate -> PantopusIcon.Shield
                Lockbox -> PantopusIcon.Lock
                Garage -> PantopusIcon.Building2
                SmartLock -> PantopusIcon.ShieldCheck
            }

    /** Soft-tinted background for the 40dp category tile. */
    val background: Color
        get() =
            when (this) {
                // CSS dbeafe — sky-100
                Wifi -> Color(0xFFDBEAFE)
                // CSS fee2e2 — red-100
                Alarm -> Color(0xFFFEE2E2)
                // CSS e0e7ff — indigo-100
                Gate -> Color(0xFFE0E7FF)
                // CSS fef3c7 — amber-100
                Lockbox -> Color(0xFFFEF3C7)
                // CSS e2e8f0 — slate-200
                Garage -> Color(0xFFE2E8F0)
                // CSS ccfbf1 — teal-100
                SmartLock -> Color(0xFFCCFBF1)
            }

    /** Foreground tint for the icon glyph inside the 40dp tile. */
    val foreground: Color
        get() =
            when (this) {
                // CSS 1d4ed8 — blue-700
                Wifi -> Color(0xFF1D4ED8)
                // CSS b91c1c — red-700
                Alarm -> Color(0xFFB91C1C)
                // CSS 4338ca — indigo-700
                Gate -> Color(0xFF4338CA)
                // CSS 92400e — amber-800
                Lockbox -> Color(0xFF92400E)
                // CSS 334155 — slate-700
                Garage -> Color(0xFF334155)
                // CSS 0f766e — teal-700
                SmartLock -> Color(0xFF0F766E)
            }

    /**
     * Wire string sent to the backend on POST / PUT. The database
     * CHECK constraint at `HomeAccessSecret_type_chk` only accepts
     * `('wifi','door_code','gate_code','lockbox','garage','alarm','other')`
     * so the two extra UI-side categories (`Gate`, `SmartLock`) round-
     * trip through the closest allowed strings (`gate_code`, `other`).
     */
    val backendAccessType: String
        get() =
            when (this) {
                Wifi -> "wifi"
                Alarm -> "alarm"
                Gate -> "gate_code"
                Lockbox -> "lockbox"
                Garage -> "garage"
                SmartLock -> "other"
            }

    companion object {
        /** Display order on the screen — same order the chip strip uses. */
        val displayOrder: List<AccessCategory> =
            listOf(Wifi, Alarm, Gate, Lockbox, Garage, SmartLock)

        /**
         * Map a backend `access_type` string onto a typed category.
         * Unknown values fall back to `Lockbox` so the row still renders.
         */
        fun from(accessType: String?): AccessCategory {
            if (accessType.isNullOrEmpty()) return Lockbox
            val key = accessType.lowercase()
            AccessCategory.entries.firstOrNull { it.wire == key }?.let { return it }
            return when {
                "wifi" in key || "network" in key -> Wifi
                "alarm" in key || "siren" in key -> Alarm
                "gate" in key || "fence" in key -> Gate
                "garage" in key || "opener" in key -> Garage
                "smart" in key || "digital" in key -> SmartLock
                else -> Lockbox
            }
        }
    }
}
