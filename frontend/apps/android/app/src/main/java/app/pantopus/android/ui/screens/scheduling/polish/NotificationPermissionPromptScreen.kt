@file:Suppress("PackageNaming", "UNUSED_PARAMETER", "LongMethod", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.scheduling.polish

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.app.NotificationManagerCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.scheduling._shared.OwnerPillarHeader
import app.pantopus.android.ui.theme.PantopusColors

/**
 * H15 · Stream A18. The routed full-screen host for the channel-connect prompt.
 * It owns the OS push-permission launcher (Android 13+ `POST_NOTIFICATIONS`),
 * reconciles the opening frame with the live OS push status, renders the shared
 * [NotificationChannelPrompt], deep-links to system Settings on the denied frame,
 * and pops the back stack when the prompt finishes. The same state + content can
 * be presented locally as a `ModalBottomSheet` by a reminder/workflow channel
 * toggle. Tokens only.
 *
 * Signature is the frozen A0 stub contract `RootTabScreen` calls.
 */
@Composable
fun NotificationPermissionPromptScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: NotificationPermissionPromptViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    fun pushEnabled(): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

    val permissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            viewModel.onPushResult(granted)
        }

    // Reconcile the opening frame with the real OS push status, once.
    LaunchedEffect(Unit) {
        val status =
            when {
                pushEnabled() -> PushPermissionStatus.Authorized
                Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU -> PushPermissionStatus.Denied
                else -> PushPermissionStatus.NotDetermined
            }
        viewModel.reconcile(status)
    }

    // Finish → pop the routed host.
    LaunchedEffect(state.isFinished) {
        if (state.isFinished) onBack()
    }

    val openSettings: () -> Unit = {
        val intent =
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    val requestPush: () -> Unit = {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !pushEnabled()) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            // Pre-13 (or already granted): notifications are on unless disabled in Settings.
            viewModel.onPushResult(pushEnabled())
        }
    }

    val onPrimary: () -> Unit = {
        when (state.frame) {
            NotificationPromptFrame.Push -> requestPush()
            is NotificationPromptFrame.EmailVerify -> viewModel.verifyEmail()
            NotificationPromptFrame.SmsVerify -> viewModel.verifySms()
            is NotificationPromptFrame.Connected -> viewModel.done()
            NotificationPromptFrame.Denied -> openSettings()
        }
    }

    val onSecondary: () -> Unit = {
        when (state.frame) {
            NotificationPromptFrame.Push, NotificationPromptFrame.Denied -> viewModel.useEmailInstead()
            else -> Unit
        }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag("scheduling.notificationPermissionScreen"),
    ) {
        OwnerPillarHeader(title = "Notifications", pillar = viewModel.pillar, onBack = onBack)
        NotificationChannelPrompt(
            state = state,
            accent = viewModel.pillar.accent,
            onPrimary = onPrimary,
            onSecondary = onSecondary,
            onCodeChange = viewModel::updateCode,
            onPhoneChange = viewModel::updatePhone,
            onResend = viewModel::resendCode,
            showCloseButton = false,
        )
    }
}
