@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod", "UnusedParameter")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingScreenState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStateScaffold
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

@Composable
fun IntakeQuestionsEditorScreen(
    eventTypeId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: IntakeQuestionsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    var toastText by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(saved) {
        if (saved) {
            viewModel.savedConsumed()
            onBack()
        }
    }
    LaunchedEffect(toast) {
        toast?.let {
            toastText = it
            viewModel.toastConsumed()
        }
    }
    LaunchedEffect(toastText) {
        if (toastText != null) {
            delay(2200)
            toastText = null
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val s = state) {
            IntakeUiState.Loading ->
                SchedulingStateScaffold(state = SchedulingScreenState.Loading, onRetry = viewModel::load) {}
            IntakeUiState.NeedsSaveFirst -> NeedsSaveFirst(onBack = onBack)
            is IntakeUiState.Error -> ErrorState(message = s.message, onRetry = viewModel::load)
            is IntakeUiState.Content -> IntakeContent(state = s, viewModel = viewModel, onBack = onBack)
        }
        toastText?.let { msg ->
            Row(
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = Spacing.s12)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText)
                        .padding(horizontal = Spacing.s4, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 15.dp, tint = PantopusColors.warning)
                Text(text = msg, color = PantopusColors.appTextInverse, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun IntakeContent(
    state: IntakeUiState.Content,
    viewModel: IntakeQuestionsViewModel,
    onBack: () -> Unit,
) {
    FormShell(
        title = "Intake questions",
        subtitle = state.eventName,
        isValid = true,
        isDirty = state.isDirty,
        onClose = onBack,
        onCommit = viewModel::save,
        rightActionLabel = "Done",
        isSaving = state.isSaving,
        leading = FormShellLeading.Back,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            // Pillar-accent overline ("Personal · Intro call") above the title,
            // per design Sheet header. The FormShell already prints the subtitle;
            // the overline carries the pillar identity the design specs.
            EtSectionOverline(
                text = "${state.pillar.label} · ${state.eventName}",
                accent = state.pillar.accent,
            )
            Text(
                "Ask people a few things when they book. Name and email are always asked.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
            EtCard {
                LockedRow(icon = PantopusIcon.User, label = "Name")
                LockedRow(icon = PantopusIcon.Mail, label = "Email", last = true)
            }
            Text(
                "YOUR QUESTIONS",
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.08.em,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(top = 14.dp, bottom = Spacing.s1),
            )
            if (state.questions.isEmpty() && state.editing == null) {
                Text("You haven't added any yet.", fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            }
            // Custom questions are flat rows inside ONE card, separated by 1px
            // dividers (design ListBlock) — not per-row cards. The inline edit
            // group replaces the row it's editing.
            if (state.questions.isNotEmpty() || state.editing?.isNew == false) {
                EtCard {
                    val editingExistingId = state.editing?.takeIf { !it.isNew }?.draft?.localId
                    state.questions.forEachIndexed { index, q ->
                        val last = index == state.questions.lastIndex
                        if (editingExistingId == q.localId) {
                            EditGroup(editing = state.editing!!, viewModel = viewModel)
                        } else {
                            QuestionRow(
                                draft = q,
                                index = index,
                                count = state.questions.size,
                                last = last,
                                onEdit = { viewModel.editQuestion(q.localId) },
                                onDelete = { viewModel.deleteQuestion(q.localId) },
                                onMove = viewModel::moveQuestion,
                            )
                        }
                    }
                }
            }
            if (state.editing?.isNew == true) {
                EditGroup(editing = state.editing, viewModel = viewModel)
            }
            EtPrimaryButton(
                label = "Add a question",
                onClick = viewModel::startAdd,
                leadingIcon = PantopusIcon.Plus,
                modifier = Modifier.padding(top = Spacing.s2),
            )
            Spacer(Modifier.height(Spacing.s4))
        }
    }
}

@Composable
private fun LockedRow(
    icon: PantopusIcon,
    label: String,
    last: Boolean = false,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Box(
                modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextSecondary)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text("Always asked", fontSize = 10.5.sp, color = PantopusColors.appTextMuted, modifier = Modifier.padding(top = 1.dp))
            }
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = "Always asked",
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (!last) HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

// Flat custom-question row inside the single ListBlock card — label + type/
// required caption, trailing trash-2, and a grip-vertical drag handle wired to
// vertical-drag reorder. Separated from the next row by a 1px divider.
@Composable
private fun QuestionRow(
    draft: QuestionDraft,
    index: Int,
    count: Int,
    last: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onMove: (Int, Int) -> Unit,
) {
    val rowHeightPx = with(LocalDensity.current) { 56.dp.toPx() }
    var dragAccum by remember(index, count) { mutableStateOf(0f) }
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onEdit)
                    .padding(vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(draft.label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    modifier = Modifier.padding(top = 3.dp),
                ) {
                    Text(draft.type.typeCaption, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                    if (draft.required) RequiredPill()
                }
            }
            Box(
                modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).clickable(onClick = onDelete),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Trash2,
                    contentDescription = "Delete",
                    size = 15.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(30.dp)
                        .pointerInput(index, count) {
                            detectVerticalDragGestures(
                                onDragEnd = { dragAccum = 0f },
                                onDragCancel = { dragAccum = 0f },
                            ) { change, dragAmount ->
                                change.consume()
                                dragAccum += dragAmount
                                if (dragAccum <= -rowHeightPx && index > 0) {
                                    onMove(index, index - 1)
                                    dragAccum = 0f
                                } else if (dragAccum >= rowHeightPx && index < count - 1) {
                                    onMove(index, index + 1)
                                    dragAccum = 0f
                                }
                            }
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.GripVertical,
                    contentDescription = "Drag to reorder",
                    size = ICON_16,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
        if (!last) HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

@Composable
private fun RequiredPill() {
    Box(
        modifier =
            Modifier.clip(
                RoundedCornerShape(Radii.pill),
            ).background(PantopusColors.primary50).padding(horizontal = 7.dp, vertical = 2.dp),
    ) {
        Text("REQUIRED", fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.em, color = PantopusColors.primary700)
    }
}

@Composable
private fun EditGroup(
    editing: EditingQuestion,
    viewModel: IntakeQuestionsViewModel,
) {
    val draft = editing.draft
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.5.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        EtTextField(value = draft.label, onValueChange = viewModel::onEditLabel, label = "Question", placeholder = "What should we cover?")
        Column {
            EtFieldLabel(text = "Answer type")
            TypeSelector(selected = draft.type, onSelect = viewModel::onEditType)
        }
        if (draft.type.hasOptions) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                EtFieldLabel(text = "Options")
                draft.options.forEachIndexed { index, option ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        PantopusIconImage(
                            icon = PantopusIcon.GripVertical,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                        EtTextField(value = option, onValueChange = {
                            viewModel.onEditOption(index, it)
                        }, placeholder = "Option ${index + 1}", modifier = Modifier.weight(1f))
                        Box(
                            modifier =
                                Modifier.size(28.dp).clip(RoundedCornerShape(Radii.md)).clickable {
                                    viewModel.removeOption(index)
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.X,
                                contentDescription = "Remove option",
                                size = 14.dp,
                                tint = PantopusColors.appTextMuted,
                            )
                        }
                    }
                }
                Row(
                    modifier = Modifier.clickable(onClick = viewModel::addOption).padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 13.dp, tint = PantopusColors.primary600)
                    Text("Add option", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
                }
            }
        }
        Row(
            modifier =
                Modifier.fillMaxWidth().clip(
                    RoundedCornerShape(Radii.md),
                ).background(
                    PantopusColors.appSurface,
                ).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)).padding(horizontal = 11.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Make this required",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            EtToggle(checked = draft.required, onToggle = viewModel::onEditRequired)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            EtPrimaryButton(
                label = "Save question",
                onClick = viewModel::saveEditing,
                enabled = draft.canSave,
                modifier = Modifier.weight(1f),
            )
            // Design EditGroup secondary action is a red trash-2 "Delete".
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClick = viewModel::deleteEditing)
                        .padding(horizontal = 6.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.Trash2, contentDescription = null, size = 15.dp, tint = PantopusColors.error)
                Text("Delete", fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.error)
            }
        }
    }
}

// Answer-type picker — 3-column grid inside one sunken track (design
// `intake-frames.jsx` TypeSelector); selected cell = surface + product blue.
@Composable
private fun TypeSelector(
    selected: QuestionType,
    onSelect: (QuestionType) -> Unit,
) {
    val types = QuestionType.entries
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        types.chunked(3).forEach { rowTypes ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                rowTypes.forEach { type ->
                    TypeCell(label = type.label, selected = type == selected, onClick = { onSelect(type) }, modifier = Modifier.weight(1f))
                }
                // pad the trailing partial row so cells keep an equal third-width.
                repeat(3 - rowTypes.size) { Box(modifier = Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun TypeCell(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .height(30.dp)
                .clip(RoundedCornerShape(7.dp))
                .background(if (selected) PantopusColors.appSurface else PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
            color = if (selected) PantopusColors.primary700 else PantopusColors.appTextSecondary,
            maxLines = 1,
        )
    }
}

@Composable
private fun NeedsSaveFirst(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        EtTopBar(title = "Intake questions", onBack = onBack)
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s8),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier.size(60.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ListChecks,
                    contentDescription = null,
                    size = 26.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            Spacer(Modifier.height(Spacing.s4))
            Text("Save your event type first", fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Spacer(Modifier.height(Spacing.s2))
            Text(
                "Create the event type, then come back to add the questions people answer when they book.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.s2),
            )
        }
    }
}
