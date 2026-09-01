@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * P2.8 — Severity chip used by the Add Emergency Info form + detail.
 * Three levels driven by the design pack's semantic tokens:
 *   info     → primary50 bg / primary700 fg          (info glyph)
 *   caution  → warningBg / warning                   (alert-circle)
 *   critical → errorBg / error                       (alert-triangle)
 *
 * Critical rows pair the error-bg chip with the alert-triangle glyph
 * per the acceptance check.
 */
enum class EmergencySeverity(
    val id: String,
    val label: String,
    val background: Color,
    val foreground: Color,
    val icon: PantopusIcon,
) {
    Info(
        id = "info",
        label = "Info",
        background = PantopusColors.primary50,
        foreground = PantopusColors.primary700,
        icon = PantopusIcon.Info,
    ),
    Caution(
        id = "caution",
        label = "Caution",
        background = PantopusColors.warningBg,
        foreground = PantopusColors.warning,
        icon = PantopusIcon.AlertCircle,
    ),
    Critical(
        id = "critical",
        label = "Critical",
        background = PantopusColors.errorBg,
        foreground = PantopusColors.error,
        icon = PantopusIcon.AlertTriangle,
    ),
    ;

    companion object {
        /**
         * Resolve a severity from a stored details-map string. Returns
         * `null` for absent / unknown values so the chip is omitted.
         */
        fun fromValue(value: String?): EmergencySeverity? = entries.firstOrNull { it.id == value }
    }
}
