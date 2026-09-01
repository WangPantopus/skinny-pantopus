@file:Suppress("MagicNumber", "LongMethod", "FunctionNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Three z-stacked tilted paper sheets — the document-preview hero used
 * on archival mail variants (A17.10 Records). Compose mirror of iOS
 * `Core/Design/Components/PaperStack.swift`.
 *
 * @param content Composable rendered on top of the front sheet's
 *     shim-line preview (e.g. letterhead overlay).
 */
@Composable
fun PaperStack(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit = {},
) {
    Box(
        modifier = modifier.size(width = 320.dp, height = 384.dp),
        contentAlignment = Alignment.Center,
    ) {
        // Back sheet — rotated -3°, muted fill.
        PaperSheet(
            tone = PaperSheetTone.Muted,
            modifier =
                Modifier
                    .offset(x = (-10).dp, y = 6.dp)
                    .rotate(-3f),
        )
        // Middle sheet — rotated +1°, muted fill.
        PaperSheet(
            tone = PaperSheetTone.Muted,
            modifier =
                Modifier
                    .offset(x = 10.dp, y = 3.dp)
                    .rotate(1f),
        )
        // Front sheet — rotated -1°, paper-white, with caller content.
        PaperSheet(
            tone = PaperSheetTone.Paper,
            modifier = Modifier.rotate(-1f),
            overlay = content,
        )
    }
}

private enum class PaperSheetTone { Paper, Muted }

@Composable
private fun PaperSheet(
    tone: PaperSheetTone,
    modifier: Modifier = Modifier,
    overlay: @Composable () -> Unit = {},
) {
    val background =
        when (tone) {
            PaperSheetTone.Paper -> PantopusColors.appSurface
            PaperSheetTone.Muted -> PantopusColors.appSurfaceSunken
        }
    val shadowAlpha = if (tone == PaperSheetTone.Paper) 0.14f else 0.08f
    val shadowElev = if (tone == PaperSheetTone.Paper) 8.dp else 4.dp

    Box(
        modifier =
            modifier
                .size(width = 280.dp, height = 360.dp)
                .shadow(
                    elevation = shadowElev,
                    shape = RoundedCornerShape(Radii.xs),
                    ambientColor = Color.Black.copy(alpha = shadowAlpha),
                    spotColor = Color.Black.copy(alpha = shadowAlpha),
                ).clip(RoundedCornerShape(Radii.xs))
                .background(background)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.xs)),
    ) {
        ShimLines(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(Spacing.s4),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(Spacing.s4),
        ) {
            overlay()
        }
    }
}

/**
 * Six shim-lines as content preview — alternating dark heading (5 dp)
 * and light body (3 dp) — matches the design's letterhead shimmer.
 */
@Composable
private fun ShimLines(modifier: Modifier = Modifier) {
    val widths = listOf(0.38f, 0.62f, 0.55f, 0.42f, 0.74f, 0.68f)
    val isHeading = listOf(true, false, false, true, false, false)
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        widths.forEachIndexed { index, fraction ->
            val heading = isHeading[index]
            val barHeight = if (heading) 5.dp else 3.dp
            val color =
                if (heading) {
                    PantopusColors.appTextStrong.copy(alpha = 0.85f)
                } else {
                    PantopusColors.appBorderStrong
                }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(fraction)
                        .height(barHeight)
                        .clip(RoundedCornerShape(2.dp))
                        .background(color),
            )
            if (index == 2) {
                Box(modifier = Modifier.height(Spacing.s1).fillMaxWidth())
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 480, backgroundColor = 0xFFF6F7F9)
@Composable
private fun PaperStackPreview() {
    Box(
        modifier =
            Modifier
                .size(width = 360.dp, height = 480.dp)
                .padding(Spacing.s4),
        contentAlignment = Alignment.Center,
    ) {
        PaperStack {
            Column(
                modifier = Modifier.wrapContentSize(Alignment.TopStart),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "MERIDIAN WEALTH",
                    color = PantopusColors.appText,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = "Q1 2026 Statement",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 9.sp,
                )
                Box(modifier = Modifier.width(Spacing.s1).height(Spacing.s1))
            }
        }
    }
}
