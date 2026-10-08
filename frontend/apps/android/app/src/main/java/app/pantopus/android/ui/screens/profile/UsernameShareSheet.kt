package app.pantopus.android.ui.screens.profile

import android.content.SharedPreferences
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.identity.MadeUpUsername
import app.pantopus.android.core.identity.ProfileChanges
import app.pantopus.android.data.api.models.users.ProfileUpdateRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
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
 * "Pick a username for your link" — asked the first time someone shares their own profile while its link still
 * uses the username the server made up (pantopus.com/u/user_3f9a…). Save and share, or share the link as it is;
 * either way this device doesn't ask that account again. Web: `components/profile/UsernamePrompt.tsx`; iOS:
 * `UsernameShareSheet.swift`.
 */

object UsernameShareTags {
    const val SHEET = "usernameShareSheet"
    const val FIELD = "usernameShareField"
    const val SAVE = "usernameShareSave"
    const val SHARE_AS_IS = "usernameShareAsIs"
}

/** What the sheet shows; null while it isn't open. */
data class UsernameShareForm(
    val text: String = "",
    val serverError: String? = null,
    val isSaving: Boolean = false,
)

@HiltViewModel
class UsernameShareViewModel
    @Inject
    constructor(
        private val repo: ProfileRepository,
        private val authRepository: AuthRepository,
        private val prefs: SharedPreferences,
    ) : ViewModel() {
        val checker = UsernameAvailabilityChecker { repo.usernameAvailability(it) }

        private val _form = MutableStateFlow<UsernameShareForm?>(null)
        val form: StateFlow<UsernameShareForm?> = _form.asStateFlow()

        /** True when [userId]'s link still uses a made-up [username] and this device hasn't asked yet. */
        fun shouldAsk(
            userId: String,
            username: String,
        ): Boolean = MadeUpUsername.isMadeUp(username) && !prefs.getBoolean(askedKey(userId), false)

        fun open(
            userId: String,
            currentUsername: String,
        ) {
            // Asked once: remembered as soon as it shows.
            prefs.edit().putBoolean(askedKey(userId), true).apply()
            checker.reset(currentUsername, isMadeUp = true)
            _form.value = UsernameShareForm()
        }

        fun onTextChange(value: String) {
            _form.value = _form.value?.copy(text = value, serverError = null)
            checker.check(value, viewModelScope)
        }

        fun close() {
            if (_form.value?.isSaving == true) return
            _form.value = null
        }

        /** Saves the username, then hands the new one to [onSaved]. */
        fun save(onSaved: (String) -> Unit) {
            val current = _form.value ?: return
            val username = UsernameAvailabilityChecker.normalize(current.text)
            if (current.isSaving || username.isEmpty() || checker.state.value != UsernameCheckState.Available) return
            _form.value = current.copy(isSaving = true, serverError = null)
            viewModelScope.launch {
                when (val result = repo.updateProfile(ProfileUpdateRequest(username = username))) {
                    is NetworkResult.Success -> {
                        authRepository.refreshSessionUser()
                        ProfileChanges.notifyChanged()
                        _form.value = null
                        onSaved(result.data.user.username.ifBlank { username })
                    }
                    is NetworkResult.Failure ->
                        _form.value =
                            _form.value?.copy(
                                isSaving = false,
                                serverError = result.error.message.ifBlank { "Your username wasn't saved. Try again." },
                            )
                }
            }
        }

        companion object {
            fun askedKey(userId: String) = "usernamePrompt.$userId.asked"
        }
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UsernameShareSheet(
    model: UsernameShareViewModel,
    form: UsernameShareForm,
    onShareAsIs: () -> Unit,
    onSaved: (String) -> Unit,
) {
    val checkState by model.checker.state.collectAsStateWithLifecycle()
    val canSave = checkState == UsernameCheckState.Available && !form.isSaving
    ModalBottomSheet(
        onDismissRequest = model::close,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        modifier = Modifier.testTag(UsernameShareTags.SHEET),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    "Pick a username for your link",
                    style = PantopusTextStyle.h2,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    "Your profile link uses a made-up name: " +
                        "${UsernameAvailabilityChecker.linkLabel(model.checker.current)}. " +
                        "Choose one people will recognize.",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextSecondary,
                )
            }
            UsernameFieldBlock(
                checker = model.checker,
                value = form.text,
                onValueChange = model::onTextChange,
                serverError = form.serverError,
                showCurrentLink = false,
                testTag = UsernameShareTags.FIELD,
            )
            PrimaryButton(
                title = "Save and share",
                onClick = { model.save(onSaved) },
                modifier = Modifier.fillMaxWidth().testTag(UsernameShareTags.SAVE),
                isLoading = form.isSaving,
                isEnabled = canSave,
            )
            GhostButton(
                title = "Share as is",
                onClick = onShareAsIs,
                modifier = Modifier.fillMaxWidth().testTag(UsernameShareTags.SHARE_AS_IS),
                isEnabled = !form.isSaving,
            )
        }
    }
}
