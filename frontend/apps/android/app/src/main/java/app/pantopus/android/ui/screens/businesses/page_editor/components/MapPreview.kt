@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P4.2 — A13.10 Edit Business Page. Stylized map preview tile —
 * hand-rolled Compose Canvas (no Maps SDK yet) showing a city block
 * grid, park, and a violet pin centered on the address. Pin carries an
 * amber rim when `pinDirty`; bottom-left chip flips between Verified
 * (green) and Verify address (warning amber) based on `verified`.
 */
@Composable
fun EditBusinessMapPreview(
    verified: Boolean,
    pinDirty: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val a11y =
        if (verified) "Map preview, address verified" else "Map preview, address unverified"
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.personalBg)
                .testTag("editBusinessPage.mapPreview")
                .semantics { contentDescription = a11y },
    ) {
        MapBackgroundCanvas()
        // Pin centered.
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            PinComposite(pinDirty = pinDirty)
        }
        // Verification chip — bottom left.
        VerificationChip(
            verified = verified,
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = Spacing.s2, bottom = Spacing.s2),
        )
        // Zoom controls — top right.
        ZoomControls(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(Spacing.s2),
        )
    }
}

@Composable
private fun MapBackgroundCanvas() {
    val streetColor = PantopusColors.appSurface
    val parkColor = PantopusColors.successBg
    val parkGreen = PantopusColors.success
    val blockColor = PantopusColors.warningLight
    Canvas(modifier = Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        // Horizontal streets
        drawRect(streetColor, topLeft = Offset(0f, h * 0.34f), size = androidx.compose.ui.geometry.Size(w, h * 0.08f))
        drawRect(streetColor, topLeft = Offset(0f, h * 0.69f), size = androidx.compose.ui.geometry.Size(w, h * 0.055f))
        // Vertical streets
        drawRect(streetColor, topLeft = Offset(w * 0.245f, 0f), size = androidx.compose.ui.geometry.Size(w * 0.045f, h))
        drawRect(streetColor, topLeft = Offset(w * 0.675f, 0f), size = androidx.compose.ui.geometry.Size(w * 0.032f, h))
        // Park
        drawRect(parkColor, topLeft = Offset(w * 0.315f, h * 0.45f), size = androidx.compose.ui.geometry.Size(w * 0.33f, h * 0.20f))
        // Trees
        listOf(0.38f, 0.48f, 0.58f).forEach { x ->
            drawCircle(parkGreen.copy(alpha = 0.65f), radius = w * 0.018f, center = Offset(w * x, h * 0.53f))
        }
        // Corner blocks
        val blockSpecs =
            listOf(
                Quadruple(0.04f, 0.04f, 0.18f, 0.20f),
                Quadruple(0.78f, 0.04f, 0.18f, 0.18f),
                Quadruple(0.04f, 0.82f, 0.18f, 0.15f),
                Quadruple(0.78f, 0.82f, 0.18f, 0.16f),
            )
        blockSpecs.forEach { b ->
            drawRect(
                blockColor.copy(alpha = 0.5f),
                topLeft = Offset(w * b.a, h * b.b),
                size = androidx.compose.ui.geometry.Size(w * b.c, h * b.d),
            )
        }
    }
}

private data class Quadruple(val a: Float, val b: Float, val c: Float, val d: Float)

@Composable
private fun PinComposite(pinDirty: Boolean) {
    val pinFill = PantopusColors.business
    val dirtyRing = PantopusColors.warning
    val shadow = PantopusColors.appText.copy(alpha = 0.25f)
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(modifier = Modifier.size(32.dp, 38.dp), contentAlignment = Alignment.Center) {
            Canvas(modifier = Modifier.matchParentSize()) {
                val w = size.width
                val h = size.height
                val path =
                    Path().apply {
                        addOval(androidx.compose.ui.geometry.Rect(Offset.Zero, androidx.compose.ui.geometry.Size(w, w)))
                        moveTo(w * 0.5f, h)
                        lineTo(w * 0.25f, w * 0.78f)
                        lineTo(w * 0.75f, w * 0.78f)
                        close()
                    }
                drawPath(path, pinFill)
                if (pinDirty) {
                    drawPath(path, dirtyRing, style = Stroke(width = 4f))
                }
            }
            PantopusIconImage(
                icon = PantopusIcon.Building2,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextInverse,
                modifier = Modifier.padding(bottom = 14.dp),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(14.dp, 5.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(shadow),
        )
    }
}

@Composable
private fun VerificationChip(
    verified: Boolean,
    modifier: Modifier = Modifier,
) {
    val bg = if (verified) PantopusColors.successBg else PantopusColors.warningBg
    val fg = if (verified) PantopusColors.success else PantopusColors.warmAmber
    val border = if (verified) PantopusColors.successLight else PantopusColors.warningLight
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(width = 1.dp, color = border, shape = RoundedCornerShape(Radii.pill))
                .padding(horizontal = 9.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = if (verified) PantopusIcon.ShieldCheck else PantopusIcon.ShieldAlert,
            contentDescription = null,
            size = 10.dp,
            tint = fg,
        )
        Box(modifier = Modifier.size(width = 4.dp, height = 0.dp))
        Text(
            text = if (verified) "VERIFIED" else "VERIFY ADDRESS",
            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold),
            color = fg,
        )
    }
}

@Composable
private fun ZoomControls(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.appSurface),
    ) {
        Box(
            modifier = Modifier.size(width = 26.dp, height = 24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "+",
                style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextStrong,
            )
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Box(
            modifier = Modifier.size(width = 26.dp, height = 24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "−",
                style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextStrong,
            )
        }
    }
}
