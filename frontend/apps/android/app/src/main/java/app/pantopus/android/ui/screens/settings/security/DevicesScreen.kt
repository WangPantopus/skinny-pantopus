package app.pantopus.android.ui.screens.settings.security

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.findFragmentActivity
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * Settings → Security → Devices (design §7.6 / §7.7 / §9). Thin wrapper
 * around the shared [GroupedListScreen] — [DevicesViewModel] projects the
 * trusted-device registry, web sessions, security prefs, the two
 * account-wide actions and the security-event timeline into rows; this
 * composable adds the confirmation dialog (remove device / sign out others
 * / lockdown) and the toast. Mirrors iOS `DevicesView`.
 */
@Composable
fun DevicesScreen(
    onBack: () -> Unit = {},
    viewModel: DevicesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val confirmation by viewModel.confirmation.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = remember(context) { context.findFragmentActivity() }
    val toastController = remember { ToastController() }
    val shownToast by toastController.current.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        toast?.let {
            toastController.show(it)
            viewModel.consumeToast()
        }
    }

    confirmation?.let { pending ->
        DevicesConfirmDialog(
            confirmation = pending,
            busy = busy,
            onConfirm = { viewModel.confirmPending(activity) },
            onDismiss = viewModel::dismissConfirmation,
        )
    }

    Box(modifier = Modifier.fillMaxSize().testTag(DevicesViewModel.TAG_ROOT)) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            footerCaption = "Trusted devices stay signed in for 90 days of inactivity; unverified ones for 30.",
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onTapRow = viewModel::onTapRow,
                    onToggleRow = { rowId, isOn -> viewModel.onToggle(rowId, isOn, activity) },
                    onRetry = viewModel::load,
                ),
        )
        ToastHost(
            controller = toastController,
            modifier = if (shownToast != null) Modifier.testTag(DevicesViewModel.TAG_TOAST) else Modifier,
        )
    }
}

/** Remove device / Sign out others / Lockdown confirmation. */
@Composable
private fun DevicesConfirmDialog(
    confirmation: DevicesViewModel.Confirmation,
    busy: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val (title, body, cta) =
        when (confirmation) {
            is DevicesViewModel.Confirmation.RemoveDevice ->
                Triple(
                    "Remove ${DevicesViewModel.deviceTitle(confirmation.device)}?",
                    "It will be signed out immediately and will need to sign in again. " +
                        "You'll confirm it's you first.",
                    "Remove",
                )
            DevicesViewModel.Confirmation.SignOutOthers ->
                Triple(
                    "Sign out of all other devices?",
                    "Every other phone, tablet and browser will be signed out. This device stays signed in.",
                    "Sign out others",
                )
            DevicesViewModel.Confirmation.Lockdown ->
                Triple(
                    "Lockdown your account?",
                    "You'll be signed out everywhere — including this device — and every remembered " +
                        "device will need to sign in again.",
                    "Lockdown",
                )
        }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(title) },
        text = { Text(body) },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                enabled = !busy,
                modifier = Modifier.testTag(DevicesViewModel.TAG_CONFIRM_PRIMARY),
            ) {
                if (busy) {
                    CircularProgressIndicator(
                        color = PantopusColors.primary600,
                        strokeWidth = 2.dp,
                        modifier =
                            Modifier
                                .size(Spacing.s5)
                                .testTag("${DevicesViewModel.TAG_CONFIRM_PRIMARY}.busy"),
                    )
                } else {
                    Text(cta, color = PantopusColors.error)
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !busy,
                modifier = Modifier.testTag(DevicesViewModel.TAG_CONFIRM_CANCEL),
            ) { Text("Cancel") }
        },
        modifier = Modifier.testTag(DevicesViewModel.TAG_CONFIRM_DIALOG),
    )
}
