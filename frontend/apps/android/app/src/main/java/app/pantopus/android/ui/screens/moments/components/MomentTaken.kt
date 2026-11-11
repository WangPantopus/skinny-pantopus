package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * Any photo or video in the album can be a Moment (founder, 2026-11-11). One taken more than a day before it's posted
 * says when it was taken, on the Post sheet and for everyone watching, so an old photo never reads as something
 * happening now. The server keeps the same rule (contract v3.3: `taken_at` is set only then).
 */

/** More than this before posting, a photo or video says when it was taken. */
private val TAKEN_SHOWN_AFTER: Duration = Duration.ofHours(24)

/** Whether a photo or video taken at [takenAt] says so when posted at [now]. */
internal fun takenLongAgo(
    takenAt: Instant?,
    now: Instant = Instant.now(),
): Boolean = takenAt != null && Duration.between(takenAt, now) > TAKEN_SHOWN_AFTER

/** "Taken Oct 3", or "Taken Oct 3, 2024" when it isn't this year (the viewer's own calendar). */
internal fun takenLabel(
    takenAt: Instant,
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): String {
    val date = takenAt.atZone(zone).toLocalDate()
    val pattern = if (date.year == now.atZone(zone).year) "MMM d" else "MMM d, yyyy"
    return "Taken " + DateTimeFormatter.ofPattern(pattern, Locale.getDefault()).format(date)
}

/** The server's `taken_at` as the viewer's label, or null (none, or unreadable). */
internal fun takenLabel(iso: String?): String? =
    iso?.let { runCatching { Instant.parse(it.replace("+00:00", "Z")) }.getOrNull() }?.let { takenLabel(it) }

/** The small dark pill over a Moment that says when it was taken (the viewer, under the header). */
@Composable
internal fun MomentTakenPill(
    label: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.momentCaptionPill)
                .padding(horizontal = 10.dp, vertical = 5.dp)
                .testTag("moments.viewer.taken")
                .clearAndSetSemantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Calendar, contentDescription = null, size = 13.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(text = label, color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}
