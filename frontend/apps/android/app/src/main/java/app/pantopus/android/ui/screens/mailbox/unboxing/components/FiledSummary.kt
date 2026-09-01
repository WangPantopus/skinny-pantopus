@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.unboxing.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.unboxing.UnboxingShot
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.14 filed-state chrome — the success [FiledBanner] ("Filed to Home ›
 * Warranties" + Undo) over the collapsed [FiledShots] photo summary ("4
 * photos saved · Originals kept in your Vault"). [ScanNextCard] is the
 * dashed launcher at the foot of the filed frame; the screen renders the AI
 * elf + locked `OcrFactsList` between them, matching the design order.
 * Mirrors iOS `FiledSummary`.
 */
@Composable
fun FiledSummary(
    filedTo: String,
    filedSubtitle: String,
    shots: List<UnboxingShot>,
    photosSavedLabel: String,
    onUndo: () -> Unit,
    onViewPhotos: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        FiledBanner(filedTo = filedTo, filedSubtitle = filedSubtitle, onUndo = onUndo)
        FiledShots(shots = shots, photosSavedLabel = photosSavedLabel, onViewPhotos = onViewPhotos)
    }
}

@Composable
private fun FiledBanner(
    filedTo: String,
    filedSubtitle: String,
    onUndo: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("unboxing_filedBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(38.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 20.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Filed to $filedTo",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
            )
            Text(text = filedSubtitle, fontSize = 11.5.sp, color = PantopusColors.success)
        }
        Text(
            text = "Undo",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onUndo)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp)
                    .testTag("unboxing_undo"),
        )
    }
}

@Composable
private fun FiledShots(
    shots: List<UnboxingShot>,
    photosSavedLabel: String,
    onViewPhotos: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onViewPhotos)
                .padding(Spacing.s3)
                .semantics { contentDescription = "$photosSavedLabel. Originals kept in your Vault. View photos." }
                .testTag("unboxing_filedShots"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(modifier = Modifier.width(96.dp).height(48.dp)) {
            shots.take(3).forEachIndexed { index, _ ->
                StackedThumb(modifier = Modifier.offset(x = (index * 28).dp))
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = photosSavedLabel, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                text = "Originals kept in your Vault",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                text = "View",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.categoryUnboxingDark,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.categoryUnboxingDark,
            )
        }
    }
}

@Composable
private fun StackedThumb(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .size(width = 40.dp, height = 48.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(Color(red = 0.11f, green = 0.11f, blue = 0.11f))
                .border(2.dp, PantopusColors.appSurface, RoundedCornerShape(Radii.sm)),
    ) {
        StripeField(modifier = Modifier.fillMaxSize())
    }
}

/**
 * A17.14 `ScanNext` launcher — the dashed teal card at the foot of the
 * filed frame. The Android border is solid (matching the `CameraScanner`
 * "Add" tile precedent); iOS dashes its stroke.
 */
@Composable
fun ScanNextCard(
    accent: Color,
    accentDark: Color,
    accentBg: Color,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(accentBg)
                .border(1.5.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(Radii.xl))
                .clickable(onClick = onTap)
                .padding(Spacing.s4)
                .semantics { contentDescription = "Scan the next item" }
                .testTag("unboxing_scanNext"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Radii.md)).background(accent),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ScanLine,
                contentDescription = null,
                size = 20.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = "Scan the next item", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = accentDark)
            Text(
                text = "Keep unboxing — capture flows back to here",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.2f,
            tint = accentDark,
        )
    }
}

/**
 * Diagonal hairline stripes for the collapsed photo thumbnails — the
 * design's "never a hand-drawn object" placeholder fill, mirroring the
 * `CameraScanner` stripe treatment.
 */
@Composable
private fun StripeField(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val step = 7.dp.toPx()
        val color = Color.White.copy(alpha = 0.07f)
        var x = -size.height
        while (x < size.width + size.height) {
            drawLine(color, Offset(x, 0f), Offset(x + size.height, size.height), strokeWidth = 1f)
            x += step
        }
    }
}
