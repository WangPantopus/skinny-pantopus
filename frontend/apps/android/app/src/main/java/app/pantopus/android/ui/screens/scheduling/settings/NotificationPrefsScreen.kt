@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedParameter")

package app.pantopus.android.ui.screens.scheduling.settings

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

@Composable
fun NotificationPrefsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: NotificationPrefsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val pushOff = remember { !NotificationManagerCompat.from(context).areNotificationsEnabled() }
    LaunchedEffect(Unit) { viewModel.load(pushOff) }

    val openSettings: () -> Unit = {
        val intent =
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appSurfaceMuted)) {
        SettingsTopBar(title = "Notifications", onBack = onBack)
        when (val s = state) {
            NotificationPrefsUiState.Loading ->
                SchedulingLoadingSkeleton(modifier = Modifier.fillMaxWidth().padding(Spacing.s4), rows = 5)
            is NotificationPrefsUiState.Error -> NotifError(message = s.message, onRetry = viewModel::refresh)
            is NotificationPrefsUiState.Loaded -> NotifBody(data = s.data, vm = viewModel, onOpenSettings = openSettings)
        }
    }
}

@Composable
private fun NotifBody(
    data: NotifPrefsData,
    vm: NotificationPrefsViewModel,
    onOpenSettings: () -> Unit,
) {
    val accent = data.pillar.accent
    val accentBg = data.pillar.accentBg
    // Presentational SMS-coming-soon tooltip toggle — mirrors iOS model.showSmsHint.
    var showSmsHint by remember { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = Spacing.s6)) {
        if (data.paused) {
            NotifPauseBanner(
                pausedForLabel = data.pausedForLabel,
                resumesAtLabel = data.resumesAtLabel,
                onResume = vm::resume,
            )
        }
        if (data.pushOff) NotifPushOffNotice(onOpenSettings = onOpenSettings)
        NotifOverline("Scheduling & bookings")
        NotifCategoryCard(
            label = "Notify me",
            helper = "Only you see these. Pick the channel for each event.",
            disabled = data.paused,
            accent = accent,
            accentBg = accentBg,
            smsHint = showSmsHint,
            onSmsTap = { showSmsHint = !showSmsHint },
        ) {
            data.notifyMe.forEachIndexed { index, row ->
                NotifMatrixRow(
                    row = row,
                    isAttendee = false,
                    paused = data.paused,
                    pushOff = data.pushOff,
                    showDivider = true,
                    accent = accent,
                    onToggle = { vm.toggleNotifyMe(row.key) },
                )
                if (index == data.notifyMe.lastIndex) {
                    ReminderLeadTime(
                        selected = data.reminderMinutes,
                        paused = data.paused,
                        accent = accent,
                        onToggle = vm::toggleReminder,
                    )
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        NotifCategoryCard(
            label = "Notify attendees",
            helper = "Attendees always get a confirmation — you choose the rest.",
            disabled = data.paused,
            accent = accent,
            accentBg = accentBg,
        ) {
            data.notifyAttendees.forEachIndexed { index, row ->
                NotifMatrixRow(
                    row = row,
                    isAttendee = true,
                    paused = data.paused,
                    pushOff = data.pushOff,
                    showDivider = index < data.notifyAttendees.lastIndex,
                    accent = accent,
                    onToggle = { vm.toggleNotifyAttendees(row.key) },
                )
            }
        }
        NotifLegend()
    }
}

@Composable
private fun NotifError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(64.dp))
        PantopusIconImage(icon = PantopusIcon.CloudOff, contentDescription = null, size = 28.dp, tint = PantopusColors.appTextSecondary)
        Spacer(Modifier.height(Spacing.s3))
        Text("Couldn't load notifications", style = PantopusTextStyle.h3, color = PantopusColors.appText)
        Spacer(Modifier.height(Spacing.s2))
        Text(message, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        Spacer(Modifier.height(Spacing.s4))
        TextButton(onClick = onRetry) { Text("Try again", color = PantopusColors.primary600) }
    }
}
