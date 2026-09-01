@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.roundToInt

/**
 * A14.7 Privacy — the "Map location fuzz" card body: a lead-in line, a
 * five-stop stepped slider (white thumb, primary fill, tick dots), the
 * stop labels, and the live [FuzzMap] preview (P1.3) that grows its
 * concentric ring as the slider drags. The five stops are the
 * [FuzzStop] cases. Mirror of the iOS `LocationFuzzSlider`.
 */
@Composable
fun LocationFuzzSlider(
    leadIn: String,
    stop: FuzzStop,
    onChange: (FuzzStop) -> Unit,
    modifier: Modifier = Modifier,
) {
    val stops = listOf(FuzzStop.Exact, FuzzStop.Block, FuzzStop.QuarterMile, FuzzStop.HalfMile, FuzzStop.Neighborhood)
    val index = stops.indexOf(stop).coerceAtLeast(0)

    Column(modifier = modifier.fillMaxWidth().testTag("locationFuzzSlider")) {
        Text(
            text = leadIn,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
            lineHeight = 18.sp,
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, top = 14.dp, bottom = Spacing.s1),
        )

        Column(modifier = Modifier.padding(start = Spacing.s5, end = Spacing.s5, top = 14.dp, bottom = 18.dp)) {
            FuzzTrack(stops = stops, index = index, currentStop = stop, onChange = onChange)
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2)) {
                stops.forEachIndexed { i, fuzzStop ->
                    Text(
                        text = fuzzStop.label,
                        fontSize = 10.5.sp,
                        fontWeight = if (i == index) FontWeight.Bold else FontWeight.Medium,
                        color = if (i == index) PantopusColors.appText else PantopusColors.appTextMuted,
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .padding(start = Spacing.s4)
                    .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
        )

        Box(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            FuzzMap(stop = stop)
        }
    }
}

@Composable
private fun FuzzTrack(
    stops: List<FuzzStop>,
    index: Int,
    currentStop: FuzzStop,
    onChange: (FuzzStop) -> Unit,
) {
    val count = stops.size
    val activeFraction = if (count > 1) index.toFloat() / (count - 1) else 0f
    var widthPx by remember { mutableFloatStateOf(0f) }
    val updatedStop by rememberUpdatedState(currentStop)
    val updatedOnChange by rememberUpdatedState(onChange)

    fun resolve(x: Float) {
        if (widthPx <= 0f || count <= 1) return
        val fraction = (x / widthPx).coerceIn(0f, 1f)
        val newStop = stops[(fraction * (count - 1)).roundToInt()]
        if (newStop != updatedStop) updatedOnChange(newStop)
    }

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(24.dp)
                .onGloballyPositioned { widthPx = it.size.width.toFloat() }
                .pointerInput(Unit) { detectTapGestures { resolve(it.x) } }
                .pointerInput(Unit) { detectDragGestures { change, _ -> resolve(change.position.x) } },
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .align(Alignment.CenterStart)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appBorder),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(activeFraction)
                    .height(4.dp)
                    .align(Alignment.CenterStart)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600),
        )
        stops.forEachIndexed { i, _ ->
            val fraction = if (count > 1) i.toFloat() / (count - 1) else 0f
            val filled = i <= index
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .offset { IntOffset((widthPx * fraction - 3.dp.toPx()).roundToInt(), 0) }
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(if (filled) PantopusColors.appSurface else PantopusColors.appBorderStrong)
                        .then(
                            if (filled) {
                                Modifier.border(1.5.dp, PantopusColors.primary600, CircleShape)
                            } else {
                                Modifier
                            },
                        ),
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .offset { IntOffset((widthPx * activeFraction - 12.dp.toPx()).roundToInt(), 0) }
                    .size(24.dp)
                    .shadow(2.dp, CircleShape)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(2.dp, PantopusColors.primary600, CircleShape),
        )
    }
}
