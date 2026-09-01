@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.documents

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.4b — Per-category visual tokens for the DocumentsScreen section
 * headers + row chips. Lifted from `docs-frames.jsx:65-73`. Documented
 * exception to the no-hex rule (palette file, per Android `CLAUDE.md`).
 *
 * Maps the ten backend `HomeDocument.doc_type` enum values onto the
 * seven design categories plus an `Other` catch-all:
 *   lease → Lease
 *   insurance → Insurance
 *   warranty, manual → Warranty
 *   permit, floor_plan → Permit
 *   receipt → Tax (receipts are tax-adjacent)
 *   photo, paint_color, other → Other
 */
enum class DocumentCategory(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val background: Color,
    val foreground: Color,
    val sortOrder: Int,
) {
    Lease(
        id = "lease",
        label = "Lease & ownership",
        icon = PantopusIcon.FileSignature,
        background = Color(0xFFDCFCE7),
        foreground = Color(0xFF15803D),
        sortOrder = 0,
    ),
    Insurance(
        id = "insurance",
        label = "Insurance",
        icon = PantopusIcon.ShieldCheck,
        background = Color(0xFFCCFBF1),
        foreground = Color(0xFF0F766E),
        sortOrder = 1,
    ),
    Warranty(
        id = "warranty",
        label = "Warranties & manuals",
        icon = PantopusIcon.BadgeCheck,
        background = Color(0xFFFEF3C7),
        foreground = Color(0xFFA16207),
        sortOrder = 2,
    ),
    Tax(
        id = "tax",
        label = "Tax & financial",
        icon = PantopusIcon.Landmark,
        background = Color(0xFFE0E7FF),
        foreground = Color(0xFF4338CA),
        sortOrder = 3,
    ),
    Permit(
        id = "permit",
        label = "Permits & inspections",
        icon = PantopusIcon.Stamp,
        background = Color(0xFFFFEDD5),
        foreground = Color(0xFFC2410C),
        sortOrder = 4,
    ),
    Hoa(
        id = "hoa",
        label = "HOA & community",
        icon = PantopusIcon.Building2,
        background = Color(0xFFDBEAFE),
        foreground = Color(0xFF1D4ED8),
        sortOrder = 5,
    ),
    Identity(
        id = "id",
        label = "Identity proof",
        icon = PantopusIcon.IdCard,
        background = Color(0xFFFCE7F3),
        foreground = Color(0xFFBE185D),
        sortOrder = 6,
    ),
    Other(
        id = "other",
        label = "Other",
        icon = PantopusIcon.File,
        background = Color(0xFFE2E8F0),
        foreground = Color(0xFF334155),
        sortOrder = 7,
    ),
    ;

    companion object {
        /**
         * Map a `HomeDocument.doc_type` enum value to the design
         * category. The seven design categories don't 1:1 cover the
         * ten backend types — `manual` rolls into [Warranty],
         * `floor_plan` into [Permit], `receipt` into [Tax], and
         * `paint_color` / `photo` / `other` collapse to [Other].
         */
        fun fromDocType(docType: String): DocumentCategory =
            when (docType) {
                "lease" -> Lease
                "insurance" -> Insurance
                "warranty", "manual" -> Warranty
                "permit", "floor_plan" -> Permit
                "receipt" -> Tax
                else -> Other
            }
    }
}
