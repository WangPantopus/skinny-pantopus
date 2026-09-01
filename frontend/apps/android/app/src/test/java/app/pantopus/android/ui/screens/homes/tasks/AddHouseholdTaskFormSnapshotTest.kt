@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * P2.4 Paparazzi baselines for the Add / Edit Household Task form.
 * Locks the shimmer skeleton, the Add-mode empty pose (Save disabled),
 * the Edit-mode prefilled pose, the submitting state (Save spinner),
 * the error state, and the custom recurrence sub-form.
 */
class AddHouseholdTaskFormSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 3200,
                    softButtons = false,
                ),
        )

    @Test
    fun add_household_task_loading_skeleton() {
        paparazzi.snapshot {
            Frame { AddHouseholdTaskSkeleton() }
        }
    }

    @Test
    fun add_household_task_empty_save_disabled() {
        paparazzi.snapshot {
            Frame {
                AddHouseholdTaskLoaded(
                    state = emptyAddState(),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectRecurrence = {},
                    onSelectCustomUnit = {},
                    onSelectAssignee = {},
                    onSetDueDate = {},
                )
            }
        }
    }

    @Test
    fun edit_household_task_prefilled() {
        paparazzi.snapshot {
            Frame {
                AddHouseholdTaskLoaded(
                    state = prefilledEditState(),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectRecurrence = {},
                    onSelectCustomUnit = {},
                    onSelectAssignee = {},
                    onSetDueDate = {},
                )
            }
        }
    }

    @Test
    fun add_household_task_submitting_save_spinner() {
        paparazzi.snapshot {
            Frame {
                AddHouseholdTaskLoaded(
                    state =
                        emptyAddState().copy(
                            fields = seededFields(title = SeededTitle("Wash dishes")),
                            isValid = true,
                            isDirty = true,
                            isSaving = true,
                        ),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectRecurrence = {},
                    onSelectCustomUnit = {},
                    onSelectAssignee = {},
                    onSetDueDate = {},
                )
            }
        }
    }

    @Test
    fun add_household_task_custom_recurrence_sub_form() {
        paparazzi.snapshot {
            Frame {
                AddHouseholdTaskLoaded(
                    state =
                        emptyAddState().copy(
                            fields =
                                seededFields(
                                    title = SeededTitle("Water plants"),
                                    recurrence = AddHouseholdTaskRecurrence.Custom,
                                    customRecurrence =
                                        SeededCustomRecurrence(
                                            interval = "3",
                                            unit = AddHouseholdTaskCustomUnit.Days,
                                        ),
                                ),
                            isValid = true,
                            isDirty = true,
                            selectedCategory = AddHouseholdTaskFormCategory.Yardwork,
                            selectedRecurrence = AddHouseholdTaskRecurrence.Custom,
                            selectedCustomUnit = AddHouseholdTaskCustomUnit.Days,
                            showsCustomRecurrenceSubForm = true,
                        ),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectRecurrence = {},
                    onSelectCustomUnit = {},
                    onSelectAssignee = {},
                    onSetDueDate = {},
                )
            }
        }
    }

    @Test
    fun add_household_task_validation_error_with_toast() {
        paparazzi.snapshot {
            Frame {
                Box(modifier = Modifier.fillMaxSize()) {
                    AddHouseholdTaskLoaded(
                        state =
                            emptyAddState().copy(
                                fields =
                                    seededFields(
                                        title = SeededTitle(error = "Title is required."),
                                    ),
                                isValid = false,
                                isDirty = true,
                            ),
                        onClose = {},
                        onCommit = {},
                        onUpdate = { _, _ -> },
                        onSelectCategory = {},
                        onSelectRecurrence = {},
                        onSelectCustomUnit = {},
                        onSelectAssignee = {},
                        onSetDueDate = {},
                    )
                    AddHouseholdTaskToastView(
                        payload = AddHouseholdTaskToast("Fix the highlighted field.", isError = true),
                        modifier = Modifier,
                    )
                }
            }
        }
    }

    @Test
    fun add_household_task_error_state() {
        paparazzi.snapshot {
            Frame {
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load the task",
                    subcopy = "Can't reach Pantopus. Check your connection.",
                    ctaTitle = "Try again",
                    onCta = {},
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }

    private fun emptyAddState(): AddHouseholdTaskLoadedState =
        AddHouseholdTaskLoadedState(
            fields = seededFields(),
            members = sampleMembers(),
            isEditing = false,
            isValid = false,
            isDirty = true,
            isSaving = false,
            selectedCategory = AddHouseholdTaskFormCategory.Other,
            selectedRecurrence = AddHouseholdTaskRecurrence.OneTime,
            selectedCustomUnit = AddHouseholdTaskCustomUnit.Weeks,
            selectedAssigneeId = null,
            showsCustomRecurrenceSubForm = false,
        )

    private fun prefilledEditState(): AddHouseholdTaskLoadedState =
        AddHouseholdTaskLoadedState(
            fields =
                seededFields(
                    title = SeededTitle("Take out trash"),
                    notes = "Tuesday curbside.",
                    assignedTo = "user-1",
                    dueAt = "2026-06-01",
                    category = AddHouseholdTaskFormCategory.Cleaning,
                    recurrence = AddHouseholdTaskRecurrence.Weekly,
                ),
            members = sampleMembers(),
            isEditing = true,
            isValid = true,
            isDirty = false,
            isSaving = false,
            selectedCategory = AddHouseholdTaskFormCategory.Cleaning,
            selectedRecurrence = AddHouseholdTaskRecurrence.Weekly,
            selectedCustomUnit = AddHouseholdTaskCustomUnit.Weeks,
            selectedAssigneeId = "user-1",
            showsCustomRecurrenceSubForm = false,
        )

    private fun sampleMembers(): List<HouseholdTaskAssignableMember> =
        listOf(
            HouseholdTaskAssignableMember(id = "user-1", displayName = "Maria Kovács", initials = "MK"),
            HouseholdTaskAssignableMember(id = "user-2", displayName = "Avery Park", initials = "AP"),
        )

    /** Build a populated field map. Lets callers override individual
     *  fields to simulate dirty / error / picker poses. */
    private fun seededFields(
        title: SeededTitle = SeededTitle(),
        notes: String = "",
        assignedTo: String = "",
        dueAt: String = "",
        category: AddHouseholdTaskFormCategory = AddHouseholdTaskFormCategory.Other,
        recurrence: AddHouseholdTaskRecurrence = AddHouseholdTaskRecurrence.OneTime,
        customRecurrence: SeededCustomRecurrence = SeededCustomRecurrence(),
    ): Map<AddHouseholdTaskField, FormFieldState> {
        fun seeded(
            field: AddHouseholdTaskField,
            value: String,
            error: String? = null,
            touched: Boolean = false,
        ): FormFieldState =
            FormFieldState(
                id = field.key,
                value = value,
                originalValue = if (touched) "" else value,
                touched = touched,
                error = error,
            )
        return mapOf(
            AddHouseholdTaskField.Title to
                seeded(
                    AddHouseholdTaskField.Title,
                    value = title.value,
                    error = title.error,
                    touched = title.error != null,
                ),
            AddHouseholdTaskField.Notes to seeded(AddHouseholdTaskField.Notes, notes),
            AddHouseholdTaskField.AssignedTo to seeded(AddHouseholdTaskField.AssignedTo, assignedTo),
            AddHouseholdTaskField.DueAt to seeded(AddHouseholdTaskField.DueAt, dueAt),
            AddHouseholdTaskField.Category to seeded(AddHouseholdTaskField.Category, category.rawValue),
            AddHouseholdTaskField.Recurrence to seeded(AddHouseholdTaskField.Recurrence, recurrence.rawValue),
            AddHouseholdTaskField.CustomInterval to
                seeded(AddHouseholdTaskField.CustomInterval, customRecurrence.interval),
            AddHouseholdTaskField.CustomUnit to seeded(AddHouseholdTaskField.CustomUnit, customRecurrence.unit.rawValue),
        )
    }

    private data class SeededCustomRecurrence(
        val interval: String = "1",
        val unit: AddHouseholdTaskCustomUnit = AddHouseholdTaskCustomUnit.Weeks,
    )

    private data class SeededTitle(
        val value: String = "",
        val error: String? = null,
    )
}
