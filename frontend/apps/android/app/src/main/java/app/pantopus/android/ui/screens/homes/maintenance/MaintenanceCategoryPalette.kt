@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.3b / P10 — Per-task-category visual tokens for the Maintenance
 * row. Lifted from the design at `maintenance-frames.jsx:49-63`
 * (the `TASK` map). Feature code ([MaintenanceListViewModel], etc.)
 * references these typed swatches; no hex literal appears in the
 * `ui/screens` tree outside this file.
 *
 * Why not in [app.pantopus.android.ui.theme.PantopusColors]? These are
 * per-category chip pairs (icon-background + icon-foreground) that
 * don't fit the existing `(name) → (single Color)` semantic token
 * model — same rationale documented on
 * `UtilityCategoryPalette` (Bills T6.0a).
 *
 * Inference is client-side from the `task` string (case-insensitive
 * substring match, first-match wins). The new `HomeMaintenanceLog`
 * rows don't carry a typed category column; the design relies on the
 * task title for visual signal and the inference table here covers
 * the 12 most common annual maintenance jobs.
 *
 * This file is the **documented exception** to the no-hex-literal
 * rule in the `ui/screens` tree; each `Color(0xFF…)` literal is
 * annotated with the matching CSS hex from the design system.
 */
enum class MaintenanceCategory(val rawValue: String) {
    Hvac("hvac"),
    Plumbing("plumbing"),
    Electrical("electrical"),
    Roof("roof"),
    Gutter("gutter"),
    Appliance("appliance"),
    Pest("pest"),
    Landscape("landscape"),
    Cleaning("cleaning"),
    Painting("painting"),
    Safety("safety"),
    Chimney("chimney"),
    Generic("generic"),
    ;

    /** User-facing label (matches the design `TASK` map labels). */
    val label: String
        get() =
            when (this) {
                Hvac -> "HVAC"
                Plumbing -> "Plumbing"
                Electrical -> "Electrical"
                Roof -> "Roof"
                Gutter -> "Gutters"
                Appliance -> "Appliance"
                Pest -> "Pest"
                Landscape -> "Landscape"
                Cleaning -> "Cleaning"
                Painting -> "Painting"
                Safety -> "Safety"
                Chimney -> "Chimney"
                Generic -> "Other"
            }

    /** Lucide icon glyph for the 40dp category tile. */
    val icon: PantopusIcon
        get() =
            when (this) {
                Hvac -> PantopusIcon.Fan
                Plumbing -> PantopusIcon.Wrench
                Electrical -> PantopusIcon.Zap
                Roof -> PantopusIcon.Home
                Gutter -> PantopusIcon.CloudRain
                Appliance -> PantopusIcon.Refrigerator
                Pest -> PantopusIcon.Bug
                Landscape -> PantopusIcon.Trees
                Cleaning -> PantopusIcon.Sparkles
                Painting -> PantopusIcon.PaintRoller
                Safety -> PantopusIcon.BellRing
                Chimney -> PantopusIcon.Flame
                Generic -> PantopusIcon.Wrench
            }

    /** Soft-tinted background for the 40dp category tile. Hex values
     *  mirror `maintenance-frames.jsx:49-63` exactly. */
    val background: Color
        get() =
            when (this) {
                // CSS fef3c7 — yellow-100
                Hvac -> Color(0xFFFEF3C7)
                // CSS dbeafe — blue-100
                Plumbing -> Color(0xFFDBEAFE)
                // CSS fef9c3 — yellow-100 (electrical bolt)
                Electrical -> Color(0xFFFEF9C3)
                // CSS e2e8f0 — slate-200
                Roof -> Color(0xFFE2E8F0)
                // CSS ccfbf1 — teal-100
                Gutter -> Color(0xFFCCFBF1)
                // CSS e0e7ff — indigo-100
                Appliance -> Color(0xFFE0E7FF)
                // CSS fee2e2 — red-100
                Pest -> Color(0xFFFEE2E2)
                // CSS dcfce7 — green-100
                Landscape -> Color(0xFFDCFCE7)
                // CSS cffafe — cyan-100
                Cleaning -> Color(0xFFCFFAFE)
                // CSS ede9fe — violet-100
                Painting -> Color(0xFFEDE9FE)
                // CSS fed7aa — orange-200
                Safety -> Color(0xFFFED7AA)
                // CSS fecaca — red-200
                Chimney -> Color(0xFFFECACA)
                // CSS f0f9ff — primary50 (mirrors PantopusColors.primary50)
                Generic -> Color(0xFFF0F9FF)
            }

    /** Foreground tint for the icon glyph inside the 40dp tile. */
    val foreground: Color
        get() =
            when (this) {
                // CSS a16207 — yellow-700
                Hvac -> Color(0xFFA16207)
                // CSS 1d4ed8 — blue-700
                Plumbing -> Color(0xFF1D4ED8)
                // CSS a16207 — yellow-700
                Electrical -> Color(0xFFA16207)
                // CSS 334155 — slate-700
                Roof -> Color(0xFF334155)
                // CSS 0f766e — teal-700
                Gutter -> Color(0xFF0F766E)
                // CSS 4338ca — indigo-700
                Appliance -> Color(0xFF4338CA)
                // CSS b91c1c — red-700
                Pest -> Color(0xFFB91C1C)
                // CSS 15803d — green-700
                Landscape -> Color(0xFF15803D)
                // CSS 0e7490 — cyan-700
                Cleaning -> Color(0xFF0E7490)
                // CSS 6d28d9 — violet-700
                Painting -> Color(0xFF6D28D9)
                // CSS c2410c — orange-700
                Safety -> Color(0xFFC2410C)
                // CSS b91c1c — red-700
                Chimney -> Color(0xFFB91C1C)
                // CSS 0284c7 — primary600 (mirrors PantopusColors.primary600)
                Generic -> Color(0xFF0284C7)
            }

    companion object {
        /**
         * Client-side inference from a task title (case-insensitive
         * substring match, first-match wins). Returns [Generic] when
         * no pattern matches. The design defaults to the wrench glyph
         * + primary tint, which [Generic] carries.
         *
         * Patterns are explicit constants here so future categories
         * bolt on without touching the row mapper.
         */
        @JvmStatic
        fun from(task: String?): MaintenanceCategory {
            if (task.isNullOrEmpty()) return Generic
            val lower = task.lowercase()
            for (entry in patterns) {
                if (entry.matchers.any { lower.contains(it) }) {
                    return entry.category
                }
            }
            return Generic
        }

        private data class Pattern(
            val category: MaintenanceCategory,
            val matchers: List<String>,
        )

        /**
         * Ordered pattern table. **Order matters** — first match wins,
         * so more-specific patterns sit before generic ones (e.g.
         * "chimney sweep" wins over "sweep" which could otherwise hit
         * cleaning).
         */
        private val patterns: List<Pattern> =
            listOf(
                // Chimney — fireplaces / soot. First so "chimney sweep"
                // doesn't hit the cleaning branch below.
                Pattern(
                    Chimney,
                    listOf("chimney", "fireplace", "flue", "soot"),
                ),
                // Plumbing — water lines, drains, water heater.
                Pattern(
                    Plumbing,
                    listOf(
                        "plumbing", "plumber", "leak", "drain", "faucet",
                        "water heater", "toilet", "pipe", "sump pump",
                    ),
                ),
                // HVAC — heating + cooling + air filtration. Kept after
                // plumbing so "water heater" wins before generic "heater".
                Pattern(
                    Hvac,
                    listOf(
                        "hvac", "furnace", "air condition", "ac unit", "heater",
                        "boiler", "thermostat", "duct", "vent",
                        "filter swap", "filter change", "air filter",
                    ),
                ),
                // Electrical.
                Pattern(
                    Electrical,
                    listOf("electrical", "electrician", "wiring", "outlet", "breaker", "panel", "circuit"),
                ),
                // Roof.
                Pattern(
                    Roof,
                    listOf("roof", "shingle", "flashing"),
                ),
                // Gutter / downspout.
                Pattern(
                    Gutter,
                    listOf("gutter", "downspout"),
                ),
                // Appliance.
                Pattern(
                    Appliance,
                    listOf(
                        "appliance", "fridge", "refrigerator", "dishwasher",
                        "washer", "dryer", "oven", "microwave", "disposal",
                    ),
                ),
                // Pest control.
                Pattern(
                    Pest,
                    listOf("pest", "exterminate", "termite", "rodent", "ant", "roach", "mouse", "rats"),
                ),
                // Landscaping + yard.
                Pattern(
                    Landscape,
                    listOf(
                        "landscape", "yard", "lawn", "mow", "garden",
                        "tree", "hedge", "mulch", "irrigation",
                    ),
                ),
                // Cleaning.
                Pattern(
                    Cleaning,
                    listOf("clean", "wash", "pressure wash", "deep clean"),
                ),
                // Painting.
                Pattern(
                    Painting,
                    listOf("paint", "stain", "primer"),
                ),
                // Safety — smoke + CO alarms, fire extinguishers.
                Pattern(
                    Safety,
                    listOf("alarm", "smoke detector", "co detector", "carbon monoxide", "fire extinguisher", "safety check"),
                ),
            )
    }
}
