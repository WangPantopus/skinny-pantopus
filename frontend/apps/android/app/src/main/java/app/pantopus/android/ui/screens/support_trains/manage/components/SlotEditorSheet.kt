@file:Suppress("LongMethod", "MagicNumber", "PackageNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.support_trains.manage.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.FutureDateTimePickerDialogs
import app.pantopus.android.ui.screens.support_trains.manage.ManageSlotEditorState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * S1 — organizer add / edit for one Support Train date. Mirrors RN's
 * `components/support-trains/SupportTrainSlotEditorSheet.tsx` and the
 * iOS `SlotEditorSheet`: date, slot label, support mode and the drop-off
 * window. Posts through `POST /:id/slots` (add) or
 * `PATCH /:id/slots/:slotId` (edit); both Joi schemas cap the label /
 * mode to the enums surfaced here and want `HH:mm` times.
 */
@Composable
fun SlotEditorSheet(
    editor: ManageSlotEditorState,
    isSubmitting: Boolean,
    onSave: (ManageSlotEditorState) -> Unit,
    onCancel: () -> Unit,
) {
    var draft by remember(editor.slotId) { mutableStateOf(editor) }
    var pickerTarget by remember { mutableStateOf<PickerTarget?>(null) }
    val canSave = !isSubmitting && draft.endTime > draft.startTime

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .testTag("slotEditorSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.fillMaxWidth().height(52.dp).background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (editor.isEditing) "Edit date" else "Add a date",
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.semantics { heading() },
            )
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .padding(start = Spacing.s2)
                        .height(44.dp)
                        .clickable(onClick = onCancel)
                        .padding(horizontal = Spacing.s3)
                        .testTag("slotEditorCloseButton")
                        .semantics {
                            role = Role.Button
                            contentDescription = "Close"
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appText,
                )
            }
        }

        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            EditorRow(
                label = "Date",
                value = draft.slotDate,
                tag = "slotEditorDateField",
                onClick = { pickerTarget = PickerTarget.DATE },
            )

            FieldLabel("What kind of date is this?")
            ChipRow(
                options = ManageSlotEditorState.LABELS,
                selected = draft.slotLabel,
                tagPrefix = "slotEditorLabel",
                onSelect = { draft = draft.copy(slotLabel = it) },
            )

            FieldLabel("How can neighbors help?")
            ChipRow(
                options = ManageSlotEditorState.MODES,
                selected = draft.supportMode,
                tagPrefix = "slotEditorMode",
                onSelect = { draft = draft.copy(supportMode = it) },
            )

            EditorRow(
                label = "Window opens",
                value = draft.startTime,
                tag = "slotEditorStartField",
                onClick = { pickerTarget = PickerTarget.START },
            )
            EditorRow(
                label = "Window closes",
                value = draft.endTime,
                tag = "slotEditorEndField",
                onClick = { pickerTarget = PickerTarget.END },
            )

            if (draft.endTime <= draft.startTime) {
                Text(
                    text = "The window has to close after it opens.",
                    color = PantopusColors.error,
                    fontSize = 12.5.sp,
                )
            }
        }

        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(if (canSave) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                        .clickable(enabled = canSave) { onSave(draft) }
                        .testTag("slotEditorSaveButton"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (editor.isEditing) "Save date" else "Add date",
                    color = PantopusColors.appTextInverse,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }

    pickerTarget?.let { target ->
        FutureDateTimePickerDialogs(
            initial = null,
            onPicked = { picked ->
                draft =
                    when (target) {
                        PickerTarget.DATE -> draft.copy(slotDate = picked.toLocalDate().format(DATE_FORMAT))
                        PickerTarget.START -> draft.copy(startTime = picked.toLocalTime().format(TIME_FORMAT))
                        PickerTarget.END -> draft.copy(endTime = picked.toLocalTime().format(TIME_FORMAT))
                    }
                pickerTarget = null
            },
            onDismiss = { pickerTarget = null },
        )
    }
}

private enum class PickerTarget { DATE, START, END }

private val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
private val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        color = PantopusColors.appTextSecondary,
        fontSize = 12.5.sp,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun EditorRow(
    label: String,
    value: String,
    tag: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag(tag)
                .semantics {
                    role = Role.Button
                    contentDescription = "$label $value"
                },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, color = PantopusColors.appTextSecondary, fontSize = 13.sp)
        Box(modifier = Modifier.weight(1f))
        Text(
            text = value,
            color = PantopusColors.appText,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun ChipRow(
    options: List<String>,
    selected: String,
    tagPrefix: String,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        options.forEach { option ->
            val isSelected = option == selected
            Box(
                modifier =
                    Modifier
                        .height(34.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (isSelected) PantopusColors.primary600 else PantopusColors.appSurface)
                        .border(
                            1.dp,
                            if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onSelect(option) }
                        .padding(horizontal = Spacing.s3)
                        .testTag("$tagPrefix-$option"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option.replaceFirstChar { it.uppercase() },
                    color = if (isSelected) PantopusColors.appTextInverse else PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 640)
@Composable
private fun SlotEditorPreview() {
    SlotEditorSheet(
        editor =
            ManageSlotEditorState(
                slotId = null,
                slotDate = LocalDate.now().toString(),
                slotLabel = "Dinner",
                supportMode = "meal",
                startTime = LocalTime.of(17, 0).format(TIME_FORMAT),
                endTime = LocalTime.of(19, 0).format(TIME_FORMAT),
            ),
        isSubmitting = false,
        onSave = {},
        onCancel = {},
    )
}
