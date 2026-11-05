@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.crewday.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.crewday.CrewDayCrewDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import java.util.Locale

/**
 * The illustrated mini-map (board `Main`): blocks, a park and the cross streets, with the Crew Day's street
 * highlighted in home green and labeled. Never houses or pins: it shows the street, not anyone's home. Decorative
 * for TalkBack (the title says which street).
 */
@Composable
fun CrewDayStreetMap(
    street: String,
    modifier: Modifier = Modifier,
    height: Dp = 150.dp,
) {
    val ground = PantopusColors.appSurfaceRaised
    val block = PantopusColors.appSurfaceSunken
    val park = PantopusColors.homeBg
    val road = PantopusColors.appSurface
    val edge = PantopusColors.appBorderStrong
    val highlight = PantopusColors.home.copy(alpha = 0.2f)
    Box(modifier = modifier.fillMaxWidth().height(height).background(ground).clearAndSetSemantics {}) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val unit = h / 150f

            fun rect(
                x: Float,
                y: Float,
                width: Float,
                height: Float,
                color: androidx.compose.ui.graphics.Color,
                radius: Float = 4f * unit,
            ) = drawRoundRect(color, Offset(x, y), Size(width, height), CornerRadius(radius, radius))
            // Two rows of blocks and a park, above and below the street.
            rect(0.04f * w, 12f * unit, 0.23f * w, 52f * unit, park, radius = 22f * unit)
            listOf(0.33f to 0.20f, 0.57f to 0.15f, 0.80f to 0.17f).forEach { (x, width) ->
                rect(x * w, 14f * unit, width * w, 38f * unit, block)
            }
            listOf(0.06f to 0.20f, 0.33f to 0.20f, 0.57f to 0.15f, 0.80f to 0.17f).forEach { (x, width) ->
                rect(x * w, 104f * unit, width * w, 32f * unit, block)
            }
            // The street's glow, then the roads over it.
            rect(0.08f * w, 63f * unit, 0.86f * w, 34f * unit, highlight, radius = 17f * unit)
            drawRect(edge, Offset(-0.05f * w, 75f * unit), Size(1.1f * w, 10f * unit))
            drawRect(road, Offset(-0.05f * w, 76f * unit), Size(1.1f * w, 8f * unit))
            listOf(0.29f to 6f, 0.755f to 5f).forEach { (x, width) ->
                drawRect(edge, Offset(x * w - unit, 0f), Size((width + 2f) * unit, h))
                drawRect(road, Offset(x * w, 0f), Size(width * unit, h))
            }
        }
        Text(
            text = street,
            style = PantopusTextStyle.caption.copy(fontSize = 11.sp, lineHeight = 16.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appTextStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.pill))
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = 9.dp, vertical = 3.dp),
        )
    }
}

/** The glyph for a Crew Day's service. */
fun crewDayServiceIcon(service: String?): PantopusIcon =
    when (service) {
        "gutter_cleaning" -> PantopusIcon.Droplets
        "leaf_cleanup" -> PantopusIcon.Leaf
        "roof_moss" -> PantopusIcon.Trees
        "holiday_lights" -> PantopusIcon.Sparkles
        "window_washing" -> PantopusIcon.Sun
        "pressure_washing" -> PantopusIcon.Droplet
        else -> PantopusIcon.Wrench
    }

/** The service tag (board `Main`): a home-green tile with the service's glyph, and its name. */
@Composable
fun CrewDayServiceTag(
    service: String?,
    label: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 30.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .padding(start = 4.dp, end = 12.dp, top = 4.dp, bottom = 4.dp)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            modifier = Modifier.size(22.dp).clip(RoundedCornerShape(7.dp)).background(PantopusColors.home),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = crewDayServiceIcon(service),
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = label,
            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
    }
}

/**
 * The crew row: the business's initial in violet, its name, "Insured and registered" only when Pantopus verified its
 * documents, and its reviews when it has some.
 */
@Composable
fun CrewDayCrewRow(
    crew: CrewDayCrewDto?,
    modifier: Modifier = Modifier,
) {
    val name = crew?.name?.takeIf { it.isNotBlank() } ?: "The crew"
    Row(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = name.take(1).uppercase(Locale.US),
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = name,
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (crew?.verified == true) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        PantopusIconImage(
                            icon = PantopusIcon.ShieldCheck,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.success,
                        )
                        Text(
                            text = "Insured and registered",
                            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.success,
                        )
                    }
                }
            }
            crew?.rating?.takeIf { it.count > 0 && it.average != null }?.let { rating ->
                Text(
                    text =
                        "${String.format(Locale.US, "%.1f", rating.average)} · ${rating.count} " +
                            "${if (rating.count == 1) "review" else "reviews"} from homes it served",
                    style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp),
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}
