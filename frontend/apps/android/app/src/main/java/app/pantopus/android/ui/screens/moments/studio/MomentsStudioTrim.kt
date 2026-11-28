@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.moments.MomentLimits
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.moments.MomentVideoPart
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * "Pulse, reinvented"'s Studio, PHASE-5 A ("a video also has trim"): the part of a video that posts, picked on its first
 * screen with two handles. Today's export cuts it (as it cuts a long video into parts); with nothing trimmed the video
 * posts as today.
 */

/** The shortest a trimmed video may be. */
private const val SHORTEST_MS = 1_000L

/** A handle's step for TalkBack. */
private const val STEP_MS = 1_000L

/** How [range] of a video posts: as one Moment while it fits one, else in parts (as [MomentMedia.parts]), from its start. */
internal fun studioTrimmedParts(
    range: LongRange,
    limits: MomentLimits,
): List<MomentVideoPart> =
    MomentMedia.parts(range.last - range.first, limits).map { it.copy(startMs = it.startMs + range.first, endMs = it.endMs + range.first) }

/** The part [range] of a video [durationMs] long, kept at least [SHORTEST_MS]; null when it is all of it. */
private fun keptTrim(
    range: LongRange,
    durationMs: Long,
): LongRange? {
    val start = range.first.coerceIn(0L, (durationMs - SHORTEST_MS).coerceAtLeast(0L))
    val end = range.last.coerceIn(start + SHORTEST_MS, durationMs.coerceAtLeast(start + SHORTEST_MS))
    return (start..end).takeUnless { start == 0L && end >= durationMs }
}

private fun clock(ms: Long): String {
    val seconds = (ms / 1000).toInt()
    return "%d:%02d".format(seconds / 60, seconds % 60)
}

/** The trim bar under a video in the Studio: its whole length, the part that posts between two handles, and the times. */
@Composable
internal fun StudioTrimRow(
    state: MomentsComposeUiState,
    onTrim: (LongRange?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val video = (state.media as? MomentMediaFile.Video)?.takeIf { state.studioPair == null && it.durationMs > SHORTEST_MS } ?: return
    val duration = video.durationMs
    val posted = state.trim ?: 0L..duration
    // While a handle moves: the part under the finger; it is handed on when the finger lifts.
    var moving by remember(video.file) { mutableStateOf<LongRange?>(null) }
    val shown = moving ?: posted
    val latest by rememberUpdatedState(posted)
    val done by rememberUpdatedState(onTrim)
    val words = "Trim · ${clock(shown.first)} to ${clock(shown.last)} (${((shown.last - shown.first) / 1000.0).roundToInt()} s)"
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text = words, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        BoxWithConstraints(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .testTag("moments.studio.trim")
                    .semantics {
                        contentDescription = words
                        val step = { from: Long, to: Long ->
                            done(keptTrim(latest.first + from..latest.last + to, duration))
                            true
                        }
                        customActions =
                            listOf(
                                CustomAccessibilityAction("Start later") { step(STEP_MS, 0L) },
                                CustomAccessibilityAction("Start earlier") { step(-STEP_MS, 0L) },
                                CustomAccessibilityAction("End earlier") { step(0L, -STEP_MS) },
                                CustomAccessibilityAction("End later") { step(0L, STEP_MS) },
                            )
                    }.pointerInput(video.file) {
                        var start = true
                        detectHorizontalDragGestures(
                            onDragStart = { at ->
                                val now = latest
                                val a = now.first.toFloat() / duration * size.width
                                val b = now.last.toFloat() / duration * size.width
                                start = abs(at.x - a) <= abs(at.x - b)
                                moving = now
                            },
                            onDragEnd = {
                                moving?.let { done(keptTrim(it, duration)) }
                                moving = null
                            },
                            onDragCancel = { moving = null },
                        ) { change, amount ->
                            change.consume()
                            val now = moving ?: latest
                            val by = (amount / size.width * duration).toLong()
                            val next = if (start) now.first + by..now.last else now.first..now.last + by
                            moving = keptTrim(next, duration) ?: 0L..duration
                        }
                    },
            contentAlignment = Alignment.CenterStart,
        ) {
            TrimBar(shown, duration, constraints.maxWidth / LocalDensity.current.density)
        }
    }
}

/** The bar's drawing: the whole length, the part [shown] that posts outlined, and its two handles, [width] dp wide. */
@Composable
private fun TrimBar(
    shown: LongRange,
    duration: Long,
    width: Float,
) {
    val left = shown.first.toFloat() / duration * width
    val right = shown.last.toFloat() / duration * width
    val shape = RoundedCornerShape(8.dp)
    Box(Modifier.fillMaxWidth().height(32.dp).clip(shape).background(PantopusColors.studioPillFill))
    Box(
        Modifier
            .offset(x = left.dp)
            .width((right - left).coerceAtLeast(1f).dp)
            .height(32.dp)
            .border(2.dp, Color.White, shape),
    )
    listOf(left, right).forEach { at ->
        Box(
            Modifier
                .offset(x = (at - 3f).coerceIn(0f, width - 6f).dp)
                .width(6.dp)
                .fillMaxHeight()
                .clip(RoundedCornerShape(3.dp))
                .background(Color.White),
        )
    }
}
