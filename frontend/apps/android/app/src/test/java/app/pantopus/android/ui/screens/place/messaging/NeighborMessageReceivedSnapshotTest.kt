@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.place.messaging

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.place.NeighborMessageReply
import app.pantopus.android.data.api.models.place.NeighborMessageSender
import app.pantopus.android.data.api.models.place.NeighborReplyTemplate
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots of the D2 received-message presentation — locks the
 * anonymized card, the templated quick-reply bar, the reply-sent state, and
 * the manage rows. Regenerate with `./gradlew paparazziRecord`.
 */
class NeighborMessageReceivedSnapshotTest {
    @get:Rule
    val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_6.copy(softButtons = false))

    private val sender =
        NeighborMessageSender(label = "A verified neighbor nearby", blockLabel = "On your block", verified = true)

    private val replies =
        listOf(
            NeighborReplyTemplate(id = "thanks", body = "Thanks for the heads-up"),
            NeighborReplyTemplate(id = "got-it", body = "Got it, appreciate it"),
            NeighborReplyTemplate(id = "all-good", body = "All good on my end"),
        )

    private fun message(reply: NeighborMessageReply? = null) =
        ReceivedNeighborMessage(
            id = "msg-1",
            category = "Noise",
            body = "Just a friendly heads-up that there may be some construction noise on the block this week.",
            createdAt = "2026-06-12T09:00:00+00:00",
            sender = sender,
            reply = reply,
            canReply = true,
            notHelpful = false,
            reported = false,
            readAt = null,
        )

    @Test
    fun received_can_reply() {
        paparazzi.snapshot { Content(message = message()) }
    }

    @Test
    fun received_reply_sent() {
        val reply = NeighborMessageReply(templateId = "thanks", body = "Thanks for the heads-up", repliedAt = null)
        paparazzi.snapshot { Content(message = message(reply = reply)) }
    }

    @Composable
    private fun Content(message: ReceivedNeighborMessage) {
        PantopusTheme {
            NeighborReceivedContent(
                message = message,
                replies = replies,
                flags = NeighborManageFlags(),
                editingReply = false,
                replying = false,
                onReply = {},
                onChangeReply = {},
                onNotHelpful = {},
                onBlock = {},
                onReport = {},
                modifier = Modifier.fillMaxWidth().background(PantopusColors.appBg),
            )
        }
    }
}
