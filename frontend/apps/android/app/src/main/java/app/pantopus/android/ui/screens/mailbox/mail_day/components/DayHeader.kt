@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mail_day.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.16 — Mail Day header card. 56dp ProgressRing on the left; date +
 * streak chip + per-state meta line on the right. Switches the meta
 * text from "2 still need a call · 6 routed" to "All 8 routed. Ready
 * to close out." when the day is complete.
 */
@Composable
fun DayHeader(
    dateLabel: String,
    streakDays: Int,
    done: Int,
    total: Int,
    modifier: Modifier = Modifier,
) {
    val remaining = total - done
    val accessibilityMeta =
        if (remaining > 0) {
            "$remaining pending, $done routed of $total"
        } else {
            "All $done routed, ready to close"
        }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            modifier
                .fillMaxWidth()
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface, shape = RoundedCornerShape(Radii.lg))
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                .padding(14.dp)
                .testTag("mailDayHeader")
                .semantics(mergeDescendants = true) {
                    contentDescription = "$dateLabel. Day $streakDays streak. $accessibilityMeta."
                },
    ) {
        ProgressRing(done = done, total = total)
        Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = dateLabel,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                StreakChip(days = streakDays)
            }
            MetaLine(done = done, remaining = remaining)
        }
    }
}

@Composable
private fun ProgressRing(
    done: Int,
    total: Int,
) {
    val fraction = if (total > 0) done.toFloat() / total else 0f
    val isComplete = total > 0 && done >= total
    val ringColor = if (isComplete) PantopusColors.success else PantopusColors.primary600

    Box(modifier = Modifier.size(56.dp), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(56.dp)) {
            val stroke = 4.dp.toPx()
            val arcSize = Size(size.width - stroke, size.height - stroke)
            val arcTopLeft = Offset(stroke / 2, stroke / 2)
            // base ring
            drawArc(
                color = PantopusColors.appSurfaceSunken,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = arcTopLeft,
                size = arcSize,
                style = Stroke(width = stroke),
            )
            // progress sweep
            drawArc(
                color = ringColor,
                startAngle = -90f,
                sweepAngle = fraction * 360f,
                useCenter = false,
                topLeft = arcTopLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = "$done",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "/$total",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun StreakChip(days: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        modifier =
            Modifier
                .background(PantopusColors.warmAmberBg, shape = CircleShape)
                .padding(horizontal = 7.dp, vertical = 1.5.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Flame,
            contentDescription = null,
            size = 9.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.warmAmber,
        )
        Text(
            text = "Day $days",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.2.sp,
            color = PantopusColors.warmAmber,
        )
    }
}

@Composable
private fun MetaLine(
    done: Int,
    remaining: Int,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (remaining > 0) {
            Text(
                text = "$remaining",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "still need a call ·",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "$done",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.success,
            )
            Text(
                text = "routed",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        } else {
            Text(
                text = "All",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "$done",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
            )
            Text(
                text = "routed. Ready to close out.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}
