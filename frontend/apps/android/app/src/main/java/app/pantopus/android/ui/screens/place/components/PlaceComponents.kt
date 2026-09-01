package app.pantopus.android.ui.screens.place.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * Place — shared product-UI atoms, ported 1:1 from the design kit
 * `reference/address-anchored/place-components.jsx` (+ the `.pl-[*]`
 * CSS in the compiled screens). Home-green accent, sky CTAs.
 * Parity twin of iOS `Features/Place/Components/PlaceComponents.swift`.
 *
 * Design-token mapping (design hex → app token):
 *   INK → appText · INK2 → appTextStrong · MUTE → appTextSecondary
 *   FAINT → appTextMuted · BORDER → appBorder · HOME_GREEN → home
 *   HOME_GREEN_BG → homeBg · SKY → primary600
 */

// ─── Card container (`.pl-card`) ─────────────────────────────

/** White card surface: 1px border, radius 16, soft shadow. */
fun Modifier.placeCard(): Modifier =
    this
        .shadow(elevation = 2.dp, shape = RoundedCornerShape(16.dp), clip = false)
        .clip(RoundedCornerShape(16.dp))
        .background(PantopusColors.appSurface)
        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(16.dp))

// ─── Icon tile (`IconTile`) ──────────────────────────────────

enum class PlaceTileTone { HOME, MUTED, SKY }

@Composable
fun PlaceIconTile(
    icon: PantopusIcon,
    tone: PlaceTileTone = PlaceTileTone.HOME,
    size: Dp = 34.dp,
) {
    val bg =
        when (tone) {
            PlaceTileTone.HOME -> PantopusColors.homeBg
            PlaceTileTone.MUTED -> PantopusColors.appSurfaceSunken
            PlaceTileTone.SKY -> PantopusColors.primary100
        }
    val fg =
        when (tone) {
            PlaceTileTone.HOME -> PantopusColors.home
            PlaceTileTone.MUTED -> PantopusColors.appTextMuted
            PlaceTileTone.SKY -> PantopusColors.primary600
        }
    Box(
        modifier =
            Modifier
                .size(size)
                .clip(RoundedCornerShape(9.dp))
                .background(bg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = size * 0.56f,
            strokeWidth = 2f,
            tint = fg,
        )
    }
}

// ─── Chevron ─────────────────────────────────────────────────

@Composable
fun PlaceChevron(size: Dp = 18.dp) {
    PantopusIconImage(
        icon = PantopusIcon.ChevronRight,
        contentDescription = null,
        size = size,
        strokeWidth = 2.25f,
        tint = PantopusColors.appTextMuted,
    )
}

// ─── Semantic chip (`Chip`) ──────────────────────────────────

enum class PlaceChipTone { SUCCESS, WARNING, ERROR, SKY, NEUTRAL }

data class PlaceChipModel(
    val tone: PlaceChipTone = PlaceChipTone.NEUTRAL,
    val text: String,
    val icon: PantopusIcon? = null,
)

/** Bordered semantic pill — 12sp semibold, tinted bg/fg/border. */
@Composable
fun PlaceChip(model: PlaceChipModel) {
    val bg =
        when (model.tone) {
            PlaceChipTone.SUCCESS -> PantopusColors.successBg
            PlaceChipTone.WARNING -> PantopusColors.warningBg
            PlaceChipTone.ERROR -> PantopusColors.errorBg
            PlaceChipTone.SKY -> PantopusColors.infoBg
            PlaceChipTone.NEUTRAL -> PantopusColors.appSurfaceSunken
        }
    val fg =
        when (model.tone) {
            PlaceChipTone.SUCCESS -> PantopusColors.success
            PlaceChipTone.WARNING -> PantopusColors.warning
            PlaceChipTone.ERROR -> PantopusColors.error
            PlaceChipTone.SKY -> PantopusColors.primary700
            PlaceChipTone.NEUTRAL -> PantopusColors.appTextSecondary
        }
    val bd =
        when (model.tone) {
            PlaceChipTone.SUCCESS -> PantopusColors.successLight
            PlaceChipTone.WARNING -> PantopusColors.warningLight
            PlaceChipTone.ERROR -> PantopusColors.errorLight
            PlaceChipTone.SKY -> PantopusColors.primary200
            PlaceChipTone.NEUTRAL -> PantopusColors.appBorder
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(bg)
                .border(1.dp, bd, RoundedCornerShape(999.dp))
                .padding(
                    start = if (model.icon != null) 7.dp else 9.dp,
                    end = 9.dp,
                    top = 3.dp,
                    bottom = 3.dp,
                ),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        model.icon?.let {
            PantopusIconImage(
                icon = it,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.25f,
                tint = fg,
            )
        }
        Text(
            text = model.text,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 16.sp,
            color = fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// ─── Verified avatar (`Avatar`) ──────────────────────────────

/** Green-gradient initials disc with a verified-check badge. */
@Composable
fun PlaceVerifiedAvatar(
    initials: String = "RC",
    size: Dp = 38.dp,
) {
    Box(modifier = Modifier.size(size)) {
        Box(
            modifier =
                Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(PantopusColors.success, PantopusColors.homeDark),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = (size.value * 0.34f).sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.2.sp,
                color = PantopusColors.appSurface,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(size * 0.42f)
                    .align(Alignment.BottomEnd)
                    .offset(x = 2.dp, y = 2.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.home)
                    .border(2.dp, PantopusColors.appSurface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = "Verified resident",
                size = size * 0.24f,
                strokeWidth = 3.25f,
                tint = PantopusColors.appSurface,
            )
        }
    }
}

// ─── Sky text button (`TextButton`) ──────────────────────────

/** Verbs-first sky CTA — 14sp semibold, optional trailing arrow. */
@Composable
fun PlaceTextButton(
    title: String,
    arrow: Boolean = true,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 20.sp,
            color = PantopusColors.primary600,
        )
        if (arrow) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowRight,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2.25f,
                tint = PantopusColors.primary600,
            )
        }
    }
}

// ─── Group label (`GroupLabel`) ──────────────────────────────

/** Uppercase overline above a card group. */
@Composable
fun PlaceGroupLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.88.sp,
        color = PantopusColors.appTextMuted,
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp)
                .semantics { heading() },
    )
}

// ─── Density dots (`DensityDots`) ────────────────────────────

/** Four-dot activity meter — filled dots = bucket level, never a count. */
@Composable
fun PlaceDensityDots(level: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(4) { index ->
            Box(
                modifier =
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(
                            if (index < level) PantopusColors.home else PantopusColors.appBorder,
                        ),
            )
        }
    }
}

// ─── Sparkline (`Sparkline`) ─────────────────────────────────

private val SPARKLINE_POINTS =
    listOf(
        Offset(0f, 26f), Offset(14f, 24f), Offset(28f, 25f), Offset(42f, 20f),
        Offset(56f, 21f), Offset(70f, 15f), Offset(84f, 13f), Offset(98f, 8f),
        Offset(112f, 9f), Offset(126f, 4f),
    )

/** Qualitative trend line with gradient fill and end dot (home-green). */
@Composable
fun PlaceSparkline(points: List<Offset> = SPARKLINE_POINTS) {
    val home = PantopusColors.home
    androidx.compose.foundation.Canvas(
        modifier = Modifier.size(width = 118.dp, height = 34.dp),
    ) {
        if (points.size < 2) return@Canvas
        val scaleX = size.width / 126f
        val scaleY = size.height / 30f
        val scaled = points.map { Offset(it.x * scaleX, it.y * scaleY) }

        val fill =
            androidx.compose.ui.graphics.Path().apply {
                moveTo(0f, size.height)
                scaled.forEach { lineTo(it.x, it.y) }
                lineTo(size.width, size.height)
                close()
            }
        drawPath(
            path = fill,
            brush =
                Brush.verticalGradient(
                    colors = listOf(home.copy(alpha = 0.16f), home.copy(alpha = 0f)),
                ),
        )

        val line =
            androidx.compose.ui.graphics.Path().apply {
                moveTo(scaled.first().x, scaled.first().y)
                scaled.drop(1).forEach { lineTo(it.x, it.y) }
            }
        drawPath(
            path = line,
            color = home,
            style =
                androidx.compose.ui.graphics.drawscope.Stroke(
                    width = 2.dp.toPx(),
                    cap = androidx.compose.ui.graphics.StrokeCap.Round,
                    join = androidx.compose.ui.graphics.StrokeJoin.Round,
                ),
        )

        drawCircle(color = home, radius = 2.6.dp.toPx(), center = scaled.last())
    }
}

/** Tiny status dot used before inline section values. */
@Composable
fun PlaceStatusDot(color: Color) {
    Box(
        modifier =
            Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color),
    )
}
