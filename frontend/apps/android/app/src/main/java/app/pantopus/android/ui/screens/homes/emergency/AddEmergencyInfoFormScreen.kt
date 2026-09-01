@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.emergency

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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * P2.8 — Add / Edit Emergency Info form. Built on the shared
 * [FormShell] archetype.
 *
 * @param onClose Pops the form (used for the close X and after a save).
 * @param editDraft When non-null, seeds the form in edit mode.
 */
@Composable
fun AddEmergencyInfoFormScreen(
    onClose: () -> Unit,
    editDraft: EmergencyFormDraft? = null,
    viewModel: AddEmergencyInfoFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showMemberPicker by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.configure(editDraft = editDraft, onCreated = { _ -> }, onUpdated = { _ -> })
        viewModel.loadMembers()
    }

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(state.shouldDismiss) {
        if (state.shouldDismiss) {
            viewModel.acknowledgeDismiss()
            delay(400)
            onClose()
        }
    }

    val screenTitle =
        if (state.mode is AddEmergencyInfoUiState.Mode.Edit) "Edit emergency info" else "Add emergency info"

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("addEmergencyInfoForm"),
    ) {
        FormShell(
            title = screenTitle,
            isValid = state.isValid,
            isDirty = state.isDirty,
            onClose = onClose,
            onCommit = { viewModel.submit() },
            isSaving = state.isSaving,
        ) {
            CategorySection(
                selected = state.category,
                onSelect = viewModel::setCategory,
            )
            TitleSection(
                state = state,
                onChange = viewModel::updateTitle,
            )
            if (state.category.supportsSeverity) {
                SeveritySection(
                    selected = state.severity,
                    onSelect = { severity ->
                        viewModel.setSeverity(if (state.severity == severity) null else severity)
                    },
                )
            }
            DetailsSection(
                state = state,
                onChange = viewModel::updateDetails,
            )
            VerifiedBySection(
                label = state.verifiedByLabel(),
                onTap = { showMemberPicker = true },
            )
        }

        state.toast?.let { toast ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 100.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (toast.isError) PantopusColors.error else PantopusColors.success)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("addEmergencyInfoToast"),
            ) {
                Text(
                    text = toast.text,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }

    if (showMemberPicker) {
        MemberPickerDialog(
            members = state.members,
            selected = state.verifiedByUserId,
            onSelect = { uid ->
                viewModel.setVerifiedBy(uid)
                showMemberPicker = false
            },
            onClear = {
                viewModel.setVerifiedBy(null)
                showMemberPicker = false
            },
            onDismiss = { showMemberPicker = false },
        )
    }
}

// MARK: - Sections

@Composable
private fun CategorySection(
    selected: EmergencyFormCategory,
    onSelect: (EmergencyFormCategory) -> Unit,
) {
    FormFieldGroup("Category") {
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.heightIn(min = 200.dp, max = 280.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            items(EmergencyFormCategory.entries, key = { it.id }) { category ->
                CategoryTile(
                    category = category,
                    isSelected = category == selected,
                    onClick = { onSelect(category) },
                )
            }
        }
    }
}

@Composable
private fun CategoryTile(
    category: EmergencyFormCategory,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    val border = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderSubtle
    val background =
        if (isSelected) PantopusColors.primary50 else PantopusColors.appSurfaceMuted
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = border,
                    shape = RoundedCornerShape(Radii.md),
                )
                .clickable(onClick = onClick)
                .padding(Spacing.s2)
                .testTag("categoryTile_${category.id}")
                .semantics { contentDescription = category.label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(category.palette.background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = category.icon,
                contentDescription = null,
                size = Radii.xl,
                tint = category.palette.foreground,
            )
        }
        Text(
            text = category.label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun TitleSection(
    state: AddEmergencyInfoUiState,
    onChange: (String) -> Unit,
) {
    FormFieldGroup("Title") {
        val fieldState =
            when {
                state.titleField.error != null -> PantopusFieldState.Error(state.titleField.error!!)
                state.titleField.touched && state.titleField.value.trim().isNotEmpty() ->
                    PantopusFieldState.Valid
                else -> PantopusFieldState.Default
            }
        PantopusTextField(
            label = "Title",
            value = state.titleField.value,
            onValueChange = onChange,
            placeholder = titlePlaceholder(state.category),
            state = fieldState,
            fieldTestTag = "field_title",
        )
    }
}

@Composable
private fun SeveritySection(
    selected: EmergencySeverity?,
    onSelect: (EmergencySeverity) -> Unit,
) {
    FormFieldGroup("Severity") {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            EmergencySeverity.entries.forEach { severity ->
                SeverityChipButton(
                    severity = severity,
                    isSelected = selected == severity,
                    onClick = { onSelect(severity) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Spacer(Modifier.height(Spacing.s1))
        Text(
            text = "Tap a chip to mark how urgent this item is. Tap again to clear.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SeverityChipButton(
    severity: EmergencySeverity,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 36.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(severity.background)
                .border(
                    width = if (isSelected) 2.dp else 0.dp,
                    color = if (isSelected) severity.foreground else PantopusColors.appBorderSubtle,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("severityChip_${severity.id}")
                .semantics { contentDescription = "Severity ${severity.label}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = severity.icon,
            contentDescription = null,
            size = Radii.lg,
            tint = severity.foreground,
        )
        Text(
            text = severity.label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = severity.foreground,
        )
    }
}

@Composable
private fun DetailsSection(
    state: AddEmergencyInfoUiState,
    onChange: (String) -> Unit,
) {
    FormFieldGroup("Details") {
        val borderColor =
            if (state.detailsField.error != null) PantopusColors.error else PantopusColors.appBorder
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, borderColor, RoundedCornerShape(Radii.md))
                    .padding(Spacing.s2),
        ) {
            BasicTextField(
                value = state.detailsField.value,
                onValueChange = onChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier =
                    Modifier
                        .fillMaxSize()
                        .testTag("field_details"),
            )
        }
        if (state.detailsField.error != null) {
            Spacer(Modifier.height(Spacing.s1))
            Text(
                text = state.detailsField.error!!,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun VerifiedBySection(
    label: String?,
    onTap: () -> Unit,
) {
    FormFieldGroup("Verified by") {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .clickable(onClick = onTap)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .testTag("field_verifiedBy")
                    .semantics {
                        contentDescription =
                            label?.let { "Verified by $it" } ?: "Verified by — none selected"
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UserRound,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = label ?: "Pick a household member (optional)",
                style = PantopusTextStyle.body,
                color =
                    if (label == null) PantopusColors.appTextMuted else PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun MemberPickerDialog(
    members: List<app.pantopus.android.data.api.models.homes.OccupantDto>,
    selected: String?,
    onSelect: (String) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Verified by",
                style = PantopusTextStyle.h3,
                modifier = Modifier.semantics { heading() },
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                if (selected != null) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable(onClick = onClear)
                                .padding(Spacing.s2)
                                .testTag("memberPicker_clear"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.X,
                            contentDescription = null,
                            size = Radii.xl,
                            tint = PantopusColors.appTextSecondary,
                        )
                        Text("Clear selection", style = PantopusTextStyle.body)
                    }
                }
                if (members.isEmpty()) {
                    Text(
                        text = "No household members yet.",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextSecondary,
                    )
                } else {
                    members.forEach { member ->
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect(member.userId) }
                                    .padding(Spacing.s2)
                                    .testTag("memberPicker_member_${member.userId}"),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.UserRound,
                                contentDescription = null,
                                size = Radii.xl,
                                tint = PantopusColors.appTextSecondary,
                            )
                            Text(
                                text = member.displayName ?: member.username ?: "Member",
                                style = PantopusTextStyle.body,
                                modifier = Modifier.weight(1f),
                            )
                            if (selected == member.userId) {
                                PantopusIconImage(
                                    icon = PantopusIcon.Check,
                                    contentDescription = null,
                                    size = Radii.xl,
                                    tint = PantopusColors.primary600,
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Done") }
        },
    )
}

private fun titlePlaceholder(category: EmergencyFormCategory): String =
    when (category) {
        EmergencyFormCategory.Allergy -> "e.g. Penicillin allergy"
        EmergencyFormCategory.MedicalCondition -> "e.g. Asthma"
        EmergencyFormCategory.Medication -> "e.g. Daily metformin"
        EmergencyFormCategory.Contact -> "e.g. Dr. Lin — family doctor"
        EmergencyFormCategory.PetMedical -> "e.g. Murphy — chicken allergy"
        EmergencyFormCategory.PowerOfAttorney -> "e.g. Healthcare POA — Sarah"
        EmergencyFormCategory.Other -> "Short, scannable label"
    }
