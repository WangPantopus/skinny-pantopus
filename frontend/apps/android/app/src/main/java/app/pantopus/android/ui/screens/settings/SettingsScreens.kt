@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.settings

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.findFragmentActivity
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.theme.PantopusColors

/**
 * T3.1 Settings index. Thin wrapper around [GroupedListScreen] —
 * the [SettingsIndexViewModel] projects the auth state into chevron
 * rows + status chips and routes taps via `onNavigate`.
 */
@Composable
fun SettingsIndexScreen(
    onClose: () -> Unit = {},
    onNavigate: (SettingsRoute) -> Unit = {},
    viewModel: SettingsIndexViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val footer by viewModel.footerCaption.collectAsStateWithLifecycle()
    val navigation by viewModel.navigation.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(navigation) {
        navigation?.let {
            viewModel.consumeNavigation()
            onNavigate(it)
        }
    }

    GroupedListScreen(
        title = viewModel.title,
        state = state,
        footerCaption = footer,
        callbacks =
            GroupedListCallbacks(
                onBack = onClose,
                onTapRow = viewModel::onRow,
                onRetry = viewModel::load,
            ),
    )
}

/**
 * A14.5 Notification & briefing preferences, backed by
 * `GET/PUT /api/hub/preferences`. Toggles / chips / radios flip
 * optimistically and debounce-save; the toast surfaces the save result
 * (and the rollback) exactly like iOS `NotificationSettingsView`.
 */
@Composable
fun NotificationSettingsScreen(
    onBack: () -> Unit = {},
    viewModel: NotificationSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val footer by viewModel.footerCaption.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val toastController = remember { ToastController() }
    val shownToast by toastController.current.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        toast?.let {
            toastController.show(it)
            viewModel.consumeToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            footerCaption = footer,
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onToggleRow = viewModel::onToggle,
                    onSelectRadio = viewModel::onSelectRadio,
                    onSelectChip = viewModel::onSelectChip,
                    onRetry = viewModel::load,
                ),
        )
        // Tag mirrors iOS `NotificationSettingsView`'s
        // `notificationSettingsToast`, which likewise exists only while
        // a toast is up.
        ToastHost(
            controller = toastController,
            modifier =
                if (shownToast != null) {
                    Modifier.testTag(NOTIFICATION_SETTINGS_TOAST_TAG)
                } else {
                    Modifier
                },
        )
    }
}

/** Mirrors iOS `notificationSettingsToast`. */
const val NOTIFICATION_SETTINGS_TOAST_TAG = "notificationSettingsToast"

/** A14.7 Privacy preferences (RadioCards + fuzz slider + toggles + data rows). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrivacySettingsScreen(
    onBack: () -> Unit = {},
    viewModel: PrivacySettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val deleteSheetVisible by viewModel.deleteSheetVisible.collectAsStateWithLifecycle()
    val deletingAccount by viewModel.deletingAccount.collectAsStateWithLifecycle()
    val deleteAccountError by viewModel.deleteAccountError.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context.findFragmentActivity()
    val toastController = remember { ToastController() }
    val shownToast by toastController.current.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        toast?.let {
            toastController.show(it)
            viewModel.consumeToast()
        }
    }

    if (deleteSheetVisible) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.dismissDeleteSheet() },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = PantopusColors.appSurface,
        ) {
            AccountDeleteSheet(
                isDeleting = deletingAccount,
                errorMessage = deleteAccountError,
                onCancel = { viewModel.dismissDeleteSheet() },
                onConfirm = { viewModel.confirmDeleteAccount(activity) },
            )
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            footerCaption = viewModel.footerCaption,
            banner = banner,
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onToggleRow = { rowId, isOn -> viewModel.onToggle(rowId, isOn, activity) },
                    onSelectRadio = viewModel::onRadio,
                    onSetFuzz = viewModel::onSetFuzz,
                    onTapRow = { rowId ->
                        if (rowId == "appLockOpenSettings") {
                            val intent =
                                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                    data = Uri.fromParts("package", context.packageName, null)
                                }
                            runCatching { context.startActivity(intent) }
                        } else {
                            viewModel.onTapRow(rowId)
                        }
                    },
                    onRetry = viewModel::load,
                ),
        )
        // Tag mirrors iOS `PrivacyView`'s `privacySettingsToast`
        // identifier, which likewise exists only while a toast is up.
        ToastHost(
            controller = toastController,
            modifier =
                if (shownToast != null) {
                    Modifier.testTag(PRIVACY_SETTINGS_TOAST_TAG)
                } else {
                    Modifier
                },
        )
    }
}

/** Mirrors iOS `privacySettingsToast`. */
const val PRIVACY_SETTINGS_TOAST_TAG = "privacySettingsToast"
