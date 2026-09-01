@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.support_trains.edit_signup

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Test tag on the Edit Signup form root container. */
const val EDIT_SIGNUP_FORM_TAG = "editSignupForm"
const val EDIT_SIGNUP_CONTRIBUTION_FIELD_TAG = "editSignupContributionField"
const val EDIT_SIGNUP_DROPOFF_TIME_FIELD_TAG = "editSignupDropoffTimeField"
const val EDIT_SIGNUP_DIETARY_NOTES_FIELD_TAG = "editSignupDietaryNotesField"
const val EDIT_SIGNUP_TOAST_TAG = "editSignupToast"

/**
 * P3.7 — Edit Signup form. The ViewModel reads the seed reservation
 * from [app.pantopus.android.data.support_trains.SupportTrainReservationsStore]
 * on init; the list screen stages it before navigating so the form
 * prefills without a re-fetch. On save the form writes a patch back
 * to the same store so the Review-signups list reflects the change
 * when the user pops.
 */
@Composable
fun EditSignupFormScreen(
    onClose: () -> Unit,
    viewModel: EditSignupFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

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

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(EDIT_SIGNUP_FORM_TAG),
    ) {
        if (state.isMissingSeed) {
            MissingSeedBody(onClose = onClose)
        } else {
            FormShell(
                title = "Edit signup",
                rightActionLabel = "Save",
                isValid = state.isValid,
                isDirty = state.isDirty,
                isSaving = state.isSaving,
                onClose = onClose,
                onCommit = { viewModel.submit() },
            ) {
                ContributionGroup(state = state, onChange = viewModel::update)
                DropoffTimeGroup(state = state, onChange = viewModel::update)
                DietaryNotesGroup(state = state, onChange = viewModel::update)
            }
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
                        .testTag(EDIT_SIGNUP_TOAST_TAG),
            ) {
                Text(
                    text = toast.text,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun MissingSeedBody(onClose: () -> Unit) {
    EmptyState(
        icon = PantopusIcon.AlertCircle,
        headline = "Reservation unavailable",
        subcopy = "Open the helper's row from the Review signups list to edit their signup.",
        ctaTitle = "Close",
        onCta = onClose,
    )
}

@Composable
private fun ContributionGroup(
    state: EditSignupUiState,
    onChange: (EditSignupField, String) -> Unit,
) {
    FormFieldGroup("Contribution") {
        val snapshot = state.fields[EditSignupField.Contribution]
        val fieldState =
            when {
                snapshot == null || !snapshot.touched -> PantopusFieldState.Default
                snapshot.error != null -> PantopusFieldState.Error(snapshot.error)
                snapshot.value.trim().isEmpty() -> PantopusFieldState.Default
                else -> PantopusFieldState.Valid
            }
        PantopusTextField(
            label = state.contributionLabel,
            value = snapshot?.value.orEmpty(),
            onValueChange = { onChange(EditSignupField.Contribution, it) },
            placeholder = state.contributionPlaceholder,
            state = fieldState,
            keyboardType = KeyboardType.Text,
            fieldTestTag = EDIT_SIGNUP_CONTRIBUTION_FIELD_TAG,
        )
    }
}

@Composable
private fun DropoffTimeGroup(
    state: EditSignupUiState,
    onChange: (EditSignupField, String) -> Unit,
) {
    FormFieldGroup("Drop-off time") {
        val snapshot = state.fields[EditSignupField.DropoffTime]
        val value = snapshot?.value.orEmpty()
        val error = if (snapshot != null && snapshot.touched) snapshot.error else null

        var showPicker by remember { mutableStateOf(false) }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Drop-off time",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag(EDIT_SIGNUP_DROPOFF_TIME_FIELD_TAG)
                        .semantics { contentDescription = "Drop-off time" },
            ) {
                TextButton(onClick = { showPicker = true }) {
                    Text(
                        text = if (value.isEmpty()) "Pick a time" else value,
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                    )
                }
            }
            if (error != null) {
                Text(
                    text = error,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                )
            }
            Text(
                text = "Pick a time inside the recipient's preferred drop window.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }

        if (showPicker) {
            val parsed = parseHHmm(value)
            val timePickerState =
                rememberTimePickerState(
                    initialHour = parsed.first,
                    initialMinute = parsed.second,
                    is24Hour = false,
                )
            DatePickerDialog(
                onDismissRequest = { showPicker = false },
                confirmButton = {
                    TextButton(onClick = {
                        showPicker = false
                        onChange(
                            EditSignupField.DropoffTime,
                            formatHHmm(timePickerState.hour, timePickerState.minute),
                        )
                    }) { Text("Done") }
                },
                dismissButton = {
                    TextButton(onClick = { showPicker = false }) { Text("Cancel") }
                },
            ) {
                Box(modifier = Modifier.padding(Spacing.s4)) {
                    TimePicker(state = timePickerState)
                }
            }
        }
    }
}

@Composable
private fun DietaryNotesGroup(
    state: EditSignupUiState,
    onChange: (EditSignupField, String) -> Unit,
) {
    FormFieldGroup("Dietary notes") {
        val snapshot = state.fields[EditSignupField.DietaryNotes]
        val value = snapshot?.value.orEmpty()
        val error = if (snapshot != null && snapshot.touched) snapshot.error else null
        val hasError = error != null

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Dietary / accommodation notes",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            OutlinedTextField(
                value = value,
                onValueChange = { onChange(EditSignupField.DietaryNotes, it) },
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 96.dp)
                        .testTag(EDIT_SIGNUP_DIETARY_NOTES_FIELD_TAG),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = PantopusColors.appSurface,
                        unfocusedContainerColor = PantopusColors.appSurface,
                        focusedBorderColor = PantopusColors.primary600,
                        unfocusedBorderColor =
                            if (hasError) {
                                PantopusColors.error
                            } else {
                                PantopusColors.appBorder
                            },
                        errorBorderColor = PantopusColors.error,
                    ),
                isError = hasError,
                placeholder = {
                    Text(
                        text = "Allergies, access needs, anything the helper should know.",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextMuted,
                    )
                },
            )
            if (error != null) {
                Text(
                    text = error,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                )
            }
            Text(
                text = "Only the organizer sees this. Helpful for allergies or access needs.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

private fun parseHHmm(value: String): Pair<Int, Int> {
    if (value.isEmpty()) return 12 to 0
    val parts = value.split(":")
    val hour = parts.getOrNull(0)?.toIntOrNull() ?: 12
    val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0
    return hour to minute
}

private fun formatHHmm(
    hour: Int,
    minute: Int,
): String = "%02d:%02d".format(hour, minute)
