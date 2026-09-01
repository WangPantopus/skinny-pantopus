@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.4b — Per-emergency-category visual tokens for the
 * EmergencyInfoScreen row. Lifted from `emergency-frames.jsx:54-59`.
 * Feature code references typed swatches; no hex literal lives in
 * the feature screen tree outside this palette file (documented exception per
 * the Android `CLAUDE.md` token rules).
 *
 * The four design categories collapse the nine backend
 * `HomeEmergency.type` enum values:
 *   shutoff_water · shutoff_gas · shutoff_electric · breaker_map →
 *     [EmergencyCategory.Shutoff] (slate tile, view-photo action)
 *   emergency_contacts → [EmergencyCategory.Contact] (sky tile, tap-to-call)
 *   evac_plan → [EmergencyCategory.Evac] (amber tile, open-in-maps)
 *   first_aid · extinguisher → [EmergencyCategory.Medical] (rose, tap-to-call)
 *   other → [EmergencyCategory.Contact] fallback
 */
enum class EmergencyCategory(
    val id: String,
    val label: String,
    val chipLabel: String,
    val icon: PantopusIcon,
    val background: Color,
    val foreground: Color,
    val actionIcon: PantopusIcon,
    val actionAccessibilityLabel: String,
) {
    Shutoff(
        id = "shutoff",
        label = "Shutoffs",
        chipLabel = "Shutoffs",
        icon = PantopusIcon.Power,
        background = Color(0xFFE2E8F0),
        foreground = Color(0xFF334155),
        actionIcon = PantopusIcon.Image,
        actionAccessibilityLabel = "View shutoff photo",
    ),
    Contact(
        id = "contact",
        label = "Contacts",
        chipLabel = "Contacts",
        icon = PantopusIcon.Phone,
        background = Color(0xFFDBEAFE),
        foreground = Color(0xFF1D4ED8),
        actionIcon = PantopusIcon.PhoneCall,
        actionAccessibilityLabel = "Call",
    ),
    Evac(
        id = "evac",
        label = "Evacuation",
        chipLabel = "Evac",
        icon = PantopusIcon.Navigation,
        background = Color(0xFFFFEDD5),
        foreground = Color(0xFFC2410C),
        actionIcon = PantopusIcon.MapPin,
        actionAccessibilityLabel = "Open in Maps",
    ),
    Medical(
        id = "medical",
        label = "Medical",
        chipLabel = "Medical",
        icon = PantopusIcon.HeartPulse,
        background = Color(0xFFFEE2E2),
        foreground = Color(0xFFB91C1C),
        actionIcon = PantopusIcon.PhoneCall,
        actionAccessibilityLabel = "Call",
    ),
    ;

    companion object {
        /**
         * Map a `HomeEmergency.type` enum value to the design category.
         * Backend has 9 type constants; the 4-bucket design rolls them
         * up. Falls back to [Contact] for `other` and unknown strings — a
         * contact is the safest default for a household emergency item.
         */
        fun fromType(type: String): EmergencyCategory =
            when (type) {
                "shutoff_water", "shutoff_gas", "shutoff_electric", "breaker_map" -> Shutoff
                "emergency_contacts" -> Contact
                "evac_plan" -> Evac
                "first_aid", "extinguisher" -> Medical
                else -> Contact
            }

        /**
         * Per-`type` row glyph — more descriptive than the category
         * default when the backend has finer detail. Maps the nine type
         * constants to a per-row icon; uses the category default for
         * `other` and unknown strings.
         */
        fun glyph(forType: String): PantopusIcon =
            when (forType) {
                "shutoff_water" -> PantopusIcon.Droplet
                "shutoff_gas" -> PantopusIcon.Flame
                "shutoff_electric" -> PantopusIcon.Zap
                "breaker_map" -> PantopusIcon.Power
                "extinguisher" -> PantopusIcon.FlameKindling
                "first_aid" -> PantopusIcon.Cross
                "evac_plan" -> PantopusIcon.Flag
                "emergency_contacts" -> PantopusIcon.Phone
                else -> fromType(forType).icon
            }
    }
}
