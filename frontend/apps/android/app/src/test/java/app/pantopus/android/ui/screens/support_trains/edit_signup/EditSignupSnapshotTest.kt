@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the P3.7 Edit Signup form. Three states:
 *  - prefilled (clean, valid, save disabled)
 *  - dirty + valid (save enabled)
 *  - validation error (drop-off time invalid)
 *
 * `@Ignore`'d until baselines land — same pattern as
 * [app.pantopus.android.ui.screens.review_signups.ReviewSignupsSnapshotTest].
 * Use `./gradlew paparazziRecord` to capture; `./gradlew
 * paparazziVerify` runs in CI.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class EditSignupSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2200,
                    softButtons = false,
                ),
        )

    @Test
    fun edit_signup_prefilled_clean() {
        paparazzi.snapshot {
            Frame {
                EditSignupBody(
                    contributionLabel = "Meal description",
                    contributionValue = "Veggie chili",
                    contributionPlaceholder = "e.g. Veggie chili with cornbread",
                    dropoffTime = "18:00",
                    dietaryNotes = "Strictly vegetarian.",
                    dropoffError = null,
                    isValid = true,
                    isDirty = false,
                )
            }
        }
    }

    @Test
    fun edit_signup_dirty_valid() {
        paparazzi.snapshot {
            Frame {
                EditSignupBody(
                    contributionLabel = "Meal description",
                    contributionValue = "Veggie chili + cornbread",
                    contributionPlaceholder = "e.g. Veggie chili with cornbread",
                    dropoffTime = "18:30",
                    dietaryNotes = "Strictly vegetarian. No mushrooms please.",
                    dropoffError = null,
                    isValid = true,
                    isDirty = true,
                )
            }
        }
    }

    @Test
    fun edit_signup_validation_error() {
        paparazzi.snapshot {
            Frame {
                EditSignupBody(
                    contributionLabel = "Meal description",
                    contributionValue = "Veggie chili",
                    contributionPlaceholder = "e.g. Veggie chili with cornbread",
                    dropoffTime = "midnight-ish",
                    dietaryNotes = "",
                    dropoffError = "Use the format HH:mm (24-hour).",
                    isValid = false,
                    isDirty = true,
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

    @Composable
    private fun EditSignupBody(
        contributionLabel: String,
        contributionValue: String,
        contributionPlaceholder: String,
        dropoffTime: String,
        dietaryNotes: String,
        dropoffError: String?,
        isValid: Boolean,
        isDirty: Boolean,
    ) {
        FormShell(
            title = "Edit signup",
            rightActionLabel = "Save",
            isValid = isValid,
            isDirty = isDirty,
            onClose = {},
            onCommit = {},
        ) {
            FormFieldGroup("Contribution") {
                PantopusTextField(
                    label = contributionLabel,
                    value = contributionValue,
                    onValueChange = {},
                    placeholder = contributionPlaceholder,
                    state = if (isDirty) PantopusFieldState.Valid else PantopusFieldState.Default,
                    keyboardType = KeyboardType.Text,
                )
            }
            FormFieldGroup("Drop-off time") {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
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
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                    ) {
                        TextButton(onClick = {}) {
                            Text(
                                text = dropoffTime.ifEmpty { "Pick a time" },
                                style = PantopusTextStyle.body,
                                color = PantopusColors.appText,
                            )
                        }
                    }
                    if (dropoffError != null) {
                        Text(
                            text = dropoffError,
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
            }
            FormFieldGroup("Dietary notes") {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = "Dietary / accommodation notes",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                    OutlinedTextField(
                        value = dietaryNotes,
                        onValueChange = {},
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 96.dp),
                        colors =
                            OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = PantopusColors.appSurface,
                                unfocusedContainerColor = PantopusColors.appSurface,
                                focusedBorderColor = PantopusColors.primary600,
                                unfocusedBorderColor = PantopusColors.appBorder,
                            ),
                        placeholder = {
                            Text(
                                text = "Allergies, access needs, anything the helper should know.",
                                style = PantopusTextStyle.body,
                                color = PantopusColors.appTextMuted,
                            )
                        },
                    )
                    Text(
                        text = "Only the organizer sees this. Helpful for allergies or access needs.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}
