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
 * Stream A16 — H5 Message Template Editor (full screen). A scroll of sections:
 * channel chips, a name, a subject (shown for Email / SMS, required for Email),
 * and the body with an "Insert variable" bar (H6), a live counter, and a Preview
 * button (H7). Sticky Done POSTs (new) or PUTs (existing).
 */
@Composable
fun MessageTemplateEditorScreen(
    templateId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: MessageTemplateEditorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val deleted by viewModel.deleted.collectAsStateWithLifecycle()
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

    val loaded = state as? MessageTemplateEditorUiState.Loaded

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("scheduling.templates.editor")) {
        AutoTopBar(
            title = viewModel.navTitle,
            leading = AutoLeading.Close,
            onLeading = onBack,
            trailing = {
                AutoTopBarTextButton(
                    title = "Done",
                    isEnabled = loaded?.canSave == true,
                    onClick = viewModel::save,
                    modifier = Modifier.testTag("automationsTopBarAction"),
                )
            },
        )
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when (val s = state) {
                MessageTemplateEditorUiState.Loading -> EditorLoading()
                is MessageTemplateEditorUiState.Error ->
                    AutoErrorView(message = s.message, onRetry = viewModel::start, headline = "Couldn't load template")
                is MessageTemplateEditorUiState.Loaded ->
                    TemplateBody(
                        state = s,
                        isNew = viewModel.isNew,
                        accent = accent,
                        accentBg = viewModel.pillar.accentBg,
                        onName = viewModel::onName,
                        onSubject = viewModel::onSubject,
                        onBody = viewModel::onBody,
                        onSetChannel = viewModel::setChannel,
                        onSetActive = viewModel::setActive,
                        onSave = viewModel::save,
                        onDelete = { showDeleteConfirm = true },
                        onOpenVariable = { showVariable = true },
                        onOpenPreview = { showPreview = true },
                    )
            }
        }
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
            subject = loaded.form.previewSubject,
            body = loaded.form.body,
            channel = loaded.form.channel,
            onDismiss = { showPreview = false },
        )
    }
    if (showDeleteConfirm && loaded != null) {
        val name = loaded.form.name.trim().ifBlank { "this template" }
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete “$name”?") },
            text = { Text("This template will be permanently removed and can't be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.delete()
                }) { Text("Delete template", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { showDeleteConfirm = false }) { Text("Keep") } },
        )
    }
}

@Composable
private fun TemplateBody(
    state: MessageTemplateEditorUiState.Loaded,
    isNew: Boolean,
    accent: Color,
    accentBg: Color,
    onName: (String) -> Unit,
    onSubject: (String) -> Unit,
    onBody: (String) -> Unit,
    onSetChannel: (WorkflowChannel) -> Unit,
    onSetActive: (Boolean) -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
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
            // Channel
            Section(header = "Channel") {
                AutoCard(horizontal = 13.dp, vertical = 12.dp) {
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        WorkflowChannel.entries.forEach { channel ->
                            AutoChannelChip(
                                label = channel.label,
                                icon = channel.icon,
                                isOn = form.channel == channel,
                                isComingSoon = channel.isComingSoon,
                                accent = accent,
                                accentBg = accentBg,
                                onTap = { onSetChannel(channel) },
                            )
                        }
                    }
                }
            }
            // Name
            Section(header = "Name") {
                AutoTextField(
                    value = form.name,
                    onValueChange = onName,
                    placeholder = "Booking thank-you",
                    isError = state.didAttemptSave && form.nameIsEmpty,
                )
                if (state.didAttemptSave && form.nameIsEmpty) {
                    Text(
                        text = "Give your template a name.",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.error,
                    )
                }
            }
            // Active — mirrors iOS `activeSection` (backend `is_active`).
            ActiveToggleCard(isActive = form.isActive, accent = accent, onSetActive = onSetActive)
            // Subject
            if (form.showsSubject) {
                Section(header = if (form.subjectRequired) "Subject" else "Subject · optional") {
                    AutoTextField(
                        value = form.subject,
                        onValueChange = onSubject,
                        placeholder = "You're booked: {{event_title}}",
                        isError = state.didAttemptSave && form.subjectMissing,
                    )
                    if (state.didAttemptSave && form.subjectMissing) {
                        Text(
                            text = "Email templates need a subject.",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.error,
                        )
                    }
                }
            }
            // Message
            Section(header = "Message") {
                TemplateMessageSection(
                    state = state,
                    accent = accent,
                    onBody = onBody,
                    onOpenVariable = onOpenVariable,
                    onOpenPreview = onOpenPreview,
                )
            }
            if (state.saveError != null) {
                AutoNote(tone = AutoTone.Error, icon = PantopusIcon.AlertTriangle, text = state.saveError)
            }
            if (state.deleteError != null) {
                AutoNote(tone = AutoTone.Error, icon = PantopusIcon.AlertTriangle, text = state.deleteError)
            }
            if (!isNew) {
                DeleteTemplateRow(onDelete = onDelete)
            }
            Box(modifier = Modifier.size(Spacing.s4))
        }
        AutoSheetFooter {
            AutoPrimaryButton(
                title = if (state.isSaving) "Saving" else "Done",
                icon = PantopusIcon.Check,
                isSaving = state.isSaving,
                isDisabled = !state.canSave,
                onClick = onSave,
                modifier = Modifier.testTag("automationsPrimaryButton"),
            )
        }
    }
}

/** Active / Inactive toggle — mirrors iOS `activeSection` (web's `is_active` card). */
@Composable
private fun ActiveToggleCard(
    isActive: Boolean,
    accent: Color,
    onSetActive: (Boolean) -> Unit,
) {
    AutoCard(horizontal = 14.dp, vertical = 12.dp, modifier = Modifier.testTag("templateEditor.activeToggle")) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PantopusIconImage(
                icon = PantopusIcon.Zap,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 1.8f,
                tint = if (isActive) accent else PantopusColors.appTextMuted,
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(text = "Active", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(
                    text = if (isActive) "Workflows can use this template." else "Template is paused — no sends.",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Switch(
                checked = isActive,
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
}

/** Destructive delete row — visible only when editing an existing template. */
@Composable
private fun DeleteTemplateRow(onDelete: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s2)
                .heightIn(min = 38.dp)
                .clickable(onClickLabel = "Delete template", onClick = onDelete)
                .testTag("templateEditor.delete"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = PantopusIcon.Trash2, contentDescription = null, size = 14.dp, tint = PantopusColors.error)
        Text(text = "Delete template", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.error)
    }
}

@Composable
private fun TemplateMessageSection(
    state: MessageTemplateEditorUiState.Loaded,
    accent: Color,
    onBody: (String) -> Unit,
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
            modifier = Modifier.testTag("templateEditor.insertVariable"),
        )
        AutoTextEditor(
            value = form.body,
            onValueChange = onBody,
            placeholder = "Write what attendees should see…",
            isError = state.didAttemptSave && form.bodyIsEmpty,
        )
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            TemplateMessageHint(state = state, modifier = Modifier.weight(1f))
            Text(
                text = "${form.bodyCount} / ${form.counterLimit}",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = if (form.isOverLimit) PantopusColors.error else PantopusColors.appTextMuted,
            )
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Row(
                modifier = Modifier.clickable(enabled = state.canPreview, onClick = onOpenPreview).testTag("templateEditor.preview"),
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
private fun TemplateMessageHint(
    state: MessageTemplateEditorUiState.Loaded,
    modifier: Modifier = Modifier,
) {
    val form = state.form
    when {
        state.didAttemptSave && form.bodyIsEmpty ->
            Text(
                text = "Add a message before saving.",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.error,
                modifier = modifier,
            )
        form.isOverLimit ->
            Text(
                text = "This will send as more than one SMS.",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.warning,
                modifier = modifier,
            )
        else ->
            Text(text = "Variables fill in per booking.", fontSize = 11.sp, color = PantopusColors.appTextSecondary, modifier = modifier)
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
private fun EditorLoading() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s3, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        repeat(4) {
            Shimmer(width = 90.dp, height = 9.dp, cornerRadius = Radii.xs)
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 60.dp, cornerRadius = Radii.xl)
        }
    }
}
