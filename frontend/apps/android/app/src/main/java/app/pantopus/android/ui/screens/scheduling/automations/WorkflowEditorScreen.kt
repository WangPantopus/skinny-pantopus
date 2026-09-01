@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "UNUSED_PARAMETER")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Stream A16 — H3 Workflow Editor (full screen). Build / Activity tabs. The Build
 * tab scrolls through sections: an optional name, a Trigger summary row (opens
 * the H4 Trigger Picker), an Action channel picker (SMS disabled "coming soon")
 * with the channel-implied audience, a Message body with an "Insert variable" bar
 * (opens H6), a live counter and a Preview button (opens H7), and an active
 * toggle. Save POSTs (new) or PUTs (existing).
 */
@Composable
fun WorkflowEditorScreen(
    workflowId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: WorkflowEditorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tab by viewModel.tab.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val deleted by viewModel.deleted.collectAsStateWithLifecycle()
    var showTrigger by remember { mutableStateOf(false) }
    var showVariable by remember { mutableStateOf(false) }
    var showPreview by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    val accent = viewModel.pillar.accent

    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(saved) {
        if (saved) {
            viewModel.consumeSaved()
            onBack()
        }
    }
    LaunchedEffect(deleted) {
        if (deleted) {
            viewModel.consumeDeleted()
            onBack()
        }
    }

    val loaded = state as? WorkflowEditorUiState.Loaded

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.workflows.editor")) {
        AutoTopBar(
            title = viewModel.navTitle,
            leading = AutoLeading.Close,
            onLeading = onBack,
            trailing = {
                AutoTopBarTextButton(
                    title = "Save",
                    isEnabled = loaded?.canSave == true,
                    onClick = viewModel::save,
                    modifier = Modifier.testTag("automationsTopBarAction"),
                )
            },
        )
        AutoUnderlineTabs(
            tabs = listOf("Build", "Activity"),
            selectedIndex = tab.ordinal,
            accent = accent,
            onSelect = viewModel::setTab,
        )
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when (val s = state) {
                WorkflowEditorUiState.Loading -> EditorLoading()
                is WorkflowEditorUiState.Error ->
                    AutoErrorView(message = s.message, onRetry = viewModel::start, headline = "Couldn't load workflow")
                is WorkflowEditorUiState.Loaded ->
                    when (tab) {
                        WorkflowEditorViewModel.Tab.Build ->
                            BuildTab(
                                state = s,
                                isNew = viewModel.isNew,
                                accent = accent,
                                accentBg = viewModel.pillar.accentBg,
                                onName = viewModel::onName,
                                onMessage = viewModel::onMessage,
                                onSetChannel = viewModel::setChannel,
                                onSetActive = viewModel::setActive,
                                onSave = viewModel::save,
                                onDelete = { showDeleteConfirm = true },
                                onOpenTrigger = { showTrigger = true },
                                onOpenVariable = { showVariable = true },
                                onOpenPreview = { showPreview = true },
                            )
                        WorkflowEditorViewModel.Tab.Activity -> ActivityTab(accent = accent, accentBg = viewModel.pillar.accentBg)
                    }
            }
        }
    }

    if (showTrigger && loaded != null) {
        TriggerPickerSheet(
            trigger = loaded.form.trigger,
            offsetMinutes = loaded.form.offsetMinutes,
            accent = accent,
            onApply = { trigger, offset ->
                viewModel.applyTrigger(trigger, offset)
                showTrigger = false
            },
            onDismiss = { showTrigger = false },
        )
    }
    if (showVariable) {
        VariablePickerSheet(
            accent = accent,
            onInsert = {
                viewModel.insertVariable(it)
                showVariable = false
            },
            onDismiss = { showVariable = false },
        )
    }
    if (showPreview && loaded != null) {
        MessagePreviewSheet(
            subject = null,
            body = loaded.form.message,
            channel = loaded.form.channel,
            onDismiss = { showPreview = false },
        )
    }
    if (showDeleteConfirm && loaded != null) {
        val name = loaded.form.name.trim().ifBlank { "this workflow" }
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete “$name”?") },
            text = { Text("This workflow will be permanently removed and can't be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.delete()
                }) { Text("Delete workflow", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { showDeleteConfirm = false }) { Text("Keep") } },
        )
    }
}

@Composable
private fun BuildTab(
    state: WorkflowEditorUiState.Loaded,
    isNew: Boolean,
    accent: Color,
    accentBg: Color,
    onName: (String) -> Unit,
    onMessage: (String) -> Unit,
    onSetChannel: (WorkflowChannel) -> Unit,
    onSetActive: (Boolean) -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
    onOpenTrigger: () -> Unit,
    onOpenVariable: () -> Unit,
    onOpenPreview: () -> Unit,
) {
    val form = state.form
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Name
            Section(header = "Name · optional") {
                AutoTextField(value = form.name, onValueChange = onName, placeholder = form.channel.actionSummary)
            }
            // Trigger
            Section(header = "Trigger") {
                AutoCard(horizontal = 13.dp, vertical = 4.dp) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable(onClick = onOpenTrigger)
                                .padding(vertical = 11.dp)
                                .testTag("workflowEditor.triggerRow"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(11.dp),
                    ) {
                        AutoIconTile(icon = form.trigger.icon, bg = accentBg, fg = accent)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = form.trigger.summary(form.offsetMinutes),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.appText,
                            )
                            Text(
                                text = "Tap to choose when this runs",
                                fontSize = 11.sp,
                                color = PantopusColors.appTextSecondary,
                                modifier = Modifier.padding(top = 1.dp),
                            )
                        }
                        PantopusIconImage(
                            icon = PantopusIcon.ChevronRight,
                            contentDescription = null,
                            size = ICON_16,
                            tint = PantopusColors.appTextMuted,
                        )
                    }
                }
            }
            // Action
            Section(header = "Action") {
                AutoCard(horizontal = 13.dp, vertical = 12.dp) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        ChannelChips(selected = form.channel, accent = accent, accentBg = accentBg, onSelect = onSetChannel)
                        Text(text = form.recipientCaption, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                    }
                }
            }
            // Message
            Section(header = "Message") {
                MessageSection(
                    state = state,
                    accent = accent,
                    onMessage = onMessage,
                    onOpenVariable = onOpenVariable,
                    onOpenPreview = onOpenPreview,
                )
            }
            // Enable
            AutoCard(horizontal = 14.dp, vertical = 12.dp) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Workflow active", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                        Text(
                            text = "Turn off to pause without deleting.",
                            fontSize = 11.sp,
                            color = PantopusColors.appTextSecondary,
                            modifier = Modifier.padding(top = 1.dp),
                        )
                    }
                    Switch(
                        checked = form.isActive,
                        onCheckedChange = onSetActive,
                        colors =
                            SwitchDefaults.colors(
                                checkedThumbColor = PantopusColors.appSurface,
                                checkedTrackColor = accent,
                                uncheckedThumbColor = PantopusColors.appSurface,
                                uncheckedTrackColor = PantopusColors.appBorderStrong,
                            ),
                    )
                }
            }
            if (state.saveError != null) {
                AutoNote(tone = AutoTone.Error, icon = PantopusIcon.AlertTriangle, text = state.saveError)
            }
            if (state.deleteError != null) {
                AutoNote(tone = AutoTone.Error, icon = PantopusIcon.AlertTriangle, text = state.deleteError)
            }
            if (!isNew) {
                DeleteWorkflowRow(onDelete = onDelete)
            }
            Box(modifier = Modifier.size(Spacing.s4))
        }
        AutoSheetFooter {
            AutoPrimaryButton(
                title = if (state.isSaving) "Saving" else "Save workflow",
                icon = PantopusIcon.Check,
                isSaving = state.isSaving,
                isDisabled = !state.canSave,
                onClick = onSave,
                modifier = Modifier.testTag("automationsPrimaryButton"),
            )
        }
    }
}

/** Destructive delete row — visible only when editing an existing workflow. */
@Composable
private fun DeleteWorkflowRow(onDelete: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s2)
                .heightIn(min = 38.dp)
                .clickable(onClickLabel = "Delete workflow", onClick = onDelete)
                .testTag("workflowEditor.delete"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = PantopusIcon.Trash2, contentDescription = null, size = 14.dp, tint = PantopusColors.error)
        Text(text = "Delete workflow", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.error)
    }
}

@Composable
private fun MessageSection(
    state: WorkflowEditorUiState.Loaded,
    accent: Color,
    onMessage: (String) -> Unit,
    onOpenVariable: () -> Unit,
    onOpenPreview: () -> Unit,
) {
    val form = state.form
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        AutoDashedChip(
            label = "Insert variable",
            onClick = onOpenVariable,
            icon = PantopusIcon.Hash,
            height = 30.dp,
            accent = accent,
            modifier = Modifier.testTag("workflowEditor.insertVariable"),
        )
        AutoTextEditor(
            value = form.message,
            onValueChange = onMessage,
            placeholder = "Write what this sends…",
            isError = state.didAttemptSave && form.messageIsEmpty,
        )
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            MessageHint(state = state, modifier = Modifier.weight(1f))
            Text(
                text = "${form.messageCount} / ${form.counterLimit}",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = if (form.isOverLimit) PantopusColors.error else PantopusColors.appTextMuted,
            )
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Row(
                modifier = Modifier.clickable(enabled = state.canPreview, onClick = onOpenPreview).testTag("workflowEditor.preview"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                val color = if (state.canPreview) PantopusColors.primary600 else PantopusColors.appTextMuted
                PantopusIconImage(icon = PantopusIcon.Eye, contentDescription = null, size = 13.dp, tint = color)
                Text(text = "Preview", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color)
            }
        }
    }
}

@Composable
private fun MessageHint(
    state: WorkflowEditorUiState.Loaded,
    modifier: Modifier = Modifier,
) {
    val form = state.form
    when {
        state.didAttemptSave && form.messageIsEmpty ->
            Text(
                text = "Add a message before saving.",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.error,
                modifier = modifier,
            )
        form.channel == WorkflowChannel.Sms ->
            Text(
                text = "Messages over 160 characters send as more than one.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                modifier = modifier,
            )
        else ->
            Text(text = "Variables fill in per booking.", fontSize = 11.sp, color = PantopusColors.appTextSecondary, modifier = modifier)
    }
}

@Composable
private fun ChannelChips(
    selected: WorkflowChannel,
    accent: Color,
    accentBg: Color,
    onSelect: (WorkflowChannel) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        WorkflowChannel.entries.forEach { channel ->
            AutoChannelChip(
                label = channel.label,
                icon = channel.icon,
                isOn = selected == channel,
                isComingSoon = channel.isComingSoon,
                accent = accent,
                accentBg = accentBg,
                onTap = { onSelect(channel) },
            )
        }
    }
}

@Composable
private fun Section(
    header: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        AutoOverline(text = header, modifier = Modifier.padding(horizontal = 2.dp))
        content()
    }
}

@Composable
private fun ActivityTab(
    accent: Color,
    accentBg: Color,
) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        AutoInlineEmpty(
            icon = PantopusIcon.Clock,
            headline = "No activity yet",
            subcopy = "Once this workflow runs, delivered and failed sends will show up here.",
            accent = accent,
            accentBg = accentBg,
            modifier = Modifier.padding(top = Spacing.s12),
        )
    }
}

@Composable
private fun EditorLoading() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s3, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        repeat(4) {
            Shimmer(width = 90.dp, height = 9.dp, cornerRadius = Radii.xs)
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 70.dp, cornerRadius = Radii.xl)
        }
    }
}
