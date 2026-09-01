@file:Suppress("PackageNaming", "MatchingDeclarationName", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The canonical Calendarly booking / page / link status pill — the single source
 * of truth that mirrors iOS `SchedulingStatusPill`. Leading-icon + label chip
 * grammar, 10sp / weight 700, tight 8×3 padding, tinted fill + 1dp tone-light
 * hairline border, capsule shape. Tones:
 *  - green = confirmed / active / live / completed
 *  - **info-blue = pending / draft / waitlisted (NOT amber — a pending request
 *    is informational, not a warning)**
 *  - amber = expired (the one true "attention" warning)
 *  - red = declined / no-show / cancelled
 *  - neutral grey = paused / past / secret / unavailable / unknown
 *
 * Replaces the per-screen variants (HubStatusPill, MyBookings StatusPill,
 * BookResource StatusPill, ManageBooking StatusBadge, …) so the chip stops
 * drifting across screens. testTag mirrors iOS `scheduling.statusPill.<status>`.
 */
enum class SchedulingPillStatus(val backend: String, val label: String) {
    Pending("pending", "Pending"),
    Confirmed("confirmed", "Confirmed"),
    Cancelled("cancelled", "Cancelled"),
    Declined("declined", "Declined"),
    NoShow("no_show", "No-show"),
    Completed("completed", "Completed"),
    Past("past", "Past"),
    Active("active", "Active"),
    Live("live", "Live"),
    Paused("paused", "Paused"),
    Draft("draft", "Draft"),
    Secret("secret", "Private"),
    Expired("expired", "Expired"),
    Unavailable("unavailable", "Fully booked"),
    Waitlisted("waitlisted", "Waitlisted"),
    Unknown("unknown", "Status"),
    ;

    internal val tone: PillTone
        get() =
            when (this) {
                Confirmed, Active, Live, Completed -> PillTone.Success
                // Pending / draft / waitlisted read as INFO (blue), not amber:
                // a request awaiting action is informational, not a warning.
                Pending, Draft, Waitlisted -> PillTone.Info
                Expired -> PillTone.Warning
                Declined, NoShow, Cancelled -> PillTone.Error
                Past, Paused, Secret, Unavailable, Unknown,
                -> PillTone.Neutral
            }

    /** Leading glyph that reinforces the tone (mirrors iOS `SchedulingStatusPill`). */
    internal val leadingIcon: PantopusIcon
        get() =
            when (this) {
                Confirmed, Active, Live, Completed -> PantopusIcon.CheckCircle
                Pending, Draft -> PantopusIcon.Clock
                Waitlisted -> PantopusIcon.Hourglass
                Expired -> PantopusIcon.AlertCircle
                Declined, NoShow, Cancelled -> PantopusIcon.XCircle
                Paused -> PantopusIcon.PauseCircle
                Secret -> PantopusIcon.Lock
                Unavailable -> PantopusIcon.CalendarX
                Past -> PantopusIcon.History
                Unknown -> PantopusIcon.Circle
            }

    companion object {
        /** Backend wire value (incl. aliases) → pill status; tolerant of unknowns. */
        private val ALIASES: Map<String, SchedulingPillStatus> =
            mapOf(
                "pending" to Pending, "pending_approval" to Pending, "requested" to Pending,
                "confirmed" to Confirmed, "approved" to Confirmed, "accepted" to Confirmed, "booked" to Confirmed,
                "cancelled" to Cancelled, "canceled" to Cancelled,
                "declined" to Declined, "rejected" to Declined,
                "no_show" to NoShow, "noshow" to NoShow,
                "completed" to Completed, "done" to Completed,
                "past" to Past,
                "active" to Active, "live" to Live, "published" to Active,
                "paused" to Paused,
                "draft" to Draft,
                "secret" to Secret, "private" to Secret, "hidden" to Secret,
                "expired" to Expired,
                "unavailable" to Unavailable, "full" to Unavailable, "fully_booked" to Unavailable,
                "waitlisted" to Waitlisted, "waitlist" to Waitlisted,
            )

        fun fromBackend(raw: String): SchedulingPillStatus = ALIASES[raw.lowercase().replace('-', '_')] ?: Unknown
    }
}

internal enum class PillTone {
    Success,
    Info,
    Warning,
    Error,
    Neutral,
    ;

    val bg: Color
        get() =
            when (this) {
                Success -> PantopusColors.successBg
                Info -> PantopusColors.infoBg
                Warning -> PantopusColors.warningBg
                Error -> PantopusColors.errorBg
                Neutral -> PantopusColors.appSurfaceSunken
            }

    val fg: Color
        get() =
            when (this) {
                Success -> PantopusColors.success
                Info -> PantopusColors.info
                Warning -> PantopusColors.warning
                Error -> PantopusColors.error
                Neutral -> PantopusColors.appTextSecondary
            }

    /** Hairline border tint — a 1dp tone-light outline around every chip. */
    val border: Color
        get() =
            when (this) {
                Success -> PantopusColors.successLight
                Info -> PantopusColors.infoLight
                Warning -> PantopusColors.warningLight
                Error -> PantopusColors.errorLight
                Neutral -> PantopusColors.appBorder
            }
}

@Composable
fun SchedulingStatusPill(
    status: SchedulingPillStatus,
    modifier: Modifier = Modifier,
    showIcon: Boolean = true,
) = StatusPillChip(
    label = status.label,
    tone = status.tone,
    backend = status.backend,
    leadingIcon = if (showIcon) status.leadingIcon else null,
    modifier = modifier,
)

/**
 * Convenience overload: render directly from a backend status string. An
 * unrecognized wire value keeps a humanized form of the raw string
 * ("in_review" → "In review") instead of the generic "Status", mirroring the
 * per-screen chips this pill replaced (which echoed the raw value rather than
 * dropping it).
 */
@Composable
fun SchedulingStatusPill(
    status: String,
    modifier: Modifier = Modifier,
    showIcon: Boolean = true,
) {
    val mapped = SchedulingPillStatus.fromBackend(status)
    if (mapped != SchedulingPillStatus.Unknown) {
        SchedulingStatusPill(mapped, modifier, showIcon)
    } else {
        StatusPillChip(
            label = humanizeStatus(status) ?: SchedulingPillStatus.Unknown.label,
            tone = SchedulingPillStatus.Unknown.tone,
            backend = status.lowercase().replace('-', '_').ifBlank { "unknown" },
            leadingIcon = if (showIcon) SchedulingPillStatus.Unknown.leadingIcon else null,
            modifier = modifier,
        )
    }
}

/** "in_review" / "in-review" → "In review"; blank → null (falls back to "Status"). */
private fun humanizeStatus(raw: String): String? =
    raw.replace('_', ' ').replace('-', ' ').trim().ifBlank { null }?.replaceFirstChar { it.uppercase() }

private val PILL_ICON_SIZE = 11.dp

@Composable
private fun StatusPillChip(
    label: String,
    tone: PillTone,
    backend: String,
    modifier: Modifier = Modifier,
    leadingIcon: PantopusIcon? = null,
) {
    val shape = RoundedCornerShape(Radii.pill)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        modifier =
            modifier
                .testTag("scheduling.statusPill.$backend")
                .background(tone.bg, shape)
                .border(1.dp, tone.border, shape)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
    ) {
        if (leadingIcon != null) {
            PantopusIconImage(
                icon = leadingIcon,
                contentDescription = null,
                size = PILL_ICON_SIZE,
                tint = tone.fg,
            )
        }
        Text(
            text = label,
            color = tone.fg,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
    }
}
