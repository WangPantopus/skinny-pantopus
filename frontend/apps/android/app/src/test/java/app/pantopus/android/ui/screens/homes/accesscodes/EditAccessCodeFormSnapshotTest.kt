@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.accesscodes

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
import org.junit.Rule
import org.junit.Test

/**
 * P3.1 — Paparazzi baselines for the Add / Edit Access Code form.
 *
 * The snapshots exercise [EditAccessCodeFormContent] directly with a
 * pre-cooked [EditAccessCodeUiState], so the visual contract stays
 * pinned to the form composable rather than to the entire VM round
 * trip. Covers:
 *  - each of the six categories selected (masked pose), and
 *  - the two reveal poses on the wifi case.
 */
class EditAccessCodeFormSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test fun add_code_wifi_masked() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state = sampleState(category = AccessCategory.Wifi, revealed = false),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
                )
            }
        }
    }

    @Test fun add_code_wifi_revealed() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state = sampleState(category = AccessCategory.Wifi, revealed = true),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
                )
            }
        }
    }

    @Test fun add_code_alarm_selected() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state = sampleState(category = AccessCategory.Alarm),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
                )
            }
        }
    }

    @Test fun add_code_gate_selected() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state = sampleState(category = AccessCategory.Gate),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
                )
            }
        }
    }

    @Test fun add_code_lockbox_selected() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state = sampleState(category = AccessCategory.Lockbox),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
                )
            }
        }
    }

    @Test fun add_code_garage_selected() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state = sampleState(category = AccessCategory.Garage),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
                )
            }
        }
    }

    @Test fun add_code_smartlock_selected() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state = sampleState(category = AccessCategory.SmartLock),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
                )
            }
        }
    }

    @Test fun edit_code_hydrated_dirty_save_enabled() {
        paparazzi.snapshot {
            Frame {
                EditAccessCodeFormContent(
                    state =
                        sampleState(
                            category = AccessCategory.Wifi,
                            isEditing = true,
                            values =
                                SampleFieldValues(
                                    label = "Main network",
                                    value = "MaplePan@2025!",
                                    valueDirty = true,
                                    notes = "Guests use the other one",
                                ),
                        ),
                    onClose = {},
                    onCommit = {},
                    onUpdate = { _, _ -> },
                    onSelectCategory = {},
                    onSelectVisibility = {},
                    onToggleReveal = {},
                    onCopy = {},
                    rosterSummary = { scope -> sampleRosterSummary(scope) },
                    sharedWithNames = { sampleSharedNames(AccessVisibility.Members) },
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

    private fun sampleRoster(): List<AccessRosterMember> =
        listOf(
            AccessRosterMember("u_owner", "Maria", role = "owner", canManageAccess = true, canViewSensitive = true),
            AccessRosterMember("u_manager", "Jose", role = "manager", canManageAccess = true, canViewSensitive = false),
            AccessRosterMember("u_member", "Sam", role = "member", canManageAccess = false, canViewSensitive = false),
        )

    private fun sampleRosterSummary(scope: AccessVisibility): String =
        when (scope) {
            AccessVisibility.Everyone -> "Everyone (3 members + guests)"
            AccessVisibility.Members -> "All household members (3)"
            AccessVisibility.Managers -> "Owners & managers (2)"
            AccessVisibility.Sensitive -> "Owners only (1)"
        }

    private fun sampleSharedNames(scope: AccessVisibility): List<String> =
        when (scope) {
            AccessVisibility.Everyone, AccessVisibility.Members -> listOf("Maria", "Jose", "Sam")
            AccessVisibility.Managers -> listOf("Maria", "Jose")
            AccessVisibility.Sensitive -> listOf("Maria")
        }

    private data class SampleFieldValues(
        val label: String = "",
        val value: String = "",
        val valueDirty: Boolean = false,
        val notes: String = "",
    )

    private fun sampleState(
        category: AccessCategory,
        visibility: AccessVisibility = AccessVisibility.Members,
        revealed: Boolean = false,
        isEditing: Boolean = false,
        values: SampleFieldValues = SampleFieldValues(),
    ): EditAccessCodeUiState {
        fun seed(
            field: EditAccessCodeField,
            value: String,
            dirty: Boolean = false,
        ) = FormFieldState(
            id = field.key,
            value = value,
            originalValue = if (dirty) "" else value,
            touched = dirty,
            error = null,
        )
        return EditAccessCodeUiState(
            isEditing = isEditing,
            category = category,
            visibility = visibility,
            isRevealed = revealed,
            roster = sampleRoster(),
            fields =
                mapOf(
                    EditAccessCodeField.Category to seed(EditAccessCodeField.Category, category.wire),
                    EditAccessCodeField.Label to seed(EditAccessCodeField.Label, values.label),
                    EditAccessCodeField.Value to seed(EditAccessCodeField.Value, values.value, dirty = values.valueDirty),
                    EditAccessCodeField.Notes to seed(EditAccessCodeField.Notes, values.notes),
                    EditAccessCodeField.SharedWith to seed(EditAccessCodeField.SharedWith, visibility.wire),
                ),
        )
    }
}
