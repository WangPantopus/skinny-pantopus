package app.pantopus.android.ui.screens.moments.components

import android.provider.Settings
import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlinx.coroutines.withTimeoutOrNull

/** How long a finger rests on the picture before the motion plays again with its sound. */
private const val HOLD_MS = 350L

/**
 * "Pulse, reinvented" (PHASE-5 C, CONTRACT 10b), for a reader whose switch is on: a photo Moment that kept its motion
 * plays it once, silently, as it opens, then rests on the photo; pressing and holding plays it again with its sound
 * while the finger stays. With animations turned off on the phone it doesn't play by itself (press and hold still does).
 * A small moving-photo mark says it moves, never the word "Live". The viewer's own touches (a tap, holding to pause)
 * work as before: this layer only listens.
 */
@OptIn(UnstableApi::class)
@Composable
fun MomentMotionLayer(moment: MomentDto) {
    val url = moment.motion?.url?.takeIf { moment.kind == "photo" } ?: return
    val context = LocalContext.current
    val still = remember { Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
    var playing by remember(moment.id) { mutableStateOf(false) }
    val player = rememberMotionPlayer(moment.id, url) { playing = false }
    // Once, silently, as it opens.
    LaunchedEffect(player) {
        if (!still) {
            playing = true
            player.play()
        }
    }
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("moments.viewer.motion")
                .replaysWhileHeld(player) { playing = it },
    ) {
        AndroidView(
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                }
            },
            update = { view -> view.player = player },
            modifier = Modifier.fillMaxSize().graphicsLayer { alpha = if (playing) 1f else 0f },
        )
        MotionMark(Modifier.align(Alignment.TopEnd).padding(top = 120.dp, end = 14.dp))
    }
}

/** The clip's own player, silent and ready, let go with the Moment; [onEnded] when it has played through. */
@OptIn(UnstableApi::class)
@Composable
private fun rememberMotionPlayer(
    momentId: String,
    url: String,
    onEnded: () -> Unit,
): ExoPlayer {
    val context = LocalContext.current
    val player =
        remember(momentId) {
            ExoPlayer.Builder(context).build().apply {
                repeatMode = Player.REPEAT_MODE_OFF
                volume = 0f
                setMediaItem(MediaItem.fromUri(url))
                prepare()
            }
        }
    val ended by rememberUpdatedState(onEnded)
    DisposableEffect(player) {
        val listener =
            object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_ENDED) ended()
                }
            }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }
    return player
}

/** A finger held on the picture plays the clip again with its sound until it lifts; it only listens, never takes a touch. */
private fun Modifier.replaysWhileHeld(
    player: ExoPlayer,
    onPlaying: (Boolean) -> Unit,
): Modifier =
    pointerInput(player) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            val lifted =
                withTimeoutOrNull(HOLD_MS) {
                    do {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                    } while (event.changes.any { it.pressed })
                    true
                }
            if (lifted == null) {
                player.volume = 1f
                player.seekTo(0)
                player.play()
                onPlaying(true)
                do {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                } while (event.changes.any { it.pressed })
                player.pause()
                player.volume = 0f
                onPlaying(false)
            }
        }
    }

/** The small moving-photo mark (never the word "Live"). */
@Composable
private fun MotionMark(modifier: Modifier) {
    Box(
        modifier =
            modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(PantopusColors.momentCaptionPill)
                .semantics { contentDescription = "A moving photo. Press and hold to play it with its sound." },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.CircleDot, contentDescription = null, size = 16.dp, tint = Color.White)
    }
}
