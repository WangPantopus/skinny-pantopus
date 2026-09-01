@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Shared chrome for the A7 invitee/customer edge surfaces (slot-taken, payment
 * retry, policy-blocked, recurring). Tones map straight onto the design-system
 * status tokens — no hardcoded hex anywhere. The error halo, the closest-time
 * "alternative" row, the amber/green policy note-card, and the booking summary
 * card are reused across D5/D6/D10/D12.
 */

/** The semantic tone an edge surface renders in (matches the design's halo tones). */
enum class EdgeTone {
    Error,
    Warn,
    Info,
    Success,
    ;

    val fg: Color
        get() =
            when (this) {
                Error -> PantopusColors.error
                Warn -> PantopusColors.warning
                Info -> PantopusColors.info
                Success -> PantopusColors.success
            }

    /**
     * The darker shade of this tone (design `t.dk`): used for title/still text
     * in PolicyNoteCard to separate the title layer (dark) from the body layer
     * (fg). Since there are no numeric dark-variant tokens for warn/error/success,
     * we approximate via appText for those and primary700 for info.
     */
    val dk: Color
        get() =
            when (this) {
                Error -> PantopusColors.appText
                Warn -> PantopusColors.appText
                Info -> PantopusColors.primary700
                Success -> PantopusColors.appText
            }

    val bg: Color
        get() =
            when (this) {
                Error -> PantopusColors.errorBg
                Warn -> PantopusColors.warningBg
                Info -> PantopusColors.infoBg
                Success -> PantopusColors.successBg
            }

    val ring: Color
        get() =
            when (this) {
                Error -> PantopusColors.errorLight
                Warn -> PantopusColors.warningLight
                Info -> PantopusColors.infoLight
                Success -> PantopusColors.successLight
            }
}

private val HALO_OUTER = 66.dp
private val HALO_INNER = 52.dp
private val HALO_ICON = 25.dp
private val BODY_MAX_WIDTH = 240.dp

/**
 * Centered toned halo + headline + body — the A18 error-block pattern used at
 * the top of the slot-taken (D5) and payment-retry (D6) sheets.
 */
@Composable
fun EdgeHalo(
    tone: EdgeTone,
    icon: PantopusIcon,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(top = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(HALO_OUTER).clip(CircleShape).background(tone.bg),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(HALO_INNER)
                        .clip(CircleShape)
                        .background(tone.bg)
                        .border(2.dp, tone.ring, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = icon, contentDescription = null, size = HALO_ICON, tint = tone.fg)
            }
        }
        Text(
            text = title,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = body,
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = PantopusColors.appTextStrong,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = BODY_MAX_WIDTH),
        )
    }
}

/** A small toned status chip ("Holding your 2:00 PM time for 4:48", "Paid $48"). */
@Composable
fun EdgeStatusChip(
    tone: EdgeTone,
    icon: PantopusIcon,
    label: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(tone.bg)
                .border(1.dp, tone.ring, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = tone.fg)
        Text(text = label, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = tone.fg)
    }
}

private const val SOONEST_BADGE_ALPHA = 0.12f

/**
 * One "closest open time" alternative row (D5 / recurring inline picker). Reuses
 * the Support-Trains slot-row layout: weekday + date on the left, time-range +
 * duration on the right, a SOONEST badge on the first, and a trailing chevron.
 */
@Composable
fun AlternativeSlotRow(
    slot: SlotDto,
    soonest: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = 11.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = slotDateLabel(slot),
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                if (soonest) {
                    Text(
                        text = "SOONEST",
                        style = PantopusTextStyle.overline,
                        color = accent,
                        modifier =
                            Modifier
                                .padding(start = Spacing.s2)
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(accent.copy(alpha = SOONEST_BADGE_ALPHA))
                                .padding(horizontal = Spacing.s2, vertical = Spacing.s0),
                    )
                }
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = slotTimeRange(slot),
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            slotDurationLabel(slot)?.let {
                Text(text = it, style = PantopusTextStyle.overline, color = PantopusColors.appTextMuted)
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.padding(start = Spacing.s2),
        )
    }
}

/**
 * The amber/green "policy note-card" (D10): a toned card with an icon disc, a
 * title, a body that names the exact rule, and an optional "still" footnote that
 * always offers a fallback.
 */
@Composable
fun PolicyNoteCard(
    tone: EdgeTone,
    icon: PantopusIcon,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    still: String? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(tone.bg)
                .border(1.dp, tone.ring, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, tone.ring, RoundedCornerShape(Radii.md)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = tone.fg)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            // Design PolicyCard: title uses t.dk (darker shade), body uses t.fg (lighter).
            Text(text = title, style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = tone.dk)
            Text(text = body, style = PantopusTextStyle.caption, color = tone.fg)
            if (still != null) {
                // Spec PolicyCard draws a 1px tone hairline above the "still" note.
                Box(
                    modifier =
                        Modifier
                            .padding(top = Spacing.s2)
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(tone.ring),
                )
                Row(
                    modifier =
                        Modifier
                            .padding(top = Spacing.s2)
                            .fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Info,
                        contentDescription = null,
                        size = 12.dp,
                        tint = tone.fg,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    // Design: "still" note uses t.dk (darker shade), fontWeight 600.
                    Text(text = still, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = tone.dk)
                }
            }
        }
    }
}

/**
 * The compact booking summary card (D10): host avatar disc, event name, host +
 * pillar label, and a date/time row with a tz chip.
 */
@Composable
fun BookingSummaryCard(
    eventName: String,
    hostLabel: String,
    pillar: SchedulingPillar,
    whenLabel: String,
    modifier: Modifier = Modifier,
    tzLabel: String? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            EdgeHostAvatar(name = hostLabel, pillar = pillar, size = 34.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(text = eventName, style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(text = hostLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                    Box(modifier = Modifier.size(5.dp).clip(CircleShape).background(pillar.accent))
                    Text(text = pillar.label, style = PantopusTextStyle.overline, color = pillar.accent)
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(icon = PantopusIcon.Calendar, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextSecondary)
            Text(
                text = whenLabel,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            if (tzLabel != null) {
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(pillar.accentBg)
                            .padding(horizontal = Spacing.s2, vertical = Spacing.s0),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 10.dp, tint = pillar.accent)
                    Text(text = tzLabel, style = PantopusTextStyle.overline, color = pillar.accent)
                }
            }
        }
    }
}

/** Human label for the pillar ("Personal" / "Home" / "Business"). */
val SchedulingPillar.label: String
    get() =
        when (this) {
            SchedulingPillar.Personal -> "Personal"
            SchedulingPillar.Home -> "Home"
            SchedulingPillar.Business -> "Business"
        }

/** Two-tone pillar avatar gradient (the design's 135° HOST_AV sky disc). Tokens only. */
fun SchedulingPillar.avatarBrush(): Brush =
    when (this) {
        SchedulingPillar.Personal -> Brush.linearGradient(listOf(PantopusColors.primary400, PantopusColors.primary700))
        SchedulingPillar.Home -> Brush.linearGradient(listOf(PantopusColors.home, PantopusColors.homeDark))
        SchedulingPillar.Business -> Brush.linearGradient(listOf(PantopusColors.business, PantopusColors.businessDark))
    }

/** First-two-letters initials for a host/event name ("Maria Kessler" → "MK"). */
fun edgeInitials(name: String?): String {
    val parts = name?.trim()?.split(Regex("\\s+")).orEmpty().filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(2).uppercase()
        else -> (parts[0].take(1) + parts[1].take(1)).uppercase()
    }
}

/**
 * The design's gradient host avatar — a sky-gradient disc carrying the host's
 * initials (mirrors iOS `EdgePillarAvatar` / the design `HOST_AV` disc).
 */
@Composable
fun EdgeHostAvatar(
    name: String?,
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 34.dp,
) {
    Box(
        modifier = modifier.size(size).clip(CircleShape).background(pillar.avatarBrush()),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = edgeInitials(name),
            color = PantopusColors.appTextInverse,
            fontSize = (size.value * 0.34f).sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** Card brand for the saved-card row (D6 declined). */
enum class CardBrand(val label: String) {
    Visa("VISA"),
    Mastercard("MC"),
    Generic("CARD"),
    ;

    val badgeBg: Color
        get() =
            when (this) {
                Visa -> PantopusColors.primary900
                Mastercard -> PantopusColors.warningBg
                Generic -> PantopusColors.appSurfaceSunken
            }

    val badgeFg: Color
        get() =
            when (this) {
                Visa -> PantopusColors.appTextInverse
                Mastercard -> PantopusColors.warning
                Generic -> PantopusColors.appTextSecondary
            }
}

/**
 * The A14.6 saved-card row (D6 declined): a brand badge, the masked PAN label,
 * a status sub-line, and an optional "Declined" pill.
 */
@Composable
fun EdgeSavedCardRow(
    brand: CardBrand,
    label: String,
    sub: String,
    modifier: Modifier = Modifier,
    declined: Boolean = false,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, if (declined) PantopusColors.errorLight else PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(width = 38.dp, height = 26.dp).clip(RoundedCornerShape(Radii.sm)).background(brand.badgeBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = brand.label, color = brand.badgeFg, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(
                text = sub,
                style = PantopusTextStyle.overline,
                fontWeight = if (declined) FontWeight.SemiBold else FontWeight.Normal,
                color = if (declined) PantopusColors.error else PantopusColors.appTextSecondary,
            )
        }
        if (declined) {
            Text(
                text = "Declined",
                style = PantopusTextStyle.overline,
                color = PantopusColors.error,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.errorBg)
                        .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.pill))
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s0),
            )
        }
    }
}

// ─── Date / time helpers (render local, store UTC) ──────────────────────────

private val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
private val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
private val DAY_FULL_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.US)
private const val MINUTES_PER_HOUR = 60L

/** Parse an ISO instant ("…Z"/offset) or a bare local date-time to [Instant] (UTC). */
fun parseInstant(value: String?): Instant? {
    if (value.isNullOrBlank()) return null
    return runCatching { OffsetDateTime.parse(value).toInstant() }
        .recoverCatching { Instant.parse(value) }
        .recoverCatching { LocalDateTime.parse(value).atZone(ZoneId.systemDefault()).toInstant() }
        .getOrNull()
}

/** Resolve an IANA zone id, falling back to the device zone. */
fun zoneOf(tz: String?): ZoneId = tz?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()

/** "Wed, Jun 17" for a UTC instant rendered in [zone]. */
fun formatDate(
    utc: String?,
    zone: ZoneId = ZoneId.systemDefault(),
): String? = parseInstant(utc)?.atZone(zone)?.format(DATE_FORMAT)

/** "Wed, Jun 17 · 9:30–10:00 AM" for a UTC range rendered in [zone]. */
fun formatWhenRange(
    startUtc: String?,
    endUtc: String?,
    zone: ZoneId = ZoneId.systemDefault(),
): String {
    val start = parseInstant(startUtc)?.atZone(zone) ?: return startUtc.orEmpty()
    val date = start.format(DATE_FORMAT)
    val startTime = start.format(TIME_FORMAT)
    val end = parseInstant(endUtc)?.atZone(zone)
    return if (end != null) "$date · $startTime–${end.format(TIME_FORMAT)}" else "$date · $startTime"
}

/** "Wednesday, Jun 17" full-weekday day heading. */
fun formatDayHeading(
    utc: String?,
    zone: ZoneId = ZoneId.systemDefault(),
): String? = parseInstant(utc)?.atZone(zone)?.format(DAY_FULL_FORMAT)

/** A short tz abbreviation ("PDT") for the chip; falls back to the zone id. */
fun tzShortLabel(
    zone: ZoneId,
    at: Instant = Instant.now(),
): String =
    runCatching {
        ZonedDateTime.ofInstant(at, zone)
            .format(DateTimeFormatter.ofPattern("zzz", Locale.US))
    }.getOrElse { zone.id }

private fun slotZoned(slot: SlotDto): ZonedDateTime? {
    val raw = slot.startLocal ?: slot.start
    return runCatching { LocalDateTime.parse(raw).atZone(ZoneId.systemDefault()) }
        .recoverCatching { OffsetDateTime.parse(raw).toZonedDateTime() }
        .getOrNull()
}

private fun slotDateLabel(slot: SlotDto): String = slotZoned(slot)?.format(DATE_FORMAT) ?: (slot.startLocal ?: slot.start)

private fun slotTimeRange(slot: SlotDto): String {
    val start = slotZoned(slot)?.format(TIME_FORMAT) ?: return slot.startLocal ?: slot.start
    val end =
        slot.end?.let { e ->
            runCatching { OffsetDateTime.parse(e).format(TIME_FORMAT) }
                .recoverCatching { LocalDateTime.parse(e).format(TIME_FORMAT) }
                .getOrNull()
        }
    return if (end != null) "$start–$end" else start
}

private fun slotDurationLabel(slot: SlotDto): String? {
    val end = slot.end ?: return null
    return runCatching {
        val minutes = Duration.between(OffsetDateTime.parse(slot.start), OffsetDateTime.parse(end)).toMinutes()
        when {
            minutes <= 0 -> null
            minutes % MINUTES_PER_HOUR == 0L -> "${minutes / MINUTES_PER_HOUR} hr"
            else -> "$minutes min"
        }
    }.getOrNull()
}
