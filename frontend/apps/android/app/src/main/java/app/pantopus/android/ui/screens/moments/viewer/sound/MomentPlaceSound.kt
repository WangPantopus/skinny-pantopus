package app.pantopus.android.ui.screens.moments.viewer.sound

import android.media.AudioAttributes
import android.media.MediaPlayer
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.moments.sound.MomentSoundDto
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/*
 * "Pulse, reinvented" phase 2, place sound for readers (CONTRACT 7e), as the iPhone's `MomentSoundLayer.swift`: a
 * Moment that carries place sound plays it once as it opens, and a small "Place sound" pill plays it again. A sound the
 * author cleaned of wind says so ("Anything it touched is marked"). Only for a reader whose switch is on (the viewer
 * draws this only then, and the server sends `sound` only then); a voice (Voice Spark) is drawn by its own layer.
 */
@Composable
fun MomentPlaceSound(moment: MomentDto?) {
    val sound = moment?.sound?.takeIf { it.kind == MomentSoundDto.PLACE && !it.url.isNullOrBlank() } ?: return
    val url = sound.url ?: return
    var player by remember(moment.id) { mutableStateOf<MediaPlayer?>(null) }
    var playing by remember(moment.id) { mutableStateOf(false) }
    val play = {
        player?.release()
        player =
            runCatching {
                MediaPlayer().apply {
                    setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build())
                    setDataSource(url)
                    setOnPreparedListener {
                        playing = true
                        it.start()
                    }
                    setOnCompletionListener { playing = false }
                    setOnErrorListener { _, _, _ ->
                        playing = false
                        true
                    }
                    prepareAsync()
                }
            }.getOrNull()
    }
    // Once as the Moment opens; it stops when the Moment changes or the viewer closes.
    DisposableEffect(moment.id, url) {
        play()
        onDispose {
            player?.release()
            player = null
            playing = false
        }
    }
    Box(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 12.dp, bottom = 150.dp)
                    .heightIn(min = 32.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.Black.copy(alpha = 0.45f))
                    .clickable(role = Role.Button) { play() }
                    .padding(horizontal = 10.dp)
                    .testTag("moments.viewer.placeSound")
                    .clearAndSetSemantics {
                        contentDescription =
                            if (sound.cleaned) "Place sound, wind cleaned. Plays it again" else "Place sound. Plays it again"
                        role = Role.Button
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Volume2,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = Color.White.copy(alpha = if (playing) 1f else 0.8f),
            )
            Text(if (sound.cleaned) "Place sound · wind cleaned" else "Place sound", color = Color.White, fontSize = 12.5.sp)
        }
    }
}
