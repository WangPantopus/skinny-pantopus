@file:Suppress("PackageNaming", "MatchingDeclarationName", "ktlint:standard:max-line-length")

package app.pantopus.android.ui.screens.scheduling.polish

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii

/**
 * H14 Accessibility & Large-Text pass · Stream A18.
 *
 * Reusable accessibility helpers for the Calendarly surface — minimum touch
 * targets, a visible focus ring, slot/timezone TalkBack label builders, and a
 * large-text reflow gate for slot grids — plus the audit contract encoded as
 * testable data ([SchedulingA11yAudit]).
 *
 * H14 is scoped to A18's OWN files: A18 ships these helpers and adopts them in its
 * H15 screen. Gaps found inside other streams' files (including the Foundation
 * `_shared/` components) are recorded as flagged findings with a follow-up slug —
 * A18 files them as Foundation-gap / per-stream notes and never edits those files
 * (preserving the disjoint-ownership guarantee). The human-readable hand-off
 * checklist lives in `H14-a11y-checklist.md`; keep the two in sync.
 */

/** Android Material minimum interactive target (iOS uses 44pt). */
const val A11Y_MIN_TAP_TARGET_DP = 48

/** Font-scale at/above which dense slot grids collapse to a single stacked column. */
const val A11Y_ACCESSIBILITY_FONT_SCALE = 1.3f

private val FOCUS_RING_WIDTH = 2.dp
private const val FOCUS_RING_ALPHA = 0.45f
private const val SLOT_COLUMNS_DEFAULT = 3
private const val SLOT_COLUMNS_REFLOWED = 1

/**
 * TalkBack label + value builders so availability, time, and timezone are always
 * conveyed by text — never by color alone.
 */
object SchedulingA11y {
    /** "Tue Jun 16, 3:00 PM, available" / "…, taken" — the per-slot button name. */
    fun slotLabel(
        date: String,
        time: String,
        isAvailable: Boolean,
    ): String = "$date, $time, ${if (isAvailable) "available" else "taken"}"

    /**
     * "Times shown in Pacific Time" — and, on a host/viewer mismatch,
     * "…, host is in Eastern Time" so the timezone affordance is announced.
     */
    fun timezoneLabel(
        viewer: String,
        host: String? = null,
    ): String =
        if (host == null || host == viewer) {
            "Times shown in $viewer"
        } else {
            "Times shown in $viewer, host is in $host"
        }

    /**
     * Slot grids collapse to a single stacked column at accessibility font
     * scales so day numbers never truncate and every tile keeps a 48dp target.
     */
    fun slotColumns(fontScale: Float): Int = if (fontScale >= A11Y_ACCESSIBILITY_FONT_SCALE) SLOT_COLUMNS_REFLOWED else SLOT_COLUMNS_DEFAULT
}

/**
 * Guarantee a ≥[size] (default 48dp) interactive target — the floor every
 * scheduling control must meet, including at large text.
 */
fun Modifier.a11yMinTapTarget(size: Dp = A11Y_MIN_TAP_TARGET_DP.dp): Modifier = this.sizeIn(minWidth = size, minHeight = size)

/**
 * A visible focus ring for keyboard / switch-access focus (color is never the
 * sole signal — pair with a real `contentDescription`).
 */
fun Modifier.a11yFocusRing(
    active: Boolean,
    accent: Color = PantopusColors.primary600,
    cornerRadius: Dp = Radii.sm,
): Modifier =
    if (active) {
        this.border(FOCUS_RING_WIDTH, accent.copy(alpha = FOCUS_RING_ALPHA), RoundedCornerShape(cornerRadius))
    } else {
        this
    }

/** Set a single TalkBack [label] on a control, replacing child semantics. */
fun Modifier.a11yLabel(label: String): Modifier = this.semantics { contentDescription = label }

// MARK: - The audit contract, encoded as testable data

/**
 * The accessibility requirements every scheduling surface is held to (from the
 * H14 design — the gate that fixes SlotCalendar's fixed-size tiles).
 */
enum class SchedulingA11yRequirement {
    MinimumTapTarget,
    FullSlotLabel,
    TimezoneAffordance,
    TextNotColorOnly,
    LargeTextReflow,
    VisibleFocusRing,
    ReduceMotion,
    AccessibilityIdentifier,
    ;

    /** One-line statement of the requirement. */
    val summary: String
        get() =
            when (this) {
                MinimumTapTarget -> "Interactive controls are ≥48dp, including at the largest font scale."
                FullSlotLabel -> "Each slot button announces its full label: '<date>, <time>, available/taken'."
                TimezoneAffordance -> "'Times shown in <tz>' is announced as text; a host/viewer mismatch is spoken, not color."
                TextNotColorOnly -> "Availability, status, and conflicts are conveyed by text/shape, never color alone."
                LargeTextReflow -> "Dense slot grids reflow to a single stacked list at accessibility font scales."
                VisibleFocusRing -> "Focused controls show a visible focus ring."
                ReduceMotion -> "Decorative motion (confetti, halo pulses) is suppressed under reduce-motion."
                AccessibilityIdentifier -> "Every routed screen and key control carries a stable testTag (mirrors iOS identifiers)."
            }
}

/** Whether a checked surface meets the requirement today. */
enum class SchedulingA11yStatus { Pass, Flagged }

/** One audited (surface × requirement) result. */
data class SchedulingA11yFinding(
    val surface: String,
    val requirement: SchedulingA11yRequirement,
    val status: SchedulingA11yStatus,
    val note: String,
    /** When flagged, the follow-up slug to file against the owning stream's files. */
    val followUp: String? = null,
) {
    val id: String get() = "$surface·${requirement.name}"
}

/**
 * The audit of the merged Calendarly surface as it stands on
 * `feature/calendarly-android` (Foundation `_shared/SlotPicker` + `TimezonePicker`,
 * the shared `HaloCircle`/`ConfettiSpray` motion gates, and this stream's H15).
 * Flagged findings sit in Foundation `_shared/` files (owned by A0) — they are
 * filed as Foundation-gap follow-ups, not edited by A18.
 */
object SchedulingA11yAudit {
    val findings: List<SchedulingA11yFinding> =
        listOf(
            // Foundation — _shared/SlotPicker SlotRow (the reused time-slot primitive)
            SchedulingA11yFinding(
                surface = "SlotPicker.SlotRow",
                requirement = SchedulingA11yRequirement.MinimumTapTarget,
                status = SchedulingA11yStatus.Flagged,
                note = "Row sets vertical padding only (~44dp); no minHeight floor, so the target can drop below 48dp.",
                followUp = "a18-a11y-slotrow-target",
            ),
            SchedulingA11yFinding(
                surface = "SlotPicker.SlotRow",
                requirement = SchedulingA11yRequirement.FullSlotLabel,
                status = SchedulingA11yStatus.Flagged,
                note = "contentDescription is time-only ('9:30 AM' / '…, unavailable'); the day/date and ', available' are not announced.",
                followUp = "a18-a11y-slotrow-label",
            ),
            SchedulingA11yFinding(
                surface = "SlotPicker.SlotRow",
                requirement = SchedulingA11yRequirement.TextNotColorOnly,
                status = SchedulingA11yStatus.Pass,
                note = "Disabled slots append ', unavailable' + a line-through; the chosen slot adds a check-circle, not just a hue.",
            ),
            // Foundation — _shared/SlotPicker MonthCalendar day cells
            SchedulingA11yFinding(
                surface = "SlotPicker.MonthCalendar.DayCell",
                requirement = SchedulingA11yRequirement.MinimumTapTarget,
                status = SchedulingA11yStatus.Flagged,
                note = "Day cell is a 36dp box (selected/today disc 34dp) — below the 48dp floor.",
                followUp = "a18-a11y-daycell-target",
            ),
            SchedulingA11yFinding(
                surface = "SlotPicker.MonthCalendar.DayCell",
                requirement = SchedulingA11yRequirement.TextNotColorOnly,
                status = SchedulingA11yStatus.Flagged,
                note = "Availability is conveyed only by an accent dot + weight; the cell has no contentDescription announcing ', available'/', today'.",
                followUp = "a18-a11y-daycell-label",
            ),
            SchedulingA11yFinding(
                surface = "SlotPicker.SlotTimeList",
                requirement = SchedulingA11yRequirement.LargeTextReflow,
                status = SchedulingA11yStatus.Pass,
                note = "Slots already render as full-width grouped rows (Morning/Afternoon/Evening), not a fixed grid.",
            ),
            // Foundation — _shared/TimezonePicker
            SchedulingA11yFinding(
                surface = "TimezonePicker",
                requirement = SchedulingA11yRequirement.TimezoneAffordance,
                status = SchedulingA11yStatus.Flagged,
                note = "Picker is a labelled 'Time zone' control, but a host/viewer mismatch is not spoken; use SchedulingA11y.timezoneLabel(viewer, host).",
                followUp = "a18-a11y-timezone-mismatch",
            ),
            // Foundation — shared motion components
            SchedulingA11yFinding(
                surface = "HaloCircle / ConfettiSpray",
                requirement = SchedulingA11yRequirement.ReduceMotion,
                status = SchedulingA11yStatus.Pass,
                note = "Both read rememberReduceMotion(): the halo pulse disables and confetti defaults to off under reduce-motion.",
            ),
            // A18 — H15 channel prompt (this stream — the exemplar)
            SchedulingA11yFinding(
                surface = "NotificationChannelPrompt",
                requirement = SchedulingA11yRequirement.MinimumTapTarget,
                status = SchedulingA11yStatus.Pass,
                note = "Code field + CTAs use a11yMinTapTarget / PrimaryButton (≥48dp); the phone field floors at 48dp.",
            ),
            SchedulingA11yFinding(
                surface = "NotificationChannelPrompt",
                requirement = SchedulingA11yRequirement.VisibleFocusRing,
                status = SchedulingA11yStatus.Pass,
                note = "The active code box uses a11yFocusRing; the input is one real labelled BasicTextField (TalkBack + autofill reach it).",
            ),
            SchedulingA11yFinding(
                surface = "NotificationChannelPrompt",
                requirement = SchedulingA11yRequirement.TextNotColorOnly,
                status = SchedulingA11yStatus.Pass,
                note = "Push / connected / denied frames use distinct headlines + icons, not color alone.",
            ),
            SchedulingA11yFinding(
                surface = "NotificationChannelPrompt",
                requirement = SchedulingA11yRequirement.AccessibilityIdentifier,
                status = SchedulingA11yStatus.Pass,
                note = "Screen, frame, primary/secondary CTAs, resend, and toast all carry stable testTags mirroring iOS.",
            ),
        )

    /** Findings that still need a follow-up against the owning stream's files. */
    val flagged: List<SchedulingA11yFinding> get() = findings.filter { it.status == SchedulingA11yStatus.Flagged }

    /** Findings that already meet the contract. */
    val passing: List<SchedulingA11yFinding> get() = findings.filter { it.status == SchedulingA11yStatus.Pass }
}
