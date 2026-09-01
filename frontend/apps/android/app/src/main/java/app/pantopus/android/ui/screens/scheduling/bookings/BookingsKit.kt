@file:Suppress(
    "PackageNaming",
    "MatchingDeclarationName",
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillStatus
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Shared building blocks for the A8 Bookings stream (E1 inbox + E2 detail +
 * E3–E5 sheets): owner→pillar mapping, booking-status decode, UTC→local time
 * formatting (render local, compare UTC per the wiring contract), the
 * verified-avatar disc, and the pillar-accented CTA buttons the designs use.
 * Kept here so the inbox, detail, and the three sheets render identically.
 */

// ─── Status ─────────────────────────────────────────────────────────────────

/** The host-side booking lifecycle status the UI routes on. */
enum class BookingStatus(val raw: String) {
    Pending("pending"),
    Confirmed("confirmed"),
    Cancelled("cancelled"),
    Declined("declined"),
    Completed("completed"),
    NoShow("no_show"),
    ;

    companion object {
        fun fromRaw(raw: String?): BookingStatus = entries.firstOrNull { it.raw == raw } ?: Confirmed
    }
}

/** Map a booking lifecycle status onto the shared [SchedulingPillStatus] the status pill renders. */
fun BookingStatus.toPillStatus(): SchedulingPillStatus =
    when (this) {
        BookingStatus.Confirmed -> SchedulingPillStatus.Confirmed
        BookingStatus.Pending -> SchedulingPillStatus.Pending
        BookingStatus.Cancelled -> SchedulingPillStatus.Cancelled
        BookingStatus.Declined -> SchedulingPillStatus.Declined
        BookingStatus.Completed -> SchedulingPillStatus.Completed
        BookingStatus.NoShow -> SchedulingPillStatus.NoShow
    }

// ─── Owner / pillar ───────────────────────────────────────────────────────────

/** The pillar for a resolved owner context. */
fun SchedulingOwner.toPillar(): SchedulingPillar =
    when (this) {
        is SchedulingOwner.Personal -> SchedulingPillar.Personal
        is SchedulingOwner.Home -> SchedulingPillar.Home
        is SchedulingOwner.Business -> SchedulingPillar.Business
    }

/** "Dana Whitfield" → "DA"; falls back to "?" so the avatar never renders blank. */
fun initialsOf(name: String?): String {
    val cleaned = name?.trim().orEmpty()
    if (cleaned.isEmpty()) return "?"
    val parts = cleaned.split(" ", "-").filter { it.isNotBlank() }
    return when {
        parts.size >= 2 -> "${parts[0].first()}${parts[1].first()}".uppercase()
        else -> cleaned.take(2).uppercase()
    }
}

// ─── Time formatting (render local, store UTC) ───────────────────────────────

private val ZONE: ZoneId = ZoneId.systemDefault()
private val DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
private val TIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

private fun parseUtc(value: String?): ZonedDateTime? {
    if (value.isNullOrBlank()) return null
    return runCatching { Instant.parse(value) }
        .recoverCatching { OffsetDateTime.parse(value).toInstant() }
        .getOrNull()
        ?.atZone(ZONE)
}

private fun tzAbbrev(): String = ZONE.getDisplayName(TextStyle.SHORT, Locale.US)

/** Date buckets the Upcoming segment groups rows under. */
enum class DateBucket(val label: String) {
    Today("Today"),
    Tomorrow("Tomorrow"),
    ThisWeek("Later this week"),
    Later("Later"),
    Earlier("Earlier"),
}

fun bucketOf(startUtc: String?): DateBucket {
    val day = parseUtc(startUtc)?.toLocalDate() ?: return DateBucket.Later
    val today = LocalDate.now(ZONE)
    return when {
        day.isBefore(today) -> DateBucket.Earlier
        day == today -> DateBucket.Today
        day == today.plusDays(1) -> DateBucket.Tomorrow
        day.isBefore(today.plusWeeks(1)) -> DateBucket.ThisWeek
        else -> DateBucket.Later
    }
}

/** Row "when" line: "Today · 2:00 PM · PST" / "Sat, Jun 14 · 10:00 AM · PST". */
fun rowWhenLabel(startUtc: String?): String {
    val zoned = parseUtc(startUtc) ?: return ""
    val today = LocalDate.now(ZONE)
    val datePart =
        when (zoned.toLocalDate()) {
            today -> "Today"
            today.plusDays(1) -> "Tomorrow"
            else -> zoned.format(DATE_FMT)
        }
    return "$datePart · ${zoned.format(TIME_FMT)} · ${tzAbbrev()}"
}

/** Detail header range: "Thu, Jun 18 · 2:00–2:30 PM · PST". */
fun rangeLabel(
    startUtc: String?,
    endUtc: String?,
): String {
    val start = parseUtc(startUtc) ?: return ""
    val end = parseUtc(endUtc)
    val startTime = start.format(TIME_FMT)
    val endTime = end?.format(TIME_FMT)
    val time = if (endTime != null) "$startTime–$endTime" else startTime
    return "${start.format(DATE_FMT)} · $time · ${tzAbbrev()}"
}

private val STAMP_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d · h:mm a", Locale.US)

/** Timeline-node stamp: "Jun 12 · 9:04 AM" (null when the source is blank). */
fun shortStamp(utc: String?): String? = parseUtc(utc)?.format(STAMP_FMT)

/** Whether the booking's end time is in the past (drives "Met"/follow-up timeline + docks). */
fun eventEnded(endUtc: String?): Boolean {
    val end = parseUtc(endUtc) ?: return false
    return end.toInstant().isBefore(Instant.now())
}

/** Compact slot range used inside the sheets: "Tue, Oct 22 · 2:00–2:30 PM". */
fun slotRangeLabel(
    startUtc: String?,
    endUtc: String?,
): String {
    val start = parseUtc(startUtc) ?: return ""
    val end = parseUtc(endUtc)
    val startTime = start.format(TIME_FMT)
    val endTime = end?.format(TIME_FMT)
    val time = if (endTime != null) "$startTime–$endTime" else startTime
    return "${start.format(DATE_FMT)} · $time"
}

private val WEEKDAY_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE", Locale.US)

/** A slot's local calendar day (parses `startLocal`, falling back to the UTC `start`). */
fun slotLocalDate(slot: SlotDto): LocalDate? {
    val local =
        slot.startLocal?.let {
            runCatching { java.time.LocalDateTime.parse(it).toLocalDate() }.getOrNull()
        }
    if (local != null) return local
    return parseUtc(slot.start)?.toLocalDate()
}

/** Day-strip cell labels for an epoch day: weekday ("Mon") + day-of-month ("20"). */
fun dayChipLabels(epochDay: Long): Pair<String, String> {
    val date = LocalDate.ofEpochDay(epochDay)
    return date.format(WEEKDAY_FMT) to date.dayOfMonth.toString()
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

private fun pillarAvatarBrush(pillar: SchedulingPillar): Brush =
    when (pillar) {
        SchedulingPillar.Personal ->
            Brush.linearGradient(
                listOf(PantopusColors.primary400, PantopusColors.primary700),
            )
        SchedulingPillar.Home ->
            Brush.linearGradient(
                listOf(PantopusColors.home, PantopusColors.homeDark),
            )
        SchedulingPillar.Business ->
            Brush.linearGradient(
                listOf(PantopusColors.business, PantopusColors.businessDark),
            )
    }

/** Circular initials avatar on the pillar gradient with a verified badge-check overlay. */
@Composable
fun BookingAvatar(
    pillar: SchedulingPillar,
    initials: String,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 34.dp,
    verified: Boolean = true,
) {
    Box(modifier = modifier.size(size)) {
        Box(
            modifier =
                Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(pillarAvatarBrush(pillar)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                color = PantopusColors.appTextInverse,
                fontSize = (size.value * 0.34f).sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (verified) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(size.value.times(0.42f).dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.BadgeCheck,
                    contentDescription = null,
                    size = size.value.times(0.38f).dp,
                    tint = pillar.accent,
                )
            }
        }
    }
}

// ─── Buttons (pillar-accented) ────────────────────────────────────────────────

private val CTA_HEIGHT = 46.dp
private val CTA_ICON = 17.dp
private val CTA_SPINNER = 18.dp

@Composable
private fun CtaScaffold(
    background: Color,
    foreground: Color,
    border: Color?,
    shadow: Boolean,
    enabled: Boolean,
    loading: Boolean,
    label: String,
    leadingIcon: PantopusIcon?,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    val clickable = enabled && !loading
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = CTA_HEIGHT)
                .alpha(if (enabled) 1f else 0.5f)
                .then(
                    if (shadow) {
                        Modifier.pantopusShadow(
                            PantopusElevations.primary,
                            shape = RoundedCornerShape(Radii.lg),
                        )
                    } else {
                        Modifier
                    },
                ).clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .then(
                    if (border != null) {
                        Modifier.border(1.dp, border, RoundedCornerShape(Radii.lg))
                    } else {
                        Modifier
                    },
                ).clickable(enabled = clickable, onClick = onClick)
                .padding(horizontal = Spacing.s4)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = foreground,
                strokeWidth = 2.dp,
                modifier = Modifier.size(CTA_SPINNER),
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                if (leadingIcon != null) {
                    PantopusIconImage(
                        icon = leadingIcon,
                        contentDescription = null,
                        size = CTA_ICON,
                        tint = foreground,
                    )
                }
                Text(
                    text = label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = foreground,
                )
            }
        }
    }
}

/** Filled CTA tinted with the booking's pillar accent (Approve / Reschedule now / Reassign). */
@Composable
fun PillarFilledButton(
    label: String,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: PantopusIcon? = null,
    loading: Boolean = false,
    enabled: Boolean = true,
) = CtaScaffold(
    background = accent,
    foreground = PantopusColors.appTextInverse,
    border = null,
    shadow = true,
    enabled = enabled,
    loading = loading,
    label = label,
    leadingIcon = leadingIcon,
    onClick = onClick,
    modifier = modifier,
)

/** Outlined neutral / danger CTA (Reschedule · Decline · Cancel). */
@Composable
fun PillarOutlineButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: PantopusIcon? = null,
    danger: Boolean = false,
) = CtaScaffold(
    background = PantopusColors.appSurface,
    foreground = if (danger) PantopusColors.error else PantopusColors.appTextStrong,
    border = if (danger) PantopusColors.errorLight else PantopusColors.appBorderStrong,
    shadow = false,
    enabled = true,
    loading = false,
    label = label,
    leadingIcon = leadingIcon,
    onClick = onClick,
    modifier = modifier,
)

/** Filled red destructive CTA (Cancel & refund / Decline request / Retry refund). */
@Composable
fun DangerFilledButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: PantopusIcon? = null,
    loading: Boolean = false,
    enabled: Boolean = true,
) = CtaScaffold(
    background = PantopusColors.error,
    foreground = PantopusColors.appTextInverse,
    border = null,
    shadow = false,
    enabled = enabled,
    loading = loading,
    label = label,
    leadingIcon = leadingIcon,
    onClick = onClick,
    modifier = modifier,
)
