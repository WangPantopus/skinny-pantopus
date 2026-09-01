@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.3c — Per-chore-category visual tokens for the Household tasks row.
 * Lifted from the design at `householdtasks-frames.jsx:55-65`. Feature
 * code ([HouseholdTasksListViewModel], etc.) references these typed
 * swatches; no hex literal appears in the `ui/screens` tree outside
 * this file.
 *
 * Same per-feature-palette exception as
 * [app.pantopus.android.ui.screens.homes.bills.UtilityCategory] for
 * Bills — these are per-category chip pairs (icon-background +
 * icon-foreground) that don't fit the existing `(name) → (single
 * Color)` semantic token model.
 *
 * Category is **client-derived from the task title** — there is no
 * backend `category` field on `HomeTask`. The schema's `task_type`
 * column carries 5 broad buckets (chore / shopping / project /
 * reminder / repair) that don't match the 8 design categories
 * (cleaning / trash / kitchen / laundry / yard / pet / errand /
 * kids), so the inference helper maps the title to a category, with
 * the `task_type` as a hint for the `Other` fallback. Mirrors the
 * payee-to-category pattern in
 * [app.pantopus.android.ui.screens.homes.bills.UtilityCategory].
 *
 * Each `Color(0xFF…)` literal is annotated with the matching CSS hex
 * from the design system.
 */
enum class HouseholdTaskCategory(val rawValue: String) {
    Cleaning("cleaning"),
    Trash("trash"),
    Kitchen("kitchen"),
    Laundry("laundry"),
    Yard("yard"),
    Pet("pet"),
    Errand("errand"),
    Kids("kids"),
    Other("other"),
    ;

    /** User-facing label. */
    val label: String
        get() =
            when (this) {
                Cleaning -> "Cleaning"
                Trash -> "Trash"
                Kitchen -> "Kitchen"
                Laundry -> "Laundry"
                Yard -> "Yard"
                Pet -> "Pets"
                Errand -> "Errand"
                Kids -> "Kids"
                Other -> "Task"
            }

    /** Lucide icon glyph for the 40dp category tile. */
    val icon: PantopusIcon
        get() =
            when (this) {
                Cleaning -> PantopusIcon.Sparkles
                Trash -> PantopusIcon.Trash2
                Kitchen -> PantopusIcon.Utensils
                Laundry -> PantopusIcon.Shuffle
                Yard -> PantopusIcon.Leaf
                Pet -> PantopusIcon.PawPrint
                Errand -> PantopusIcon.ShoppingBag
                Kids -> PantopusIcon.Baby
                Other -> PantopusIcon.CheckCircle
            }

    /**
     * Soft-tinted background for the 40dp category tile. Hex values
     * mirror `householdtasks-frames.jsx:55-65` exactly.
     */
    val background: Color
        get() =
            when (this) {
                // CSS dbeafe — sky-100
                Cleaning -> Color(0xFFDBEAFE)
                // CSS e2e8f0 — slate-200
                Trash -> Color(0xFFE2E8F0)
                // CSS fef3c7 — amber-100
                Kitchen -> Color(0xFFFEF3C7)
                // CSS ede9fe — violet-100
                Laundry -> Color(0xFFEDE9FE)
                // CSS dcfce7 — green-100
                Yard -> Color(0xFFDCFCE7)
                // CSS ffedd5 — orange-100
                Pet -> Color(0xFFFFEDD5)
                // CSS ccfbf1 — teal-100
                Errand -> Color(0xFFCCFBF1)
                // CSS fce7f3 — pink-100
                Kids -> Color(0xFFFCE7F3)
                // CSS f3f4f6 — gray-100
                Other -> Color(0xFFF3F4F6)
            }

    /** Foreground tint for the icon glyph inside the 40dp tile. */
    val foreground: Color
        get() =
            when (this) {
                // CSS 1d4ed8 — blue-700
                Cleaning -> Color(0xFF1D4ED8)
                // CSS 334155 — slate-700
                Trash -> Color(0xFF334155)
                // CSS 92400e — amber-800
                Kitchen -> Color(0xFF92400E)
                // CSS 6d28d9 — violet-700
                Laundry -> Color(0xFF6D28D9)
                // CSS 15803d — green-700
                Yard -> Color(0xFF15803D)
                // CSS c2410c — orange-700
                Pet -> Color(0xFFC2410C)
                // CSS 0f766e — teal-700
                Errand -> Color(0xFF0F766E)
                // CSS be185d — pink-700
                Kids -> Color(0xFFBE185D)
                // CSS 374151 — gray-700
                Other -> Color(0xFF374151)
            }

    companion object {
        /**
         * Client-side inference from a task title + optional `task_type`
         * (case-insensitive substring match, first-match wins). Returns
         * [Other] when no pattern matches. Adding a title → category
         * pattern is a one-line edit to [patterns] plus a test fixture.
         */
        @JvmStatic
        fun from(
            title: String?,
            taskType: String? = null,
        ): HouseholdTaskCategory {
            if (title.isNullOrEmpty()) {
                if (taskType?.lowercase() == "shopping") return Errand
                return Other
            }
            val lower = title.lowercase()
            for (entry in patterns) {
                if (entry.matchers.any { lower.contains(it) }) return entry.category
            }
            return when (taskType?.lowercase()) {
                "shopping" -> Errand
                else -> Other
            }
        }

        private data class Pattern(
            val category: HouseholdTaskCategory,
            val matchers: List<String>,
        )

        /** Ordered pattern table — first match wins. */
        private val patterns: List<Pattern> =
            listOf(
                Pattern(
                    Trash,
                    listOf(
                        "trash",
                        "garbage",
                        "recycle",
                        "recycling",
                        "rubbish",
                        "bin out",
                        "bins out",
                        "compost",
                    ),
                ),
                Pattern(
                    Pet,
                    listOf(
                        "walk the dog",
                        "walk dog",
                        "dog walk",
                        "feed the dog",
                        "feed the cat",
                        "litter box",
                        "dog",
                        " cat ",
                        "puppy",
                        " pet ",
                        "pet ",
                        "vet ",
                    ),
                ),
                Pattern(
                    Kitchen,
                    listOf(
                        "dishwasher",
                        "dishes",
                        "dish",
                        "cook",
                        "meal",
                        "fridge",
                        "groceries away",
                        "stove",
                        "oven",
                    ),
                ),
                Pattern(
                    Laundry,
                    listOf(
                        "laundry",
                        "wash clothes",
                        "fold clothes",
                        "fold the laundry",
                        "dryer",
                        "ironing",
                        "iron the",
                    ),
                ),
                Pattern(
                    Yard,
                    listOf(
                        "water plants",
                        "water the plants",
                        "plants",
                        "garden",
                        "mow",
                        "lawn",
                        "rake",
                        "leaves",
                        "yard",
                        "porch",
                        "weed",
                    ),
                ),
                Pattern(
                    Cleaning,
                    listOf(
                        "vacuum",
                        "clean",
                        "dust",
                        "mop",
                        "wipe",
                        "scrub",
                        "sweep",
                        "tidy",
                        "bathroom",
                        "bedroom",
                    ),
                ),
                Pattern(
                    Errand,
                    listOf(
                        "costco",
                        "grocery",
                        "groceries",
                        "shopping",
                        "shop ",
                        "pick up",
                        "pickup",
                        "buy ",
                        "errand",
                        "store run",
                        "post office",
                        "pharmacy",
                    ),
                ),
                Pattern(
                    Kids,
                    listOf(
                        "kid",
                        "kids",
                        "school",
                        "homework",
                        "lunchbox",
                        "lunchboxes",
                        "daycare",
                        "playdate",
                        "baby ",
                        "diaper",
                    ),
                ),
            )
    }
}
