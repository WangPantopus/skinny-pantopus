@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageGalleryState
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageGalleryTile
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P4.2 — A13.10 Edit Business Page. 3-column gallery grid. Empty
 * variant shows a hero "Add cover photo" tile (2×2 span) + smaller add
 * tiles; populated variant shows photo tiles + one add tile (amber rim
 * when the latest upload is fresh).
 *
 * Drag-to-reorder gestures are out of scope for v1 — the hint chip is
 * shown only.
 */
@Composable
fun EditBusinessGalleryEditor(
    state: EditBusinessPageGalleryState,
    modifier: Modifier = Modifier,
) {
    if (state.isEmpty) {
        EmptyGallery(modifier = modifier)
    } else {
        PopulatedGallery(state = state, modifier = modifier)
    }
}

@Composable
private fun PopulatedGallery(
    state: EditBusinessPageGalleryState,
    modifier: Modifier,
) {
    val tiles = state.tiles + listOf<EditBusinessPageGalleryTile?>(null) // sentinel for add-tile
    // 3-column grid via two-pass layout: pre-compute rows of 3.
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .testTag("editBusinessPage.gallery"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        tiles.chunked(3).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                row.forEach { tile ->
                    Box(modifier = Modifier.weight(1f)) {
                        if (tile != null) {
                            GalleryTileView(tile = tile)
                        } else {
                            GalleryAddTile(fresh = state.freshAddTile)
                        }
                    }
                }
                repeat(3 - row.size) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun EmptyGallery(modifier: Modifier) {
    Row(
        modifier = modifier.fillMaxWidth().testTag("editBusinessPage.gallery"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.weight(2f).aspectRatio(1f)) { CoverHero() }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            GalleryAddTile(fresh = false)
            GalleryAddTile(fresh = false)
        }
    }
}

@Composable
private fun GalleryTileView(tile: EditBusinessPageGalleryTile) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(Radii.md))
                .background(paletteBrush(tile.palette))
                .then(
                    if (tile.isCover) {
                        Modifier.border(
                            width = 2.dp,
                            color = PantopusColors.business,
                            shape = RoundedCornerShape(Radii.md),
                        )
                    } else {
                        Modifier
                    },
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (tile.isCover) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.business)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
            ) {
                Text(
                    text = "COVER",
                    style = TextStyle(fontSize = 8.5.sp, fontWeight = FontWeight.Bold),
                    color = PantopusColors.appTextInverse,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(4.dp)
                    .size(22.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appText.copy(alpha = 0.65f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.appTextInverse,
                strokeWidth = 2.5f,
            )
        }
    }
}

@Composable
private fun paletteBrush(palette: EditBusinessPageGalleryTile.Palette): Brush =
    when (palette) {
        EditBusinessPageGalleryTile.Palette.Croissant ->
            Brush.linearGradient(listOf(PantopusColors.warningLight, PantopusColors.warmAmber))
        EditBusinessPageGalleryTile.Palette.Coffee ->
            Brush.linearGradient(listOf(PantopusColors.warmAmber, PantopusColors.appText))
        EditBusinessPageGalleryTile.Palette.Interior ->
            Brush.linearGradient(listOf(PantopusColors.warningLight, PantopusColors.warmAmber))
        EditBusinessPageGalleryTile.Palette.Bread ->
            Brush.linearGradient(listOf(PantopusColors.warningLight, PantopusColors.warning))
        EditBusinessPageGalleryTile.Palette.Latte ->
            Brush.linearGradient(listOf(PantopusColors.warningLight, PantopusColors.warmAmber))
        EditBusinessPageGalleryTile.Palette.Crowd ->
            Brush.linearGradient(listOf(PantopusColors.warning, PantopusColors.businessDark))
    }

@Composable
private fun GalleryAddTile(fresh: Boolean) {
    val fg = if (fresh) PantopusColors.warmAmber else PantopusColors.appTextSecondary
    val bg = if (fresh) PantopusColors.warmAmberBg else PantopusColors.appSurface
    val borderColor = if (fresh) PantopusColors.warmAmber else PantopusColors.appBorderStrong
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(Radii.md))
                .background(bg)
                .border(width = 1.5.dp, color = borderColor, shape = RoundedCornerShape(Radii.md)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = null,
                size = 20.dp,
                tint = fg,
            )
            Text(
                text = if (fresh) "Uploaded" else "Add",
                style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
                color = fg,
            )
        }
    }
}

@Composable
private fun CoverHero() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.5.dp,
                    color = PantopusColors.appBorderStrong,
                    shape = RoundedCornerShape(Radii.md),
                ),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopStart)
                    .padding(6.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.business)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
        ) {
            Text(
                text = "COVER",
                style = TextStyle(fontSize = 8.5.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appTextInverse,
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = 26.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Add cover photo",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "1080 × 1080",
                style = TextStyle(fontSize = 10.sp),
                color = PantopusColors.appTextMuted,
            )
        }
    }
}
