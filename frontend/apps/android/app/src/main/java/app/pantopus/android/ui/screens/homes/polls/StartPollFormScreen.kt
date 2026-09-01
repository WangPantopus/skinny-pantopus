@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "UnusedPrivateMember", "LongParameterList")

package app.pantopus.android.ui.screens.homes.polls

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.homes.invite_owner.ToastPayload
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Test tags wired to the assertion matrix. */
const val START_POLL_FORM_TAG = "startPollForm"
const val START_POLL_QUESTION_FIELD_TAG = "startPollQuestionField"
const val START_POLL_ADD_OPTION_BUTTON_TAG = "startPollAddOptionButton"
const val START_POLL_ANONYMITY_TOGGLE_TAG = "startPollAnonymityToggle"
const val START_POLL_AUDIENCE_ALL_TAG = "startPollAudienceAll"
const val START_POLL_AUDIENCE_LOADING_TAG = "startPollAudienceLoading"
const val START_POLL_CLOSE_DATE_FIELD_TAG = "startPollCloseDateField"

/** Compose entry for the Start-a-Poll form. */
@Composable
fun StartPollFormScreen(
    onClose: () -> Unit,
    viewModel: StartPollFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.loadMembers() }

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_500)
            viewModel.dismissToast()
        }
    }
    LaunchedEffect(state.shouldDismiss) {
        if (state.shouldDismiss) {
            viewModel.acknowledgeDismiss()
            onClose()
        }
    }

    StartPollFormContent(
        state = state,
        isValid = viewModel.isValid(state),
        isDirty = viewModel.isDirty(state),
        onClose = onClose,
        onCommit = { viewModel.submit() },
        onQuestionChange = viewModel::updateQuestion,
        onKindChange = viewModel::setKind,
        onAddOption = viewModel::addOption,
        onRemoveOption = viewModel::removeOption,
        onOptionChange = viewModel::updateOption,
        onSelectAllMembers = viewModel::selectAllMembers,
        onToggleMember = viewModel::toggleMember,
        onCloseDateChange = viewModel::setCloseDate,
        onAnonymityChange = viewModel::setAnonymous,
    )
}

/**
 * Stateless composable separated so Paparazzi snapshots can drive it
 * with a hand-built [StartPollUiState] without standing up Hilt.
 */
@Composable
internal fun StartPollFormContent(
    state: StartPollUiState,
    isValid: Boolean,
    isDirty: Boolean,
    onClose: () -> Unit,
    onCommit: () -> Unit,
    onQuestionChange: (String) -> Unit,
    onKindChange: (StartPollKind) -> Unit,
    onAddOption: () -> Unit,
    onRemoveOption: (String) -> Unit,
    onOptionChange: (String, String) -> Unit,
    onSelectAllMembers: () -> Unit,
    onToggleMember: (String) -> Unit,
    onCloseDateChange: (LocalDateTime?) -> Unit,
    onAnonymityChange: (Boolean) -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(START_POLL_FORM_TAG)) {
        FormShell(
            title = "Start a poll",
            rightActionLabel = "Post",
            isValid = isValid,
            isDirty = isDirty,
            isSaving = state.status is StartPollFormStatus.Submitting,
            onClose = onClose,
            onCommit = onCommit,
        ) {
            QuestionSection(
                question = state.question,
                error = state.questionError,
                touched = state.questionTouched,
                onChange = onQuestionChange,
            )
            KindSection(
                kind = state.kind,
                onChange = onKindChange,
            )
            OptionsSection(
                kind = state.kind,
                options = state.options,
                onAdd = onAddOption,
                onRemove = onRemoveOption,
                onChange = onOptionChange,
            )
            AudienceSection(
                state = state,
                onSelectAll = onSelectAllMembers,
                onToggle = onToggleMember,
            )
            ScheduleSection(
                closesAt = state.closesAt,
                isAnonymous = state.isAnonymous,
                onCloseDateChange = onCloseDateChange,
                onAnonymityChange = onAnonymityChange,
            )
            Spacer(modifier = Modifier.height(Spacing.s4))
        }

        state.toast?.let { toast -> ToastBanner(payload = toast, modifier = Modifier.align(Alignment.BottomCenter)) }
    }
}

// MARK: - Sections

@Composable
private fun QuestionSection(
    question: String,
    error: String?,
    touched: Boolean,
    onChange: (String) -> Unit,
) {
    FormFieldGroup("Question") {
        val fieldState =
            when {
                !touched -> PantopusFieldState.Default
                error != null -> PantopusFieldState.Error(error)
                question.trim().isEmpty() -> PantopusFieldState.Default
                else -> PantopusFieldState.Valid
            }
        PantopusTextField(
            label = "Question",
            value = question,
            onValueChange = onChange,
            placeholder = "What should we decide?",
            state = fieldState,
            keyboardType = KeyboardType.Text,
            fieldTestTag = START_POLL_QUESTION_FIELD_TAG,
        )
        Text(
            text = "${question.length} / ${StartPollBounds.QUESTION_MAX}",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.testTag("startPollQuestionCount"),
        )
    }
}

@Composable
private fun KindSection(
    kind: StartPollKind,
    onChange: (StartPollKind) -> Unit,
) {
    FormFieldGroup("Poll kind") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            StartPollKind.entries.forEach { entry ->
                KindRow(
                    kind = entry,
                    isSelected = entry == kind,
                    onTap = { onChange(entry) },
                )
            }
        }
        Text(
            text = kind.helper,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun KindRow(
    kind: StartPollKind,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 1.5.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderSubtle,
                    shape = RoundedCornerShape(Radii.md),
                ).clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("startPollKindOption_${kind.name}")
                .semantics {
                    role = Role.RadioButton
                    contentDescription = kind.label
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = kind.icon,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = kind.label,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.primary600,
            )
        } else {
            Box(
                modifier =
                    Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .border(1.dp, PantopusColors.appBorder, CircleShape),
            )
        }
    }
}

@Composable
private fun OptionsSection(
    kind: StartPollKind,
    options: List<StartPollOption>,
    onAdd: () -> Unit,
    onRemove: (String) -> Unit,
    onChange: (String, String) -> Unit,
) {
    val title = if (kind == StartPollKind.YesNo) "Options (auto)" else "Options"
    FormFieldGroup(title) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            options.forEachIndexed { index, option ->
                OptionRow(
                    option = option,
                    index = index,
                    canRemove = kind.allowsCustomOptions && options.size > StartPollBounds.MIN_OPTIONS,
                    onChange = { value -> onChange(option.id, value) },
                    onRemove = { onRemove(option.id) },
                )
            }
            if (kind.allowsCustomOptions && options.size < StartPollBounds.MAX_OPTIONS) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 44.dp)
                            .clickable(onClick = onAdd)
                            .testTag(START_POLL_ADD_OPTION_BUTTON_TAG)
                            .semantics { contentDescription = "Add option" },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Plus,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.primary600,
                    )
                    Text(
                        text = "Add option",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.primary600,
                    )
                }
            }
            if (kind.allowsCustomOptions) {
                Text(
                    text =
                        "At least ${StartPollBounds.MIN_OPTIONS}, up to " +
                            "${StartPollBounds.MAX_OPTIONS}. Each option must be unique.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun OptionRow(
    option: StartPollOption,
    index: Int,
    canRemove: Boolean,
    onChange: (String) -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (option.isLocked) {
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.md))
                        .padding(horizontal = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = option.label,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
            }
            Box(
                modifier = Modifier.size(width = 32.dp, height = 44.dp),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Lock,
                    contentDescription = "Locked option",
                    size = Radii.xl,
                    tint = PantopusColors.appTextMuted,
                )
            }
        } else {
            PantopusTextField(
                label = "Option ${index + 1}",
                value = option.label,
                onValueChange = onChange,
                placeholder = "Option ${index + 1}",
                fieldTestTag = "startPollOptionField_${option.id}",
                modifier = Modifier.weight(1f),
            )
            if (canRemove) {
                Box(
                    modifier =
                        Modifier
                            .size(32.dp)
                            .heightIn(min = 44.dp)
                            .clickable(onClick = onRemove)
                            .testTag("startPollRemoveOption_${option.id}")
                            .semantics { contentDescription = "Remove option ${index + 1}" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            } else {
                Box(modifier = Modifier.size(width = 32.dp, height = 44.dp))
            }
        }
    }
}

@Composable
private fun AudienceSection(
    state: StartPollUiState,
    onSelectAll: () -> Unit,
    onToggle: (String) -> Unit,
) {
    FormFieldGroup("Audience") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            AudienceAllRow(
                isSelected = !state.audience.isSelective,
                onTap = onSelectAll,
            )
            when {
                state.isLoadingMembers ->
                    Shimmer(
                        width = 320.dp,
                        height = 40.dp,
                        cornerRadius = Radii.md,
                        modifier = Modifier.testTag(START_POLL_AUDIENCE_LOADING_TAG),
                    )
                state.members.isEmpty() ->
                    Text(
                        text = "No other members to invite.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextMuted,
                    )
                else -> {
                    val selectedIds = state.audience.selectedIds
                    state.members.forEach { member ->
                        MemberToggleRow(
                            member = member,
                            isSelected = selectedIds.contains(member.id),
                            onTap = { onToggle(member.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AudienceAllRow(
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 1.5.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderSubtle,
                    shape = RoundedCornerShape(Radii.md),
                ).clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag(START_POLL_AUDIENCE_ALL_TAG)
                .semantics {
                    role = Role.RadioButton
                    contentDescription = "All household members"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "All household members",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text = "Everyone with an active membership can vote.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.primary600,
            )
        } else {
            Box(
                modifier =
                    Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .border(1.dp, PantopusColors.appBorder, CircleShape),
            )
        }
    }
}

@Composable
private fun MemberToggleRow(
    member: StartPollMember,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 1.5.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderSubtle,
                    shape = RoundedCornerShape(Radii.md),
                ).clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("startPollMemberRow_${member.id}")
                .semantics {
                    role = Role.Checkbox
                    contentDescription = member.name
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.User,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = member.name,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.primary600,
            )
        } else {
            Box(
                modifier =
                    Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .border(1.dp, PantopusColors.appBorder, CircleShape),
            )
        }
    }
}

@Composable
private fun ScheduleSection(
    closesAt: LocalDateTime?,
    isAnonymous: Boolean,
    onCloseDateChange: (LocalDateTime?) -> Unit,
    onAnonymityChange: (Boolean) -> Unit,
) {
    FormFieldGroup("Close date") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            var showPicker by remember { mutableStateOf(false) }
            val formatter = remember { DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US) }

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.md))
                        .clickable { showPicker = true }
                        .padding(Spacing.s3)
                        .testTag(START_POLL_CLOSE_DATE_FIELD_TAG)
                        .semantics { contentDescription = "Close date" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Calendar,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = closesAt?.toLocalDate()?.format(formatter) ?: "Pick a close date",
                    style = PantopusTextStyle.body,
                    color =
                        if (closesAt != null) PantopusColors.appText else PantopusColors.appTextMuted,
                    modifier = Modifier.weight(1f),
                )
            }

            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable { onAnonymityChange(!isAnonymous) }
                        .testTag(START_POLL_ANONYMITY_TOGGLE_TAG)
                        .semantics {
                            role = Role.Switch
                            contentDescription = "Anonymous voting"
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Anonymous voting",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "Hide who voted for what — only totals appear.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Switch(
                    checked = isAnonymous,
                    onCheckedChange = onAnonymityChange,
                    colors =
                        SwitchDefaults.colors(
                            checkedThumbColor = PantopusColors.appTextInverse,
                            checkedTrackColor = PantopusColors.primary600,
                            uncheckedThumbColor = PantopusColors.appTextInverse,
                            uncheckedTrackColor = PantopusColors.appBorderStrong,
                        ),
                )
            }

            if (showPicker) {
                SimpleDateTimePickerDialog(
                    initial = closesAt,
                    onSelect = {
                        onCloseDateChange(it)
                        showPicker = false
                    },
                    onDismiss = { showPicker = false },
                )
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun SimpleDateTimePickerDialog(
    initial: LocalDateTime?,
    onSelect: (LocalDateTime) -> Unit,
    onDismiss: () -> Unit,
) {
    val seed = initial ?: LocalDateTime.now().plusDays(1)
    val initialMillis =
        seed
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    val state = androidx.compose.material3.rememberDatePickerState(initialSelectedDateMillis = initialMillis)
    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = {
                val picked = state.selectedDateMillis
                if (picked != null) {
                    val date =
                        java.time.Instant
                            .ofEpochMilli(picked)
                            .atZone(ZoneId.systemDefault())
                            .toLocalDate()
                    // Default to 5pm local on the picked day so the close
                    // window is always at least 1 hour in the future
                    // unless the user picked today.
                    val combined =
                        if (date == LocalDate.now()) {
                            LocalDateTime.of(date, LocalTime.now().plusHours(2))
                        } else {
                            LocalDateTime.of(date, LocalTime.of(17, 0))
                        }
                    onSelect(combined)
                } else {
                    onDismiss()
                }
            }) { Text("Done") }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    ) {
        androidx.compose.material3.DatePicker(state = state)
    }
}

@Composable
private fun ToastBanner(
    payload: ToastPayload,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .padding(bottom = Spacing.s10)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (payload.isError) PantopusColors.error else PantopusColors.success)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
    ) {
        Text(
            text = payload.text,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextInverse,
        )
    }
}
