@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.pulse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * When and where an Event post happens, as its Pulse card and its post page show them (as the web card does):
 * "Sun, Oct 18 · 7:00–9:00 PM" and the place the poster named.
 */
@Immutable
data class PulseEventDetails(
    /** "Sun, Oct 18 · 7:00–9:00 PM", "Tomorrow · 7:00 PM"; null without a start time. */
    val whenText: String?,
    /** The place the poster named ("Esther Short Park"); null without one. */
    val place: String?,
)

/**
 * Null unless an Event post names a start time or a place. [long] spells the weekday out ("Sunday, Oct 18 · …"),
 * as the post page does.
 */
fun pulseEventDetails(
    postType: String?,
    startsAt: String?,
    endsAt: String?,
    venue: String?,
    long: Boolean = false,
    now: Instant = Instant.now(),
): PulseEventDetails? {
    if (postType != "event") return null
    val whenText = eventWhen(startsAt, endsAt, long, now)
    val place = venue?.trim()?.takeIf { it.isNotEmpty() }
    if (whenText == null && place == null) return null
    return PulseEventDetails(whenText = whenText, place = place)
}

/**
 * Every composer stores the time the poster picked as wall-clock time labelled UTC (the web card reads it in UTC
 * too), so it's read in UTC, and "Today" or "Tomorrow" compares it with the phone's own wall clock read the same
 * way. An end at or before the start is left out.
 */
private fun eventWhen(
    startsAt: String?,
    endsAt: String?,
    long: Boolean,
    now: Instant,
): String? {
    val start = PlanFormat.instant(startsAt)?.atZone(ZoneOffset.UTC) ?: return null
    val end = PlanFormat.instant(endsAt)?.atZone(ZoneOffset.UTC)?.takeIf { it.isAfter(start) }
    val wallClockNow = now.plusSeconds(ZoneId.systemDefault().rules.getOffset(now).totalSeconds.toLong())
    return PlanFormat.whenLine(start, end, long, wallClockNow)
}

/**
 * The Event's time and place as two icon rows: small on the Pulse card, larger on the post page ([page]).
 * Tags: `pulsePostEventWhen_<id>` on a card, `pulsePostDetail-eventWhen` on the post page (same on iOS).
 */
@Composable
fun PulseEventDetailRows(
    details: PulseEventDetails,
    page: Boolean,
    whenTag: String,
    placeTag: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(if (page) Spacing.s2 else Spacing.s1),
    ) {
        details.whenText?.let { EventDetailRow(PantopusIcon.Calendar, it, FontWeight.SemiBold, page, whenTag) }
        details.place?.let { place ->
            if (page) {
                // Selectable, so the place can be copied into Maps.
                SelectionContainer { EventDetailRow(PantopusIcon.MapPin, place, FontWeight.Normal, page, placeTag) }
            } else {
                EventDetailRow(PantopusIcon.MapPin, place, FontWeight.Normal, page, placeTag)
            }
        }
    }
}

@Composable
private fun EventDetailRow(
    icon: PantopusIcon,
    text: String,
    weight: FontWeight,
    page: Boolean,
    tag: String,
) {
    Row(
        modifier = Modifier.testTag(tag),
        verticalAlignment = if (page) Alignment.Top else Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (page) Spacing.s2 else 6.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = if (page) 15.dp else 12.dp,
            tint = PantopusColors.magic,
            modifier = if (page) Modifier.padding(top = 2.dp) else Modifier,
        )
        Text(
            text = text,
            fontSize = if (page) 14.sp else 12.sp,
            fontWeight = weight,
            color = PantopusColors.appTextStrong,
            maxLines = if (page) Int.MAX_VALUE else 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
