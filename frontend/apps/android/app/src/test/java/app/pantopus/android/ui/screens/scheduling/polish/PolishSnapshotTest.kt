@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.polish

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

class PolishSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false))

    private val accent = SchedulingPillar.Personal.accent
    private val email = "maria@pantopus.co"

    private fun frameState(
        frame: NotificationPromptFrame,
        code: String = "",
        phone: String = "",
    ) = NotificationPromptUiState(frame = frame, code = code, phone = phone, accountEmail = email)

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }

    @Composable
    private fun Prompt(state: NotificationPromptUiState) {
        NotificationChannelPrompt(
            state = state,
            accent = accent,
            onPrimary = {},
            onSecondary = {},
            onCodeChange = {},
            onPhoneChange = {},
            onResend = {},
        )
    }

    @Test
    fun prompt_push() = paparazzi.snapshot { Frame { Prompt(frameState(NotificationPromptFrame.Push)) } }

    @Test
    fun prompt_email_verify() =
        paparazzi.snapshot {
            Frame { Prompt(frameState(NotificationPromptFrame.EmailVerify(email), code = "123")) }
        }

    @Test
    fun prompt_sms_verify() =
        paparazzi.snapshot {
            Frame { Prompt(frameState(NotificationPromptFrame.SmsVerify, code = "12", phone = "5551234567")) }
        }

    @Test
    fun prompt_connected() =
        paparazzi.snapshot {
            Frame { Prompt(frameState(NotificationPromptFrame.Connected(NotificationChannel.Email))) }
        }

    @Test
    fun prompt_denied() = paparazzi.snapshot { Frame { Prompt(frameState(NotificationPromptFrame.Denied)) } }
}
