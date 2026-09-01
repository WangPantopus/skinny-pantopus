@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "FunctionNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Donut progress indicator — a track ring, an accent arc trimmed to
 * [progress], and an optional center [label] / [sublabel]. The Compose
 * mirror of iOS `Core/Design/Components/ProgressRing.swift`; same parameter
 * names so call sites read identically across platforms.
 *
 * Built first for the A10.11 Earn weekly-goal donut, but deliberately generic.
 *
 * Perf: two arc strokes + a text stack — a trivial draw well inside
 * `docs/perf_budgets.md`. The primitive is static; callers animate by changing
 * [progress] (and must gate that behind reduce-motion). Snapshots pass a fixed
 * value.
 *
 * @param progress Completion in 0..1 (clamped).
 * @param diameter Outer diameter; defaults to 72dp.
 * @param lineWidth Ring stroke width; defaults to 8dp.
 * @param tint Accent-arc color; defaults to [PantopusColors.primary600].
 * @param trackColor Unfilled-track color; defaults to
 *   [PantopusColors.appSurfaceSunken].
 * @param label Center headline (e.g. "74%").
 * @param sublabel Center caption under [label] (e.g. "to goal").
 * @param contentDescription Overrides the derived accessibility string.
 */
@Composable
fun ProgressRing(
    progress: Float,
    modifier: Modifier = Modifier,
    diameter: Dp = 72.dp,
    lineWidth: Dp = 8.dp,
    tint: Color = PantopusColors.primary600,
    trackColor: Color = PantopusColors.appSurfaceSunken,
    label: String? = null,
    sublabel: String? = null,
    contentDescription: String? = null,
) {
    val clamped = progress.coerceIn(0f, 1f)
    val a11y = contentDescription ?: derivedDescription(clamped, label, sublabel)

    Box(
        modifier =
            modifier
                .testTag("progressRing")
                .size(diameter)
                .semantics { this.contentDescription = a11y }
                .drawBehind {
                    val stroke = lineWidth.toPx()
                    val inset = stroke / 2f
                    val arcSize = Size(size.width - stroke, size.height - stroke)
                    val topLeft = Offset(inset, inset)
                    drawArc(
                        color = trackColor,
                        startAngle = 0f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = stroke),
                    )
                    drawArc(
                        color = tint,
                        startAngle = -90f,
                        sweepAngle = clamped * 360f,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                },
        contentAlignment = Alignment.Center,
    ) {
        if (label != null || sublabel != null) {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s1),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                label?.let {
                    Text(
                        text = it,
                        color = PantopusColors.appText,
                        fontSize = max(13f, diameter.value * 0.24f).sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.3).sp,
                        textAlign = TextAlign.Center,
                    )
                }
                sublabel?.let {
                    Text(
                        text = it.uppercase(),
                        color = PantopusColors.appTextSecondary,
                        fontSize = max(8f, diameter.value * 0.11f).sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

private fun derivedDescription(
    progress: Float,
    label: String?,
    sublabel: String?,
): String {
    val pct = (progress * 100).roundToInt()
    return if (label != null && sublabel != null) {
        "$label $sublabel, $pct percent"
    } else {
        "$pct percent complete"
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 160, backgroundColor = 0xFFF6F7F9)
@Composable
private fun ProgressRingPreview() {
    Row(
        modifier = Modifier.padding(Spacing.s5),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        ProgressRing(progress = 0f, label = "0%", sublabel = "to goal")
        ProgressRing(progress = 0.66f, tint = PantopusColors.success, label = "66%", sublabel = "to goal")
        ProgressRing(progress = 1f, tint = PantopusColors.success, label = "Done", sublabel = "this week")
    }
}
