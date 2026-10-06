@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.guests

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * A13.1 Paparazzi baselines for the Add Guest form.
 *
 * Locks the two design frames:
 *  - filled: Sasha, Weekend, WiFi + Entry Instructions + Parking, validated contact,
 *    sticky Send pass CTA enabled.
 *  - initial: pristine fields, no duration, sticky Send pass CTA disabled.
 */
class AddGuestFormSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun add_guest_filled() {
        val customState =
            filledState().copy(
                duration = AddGuestSampleData.DURATION_CUSTOM_ID,
                customStartLabel = "Oct 10",
                customEndLabel = "Oct 11",
                customStartEpochDay = 20736,
                customEndEpochDay = 20737,
            )
        assertTrue(customState.canSubmit)
        assertTrue(customState.copy(customEndEpochDay = customState.customStartEpochDay).canSubmit)
        assertFalse(customState.copy(customEndEpochDay = 20735).canSubmit)
        assertFalse(customState.copy(didCreate = true).canSubmit)

        paparazzi.snapshot {
            Frame {
                AddGuestFormLoaded(
                    state = filledState(),
                    onClose = {},
                    onCommit = {},
                    onNameChange = {},
                    onContactChange = {},
                    onDurationChange = {},
                    onSectionsChange = {},
                    onWelcomeChange = {},
                )
            }
        }
    }

    @Test
    fun add_guest_initial() {
        val customState = filledState().copy(duration = AddGuestSampleData.DURATION_CUSTOM_ID)
        assertFalse("Custom without committed dates must keep Send pass disabled", customState.canSubmit)
        assertFalse(customState.copy(customStartLabel = "Oct 10", customStartEpochDay = 20736).canSubmit)
        assertFalse(customState.copy(customEndLabel = "Oct 11", customEndEpochDay = 20737).canSubmit)
        assertTrue(customState.copy(duration = "2h").canSubmit)

        paparazzi.snapshot {
            Frame {
                AddGuestFormLoaded(
                    state = initialState(),
                    onClose = {},
                    onCommit = {},
                    onNameChange = {},
                    onContactChange = {},
                    onDurationChange = {},
                    onSectionsChange = {},
                    onWelcomeChange = {},
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

    private fun initialState(): AddGuestUiState =
        AddGuestSampleData.homeContext("preview").let { context ->
            AddGuestUiState(homeTitle = context.title, homeSubtitle = context.subtitle)
        }

    private fun filledState(): AddGuestUiState =
        AddGuestSampleData.homeContext("preview").let { context ->
            AddGuestUiState(
                homeTitle = context.title,
                homeSubtitle = context.subtitle,
                nameField =
                    FormFieldState(
                        id = "name",
                        value = AddGuestSampleData.Filled.NAME,
                        touched = true,
                    ),
                contactField =
                    FormFieldState(
                        id = "contact",
                        value = AddGuestSampleData.Filled.CONTACT,
                        touched = true,
                    ),
                welcomeField =
                    FormFieldState(
                        id = "welcome",
                        value = AddGuestSampleData.Filled.WELCOME,
                        touched = true,
                    ),
                duration = AddGuestSampleData.Filled.DURATION_ID,
                selectedSections = AddGuestSampleData.Filled.SECTION_IDS,
            )
        }
}
