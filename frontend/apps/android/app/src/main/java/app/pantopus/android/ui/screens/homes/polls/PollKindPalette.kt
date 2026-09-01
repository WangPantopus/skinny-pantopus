@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.polls

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.3e — Per-poll-kind visual tokens for the Polls row. Lifted from
 * the design at `polls-frames.jsx:50-55`. Feature code references these
 * typed swatches; no hex literal appears in feature code outside
 * this file.
 *
 * Kind classification is client-derived: the backend's `poll_type` enum
 * (`single_choice / multiple_choice / yes_no / ranking`) maps to a kind,
 * and the title is sniffed for schedule keywords to upgrade
 * `single_choice` polls into `Schedule` when appropriate. The backend
 * has no separate `kind` field today; this inference is the source of
 * truth.
 *
 * Per the universal convention, palette files are the documented
 * exception to the no-hex-literals rule.
 */
enum class PollKind(
    val label: String,
    val icon: PantopusIcon,
    val background: Color,
    val foreground: Color,
) {
    /** Multiple labelled options — pick one. CSS ede9fe / 6d28d9. */
    Decision(
        label = "Decision",
        icon = PantopusIcon.ClipboardList,
        background = Color(0xFFEDE9FE),
        foreground = Color(0xFF6D28D9),
    ),

    /** Day / date picker. CSS dbeafe / 1d4ed8. */
    Schedule(
        label = "Schedule",
        icon = PantopusIcon.Calendar,
        background = Color(0xFFDBEAFE),
        foreground = Color(0xFF1D4ED8),
    ),

    /** Binary yes/no vote. CSS dcfce7 / 15803d. */
    YesNo(
        label = "Yes/No",
        icon = PantopusIcon.CheckCircle,
        background = Color(0xFFDCFCE7),
        foreground = Color(0xFF15803D),
    ),

    /** Open-ended — multiple selections allowed. CSS e2e8f0 / 334155. */
    Open(
        label = "Open",
        icon = PantopusIcon.MessageCircle,
        background = Color(0xFFE2E8F0),
        foreground = Color(0xFF334155),
    ),
    ;

    companion object {
        /**
         * Derive a [PollKind] from the backend's `poll_type` + title.
         *
         *  - `yes_no` always wins (returns [YesNo]).
         *  - Title sniff for schedule keywords (`weekend`, day-of-week
         *    names, `when`, `date`) upgrades single_choice to [Schedule].
         *  - `multiple_choice` → [Open].
         *  - `ranking` / `single_choice` (default) → [Decision].
         */
        fun from(
            pollType: String,
            title: String,
        ): PollKind {
            val normalised = pollType.lowercase().replace("-", "_")
            if (normalised == "yes_no" || normalised == "yesno") return YesNo
            if (isScheduleTitle(title)) return Schedule
            return when (normalised) {
                "multiple_choice" -> Open
                "ranking", "single_choice" -> Decision
                else -> Decision
            }
        }

        private val scheduleKeywords =
            listOf(
                "when ", "what day", "what date", "which day", "which date",
                "weekend", "schedule", "saturday", "sunday", "monday", "tuesday",
                "wednesday", "thursday", "friday", " date ", " date?", "date?",
            )

        private fun isScheduleTitle(title: String): Boolean {
            val lower = " " + title.lowercase() + " "
            return scheduleKeywords.any { lower.contains(it) }
        }
    }
}

/**
 * Neutral slate tint used by the "Leading: <option>" chip on active poll
 * rows. Lives in the palette file so feature code stays hex-literal-free
 * per universal convention.
 */
object PollLeadingChipTint {
    /** CSS f1f5f9 — slate-100. Pill background. */
    val background: Color = Color(0xFFF1F5F9)

    /** CSS 334155 — slate-700. Pill foreground (icon + text). */
    val foreground: Color = Color(0xFF334155)
}
