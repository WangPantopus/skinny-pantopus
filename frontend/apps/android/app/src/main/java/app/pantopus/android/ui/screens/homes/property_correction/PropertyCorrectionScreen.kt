@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.property_correction

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.sp
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import app.pantopus.android.ui.components.ChipPicker
import app.pantopus.android.ui.components.ChipPickerOption
import app.pantopus.android.ui.components.ChipPickerStyle
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

const val PROPERTY_CORRECTION_HOME_ID_KEY = "homeId"

@HiltViewModel
class PropertyCorrectionViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String = requireNotNull(savedStateHandle[PROPERTY_CORRECTION_HOME_ID_KEY])

        companion object {
            /**
             * No backend route accepts property corrections yet —
             * `backend/routes/home.js` and `backend/routes/placeIntelligence.js`
             * expose no correction/dispute endpoint. The form therefore cannot
             * submit, and says so rather than flipping a local flag and popping
             * as if it had sent something. Mirrors iOS
             * `PropertyCorrectionViewModel.isSubmissionAvailable`.
             */
            const val IS_SUBMISSION_AVAILABLE = false

            /** Shown above the fields. Byte-identical to the iOS twin. */
            const val UNAVAILABLE_NOTICE =
                "Corrections can't be submitted yet. We're still building the property-record " +
                    "review queue — nothing you enter here is sent to Pantopus."
        }
    }

@Composable
fun PropertyCorrectionScreen(onBack: () -> Unit) {
    var field by remember { mutableStateOf("bedrooms") }
    var source by remember { mutableStateOf("county") }
    var note by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize().testTag("propertyCorrection")) {
        FormShell(
            title = "Request correction",
            rightActionLabel = "Send",
            // No correction endpoint exists yet — the action stays disabled
            // instead of faking a send.
            isValid = PropertyCorrectionViewModel.IS_SUBMISSION_AVAILABLE,
            isDirty = false,
            leading = FormShellLeading.Back,
            onClose = onBack,
            onCommit = {},
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg)
                        .padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                Text(
                    text = PropertyCorrectionViewModel.UNAVAILABLE_NOTICE,
                    fontSize = 13.sp,
                    color = PantopusColors.warning,
                    modifier = Modifier.testTag("propertyCorrectionUnavailable"),
                )
                Text(
                    text =
                        "Tell us what's wrong with the property record. " +
                            "We'll review against county data and owner-confirmed facts.",
                    fontSize = 14.sp,
                    color = PantopusColors.appTextSecondary,
                )
                FormFieldGroup(title = "Which field looks wrong?") {
                    ChipPicker(
                        options =
                            listOf("bedrooms", "bathrooms", "sqft", "year_built", "address").map {
                                ChipPickerOption(id = it, label = it.replace('_', ' '))
                            },
                        selectedId = field,
                        onSelectionChange = { field = it ?: field },
                        style = ChipPickerStyle.Tinted,
                    )
                }
                FormFieldGroup(title = "Which source should we trust?") {
                    ChipPicker(
                        options =
                            listOf("county", "owner", "unsure").map {
                                ChipPickerOption(id = it, label = it)
                            },
                        selectedId = source,
                        onSelectionChange = { source = it ?: source },
                        style = ChipPickerStyle.Tinted,
                    )
                }
                FormFieldGroup(title = "What should it say?") {
                    PantopusTextField(
                        label = "Details",
                        value = note,
                        onValueChange = { note = it },
                        placeholder = "Describe the correct value and any context…",
                        keyboardType = KeyboardType.Text,
                        modifier = Modifier.fillMaxWidth(),
                        fieldTestTag = "propertyCorrection_note",
                    )
                }
            }
        }
    }
}
