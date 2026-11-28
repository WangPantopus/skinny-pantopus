package app.pantopus.android.ui.screens.moments.viewer.sound

import android.media.AudioAttributes
import android.media.MediaPlayer
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * A whisper dot's card (CONTRACT 7c, 7e), as the iPhone's `MomentDotCard`: the whisper plays as the card opens, and
 * "Hear it again" plays it once more. Its link is the short signed one the Moment's answer carries.
 */
@Composable
fun MomentWhisperPlay(dot: MomentDotDto) {
    val url = dot.audioUrl?.takeIf { it.isNotBlank() } ?: return
    var player by remember(dot.id) { mutableStateOf<MediaPlayer?>(null) }
    var playing by remember(dot.id) { mutableStateOf(false) }
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
    DisposableEffect(dot.id, url) {
        play()
        onDispose {
            player?.release()
            player = null
        }
    }
    val length = dot.durationMs?.let { " · " + app.pantopus.android.ui.screens.moments.studio.sound.seconds(it) }.orEmpty()
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(19.dp))
                .background(PantopusColors.studioPillFill)
                .clickable(role = Role.Button) { play() }
                .padding(horizontal = 12.dp, vertical = 7.dp)
                .testTag("moments.viewer.dotWhisper")
                .clearAndSetSemantics {
                    contentDescription = if (playing) "Playing the whisper" else "Hear the whisper again"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Volume2, contentDescription = null, size = 15.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(
            text = (if (playing) "Playing" else "Hear it again") + length,
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
