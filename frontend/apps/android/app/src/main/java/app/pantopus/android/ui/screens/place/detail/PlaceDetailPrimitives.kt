package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceAddressRef
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * Shared chrome for the Place group-detail pages — parity twin of iOS
 * `PlaceDetailPrimitives`: the header (back + title + address), the
 * section overline, the provider source caption, and small fact rows.
 */

@Composable
fun PlaceDetailHeader(
    title: String,
    address: String,
    onBack: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp)
                .padding(top = 6.dp, bottom = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .shadow(1.dp, CircleShape, clip = false)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                size = 20.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.appTextStrong,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.4).sp,
                lineHeight = 24.sp,
                color = PantopusColors.appText,
            )
            Text(
                text = address,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

fun placeDetailAddress(place: PlaceAddressRef): String {
    val line1 = place.line1.trim()
    val city = place.city.trim()
    return if (line1.isNotEmpty() && city.isNotEmpty()) "$line1 · $city" else line1.ifEmpty { place.label }
}

@Composable
fun PlaceDetailSectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.88.sp,
        color = PantopusColors.appTextMuted,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
                .padding(top = 26.dp, bottom = 9.dp)
                .semantics { heading() },
    )
}

@Composable
fun PlaceSourceNote(
    name: String,
    asOf: String? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = name, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
        if (asOf != null) {
            Text("·", fontSize = 12.sp, color = PantopusColors.appTextMuted.copy(alpha = 0.5f))
            Text(asOf, fontSize = 12.sp, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
fun PlaceDetailCard(
    modifier: Modifier = Modifier,
    padding: Dp = 18.dp,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier.fillMaxWidth().placeCard().padding(padding),
        content = content,
    )
}

@Composable
fun PlaceFactCell(
    icon: PantopusIcon,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
        PlaceIconTile(icon = icon, tone = PlaceTileTone.HOME, size = 30.dp)
        Column {
            Text(text = label, fontSize = 12.sp, color = PantopusColors.appTextMuted)
            Text(
                text = value,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
fun PlaceComingSoonRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String? = null,
) {
    PlaceDetailCard(padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            PlaceIconTile(icon = icon, tone = PlaceTileTone.MUTED, size = 32.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
                if (subtitle != null) {
                    Text(text = subtitle, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
                }
            }
            PlaceChip(PlaceChipModel(PlaceChipTone.NEUTRAL, "Coming soon"))
        }
    }
}

/** A small status dot used in stat rows. */
@Composable
fun PlaceDot(
    color: Color,
    size: Dp = 6.dp,
) {
    Box(modifier = Modifier.size(size).clip(CircleShape).background(color))
}
