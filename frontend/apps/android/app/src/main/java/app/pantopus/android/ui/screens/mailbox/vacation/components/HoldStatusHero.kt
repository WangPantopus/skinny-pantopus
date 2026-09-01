@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.vacation.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.vacation.VacationHoldSampleData
import app.pantopus.android.ui.screens.mailbox.vacation.VacationHoldStat
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A14.8 — sky-gradient status card for the active variant of the
 * Vacation Hold screen. Renders the "Hold active" pulsing-dot pill,
 * the "until <date>" mono caption, a huge days-left readout, and a
 * 3-cell stats grid (packages / mail / forwarded).
 *
 * Mirrors `Features/Mailbox/Vacation/Components/HoldStatusHero.swift`.
 */
@Composable
fun HoldStatusHero(
    daysLeft: Int,
    untilLabel: String,
    stats: List<VacationHoldStat>,
    modifier: Modifier = Modifier,
    reduceMotionOverride: Boolean? = null,
) {
    val reduceMotion = reduceMotionOverride ?: false
    val gradient =
        Brush.linearGradient(
            colorStops =
                arrayOf(
                    0f to PantopusColors.primary600,
                    1f to PantopusColors.primary800,
                ),
            start = androidx.compose.ui.geometry.Offset(0.18f, 0f),
            end = androidx.compose.ui.geometry.Offset(0.82f, Float.POSITIVE_INFINITY),
        )

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(gradient)
                .padding(horizontal = 18.dp)
                .padding(top = Spacing.s4, bottom = 14.dp)
                .testTag("vacationHoldStatusHero")
                .semantics {
                    contentDescription =
                        "Vacation hold active, $daysLeft days left until $untilLabel"
                },
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        HeaderRow(untilLabel = untilLabel, reduceMotion = reduceMotion)
        DaysRow(daysLeft = daysLeft)
        Spacer(modifier = Modifier.height(10.dp))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color.White.copy(alpha = 0.18f)),
        )
        Spacer(modifier = Modifier.height(Spacing.s3))
        StatsGrid(stats = stats)
    }
}

@Composable
private fun HeaderRow(
    untilLabel: String,
    reduceMotion: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        ActivePill(reduceMotion = reduceMotion)
        Text(
            text = "until $untilLabel",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
private fun ActivePill(reduceMotion: Boolean) {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.18f))
                .padding(start = 7.dp, end = 9.dp, top = 3.dp, bottom = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PulsingDot(reduceMotion = reduceMotion)
        Text(
            text = "HOLD ACTIVE",
            color = Color.White,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
        )
    }
}

@Composable
private fun PulsingDot(reduceMotion: Boolean) {
    Box(modifier = Modifier.size(12.dp), contentAlignment = Alignment.Center) {
        val haloScale = remember { Animatable(0.9f) }
        val haloAlpha = remember { Animatable(0.7f) }

        if (!reduceMotion) {
            LaunchedEffect(Unit) {
                haloScale.animateTo(
                    targetValue = 1.25f,
                    animationSpec =
                        infiniteRepeatable(
                            animation = tween(durationMillis = 1400, easing = LinearEasing),
                            repeatMode = RepeatMode.Restart,
                        ),
                )
            }
            LaunchedEffect(Unit) {
                haloAlpha.animateTo(
                    targetValue = 0f,
                    animationSpec =
                        infiniteRepeatable(
                            animation = tween(durationMillis = 1400, easing = LinearEasing),
                            repeatMode = RepeatMode.Restart,
                        ),
                )
            }
        }

        Box(
            modifier =
                Modifier
                    .size(12.dp)
                    .scale(if (reduceMotion) 1f else haloScale.value)
                    .background(
                        PantopusColors.primary300.copy(alpha = if (reduceMotion) 1f else haloAlpha.value * 0.3f),
                        CircleShape,
                    ),
        )
        Box(
            modifier =
                Modifier
                    .size(6.dp)
                    .background(PantopusColors.primary300, CircleShape),
        )
    }
}

@Composable
private fun DaysRow(daysLeft: Int) {
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "$daysLeft",
            color = Color.White,
            fontSize = 32.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = (-0.5).sp,
        )
        Text(
            modifier = Modifier.padding(bottom = 4.dp),
            text = "days left",
            color = Color.White.copy(alpha = 0.75f),
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun StatsGrid(stats: List<VacationHoldStat>) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        stats.forEach { stat ->
            StatCell(
                stat = stat,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun StatCell(
    stat: VacationHoldStat,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier.semantics {
                contentDescription = "${stat.count} ${stat.label}"
            },
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        Text(
            text = "${stat.count}",
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.3).sp,
        )
        Text(
            text = stat.label.uppercase(),
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
        )
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 220)
@Composable
private fun HoldStatusHeroPreview() {
    Box(
        modifier =
            Modifier
                .padding(Spacing.s3)
                .background(PantopusColors.appBg),
    ) {
        HoldStatusHero(
            daysLeft = 5,
            untilLabel = "Dec 12",
            stats = VacationHoldSampleData.activeHold.stats,
            reduceMotionOverride = true,
        )
    }
}
