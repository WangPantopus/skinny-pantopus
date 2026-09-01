@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.settings.password

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.PasswordStrength
import app.pantopus.android.ui.screens.settings.password.PasswordChangeViewModel.FieldKey
import app.pantopus.android.ui.screens.settings.password.PasswordChangeViewModel.FormBannerContent
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * A13.14 — Paparazzi baselines for the reshaped Change Password screen. Locks
 * the two design frames: READY (current verified, strong revealed new
 * password, confirm matches, CTA enabled, info chip) and ERROR (form banner,
 * wrong current password + reset shortcut, breached new password, mismatched
 * confirm, CTA locked).
 *
 * Note: the iOS counterpart relies on in-process render tripwires in
 * `PantopusTests/.../PasswordChangeSnapshotTests.swift`.
 */
class PasswordChangeSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2800,
                    softButtons = false,
                ),
        )

    @Test
    fun password_change_ready_frame() {
        paparazzi.snapshot {
            Frame {
                PasswordChangeContent(
                    state = readyState(),
                    onBack = {},
                    onUpdate = { _, _ -> },
                    onSubmit = {},
                    onReset = {},
                )
            }
        }
    }

    @Test
    fun password_change_error_frame() {
        paparazzi.snapshot {
            Frame {
                PasswordChangeContent(
                    state = errorState(),
                    onBack = {},
                    onUpdate = { _, _ -> },
                    onSubmit = {},
                    onReset = {},
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

    private fun field(
        id: String,
        value: String,
        error: String? = null,
    ) = FormFieldState(id = id, value = value, originalValue = "", touched = value.isNotEmpty(), error = error)

    private fun readyState(): PasswordChangeLoadedState =
        PasswordChangeLoadedState(
            email = "maria@pantopus.app",
            lastChanged = "84 days ago",
            requiresCurrent = true,
            fields =
                mapOf(
                    FieldKey.Current to field("current", "autumn-river-2019"),
                    FieldKey.New to field("new", "Bake-Sourdough-Friday-77"),
                    FieldKey.Confirm to field("confirm", "Bake-Sourdough-Friday-77"),
                ),
            strength = PasswordStrength.evaluate("Bake-Sourdough-Friday-77"),
            formError = null,
            isCurrentValid = true,
            isNewValid = true,
            isConfirmValid = true,
            isValid = true,
            isSaving = false,
        )

    private fun errorState(): PasswordChangeLoadedState =
        PasswordChangeLoadedState(
            email = "maria@pantopus.app",
            lastChanged = "84 days ago",
            requiresCurrent = true,
            fields =
                mapOf(
                    FieldKey.Current to field("current", "autum-river-2018", "That doesn't match the password on file."),
                    FieldKey.New to field("new", "password123", "Too common — appeared in 2.3M public records."),
                    FieldKey.Confirm to field("confirm", "password12", "Doesn't match the new password above."),
                ),
            strength = PasswordStrength.evaluate("password123", breached = true),
            formError =
                FormBannerContent(
                    title = "Couldn't update password",
                    message = "Fix the two highlighted fields and try again. Three more attempts before a 15-minute cooldown.",
                ),
            isCurrentValid = false,
            isNewValid = false,
            isConfirmValid = false,
            isValid = false,
            isSaving = false,
        )
}
