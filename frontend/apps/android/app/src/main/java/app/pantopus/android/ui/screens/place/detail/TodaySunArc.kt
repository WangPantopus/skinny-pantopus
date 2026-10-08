@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.SkyPalette
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/*
 * The Sun card as the sun's path: a dashed arc from sunrise to sunset with
 * the sun where it is now (it travels there when the card appears), the
 * stretch it has covered drawn in warm light, and at night the moon in its
 * real phase. The times and daylight read as before, plus how long until
 * the next sunrise or sunset. Parity twin of iOS `TodaySunArc.swift`.
 */

@Composable
fun TodaySunArcCard(data: PlaceSunriseSunsetData) {
    val moment = SkyMoment.at(rememberMinuteClock(), data.sunrise, data.sunset)
    val up = moment.minutes >= moment.sunrise && moment.minutes <= moment.sunset
    val target =
        when {
            up -> moment.dayFraction
            moment.minutes < moment.sunrise -> 0.0
            else -> 1.0
        }
    val reduced = rememberMotionReduced()
    val travelled = remember { Animatable(0f) }
    LaunchedEffect(target, reduced) {
        if (reduced) {
            travelled.snapTo(target.toFloat())
        } else {
            travelled.animateTo(target.toFloat(), spring(dampingRatio = 0.85f, stiffness = Spring.StiffnessVeryLow))
        }
    }
    val minutesLeft =
        when {
            up -> moment.sunset - moment.minutes
            moment.minutes < moment.sunrise -> moment.sunrise - moment.minutes
            else -> moment.sunrise + 1440 - moment.minutes
        }
    val whole = minutesLeft.roundToInt().coerceAtLeast(1)
    val span = if (whole >= 60) "${whole / 60}h ${whole % 60}m" else "${whole}m"
    val next = if (up) "Sunset in $span" else "Sunrise in $span"
    val daylight = "${data.daylightMinutes / 60}h ${data.daylightMinutes % 60}m"
    val spoken =
        "Sunrise ${clock(moment.sunrise)}, sunset ${clock(moment.sunset)}, ${data.daylightMinutes / 60} hours " +
            "${data.daylightMinutes % 60} minutes of daylight. $next."
    PlaceDetailCard(
        modifier = Modifier.testTag("todaySunArc").clearAndSetSemantics { contentDescription = spoken },
        padding = 16.dp,
    ) {
        SunArcDial(travelled.value, up, moment.moonPhase, daylight)
        Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.Top) {
            SunTime(PantopusIcon.Sunrise, "Sunrise", clock(moment.sunrise), Alignment.Start)
            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Text(
                    next,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.warning,
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(PantopusColors.warningBg)
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
            SunTime(PantopusIcon.Sunset, "Sunset", clock(moment.sunset), Alignment.End)
        }
    }
}

/** The dashed path, the stretch the sun has covered, the sun (or the moon by night) and the daylight in the middle. */
@Composable
private fun SunArcDial(
    travelled: Float,
    up: Boolean,
    moonPhase: Double,
    daylight: String,
) {
    Box(modifier = Modifier.fillMaxWidth().height(104.dp)) {
        val muted = PantopusColors.appTextMuted
        Canvas(modifier = Modifier.fillMaxSize()) {
            arcPath(1f)?.let {
                drawPath(it, PantopusColors.appBorder, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, pathEffect = dashes()))
            }
            arcPath(travelled)?.let {
                drawPath(
                    it,
                    Brush.horizontalGradient(listOf(SkyPalette.sunLow, SkyPalette.sunHigh)),
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
                )
            }
            val horizon = size.height - 12.dp.toPx()
            drawLine(PantopusColors.appBorder, Offset(8.dp.toPx(), horizon), Offset(size.width - 8.dp.toPx(), horizon), 1.dp.toPx())
            if (!up) {
                val moonCenter = Offset(size.width - 47.dp.toPx(), 11.dp.toPx())
                drawCircle(muted.copy(alpha = 0.18f), 9.dp.toPx(), moonCenter)
                drawPath(TodaySkyPainter.moonPath(moonCenter, 9.dp.toPx(), moonPhase), PantopusColors.appTextSecondary)
            }
            val sun = arcPoint(travelled)
            if (up) drawCircle(SkyPalette.sunLow.copy(alpha = 0.35f), 13.dp.toPx(), sun)
            drawCircle(if (up) SkyPalette.sunHigh else muted, 8.dp.toPx(), sun)
            drawCircle(PantopusColors.appSurface, 8.dp.toPx(), sun, style = Stroke(width = 2.dp.toPx()))
        }
        Column(
            modifier = Modifier.align(Alignment.Center).padding(top = 34.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(daylight, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text("of daylight", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
        }
    }
}

/** True when animations are removed in the system settings or battery saver is on. */
@Composable
fun rememberMotionReduced(): Boolean {
    val context = LocalContext.current
    val scale =
        android.provider.Settings.Global.getFloat(
            context.contentResolver,
            android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        )
    val power = context.getSystemService(android.content.Context.POWER_SERVICE) as? android.os.PowerManager
    return scale == 0f || power?.isPowerSaveMode == true
}

@Composable
private fun SunTime(
    icon: PantopusIcon,
    label: String,
    time: String,
    alignment: Alignment.Horizontal,
) {
    Column(horizontalAlignment = alignment, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            PantopusIconImage(icon, null, size = 15.dp, strokeWidth = 2f, tint = PantopusColors.warning)
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
        }
        Text(time, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
    }
}

private fun clock(minutes: Double): String =
    LocalTime
        .ofSecondOfDay((minutes * 60).toLong().coerceIn(0L, 86_399L))
        .format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))

private fun DrawScope.dashes() = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 5.dp.toPx()))

/** The arc spans the card: horizon 12 dp above the bottom, peak 14 dp from the top. */
private fun DrawScope.arcPoint(fraction: Float): Offset {
    val theta = PI * (1 - fraction.coerceIn(0f, 1f))
    val horizon = size.height - 12.dp.toPx()
    val rx = size.width / 2 - 26.dp.toPx()
    val ry = horizon - 14.dp.toPx()
    return Offset((size.width / 2 + rx * cos(theta)).toFloat(), (horizon - ry * sin(theta)).toFloat())
}

private fun DrawScope.arcPath(progress: Float): Path? {
    if (progress <= 0f) return null
    val steps = (60 * progress.coerceIn(0f, 1f)).toInt().coerceAtLeast(1)
    val path = Path()
    for (step in 0..steps) {
        val point = arcPoint(progress * step / steps)
        if (step == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y)
    }
    return path
}
