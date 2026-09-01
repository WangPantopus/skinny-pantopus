@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "UNUSED_PARAMETER")

package app.pantopus.android.ui.screens.scheduling.automations

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Stream A16 — H1 Default Reminders Quick-Setup (routed full screen). Mirrors
 * `reminders-frames.jsx`: one card of selectable lead-time rows (1 week / 1 day /
 * 1 hour / 30 min / 15 min / At start), each with a check-circle and, when on, an
 * inline Push / Email channel mini-row; a dashed "Add custom time" chip that
 * expands to a stepper; and a sticky Save. Smart default pre-checks 1 day +
 * 1 hour. Frames: default · first-open copy · saved toast · push-off banner.
 * Also presented as a local sheet from the Workflows list via [RemindersQuickSetupSheet].
 */
@Composable
fun RemindersQuickSetupScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: RemindersQuickSetupViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val pushOff = remember { !context.areNotificationsEnabled() }
    LaunchedEffect(Unit) { viewModel.load() }
    RemindersBody(viewModel = viewModel, pushOff = pushOff, onClose = onBack, modifier = Modifier.fillMaxSize())
}

/** The H1 surface as a local `ModalBottomSheet` (opened from the Workflows list). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemindersQuickSetupSheet(onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    val pushOff = remember { !context.areNotificationsEnabled() }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        dragHandle = null,
    ) {
        val viewModel: RemindersQuickSetupViewModel = hiltViewModel()
        LaunchedEffect(Unit) { viewModel.load() }
        RemindersBody(
            viewModel = viewModel,
            pushOff = pushOff,
            onClose = onDismiss,
            modifier = Modifier.fillMaxHeight(0.92f).fillMaxWidth(),
        )
    }
}

@Composable
private fun RemindersBody(
    viewModel: RemindersQuickSetupViewModel,
    pushOff: Boolean,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val savedToast by viewModel.savedToast.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Box(modifier = modifier.background(PantopusColors.appBg).testTag("scheduling.reminders")) {
        Column(modifier = Modifier.fillMaxSize()) {
            AutoSheetHeader(
                title = "Default reminders",
                subhead = "Times come from each event you own. Per-event overrides stay.",
                onClose = onClose,
            )
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val s = state) {
                    RemindersUiState.Loading -> RemindersSkeleton()
                    is RemindersUiState.Error ->
                        AutoErrorView(message = s.message, onRetry = viewModel::load, headline = "Couldn't load reminders")
                    is RemindersUiState.Loaded ->
                        RemindersLoaded(
                            state = s,
                            accent = viewModel.pillar.accent,
                            accentBg = viewModel.pillar.accentBg,
                            pushOff = pushOff,
                            onToggle = viewModel::toggle,
                            onShowCustom = viewModel::showCustom,
                            onHideCustom = viewModel::hideCustom,
                            onStep = viewModel::stepCustom,
                            onUnit = viewModel::setCustomUnit,
                            onAddCustom = viewModel::addCustom,
                            onSave = viewModel::save,
                            onEnablePush = { context.openNotificationSettings() },
                        )
                }
            }
        }
        if (savedToast) {
            AutoToast(
                text = "Reminders saved. They'll apply to new events.",
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 92.dp).testTag("reminderSavedToast"),
            )
        }
    }
}

@Composable
private fun RemindersLoaded(
    state: RemindersUiState.Loaded,
    accent: Color,
    accentBg: Color,
    pushOff: Boolean,
    onToggle: (Int) -> Unit,
    onShowCustom: () -> Unit,
    onHideCustom: () -> Unit,
    onStep: (Int) -> Unit,
    onUnit: (ReminderPreset.Unit) -> Unit,
    onAddCustom: () -> Unit,
    onSave: () -> Unit,
    onEnablePush: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (pushOff) {
                AutoNote(
                    tone = AutoTone.Warning,
                    icon = PantopusIcon.BellOff,
                    text = "Push is off in system settings. Email still works.",
                    trailing = {
                        Text(
                            text = "Enable",
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = accent,
                            modifier = Modifier.testTag("reminderEnablePush").clickable(onClick = onEnablePush),
                        )
                    },
                )
            } else {
                Text(
                    text =
                        if (state.firstOpen) {
                            "We pre-picked two reminders most people keep. Change them anytime."
                        } else {
                            "Pick the lead-times that attach to every event you own."
                        },
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(horizontal = 2.dp),
                )
            }

            ReminderCard(state = state, accent = accent, accentBg = accentBg, onToggle = onToggle)

            if (state.atLimit) {
                AutoNote(
                    tone = AutoTone.Info,
                    icon = PantopusIcon.Info,
                    text = "Up to 5 reminders",
                    modifier = Modifier.testTag("reminderLimitNote"),
                )
            }

            if (state.showCustom) {
                CustomStepper(
                    state = state,
                    accent = accent,
                    onStep = onStep,
                    onUnit = onUnit,
                    onCancel = onHideCustom,
                    onAdd = onAddCustom,
                )
            } else {
                AutoDashedChip(
                    label = "Add custom time",
                    onClick = onShowCustom,
                    accent = accent,
                    modifier = Modifier.testTag("reminderAddCustom"),
                )
            }

            if (state.saveError != null) {
                AutoNote(tone = AutoTone.Error, icon = PantopusIcon.AlertTriangle, text = state.saveError)
            }
        }
        AutoSheetFooter {
            AutoPrimaryButton(
                title = if (state.isSaving) "Saving" else "Save",
                isSaving = state.isSaving,
                onClick = onSave,
                modifier = Modifier.testTag("automationsPrimaryButton"),
            )
        }
    }
}

@Composable
private fun ReminderCard(
    state: RemindersUiState.Loaded,
    accent: Color,
    accentBg: Color,
    onToggle: (Int) -> Unit,
) {
    val rows =
        ReminderPreset.all.map { it.first to it.second } +
            state.customMinutes.map { it to AutomationsFormat.reminderRowLabel(it) }
    AutoCard(horizontal = 13.dp, vertical = 4.dp) {
        rows.forEachIndexed { idx, (minutes, label) ->
            ReminderRow(
                minutes = minutes,
                label = label,
                on = state.isOn(minutes),
                accent = accent,
                accentBg = accentBg,
                onToggle = onToggle,
            )
            if (idx < rows.size - 1) AutoRowDivider()
        }
    }
}

@Composable
private fun ReminderRow(
    minutes: Int,
    label: String,
    on: Boolean,
    accent: Color,
    accentBg: Color,
    onToggle: (Int) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onToggle(minutes) }
                .padding(vertical = 11.dp, horizontal = 2.dp)
                .testTag("reminderRow_$minutes"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            PantopusIconImage(
                icon = if (on) PantopusIcon.CheckCircle else PantopusIcon.Circle,
                contentDescription = null,
                size = 21.dp,
                strokeWidth = if (on) 2.4f else 2f,
                tint = if (on) accent else PantopusColors.appBorderStrong,
            )
            Text(
                text = label,
                fontSize = 14.sp,
                fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium,
                color = if (on) PantopusColors.appText else PantopusColors.appTextSecondary,
            )
        }
        if (on) {
            Row(modifier = Modifier.padding(start = 31.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AutoChannelChip(label = "Push", icon = PantopusIcon.Bell, isOn = true, accent = accent, accentBg = accentBg)
                AutoChannelChip(label = "Email", icon = PantopusIcon.Mail, isOn = false)
            }
        }
    }
}

@Composable
private fun CustomStepper(
    state: RemindersUiState.Loaded,
    accent: Color,
    onStep: (Int) -> Unit,
    onUnit: (ReminderPreset.Unit) -> Unit,
    onCancel: () -> Unit,
    onAdd: () -> Unit,
) {
    AutoCard(horizontal = 14.dp, vertical = 12.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(text = "Custom reminder", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextStrong)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                AutoStepper(
                    value = state.customValue,
                    accent = accent,
                    canDecrement = state.customValue > 1,
                    canIncrement = state.customValue < state.customMax,
                    onDecrement = { onStep(-1) },
                    onIncrement = { onStep(1) },
                )
                AutoSegmented(
                    options = ReminderPreset.Unit.entries.map { it.label },
                    selectedIndex = ReminderPreset.Unit.entries.indexOf(state.customUnit),
                    accent = accent,
                    onSelect = { onUnit(ReminderPreset.Unit.entries[it]) },
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                text = "${AutomationsFormat.duration(state.customResolvedMinutes)} before each event starts.",
                fontSize = 10.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                AutoGhostButton(title = "Cancel", onClick = onCancel)
                AutoPrimaryButton(title = "Add time", icon = PantopusIcon.Plus, onClick = onAdd, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun RemindersSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Shimmer(width = 220.dp, height = 11.dp, cornerRadius = Radii.xs)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 300.dp, cornerRadius = Radii.xl)
        Shimmer(width = 150.dp, height = 34.dp, cornerRadius = Radii.pill)
    }
}

private fun Context.areNotificationsEnabled(): Boolean =
    runCatching { NotificationManagerCompat.from(this).areNotificationsEnabled() }.getOrDefault(true)

private fun Context.openNotificationSettings() {
    runCatching {
        val intent =
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
    }
}
