@file:Suppress("MagicNumber", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Tone variant for [DateSpan] — picks the dashed line + pill accent. */
enum class DateSpanTone(
    val accent: Color,
    val soft: Color,
) {
    Info(PantopusColors.primary600, PantopusColors.primary50),
    Success(PantopusColors.success, PantopusColors.successBg),
    Warning(PantopusColors.warning, PantopusColors.warningBg),
}

/**
 * Mini-timeline strip rendered between two date pickers on A14.8
 * Vacation Hold. Mirrors `Core/Design/Components/DateSpan.swift`.
 *
 * @param days Duration shown in the centred pill.
 * @param fromWeekday Short weekday abbreviation under the leading anchor
 *     ("MON"). Caller-uppercased — the composable uppercases again so
 *     mixed-case input still renders correctly.
 * @param toWeekday Short weekday abbreviation under the trailing anchor.
 * @param tone Colour variant. Defaults to [DateSpanTone.Info].
 */
@Composable
fun DateSpan(
    days: Int,
    fromWeekday: String,
    toWeekday: String,
    modifier: Modifier = Modifier,
    tone: DateSpanTone = DateSpanTone.Info,
) {
    Column(
        modifier =
            modifier
                .testTag("dateSpan")
                .semantics {
                    contentDescription = "Span: $days days, $fromWeekday to $toWeekday"
                },
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        TimelineRow(days = days, tone = tone)
        WeekdayRow(fromWeekday = fromWeekday, toWeekday = toWeekday)
    }
}

private val StripHeight: Dp = 28.dp
private val AnchorDiameter: Dp = 10.dp
private val LineHeight: Dp = 4.dp
private val EdgeInset: Dp = 12.dp

@Composable
private fun TimelineRow(
    days: Int,
    tone: DateSpanTone,
) {
    Box(
        modifier = Modifier.fillMaxWidth().height(StripHeight),
        contentAlignment = Alignment.Center,
    ) {
        // Soft underlay line.
        Box(
            modifier =
                Modifier
                    .padding(horizontal = EdgeInset)
                    .fillMaxWidth()
                    .height(LineHeight)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(tone.soft),
        )

        // Dashed accent line.
        Box(
            modifier =
                Modifier
                    .padding(horizontal = EdgeInset)
                    .fillMaxWidth()
                    .height(LineHeight)
                    .drawBehind {
                        val mid = size.height / 2f
                        drawLine(
                            color = tone.accent,
                            start = Offset(0f, mid),
                            end = Offset(size.width, mid),
                            strokeWidth = LineHeight.toPx(),
                            cap = StrokeCap.Round,
                            pathEffect =
                                PathEffect.dashPathEffect(
                                    intervals = floatArrayOf(6.dp.toPx(), 4.dp.toPx()),
                                    phase = 0f,
                                ),
                        )
                    },
        )

        // Anchors.
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Anchor(tone = tone)
            Anchor(tone = tone)
        }

        // Duration pill.
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, tone.accent, RoundedCornerShape(Radii.pill))
                    .padding(horizontal = Spacing.s2, vertical = 2.dp),
        ) {
            Text(
                text = "$days days",
                color = tone.accent,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun Anchor(tone: DateSpanTone) {
    Box(
        modifier =
            Modifier
                .size(AnchorDiameter)
                .clip(RoundedCornerShape(Radii.pill))
                .background(tone.accent)
                .border(2.dp, PantopusColors.appSurface, RoundedCornerShape(Radii.pill)),
    )
}

@Composable
private fun WeekdayRow(
    fromWeekday: String,
    toWeekday: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = fromWeekday.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 0.6.sp,
        )
        Text(
            text = toWeekday.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 0.6.sp,
        )
    }
}

// MARK: - Preview

@Preview(showBackground = true, widthDp = 320, heightDp = 240)
@Composable
private fun DateSpanPreview() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        DateSpan(days = 13, fromWeekday = "MON", toWeekday = "WED", tone = DateSpanTone.Info)
        DateSpan(days = 7, fromWeekday = "FRI", toWeekday = "THU", tone = DateSpanTone.Success)
        DateSpan(days = 30, fromWeekday = "TUE", toWeekday = "WED", tone = DateSpanTone.Warning)
    }
}
