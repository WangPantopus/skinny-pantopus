package app.pantopus.android.ui.screens.profile

import android.content.SharedPreferences
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.identity.ProfileChanges
import app.pantopus.android.data.api.models.users.ProfileUpdateRequest
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.auth.AuthValidation
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/*
 * "What should we call you?" — asked once of an account that has no first or last name: accounts made while
 * sign-up asked only for an email and a password, and Google or Apple sign-ins that brought no name. Without
 * a name, the household, neighbors and helpers see a stand-in instead of the person. Save or Not now; either
 * way this device doesn't ask that account again (Edit Profile still can). Web: `NamePrompt.tsx`; iOS:
 * `NamePrompt.swift`.
 */

object NamePromptTags {
    const val DIALOG = "namePromptDialog"
    const val FIRST_NAME = "namePromptFirstName"
    const val MIDDLE_NAME = "namePromptMiddleName"
    const val LAST_NAME = "namePromptLastName"
    const val SAVE = "namePromptSave"
    const val NOT_NOW = "namePromptNotNow"
}

/** What the dialog shows; null while it isn't open. */
data class NamePromptForm(
    val firstName: String = "",
    val middleName: String = "",
    val lastName: String = "",
    val firstNameError: String? = null,
    val lastNameError: String? = null,
    val saveError: String? = null,
    val isSaving: Boolean = false,
)

@HiltViewModel
class NamePromptViewModel
    @Inject
    constructor(
        private val repo: ProfileRepository,
        private val authRepository: AuthRepository,
        private val prefs: SharedPreferences,
    ) : ViewModel() {
        private val _form = MutableStateFlow<NamePromptForm?>(null)
        val form: StateFlow<NamePromptForm?> = _form.asStateFlow()

        /** Opens the dialog when [userId]'s account has no name and this device hasn't asked it yet. */
        fun evaluate(userId: String) {
            if (prefs.getBoolean(askedKey(userId), false) || _form.value != null) return
            viewModelScope.launch {
                val profile = (repo.ownProfile() as? NetworkResult.Success)?.data?.user ?: return@launch
                if (profile.id != userId || profile.accountType == "business" || !isMissingName(profile)) return@launch
                // Asked once: remembered as soon as it shows.
                prefs.edit().putBoolean(askedKey(userId), true).apply()
                _form.value =
                    NamePromptForm(
                        firstName = profile.firstName?.trim().orEmpty(),
                        middleName = profile.middleName?.trim().orEmpty(),
                        lastName = profile.lastName?.trim().orEmpty(),
                    )
            }
        }

        fun onFirstNameChange(value: String) = edit { it.copy(firstName = value, firstNameError = null, saveError = null) }

        fun onMiddleNameChange(value: String) = edit { it.copy(middleName = value, saveError = null) }

        fun onLastNameChange(value: String) = edit { it.copy(lastName = value, lastNameError = null, saveError = null) }

        fun dismiss() {
            if (_form.value?.isSaving == true) return
            _form.value = null
        }

        fun save() {
            val current = _form.value ?: return
            if (current.isSaving) return
            val firstError = AuthValidation.requiredName(current.firstName, missing = "Enter your first name.")
            val lastError = AuthValidation.requiredName(current.lastName, missing = "Enter your last name.")
            if (firstError != null || lastError != null) {
                _form.value = current.copy(firstNameError = firstError, lastNameError = lastError)
                return
            }
            _form.value = current.copy(isSaving = true, saveError = null)
            viewModelScope.launch {
                val request =
                    ProfileUpdateRequest(
                        firstName = current.firstName.trim(),
                        middleName = current.middleName.trim(),
                        lastName = current.lastName.trim(),
                    )
                when (val result = repo.updateProfile(request)) {
                    is NetworkResult.Success -> {
                        authRepository.refreshSessionUser()
                        ProfileChanges.notifyChanged()
                        _form.value = null
                    }
                    is NetworkResult.Failure ->
                        _form.value =
                            _form.value?.copy(
                                isSaving = false,
                                saveError = result.error.message.ifBlank { "Your name wasn't saved. Try again." },
                            )
                }
            }
        }

        private fun edit(change: (NamePromptForm) -> NamePromptForm) {
            _form.value = _form.value?.let(change)
        }

        companion object {
            fun askedKey(userId: String) = "namePrompt.$userId.asked"

            fun isMissingName(profile: UserProfile): Boolean = profile.firstName.isNullOrBlank() || profile.lastName.isNullOrBlank()
        }
    }

/** Hosts the one-time name dialog over the signed-in shell. */
@Composable
fun NamePromptHost(
    userId: String,
    viewModel: NamePromptViewModel = hiltViewModel(),
) {
    LaunchedEffect(userId) { viewModel.evaluate(userId) }
    val form by viewModel.form.collectAsStateWithLifecycle()
    val current = form ?: return
    AlertDialog(
        onDismissRequest = viewModel::dismiss,
        properties = DialogProperties(dismissOnClickOutside = false),
        modifier = Modifier.testTag(NamePromptTags.DIALOG),
        title = { Text("What should we call you?", style = PantopusTextStyle.h3) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Text(
                    "Add your name so your household and neighbors know who you are.",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextSecondary,
                )
                PantopusTextField(
                    label = "First name",
                    value = current.firstName,
                    onValueChange = viewModel::onFirstNameChange,
                    state = current.firstNameError?.let { PantopusFieldState.Error(it) } ?: PantopusFieldState.Default,
                    isRequired = true,
                    fieldTestTag = NamePromptTags.FIRST_NAME,
                )
                PantopusTextField(
                    label = "Middle name (optional)",
                    value = current.middleName,
                    onValueChange = viewModel::onMiddleNameChange,
                    fieldTestTag = NamePromptTags.MIDDLE_NAME,
                )
                PantopusTextField(
                    label = "Last name",
                    value = current.lastName,
                    onValueChange = viewModel::onLastNameChange,
                    state = current.lastNameError?.let { PantopusFieldState.Error(it) } ?: PantopusFieldState.Default,
                    isRequired = true,
                    fieldTestTag = NamePromptTags.LAST_NAME,
                )
                current.saveError?.let {
                    Text(it, style = PantopusTextStyle.small, color = PantopusColors.error)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = viewModel::save,
                enabled = !current.isSaving,
                modifier = Modifier.testTag(NamePromptTags.SAVE),
            ) { Text(if (current.isSaving) "Saving…" else "Save") }
        },
        dismissButton = {
            TextButton(
                onClick = viewModel::dismiss,
                enabled = !current.isSaving,
                modifier = Modifier.testTag(NamePromptTags.NOT_NOW),
            ) { Text("Not now") }
        },
    )
}
