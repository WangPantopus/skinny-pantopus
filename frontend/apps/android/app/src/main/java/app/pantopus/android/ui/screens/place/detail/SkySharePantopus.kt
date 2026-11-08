package app.pantopus.android.ui.screens.place.detail

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.theme.PantopusColors
import java.io.File

/*
 * "Or share in Pantopus", under the share preview's Share video and Share photo: the same picture, drawn at the tap,
 * posted to Pulse as a Local Update or sent in a chat. When rain or snow falls, the four-second clip goes as a short
 * video: Android's composer and chats don't yet pair a still with its motion the way a Live Photo does. Parity twin
 * of iOS `SkySharePantopus.swift`.
 */

/** Where the picture goes inside the app, named by its file in the share folder ([skyShareFile]). */
class SkySharePantopus(
    /** The Pulse composer, as a Local Update with the picture attached. */
    val onPostToPulse: (fileName: String) -> Unit,
    /** The New Message picker with recent group chats too; the chat picked opens with the picture in its composer. */
    val onSendInChat: (fileName: String) -> Unit,
) {
    fun open(
        kind: SkySharePantopusKind,
        fileName: String,
    ) = if (kind == SkySharePantopusKind.Pulse) onPostToPulse(fileName) else onSendInChat(fileName)
}

/** Which of the two ways in Pantopus. */
enum class SkySharePantopusKind { Pulse, Chat }

/** "Or share in Pantopus": Post to Pulse and Send in a chat, side by side, or one above the other at large text sizes. */
@Composable
fun SkyShareInPantopus(
    /** The one being drawn: its button spins and the other waits. */
    making: SkySharePantopusKind?,
    /** False while the video for the share sheet is being made. */
    enabled: Boolean,
    onShare: (SkySharePantopusKind) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "Or share in Pantopus",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        val pulse: @Composable (Modifier) -> Unit = { modifier ->
            GhostButton(
                "Post to Pulse",
                onClick = { onShare(SkySharePantopusKind.Pulse) },
                modifier = modifier.testTag("todaySkySharePulse"),
                isLoading = making == SkySharePantopusKind.Pulse,
                isEnabled = enabled && making != SkySharePantopusKind.Chat,
            )
        }
        val chat: @Composable (Modifier) -> Unit = { modifier ->
            GhostButton(
                "Send in a chat",
                onClick = { onShare(SkySharePantopusKind.Chat) },
                modifier = modifier.testTag("todaySkyShareChat"),
                isLoading = making == SkySharePantopusKind.Chat,
                isEnabled = enabled && making != SkySharePantopusKind.Pulse,
            )
        }
        if (LocalDensity.current.fontScale > LARGE_TEXT_SCALE) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                pulse(Modifier.fillMaxWidth())
                chat(Modifier.fillMaxWidth())
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                pulse(Modifier.weight(1f))
                chat(Modifier.weight(1f))
            }
        }
    }
}

/** A picture or clip "Or share in Pantopus" left in the share folder, by its name; null for any other name. */
fun skyShareFile(
    context: Context,
    name: String?,
): File? {
    if (name.isNullOrBlank() || name.contains('/') || name.startsWith('.')) return null
    return File(shareFolder(context), name).takeIf { it.isFile }
}

private const val LARGE_TEXT_SCALE = 1.3f
