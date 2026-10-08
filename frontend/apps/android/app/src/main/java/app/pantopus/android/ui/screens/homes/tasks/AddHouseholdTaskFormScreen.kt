@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "ComplexMethod",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * P2.4 — Add / Edit Household Task form. Single screen built on
 * [FormShell]; the same composable renders both Add (no `taskId`)
 * and Edit (`taskId` provided) modes — only the top-bar title, the
 * load behavior, and the wire verb differ. Pushed from the
 * household tasks list FAB and the "Edit recurring" overflow action.
 *
 * @param onClose Pops the route on either an explicit X tap or a
 *     successful submit.
 * @param onCreated Optional one-shot for the Add flow when a brand-
 *     new task id should be surfaced to the caller (so the list can
 *     refresh / the detail can be pushed). Ignored in Edit mode.
 */
@Composable
fun AddHouseholdTaskFormScreen(
    onClose: () -> Unit,
    onCreated: ((String) -> Unit)? = null,
    focusDueDate: Boolean = false,
    viewModel: AddHouseholdTaskFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val fields by viewModel.fields.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val shouldDismiss by viewModel.shouldDismiss.collectAsStateWithLifecycle()
    val members by viewModel.assignableMembers.collectAsStateWithLifecycle()
    val memberListUnavailable by viewModel.memberListUnavailable.collectAsStateWithLifecycle()
    val createdId by viewModel.createdTaskId.collectAsStateWithLifecycle()
    // Keep this outside the loaded form: foreground permission rechecks briefly
    // remove it, and must not reopen a calendar the user already dismissed.
    var showDueDatePicker by rememberSaveable { mutableStateOf(focusDueDate) }

    HomeTaskResumeEffect(onResume = viewModel::resume, onPause = viewModel::pause)
    val close = {
        viewModel.pause()
        onClose()
    }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(shouldDismiss) {
        if (shouldDismiss && viewModel.consumeCompletion()) {
            viewModel.pause()
            if (createdId != null && onCreated != null) {
                onCreated(createdId!!)
            } else {
                onClose()
            }
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("addHouseholdTaskShell"),
    ) {
        when (val current = state) {
            AddHouseholdTaskFormUiState.Loading ->
                AddHouseholdTaskSkeleton()
            AddHouseholdTaskFormUiState.Editing ->
                AddHouseholdTaskLoaded(
                    focusDueDate = showDueDatePicker,
                    onDueDatePickerDismiss = { showDueDatePicker = false },
                    state =
                        AddHouseholdTaskLoadedState(
                            fields = fields,
                            members = members,
                            memberListUnavailable = memberListUnavailable,
                            isEditing = viewModel.isEditing,
                            isValid = viewModel.isValid,
                            isDirty = viewModel.isDirty,
                            isSaving = isSaving,
                            selectedCategory = viewModel.selectedCategory,
                            selectedRecurrence = viewModel.selectedRecurrence,
                            selectedCustomUnit = viewModel.selectedCustomUnit,
                            selectedAssigneeId = viewModel.selectedAssigneeId,
                            showsCustomRecurrenceSubForm = viewModel.showsCustomRecurrenceSubForm,
                        ),
                    onClose = close,
                    onCommit = viewModel::save,
                    onUpdate = viewModel::update,
                    onSelectCategory = viewModel::selectCategory,
                    onSelectRecurrence = viewModel::selectRecurrence,
                    onSelectCustomUnit = viewModel::selectCustomUnit,
                    onSelectAssignee = viewModel::selectAssignee,
                    onSetDueDate = viewModel::setDueDate,
                )
            is AddHouseholdTaskFormUiState.Recovery ->
                HomeTaskRecoveryPanel(
                    title = "Saved task request",
                    message =
                        current.message ?: "A task request is saved. Retry that same request to confirm its result. " +
                            "Closing keeps it; reopen Add task in this Home to recover it.",
                    busy = isSaving,
                    onRetry = viewModel::retryCreation,
                    onClose = close,
                    onClear = if (current.canClear) viewModel::clearRejectedCreation else null,
                )
            is AddHouseholdTaskFormUiState.EditRecovery ->
                HomeTaskRecoveryPanel(
                    title = "Saved task edit",
                    message =
                        current.message ?: "This edit is not confirmed. Retry its original changes after a current access check. " +
                            "Closing the app discards this local edit; reopen the task to check its current values.",
                    busy = isSaving,
                    onRetry = viewModel::retryEdit,
                    onClose = close,
                )
            is AddHouseholdTaskFormUiState.Error ->
                Column {
                    TextButton(onClick = close) { Text("Close") }
                    EmptyState(
                        icon = PantopusIcon.AlertCircle,
                        headline = "Couldn't load the task",
                        subcopy = current.message,
                        ctaTitle = "Try again",
                        onCta = viewModel::refresh,
                    )
                }
        }

        toast?.let { payload ->
            AddHouseholdTaskToastView(
                payload = payload,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10),
            )
        }
    }
}

/** Snapshot of every loaded-state field consumed by the rendering
 *  surface — kept as a data class so Paparazzi can drive it directly. */
internal data class AddHouseholdTaskLoadedState(
    val fields: Map<AddHouseholdTaskField, FormFieldState>,
    val members: List<HouseholdTaskAssignableMember>,
    val isEditing: Boolean,
    val isValid: Boolean,
    val isDirty: Boolean,
    val isSaving: Boolean,
    val selectedCategory: AddHouseholdTaskFormCategory,
    val selectedRecurrence: AddHouseholdTaskRecurrence,
    val selectedCustomUnit: AddHouseholdTaskCustomUnit,
    val selectedAssigneeId: String?,
    val showsCustomRecurrenceSubForm: Boolean,
    val memberListUnavailable: Boolean = false,
)

@Composable
internal fun AddHouseholdTaskLoaded(
    state: AddHouseholdTaskLoadedState,
    onClose: () -> Unit,
    onCommit: () -> Unit,
    onUpdate: (AddHouseholdTaskField, String) -> Unit,
    onSelectCategory: (AddHouseholdTaskFormCategory) -> Unit,
    onSelectRecurrence: (AddHouseholdTaskRecurrence) -> Unit,
    onSelectCustomUnit: (AddHouseholdTaskCustomUnit) -> Unit,
    onSelectAssignee: (String?) -> Unit,
    onSetDueDate: (String?) -> Unit,
    focusDueDate: Boolean = false,
    onDueDatePickerDismiss: () -> Unit = {},
) {
    FormShell(
        title = if (state.isEditing) "Edit task" else "Add task",
        rightActionLabel = "Save",
        isValid = state.isValid,
        isDirty = state.isDirty,
        isSaving = state.isSaving,
        onClose = onClose,
        onCommit = onCommit,
    ) {
        FormFieldGroup("Task") {
            TitleField(state.fields, onUpdate)
            CategoryPicker(state.selectedCategory, onSelectCategory)
        }
        FormFieldGroup("Assigned to") {
            AssigneePicker(
                members = state.members,
                memberListUnavailable = state.memberListUnavailable,
                selectedId = state.selectedAssigneeId,
                onSelect = onSelectAssignee,
            )
        }
        FormFieldGroup("Schedule") {
            RecurrencePicker(state.selectedRecurrence, onSelectRecurrence)
            if (state.showsCustomRecurrenceSubForm) {
                CustomRecurrenceSubForm(
                    fields = state.fields,
                    unit = state.selectedCustomUnit,
                    onUpdate = onUpdate,
                    onSelectUnit = onSelectCustomUnit,
                )
            }
            DueDateField(
                fields = state.fields,
                isRecurring = state.selectedRecurrence.isRecurring,
                onSetDueDate = onSetDueDate,
                focusDueDate = focusDueDate,
                onPickerDismiss = onDueDatePickerDismiss,
            )
        }
        FormFieldGroup("Notes") {
            NotesField(state.fields, onUpdate)
        }
    }
}

// ── Field builders ──────────────────────────────────────────────

@Composable
private fun TitleField(
    fields: Map<AddHouseholdTaskField, FormFieldState>,
    onUpdate: (AddHouseholdTaskField, String) -> Unit,
) {
    val snapshot = fields[AddHouseholdTaskField.Title]
    val count = snapshot?.value?.length ?: 0
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        PantopusTextField(
            label = "Title",
            value = snapshot?.value.orEmpty(),
            onValueChange = { onUpdate(AddHouseholdTaskField.Title, it) },
            placeholder = "e.g. Take out the trash",
            state = fieldStateFor(snapshot),
            fieldTestTag = "field_title",
        )
        Text(
            text = "$count / 80",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun CategoryPicker(
    selected: AddHouseholdTaskFormCategory,
    onSelect: (AddHouseholdTaskFormCategory) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Category",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.testTag("field_category"),
        ) {
            // Wrap into rows of three so a narrow device doesn't
            // overflow the white surface card.
            val rows = AddHouseholdTaskFormCategory.entries.chunked(3)
            for (row in rows) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    for (category in row) {
                        CategoryChip(
                            category = category,
                            selected = category == selected,
                            onClick = { onSelect(category) },
                        )
                    }
                    if (row.size < 3) Spacer(modifier = Modifier.width(Spacing.s0))
                }
            }
        }
    }
}

@Composable
private fun CategoryChip(
    category: AddHouseholdTaskFormCategory,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("field_category_${category.rawValue}")
                .semantics {
                    contentDescription =
                        if (selected) "${category.label} category, selected" else "${category.label} category"
                },
    ) {
        PantopusIconImage(
            icon = category.icon,
            contentDescription = null,
            size = 14.dp,
            tint = if (selected) PantopusColors.primary600 else PantopusColors.appTextSecondary,
        )
        Text(
            text = category.label,
            style = PantopusTextStyle.small,
            color = if (selected) PantopusColors.primary600 else PantopusColors.appText,
        )
    }
}

@Composable
private fun AssigneePicker(
    members: List<HouseholdTaskAssignableMember>,
    memberListUnavailable: Boolean,
    selectedId: String?,
    onSelect: (String?) -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.testTag("field_assignedTo"),
    ) {
        AssigneeRow(
            id = null,
            title = "Unassigned",
            initials = "··",
            selected = selectedId == null,
            onClick = { onSelect(null) },
        )
        for (member in members) {
            AssigneeRow(
                id = member.id,
                title = member.displayName,
                initials = member.initials,
                selected = selectedId == member.id,
                onClick = { onSelect(member.id) },
            )
        }
        // Someone this viewer can't see in the list (they may not list members, or the person left)
        // stays selected under the same short label the task list uses.
        if (selectedId != null && members.none { it.id == selectedId }) {
            AssigneeRow(
                id = selectedId,
                title = HouseholdTasksListViewModel.assigneeDisplay(selectedId) ?: "Current assignee",
                initials = "··",
                selected = true,
                onClick = { onSelect(selectedId) },
            )
        }
        AssigneeNote(members.isEmpty(), memberListUnavailable)
    }
}

@Composable
private fun AssigneeNote(
    noMembers: Boolean,
    memberListUnavailable: Boolean,
) {
    val text =
        when {
            memberListUnavailable -> "Household members couldn't be loaded. You can take this task yourself or leave it unassigned."
            noMembers -> "No assignable members are available."
            else -> return
        }
    Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
}

@Composable
private fun AssigneeRow(
    id: String?,
    title: String,
    initials: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("field_assignedTo_${id ?: "none"}")
                .semantics {
                    contentDescription = if (selected) "$title, selected" else title
                },
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .border(
                        width = if (selected) 6.dp else 2.dp,
                        color = if (selected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        shape = CircleShape,
                    ),
        )
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.homeBg),
        ) {
            Text(
                text = initials,
                style = PantopusTextStyle.small,
                color = PantopusColors.home,
            )
        }
        Text(
            text = title,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.padding(vertical = Spacing.s2),
        )
    }
}

@Composable
private fun RecurrencePicker(
    selected: AddHouseholdTaskRecurrence,
    onSelect: (AddHouseholdTaskRecurrence) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Saved recurrence",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = "This saves a preference. To start or change automatic repeats, open Repeat schedule on the saved task.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.testTag("field_recurrence"),
        ) {
            for (option in AddHouseholdTaskRecurrence.entries) {
                RecurrenceRow(option, selected == option) { onSelect(option) }
            }
        }
    }
}

@Composable
private fun RecurrenceRow(
    option: AddHouseholdTaskRecurrence,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("field_recurrence_${option.rawValue}")
                .semantics {
                    contentDescription = if (selected) "${option.label}, selected" else option.label
                },
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .border(
                        width = if (selected) 6.dp else 2.dp,
                        color = if (selected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        shape = CircleShape,
                    ),
        )
        Text(
            text = option.label,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.padding(vertical = Spacing.s2),
        )
        if (option.isRecurring) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowsRepeat,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun CustomRecurrenceSubForm(
    fields: Map<AddHouseholdTaskField, FormFieldState>,
    unit: AddHouseholdTaskCustomUnit,
    onUpdate: (AddHouseholdTaskField, String) -> Unit,
    onSelectUnit: (AddHouseholdTaskCustomUnit) -> Unit,
) {
    val intervalSnapshot = fields[AddHouseholdTaskField.CustomInterval]
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("customRecurrenceSubForm"),
    ) {
        Text(
            text = "Every…",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            Box(modifier = Modifier.width(96.dp)) {
                PantopusTextField(
                    label = "",
                    value = intervalSnapshot?.value.orEmpty(),
                    onValueChange = { onUpdate(AddHouseholdTaskField.CustomInterval, it) },
                    placeholder = "3",
                    state = fieldStateFor(intervalSnapshot),
                    keyboardType = KeyboardType.Number,
                    fieldTestTag = "field_customInterval",
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                modifier = Modifier.testTag("field_customUnit"),
            ) {
                for (option in AddHouseholdTaskCustomUnit.entries) {
                    UnitChip(option, option == unit) { onSelectUnit(option) }
                }
            }
        }
    }
}

@Composable
private fun UnitChip(
    unit: AddHouseholdTaskCustomUnit,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("field_customUnit_${unit.rawValue}")
                .semantics {
                    contentDescription = if (selected) "${unit.label}, selected" else unit.label
                },
    ) {
        Text(
            text = unit.label,
            style = PantopusTextStyle.small,
            color = if (selected) PantopusColors.primary600 else PantopusColors.appText,
        )
    }
}

@Composable
private fun DueDateField(
    fields: Map<AddHouseholdTaskField, FormFieldState>,
    isRecurring: Boolean,
    onSetDueDate: (String?) -> Unit,
    focusDueDate: Boolean,
    onPickerDismiss: () -> Unit,
) {
    val snapshot = fields[AddHouseholdTaskField.DueAt]
    val value = snapshot?.value.orEmpty()
    if (focusDueDate) {
        TaskReminderDatePicker(
            value = value,
            onSelect = {
                onSetDueDate(it.toString())
                onPickerDismiss()
            },
            onDismiss = onPickerDismiss,
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (isRecurring) "First occurrence" else "Due date",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            if (value.isNotEmpty()) {
                Text(
                    text = "Clear",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clickable { onSetDueDate(null) }
                            .testTag("field_dueAt_clear")
                            .semantics { contentDescription = "Clear due date" },
                )
            }
        }
        // Keep the existing editable date field; notification entry also opens
        // the same Material calendar used by the household calendar/bill forms.
        PantopusTextField(
            label = "",
            value = value,
            onValueChange = { onSetDueDate(it.ifBlank { null }) },
            placeholder = "YYYY-MM-DD",
            state = fieldStateFor(snapshot),
            keyboardType = KeyboardType.Number,
            fieldTestTag = "field_dueAt",
        )
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun TaskReminderDatePicker(
    value: String,
    onSelect: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val initial = remember(value) { runCatching { LocalDate.parse(value) }.getOrDefault(LocalDate.now()) }
    // Material dates are UTC midnight, not an instant in the device's zone.
    val picker =
        androidx.compose.material3.rememberDatePickerState(
            initialSelectedDateMillis = initial.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                enabled = picker.selectedDateMillis != null,
                onClick = {
                    picker.selectedDateMillis?.let { onSelect(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                },
                modifier = Modifier.testTag("taskReminderDueDateDone"),
            ) { Text("Done") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        androidx.compose.material3.DatePicker(
            state = picker,
            modifier = Modifier.testTag("taskReminderDueDatePicker"),
        )
    }
}

@Composable
private fun NotesField(
    fields: Map<AddHouseholdTaskField, FormFieldState>,
    onUpdate: (AddHouseholdTaskField, String) -> Unit,
) {
    val snapshot = fields[AddHouseholdTaskField.Notes]
    val error = snapshot?.error
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Notes (optional)",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        BasicTextField(
            value = snapshot?.value.orEmpty(),
            onValueChange = { onUpdate(AddHouseholdTaskField.Notes, it) },
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = if (error != null) PantopusColors.error else PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.md),
                    )
                    .padding(Spacing.s2)
                    .testTag("field_notes"),
        )
        if (error != null) {
            Text(
                text = error,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
internal fun AddHouseholdTaskToastView(
    payload: AddHouseholdTaskToast,
    modifier: Modifier = Modifier,
) {
    Toast(
        message =
            ToastMessage(
                text = payload.text,
                kind = if (payload.isError) ToastKind.Error else ToastKind.Success,
            ),
        modifier = modifier.testTag("addHouseholdTaskToast"),
    )
}

private fun fieldStateFor(snapshot: FormFieldState?): PantopusFieldState =
    when {
        snapshot == null -> PantopusFieldState.Default
        snapshot.error != null && snapshot.touched -> PantopusFieldState.Error(snapshot.error)
        snapshot.touched && snapshot.isDirty && snapshot.value.trim().isNotEmpty() ->
            PantopusFieldState.Valid
        else -> PantopusFieldState.Default
    }

/** Shimmer skeleton shown while Edit-mode hydration runs. */
@Composable
internal fun AddHouseholdTaskSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().testTag("addHouseholdTaskFormSkeleton"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Edit task",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
        }
        repeat(3) { groupIndex ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 96.dp, height = 12.dp)
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface)
                            .padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    repeat(if (groupIndex == 0) 3 else 2) {
                        Shimmer(width = 240.dp, height = 44.dp)
                    }
                }
            }
        }
    }
}
