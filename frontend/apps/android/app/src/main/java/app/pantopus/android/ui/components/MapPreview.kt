@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "FunctionNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii

private const val GRID_LINE_COUNT = 8

/**
 * Static, tappable map tile with an identity-tinted pin and an optional
 * service-area ring. The Compose mirror of iOS
 * `Core/Design/Components/MapPreview.swift`.
 *
 * The backdrop is the same stylised street-grid canvas used by [FuzzMap] — no
 * map SDK, no tile fetch, no live network. Callers open the real maps surface
 * from [onTap]. Static in snapshots and well within `docs/perf_budgets.md`.
 *
 * @param identity Pin / service-area tint (defaults to [IdentityPillar.Business]).
 * @param height Tile height; defaults to 124dp.
 * @param serviceAreaRadius Optional translucent ring radius. `null` draws just
 *   the pin.
 * @param pinGlyph Optional center glyph inside the pin head; `null` draws a
 *   plain white dot.
 * @param onTap Opens the maps surface. `null` makes the tile inert.
 */
@Composable
fun MapPreview(
    modifier: Modifier = Modifier,
    identity: IdentityPillar = IdentityPillar.Business,
    height: Dp = 124.dp,
    serviceAreaRadius: Dp? = null,
    pinGlyph: PantopusIcon? = null,
    onTap: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val a11y = if (serviceAreaRadius == null) "Map preview" else "Map preview with service area"
    Box(
        modifier =
            modifier
                .testTag("mapPreview")
                .fillMaxWidth()
                .height(height)
                .clip(shape)
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, shape)
                .then(if (onTap != null) Modifier.clickable { onTap() } else Modifier)
                .semantics { contentDescription = a11y },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .drawBehind {
                        val total = (GRID_LINE_COUNT + 1).toFloat()
                        val stroke = 1.dp.toPx()
                        for (i in 1..GRID_LINE_COUNT) {
                            val y = (i / total) * size.height
                            drawLine(PantopusColors.appBorderSubtle, Offset(0f, y), Offset(size.width, y), stroke)
                            val x = (i / total) * size.width
                            drawLine(PantopusColors.appBorderSubtle, Offset(x, 0f), Offset(x, size.height), stroke)
                        }
                    },
        )
        Box(modifier = Modifier.offset(y = (-6).dp)) {
            Marker(identity = identity, serviceAreaRadius = serviceAreaRadius, glyph = pinGlyph)
        }
    }
}

@Composable
private fun Marker(
    identity: IdentityPillar,
    serviceAreaRadius: Dp?,
    glyph: PantopusIcon?,
) {
    Box(contentAlignment = Alignment.Center) {
        if (serviceAreaRadius != null) {
            Box(
                modifier =
                    Modifier
                        .size(serviceAreaRadius * 2)
                        .drawBehind {
                            val ringStroke = 1.5.dp.toPx()
                            drawCircle(
                                color = identity.color.copy(alpha = 0.15f),
                                radius = size.minDimension / 2f,
                            )
                            drawCircle(
                                color = identity.color.copy(alpha = 0.5f),
                                radius = size.minDimension / 2f - ringStroke / 2f,
                                style = Stroke(width = ringStroke),
                            )
                        },
            )
        }
        MapPin(tint = identity.color, glyph = glyph)
    }
}

@Composable
private fun MapPin(
    tint: Color,
    glyph: PantopusIcon?,
) {
    Box(modifier = Modifier.size(width = 28.dp, height = 37.dp)) {
        // Tail — a downward triangle behind the head; only its tip shows.
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .size(width = 14.dp, height = 22.dp)
                    .drawBehind {
                        val path = Path()
                        path.moveTo(0f, 0f)
                        path.lineTo(size.width, 0f)
                        path.lineTo(size.width / 2f, size.height)
                        path.close()
                        drawPath(path, tint)
                    },
        )
        // Head.
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopCenter)
                    .size(28.dp)
                    .shadow(3.dp, CircleShape)
                    .clip(CircleShape)
                    .background(tint)
                    .border(2.dp, PantopusColors.appSurface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (glyph != null) {
                PantopusIconImage(
                    icon = glyph,
                    contentDescription = null,
                    size = 13.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextInverse,
                )
            } else {
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appTextInverse),
                )
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 460, backgroundColor = 0xFFF6F7F9)
@Composable
private fun MapPreviewPreview() {
    Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        MapPreview(identity = IdentityPillar.Business, serviceAreaRadius = 56.dp)
        MapPreview(identity = IdentityPillar.Home)
        MapPreview(identity = IdentityPillar.Personal, serviceAreaRadius = 40.dp)
    }
}
