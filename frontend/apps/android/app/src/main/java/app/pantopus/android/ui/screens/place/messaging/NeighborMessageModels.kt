package app.pantopus.android.ui.screens.place.messaging

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.place.components.PlaceChevron
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Small value types + atoms shared by the neighbor-messaging screens (W2.6).
 * The trust-and-safety model lives in the contract (`NeighborMessageDtos`):
 * template-only, anonymous both ways, blockable. Mirrors the iOS
 * `NeighborMessageModels`.
 */

/**
 * A recipient home on your block — an address, never a name. Carried into
 * the composer so it can target a verified send. Null when opened without a
 * chosen neighbor (the "choose a neighbor" empty state), mirroring the web
 * `recipient: null` path. (Native has no block-home picker yet — k-anon
 * density hides membership — so the dashboard opens the composer recipient-
 * less; a future block deep-link would populate this.)
 */
data class ComposeRecipient(
    val homeId: String,
    val address: String,
    val relativeLabel: String,
)

/** The recipient-side manage toggles — each one-way, never notifies sender. */
data class NeighborManageFlags(
    val notHelpful: Boolean = false,
    val blocked: Boolean = false,
    val reported: Boolean = false,
)

/**
 * Map the server's lucide icon name to a Pantopus glyph. The catalog is
 * server-driven, so unknown names degrade to a neutral note glyph and the UI
 * never breaks on a new template. (`volume-2`/`door-open` have no exact
 * Pantopus glyph — substituted with the nearest in-set match.)
 */
fun neighborTemplateIcon(name: String): PantopusIcon =
    when (name) {
        "volume-2" -> PantopusIcon.Bell
        "package" -> PantopusIcon.Package
        "car" -> PantopusIcon.Car
        "dog" -> PantopusIcon.Dog
        "door-open" -> PantopusIcon.DoorOpen
        else -> PantopusIcon.MessageSquare
    }

private const val MILLIS_PER_MINUTE = 60_000L
private const val MINUTES_PER_HOUR = 60
private const val HOURS_PER_DAY = 24

/**
 * Coarse "x ago" label for a message timestamp. Mirrors the web
 * `relativeTime` — minute/hour/day granularity, "just now" for unparseable
 * or future stamps. Parses ISO-8601 with an offset.
 */
@Suppress("ReturnCount")
fun neighborRelativeTime(iso: String): String {
    val then =
        runCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
            .getOrNull()
            ?: return "just now"
    val mins = ((System.currentTimeMillis() - then) / MILLIS_PER_MINUTE).coerceAtLeast(0)
    if (mins < 1) return "just now"
    if (mins < MINUTES_PER_HOUR) return "${mins}m ago"
    val hrs = Math.round(mins / MINUTES_PER_HOUR.toDouble())
    if (hrs < HOURS_PER_DAY) return "${hrs}h ago"
    val days = Math.round(hrs / HOURS_PER_DAY.toDouble())
    return "${days}d ago"
}

/**
 * A tappable Place-dashboard entry row (icon tile · title/subtitle ·
 * chevron) — the verified-neighbor messaging affordances.
 */
@Composable
fun PlaceMessagesActionRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .placeCard()
                .clickable(onClick = onTap)
                .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlaceIconTile(icon = icon, tone = PlaceTileTone.HOME, size = 38.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = subtitle,
                fontSize = 12.5.sp,
                color = PantopusColors.appTextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        PlaceChevron()
    }
}

/**
 * A calm inline error banner (error-tinted) for an in-place failure that
 * doesn't warrant a full-screen `ErrorState` — e.g. a failed send/reply.
 */
@Composable
fun NeighborErrorBanner(
    message: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = message,
        fontSize = 13.sp,
        color = PantopusColors.error,
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
    )
}
