@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "FunctionNaming", "UnusedPrivateMember", "MatchingDeclarationName")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage

/** A single tile in a [GalleryStrip]. */
data class GalleryTile(
    val id: String,
    val imageUrl: String? = null,
    val label: String? = null,
    val tint: Color = PantopusColors.appSurfaceSunken,
    val icon: PantopusIcon? = PantopusIcon.Image,
    /**
     * When non-null the tile renders a dark "+N" see-all overlay instead of a
     * photo — the trailing "+9" affordance in the design.
     */
    val moreCount: Int? = null,
)

/**
 * Horizontal photo rail. The Compose mirror of iOS
 * `Core/Design/Components/GalleryStrip.swift`. When [tiles] is empty it renders
 * [emptySlots] dashed add-targets wired to [onAdd].
 *
 * Tiles render a token tint + center glyph by default; pass [GalleryTile.imageUrl]
 * for real photos (Coil, with the tint as the loading / error fallback).
 * Snapshots pass tint-only tiles so no network is hit.
 */
@Composable
fun GalleryStrip(
    tiles: List<GalleryTile>,
    modifier: Modifier = Modifier,
    emptySlots: Int = 3,
    onTileTap: ((GalleryTile) -> Unit)? = null,
    onAdd: (() -> Unit)? = null,
) {
    Row(
        modifier =
            modifier
                .testTag("galleryStrip")
                .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (tiles.isEmpty()) {
            repeat(emptySlots) { AddTile(onAdd = onAdd) }
        } else {
            tiles.forEach { tile -> GalleryTileView(tile = tile, onTileTap = onTileTap) }
        }
    }
}

private val TILE_WIDTH = 116.dp
private val TILE_HEIGHT = 92.dp

@Composable
private fun GalleryTileView(
    tile: GalleryTile,
    onTileTap: ((GalleryTile) -> Unit)?,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val a11y = tile.moreCount?.let { "See $it more photos" } ?: (tile.label ?: "Photo")
    Box(
        modifier =
            Modifier
                .size(width = TILE_WIDTH, height = TILE_HEIGHT)
                .clip(shape)
                .border(1.dp, PantopusColors.appBorder, shape)
                .then(if (onTileTap != null) Modifier.clickable { onTileTap(tile) } else Modifier)
                .semantics { contentDescription = a11y },
    ) {
        // Background — photo or token tint.
        if (tile.imageUrl != null) {
            SubcomposeAsyncImage(
                model = tile.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = { Box(Modifier.fillMaxSize().background(tile.tint)) },
                error = { Box(Modifier.fillMaxSize().background(tile.tint)) },
            )
        } else {
            Box(Modifier.fillMaxSize().background(tile.tint))
        }

        if (tile.moreCount != null) {
            Box(
                modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "+${tile.moreCount}",
                    color = PantopusColors.appTextInverse,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        } else {
            tile.icon?.let { icon ->
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 24.dp,
                    strokeWidth = 1.6f,
                    tint = PantopusColors.appTextInverse.copy(alpha = 0.92f),
                    modifier = Modifier.align(Alignment.Center),
                )
            }
            tile.label?.let { label ->
                Text(
                    text = label,
                    color = PantopusColors.appTextInverse,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    modifier =
                        Modifier
                            .align(Alignment.BottomStart)
                            .fillMaxWidth()
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.Transparent, Color.Black.copy(alpha = 0.45f)),
                                ),
                            ).padding(horizontal = Spacing.s2, vertical = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun AddTile(onAdd: (() -> Unit)?) {
    val shape = RoundedCornerShape(Radii.lg)
    Box(
        modifier =
            Modifier
                .size(width = TILE_WIDTH, height = TILE_HEIGHT)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .drawBehind {
                    val radius = Radii.lg.toPx()
                    drawRoundRect(
                        color = PantopusColors.appBorder,
                        cornerRadius = CornerRadius(radius, radius),
                        style =
                            Stroke(
                                width = 1.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()), 0f),
                            ),
                    )
                }.then(if (onAdd != null) Modifier.clickable { onAdd() } else Modifier)
                .semantics { contentDescription = "Add photo" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 20.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 240, backgroundColor = 0xFFF6F7F9)
@Composable
private fun GalleryStripPreview() {
    Column(
        modifier = Modifier.padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        GalleryStrip(
            tiles =
                listOf(
                    GalleryTile(id = "kitchen", label = "Kitchen", tint = PantopusColors.primary600),
                    GalleryTile(id = "bath", label = "Bathroom", tint = PantopusColors.success),
                    GalleryTile(id = "living", label = "Living room", tint = PantopusColors.slate),
                    GalleryTile(id = "more", tint = PantopusColors.primary800, icon = null, moreCount = 9),
                ),
        )
        GalleryStrip(tiles = emptyList())
    }
}
