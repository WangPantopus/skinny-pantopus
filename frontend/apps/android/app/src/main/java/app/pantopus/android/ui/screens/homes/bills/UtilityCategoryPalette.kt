@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.bills

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.0a — Per-utility-category visual tokens for the Bills row. Lifted
 * from the design at `bills-frames.jsx:53-62`. Feature code
 * ([BillsListViewModel], etc.) references these typed swatches; no hex
 * literal appears in the `ui/screens` tree outside this file.
 *
 * Why not in [app.pantopus.android.ui.theme.PantopusColors]? These are
 * per-category chip pairs (icon-background + icon-foreground) that
 * don't fit the existing `(name) → (single Color)` semantic token
 * model. Lifting them into their own palette file keeps the theme
 * semantic-only.
 *
 * Per the T6 open-question Q2 decision (see
 * `docs/t6-open-questions-decisions.md`), category is **client-derived
 * from the payee string** — there is no backend `category` field today
 * on `HomeBill`. [from] is the canonical inference helper, used by
 * iOS, Android, and web in parallel.
 *
 * This file is the **documented exception** to the no-hex-literal rule
 * in the `ui/screens` tree; each `Color(0xFF…)` literal is annotated with the
 * matching CSS hex from the design system so the audit trail survives.
 */
enum class UtilityCategory(val rawValue: String) {
    Electric("electric"),
    Gas("gas"),
    Water("water"),
    InternetService("internet"),
    Hoa("hoa"),
    Insurance("insurance"),
    Trash("trash"),
    Phone("phone"),
    Generic("generic"),
    ;

    /** User-facing label. */
    val label: String
        get() =
            when (this) {
                Electric -> "Electric"
                Gas -> "Gas"
                Water -> "Water"
                InternetService -> "Internet"
                Hoa -> "HOA"
                Insurance -> "Insurance"
                Trash -> "Trash"
                Phone -> "Phone"
                Generic -> "Bill"
            }

    /** Lucide icon glyph for the 40dp category tile. */
    val icon: PantopusIcon
        get() =
            when (this) {
                Electric -> PantopusIcon.Zap
                Gas -> PantopusIcon.Flame
                Water -> PantopusIcon.Droplet
                InternetService -> PantopusIcon.Wifi
                Hoa -> PantopusIcon.Building2
                Insurance -> PantopusIcon.ShieldCheck
                Trash -> PantopusIcon.Trash2
                Phone -> PantopusIcon.Smartphone
                Generic -> PantopusIcon.Receipt
            }

    /**
     * Soft-tinted background for the 40dp category tile. Hex values
     * mirror `bills-frames.jsx:53-62` exactly.
     */
    val background: Color
        get() =
            when (this) {
                // CSS fef9c3 — yellow-100
                Electric -> Color(0xFFFEF9C3)
                // CSS ffedd5 — orange-100
                Gas -> Color(0xFFFFEDD5)
                // CSS dbeafe — blue-100
                Water -> Color(0xFFDBEAFE)
                // CSS ede9fe — violet-100
                InternetService -> Color(0xFFEDE9FE)
                // CSS dcfce7 — green-100
                Hoa -> Color(0xFFDCFCE7)
                // CSS ccfbf1 — teal-100
                Insurance -> Color(0xFFCCFBF1)
                // CSS e2e8f0 — slate-200
                Trash -> Color(0xFFE2E8F0)
                // CSS fee2e2 — red-100
                Phone -> Color(0xFFFEE2E2)
                // CSS f0f9ff — primary50 (mirrors PantopusColors.primary50)
                Generic -> Color(0xFFF0F9FF)
            }

    /** Foreground tint for the icon glyph inside the 40dp tile. */
    val foreground: Color
        get() =
            when (this) {
                // CSS a16207 — yellow-700
                Electric -> Color(0xFFA16207)
                // CSS c2410c — orange-700
                Gas -> Color(0xFFC2410C)
                // CSS 1d4ed8 — blue-700
                Water -> Color(0xFF1D4ED8)
                // CSS 6d28d9 — violet-700
                InternetService -> Color(0xFF6D28D9)
                // CSS 15803d — green-700
                Hoa -> Color(0xFF15803D)
                // CSS 0f766e — teal-700
                Insurance -> Color(0xFF0F766E)
                // CSS 334155 — slate-700
                Trash -> Color(0xFF334155)
                // CSS b91c1c — red-700
                Phone -> Color(0xFFB91C1C)
                // CSS 0284c7 — primary600 (mirrors PantopusColors.primary600)
                Generic -> Color(0xFF0284C7)
            }

    companion object {
        /**
         * Client-side inference from a payee string (case-insensitive
         * substring match, first-match wins). Returns [Generic] when no
         * pattern matches. Per the T6 Q2 decision, this is the source
         * of truth for category until/unless the backend exposes a
         * typed field on `HomeBill`.
         *
         * Patterns are explicit constants here so future categories
         * bolt on without touching the row mapper. Adding a payee →
         * category pattern is a one-line edit to [patterns] plus a
         * test fixture.
         */
        @JvmStatic
        fun from(payee: String?): UtilityCategory {
            if (payee.isNullOrEmpty()) return Generic
            val lower = payee.lowercase()
            for (entry in patterns) {
                if (entry.matchers.any { lower.contains(it) }) {
                    return entry.category
                }
            }
            return Generic
        }

        private data class Pattern(
            val category: UtilityCategory,
            val matchers: List<String>,
        )

        /**
         * Ordered pattern table. **Order matters** — first match wins,
         * so more-specific patterns sit before generic ones (e.g.
         * "verizon wireless" precedes "verizon"; "comcast" precedes
         * "att" so a fictitious "att comcast" string lands on internet
         * not phone).
         */
        private val patterns: List<Pattern> =
            listOf(
                // Gas — branded gas providers first, then generic.
                Pattern(
                    Gas,
                    listOf(
                        "national grid gas",
                        "socalgas",
                        "southern california gas",
                        "atmos",
                        "centerpoint",
                        "national fuel",
                        "spire",
                        "natural gas",
                        "gas company",
                        "gas bill",
                        " gas",
                    ),
                ),
                // Electric — utility brands first, generic "electric" last.
                Pattern(
                    Electric,
                    listOf(
                        "pg&e", "pge", "coned", "con ed", "edison",
                        "dominion", "duke energy", "eversource",
                        "national grid", "pacificorp", "xcel",
                        "electric",
                    ),
                ),
                // Water — water board / municipal water + sewer.
                Pattern(
                    Water,
                    listOf(
                        "water board",
                        "water works",
                        "municipal water",
                        "aqua",
                        "sewer",
                        "wastewater",
                        "water",
                    ),
                ),
                // Internet — ISPs + fiber brands.
                Pattern(
                    InternetService,
                    listOf(
                        "comcast", "xfinity", "spectrum", "fios",
                        "starlink", "google fiber", "earthlink", "cox",
                        "frontier", "centurylink", "viasat", "hughesnet",
                        "internet",
                    ),
                ),
                // HOA + condo associations.
                Pattern(
                    Hoa,
                    listOf(
                        "hoa",
                        "homeowners association",
                        "homeowners assoc",
                        "condo assn",
                        "condo association",
                        "strata",
                    ),
                ),
                // Insurance — branded carriers + generic.
                Pattern(
                    Insurance,
                    listOf(
                        "state farm", "geico", "allstate", "progressive",
                        "liberty mutual", "farmers insurance", "nationwide",
                        "aaa auto", "metlife", "insurance",
                    ),
                ),
                // Trash + refuse + recycling.
                Pattern(
                    Trash,
                    listOf(
                        "waste management",
                        "republic services",
                        "recology",
                        "refuse",
                        "trash",
                        "garbage",
                        "recycling",
                    ),
                ),
                // Phone — branded carriers + generic.
                Pattern(
                    Phone,
                    listOf(
                        "t-mobile", "tmobile", "sprint", "mint mobile",
                        "google fi", "boost mobile", "cricket",
                        "wireless", "cell phone", "phone bill", "phone",
                    ),
                ),
            )
    }
}
