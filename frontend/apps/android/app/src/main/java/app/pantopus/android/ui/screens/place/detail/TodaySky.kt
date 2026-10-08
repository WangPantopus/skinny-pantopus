@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.ui.theme.SkyPalette
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.roundToInt

/*
 * The Today tab's "Now" card as a living sky over the resident's house:
 * the sky, the sun or the moon (in its real phase), clouds, rain, snow,
 * fog, wind and storms follow the reported weather and the time of day at
 * this address. The numbers sit on top, read exactly as before.
 *
 * Motion is decoration, so it stops when animations are removed in the
 * system settings, in battery saver, while the app is in the background
 * and while the card is scrolled away; the still picture is the same
 * scene. Parity twin of iOS `TodaySky.swift`.
 */

/** The "Now" reading drawn over the living sky. */
@Composable
fun TodaySkyHero(
    data: PlaceWeatherData,
    sun: PlaceSunriseSunsetData?,
) {
    val reduced = rememberMotionReduced()
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val screenHeight = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    var onScreen by remember { mutableStateOf(true) }
    val animating = !reduced && lifecycle.isAtLeast(Lifecycle.State.RESUMED) && onScreen
    val time = rememberSkyTime(animating)
    val moment = SkyMoment.at(rememberMinuteClock(), sun?.sunrise, sun?.sunset)
    val sky = SkyPalette.sky(moment.phase, skyWeather(data.conditionCode))
    val painter = TodaySkyPainter(data.conditionCode, moment, cold = data.currentTempF < 50, still = !animating)
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(188.dp)
                .shadow(elevation = 10.dp, shape = shape, ambientColor = sky.mid, spotColor = sky.mid)
                .clip(shape)
                // A hairline edge keeps a night sky from melting into a dark page.
                .border(1.dp, SkyPalette.white.copy(alpha = 0.1f), shape)
                .onGloballyPositioned {
                    val bounds = it.boundsInWindow()
                    onScreen = bounds.bottom > 0f && bounds.top < screenHeight
                }.testTag("todaySkyHero"),
    ) {
        Canvas(modifier = Modifier.fillMaxSize().clearAndSetSemantics { }) {
            val t = time.doubleValue
            val perDp = density
            withTransform({ scale(perDp, perDp, pivot = Offset.Zero) }) {
                painter.paint(this, size.width / perDp, size.height / perDp, t)
            }
        }
        SkyReading(data)
    }
}

/** Seconds of the day, advanced at about 30 frames a second while [animating]. */
@Composable
private fun rememberSkyTime(animating: Boolean): androidx.compose.runtime.MutableDoubleState {
    val time = remember { mutableDoubleStateOf(2.0) }
    LaunchedEffect(animating) {
        while (animating && isActive) {
            time.doubleValue = (System.currentTimeMillis() % 86_400_000L) / 1000.0
            delay(33L)
        }
    }
    return time
}

@Composable
private fun SkyReading(data: PlaceWeatherData) {
    val temp = data.currentTempF.roundToInt()
    val nowLabel = if (data.conditionLabel.isEmpty()) "Now, $temp°" else "Now, $temp°, ${data.conditionLabel}"
    val range =
        listOfNotNull(
            if (data.highF != null && data.lowF != null) "H ${data.highF.roundToInt()}° · L ${data.lowF.roundToInt()}°" else null,
            data.feelsLikeF?.let { "Feels like ${it.roundToInt()}°" },
        ).joinToString(" · ")
    val spokenRange =
        listOfNotNull(
            if (data.highF != null && data.lowF != null) "High ${data.highF.roundToInt()}°, low ${data.lowF.roundToInt()}°" else null,
            data.feelsLikeF?.let { "feels like ${it.roundToInt()}°" },
        ).joinToString(", ")
    val shadow = TextStyle(shadow = Shadow(SkyPalette.black.copy(alpha = 0.28f), Offset(0f, 2f), 6f))
    Column(modifier = Modifier.padding(start = 18.dp, top = 14.dp, end = 120.dp)) {
        Column(modifier = Modifier.clearAndSetSemantics { contentDescription = nowLabel }) {
            Text(
                "NOW",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.9.sp,
                color = SkyPalette.white.copy(alpha = 0.86f),
                style = shadow,
            )
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    "$temp",
                    fontSize = 64.sp,
                    lineHeight = 70.sp,
                    fontWeight = FontWeight.Light,
                    letterSpacing = (-2).sp,
                    color = SkyPalette.white,
                    style = shadow,
                )
                Text(
                    "°",
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Light,
                    color = SkyPalette.white,
                    style = shadow,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (data.conditionLabel.isNotEmpty()) {
                Text(
                    data.conditionLabel,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SkyPalette.white,
                    style = shadow,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.offset(y = (-4).dp),
                )
            }
        }
        if (range.isNotEmpty()) {
            Text(
                range,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                color = SkyPalette.white.copy(alpha = 0.9f),
                style = shadow,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.clearAndSetSemantics { contentDescription = spokenRange },
            )
        }
    }
}
