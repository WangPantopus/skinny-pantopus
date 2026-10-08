@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
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
import kotlin.math.min
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
                // Grows with large fonts instead of clipping the reading; the ground stays at the bottom.
                .heightIn(min = 188.dp)
                .shadow(elevation = 10.dp, shape = shape, ambientColor = sky.mid, spotColor = sky.mid)
                .clip(shape)
                // A hairline edge keeps a night sky from melting into a dark page.
                .border(1.dp, SkyPalette.white.copy(alpha = 0.1f), shape)
                .onGloballyPositioned {
                    val bounds = it.boundsInWindow()
                    onScreen = bounds.bottom > 0f && bounds.top < screenHeight
                }.testTag("todaySkyHero"),
    ) {
        Canvas(modifier = Modifier.matchParentSize().clearAndSetSemantics { }) {
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
    // High/low and feels-like, each in a dark glass chip: they sit near the bright horizon, where
    // white text alone can't keep 4.5:1 on a light sky.
    val chips =
        listOfNotNull(
            if (data.highF != null && data.lowF != null) "H ${data.highF.roundToInt()}° · L ${data.lowF.roundToInt()}°" else null,
            data.feelsLikeF?.let { "Feels like ${it.roundToInt()}°" },
        )
    val spokenRange =
        listOfNotNull(
            if (data.highF != null && data.lowF != null) "High ${data.highF.roundToInt()}°, low ${data.lowF.roundToInt()}°" else null,
            data.feelsLikeF?.let { "feels like ${it.roundToInt()}°" },
        ).joinToString(", ")
    // The numeral is a picture of the reading: it grows a little with the font size, not without bound.
    val fontScale = LocalDensity.current.fontScale
    val numeral = min(fontScale, 1.3f) / fontScale
    val shadow = TextStyle(shadow = Shadow(SkyPalette.black.copy(alpha = 0.28f), Offset(0f, 2f), 6f))
    Column(modifier = Modifier.padding(start = 18.dp, top = 14.dp, end = 110.dp, bottom = 36.dp)) {
        Column(modifier = Modifier.clearAndSetSemantics { contentDescription = nowLabel }) {
            // 14 sp bold (large text) in full white: it sits over the cloud deck on grey days.
            Text(
                "NOW",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.9.sp,
                color = SkyPalette.white,
                style = shadow,
            )
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    "$temp",
                    fontSize = (64 * numeral).sp,
                    lineHeight = (70 * numeral).sp,
                    fontWeight = FontWeight.Light,
                    letterSpacing = (-2).sp,
                    color = SkyPalette.white,
                    style = shadow,
                )
                Text(
                    "°",
                    fontSize = (34 * numeral).sp,
                    fontWeight = FontWeight.Light,
                    color = SkyPalette.white,
                    style = shadow,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (data.conditionLabel.isNotEmpty()) {
                // 18 sp: large text, so 3:1 over the sky is enough (every scene clears it).
                Text(
                    data.conditionLabel,
                    fontSize = 18.sp,
                    lineHeight = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SkyPalette.white,
                    style = shadow,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.offset(y = (-4).dp),
                )
            }
        }
        if (chips.isNotEmpty()) SkyChips(chips, spokenRange)
    }
}

/** High/low and feels-like in dark glass chips; they wrap onto a second line rather than truncate. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SkyChips(
    chips: List<String>,
    spoken: String,
) {
    FlowRow(
        modifier = Modifier.padding(top = 2.dp).clearAndSetSemantics { contentDescription = spoken },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        chips.forEach { chip ->
            Text(
                chip,
                fontSize = 13.sp,
                lineHeight = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = SkyPalette.white,
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(SkyPalette.scrim.copy(alpha = 0.45f))
                        .padding(horizontal = 9.dp, vertical = 4.dp),
            )
        }
    }
}
