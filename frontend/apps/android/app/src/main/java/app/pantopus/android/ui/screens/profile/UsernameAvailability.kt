package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.users.UsernameAvailabilityDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.components.InviteLinks
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.auth.AuthValidation
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/*
 * A person's username is the address of their profile link (pantopus.com/u/<username>). Nobody picks one at
 * sign-up, so until they do it's one the server made up. [UsernameAvailabilityChecker] checks a typed
 * username after a pause (`GET /api/users/username-availability`); [UsernameFieldBlock] is the field plus its
 * status and a plain note that changing it changes the link and old links stop working. Used by Edit Profile
 * and the share-profile username sheet. Mirrors iOS `UsernameAvailability.swift`.
 */

/** Where the username a person typed stands. */
sealed interface UsernameCheckState {
    /** Empty, or the same as the current username. */
    data object Unchanged : UsernameCheckState

    data object Checking : UsernameCheckState

    data object Available : UsernameCheckState

    data class Unavailable(
        val message: String,
    ) : UsernameCheckState

    /** The check itself failed (offline, server error); the save checks again. */
    data object Failed : UsernameCheckState
}

class UsernameAvailabilityChecker(
    private val lookup: suspend (String) -> NetworkResult<UsernameAvailabilityDto>,
) {
    private val _state = MutableStateFlow<UsernameCheckState>(UsernameCheckState.Unchanged)
    val state: StateFlow<UsernameCheckState> = _state.asStateFlow()

    /** The account's username as the server has it. */
    var current: String = ""
        private set

    /** True when [current] is the one the server made up. */
    var currentIsMadeUp: Boolean = false
        private set

    private var job: Job? = null

    fun reset(
        current: String,
        isMadeUp: Boolean,
    ) {
        job?.cancel()
        this.current = current
        currentIsMadeUp = isMadeUp
        _state.value = UsernameCheckState.Unchanged
    }

    /** True while the typed name can't be saved (or is still being checked). */
    val blocksSave: Boolean
        get() = _state.value is UsernameCheckState.Checking || _state.value is UsernameCheckState.Unavailable

    /** Check [value] after a short pause; a newer call replaces an older one. */
    fun check(
        value: String,
        scope: CoroutineScope,
    ) {
        job?.cancel()
        val desired = normalize(value)
        if (desired.isEmpty() || desired == current.lowercase()) {
            _state.value = UsernameCheckState.Unchanged
            return
        }
        AuthValidation.username(desired)?.let {
            _state.value = UsernameCheckState.Unavailable(it)
            return
        }
        _state.value = UsernameCheckState.Checking
        job =
            scope.launch {
                delay(CHECK_DELAY_MS)
                _state.value =
                    when (val result = lookup(desired)) {
                        is NetworkResult.Success ->
                            when {
                                result.data.available && result.data.reason == "current" -> UsernameCheckState.Unchanged
                                result.data.available -> UsernameCheckState.Available
                                else ->
                                    UsernameCheckState.Unavailable(
                                        result.data.message ?: "That username isn't available. Try another.",
                                    )
                            }
                        is NetworkResult.Failure -> UsernameCheckState.Failed
                    }
            }
    }

    companion object {
        private const val CHECK_DELAY_MS = 400L

        /** A username as it would be saved: no spaces, no leading @, lowercase. */
        fun normalize(value: String): String = value.replace(" ", "").trimStart('@').lowercase()

        /** The profile link for [username], without the scheme, for reading. */
        fun linkLabel(username: String): String =
            InviteLinks.profileUrl(username).removePrefix("https://").removePrefix("http://")
    }
}

/** The username field with its availability line and the link note. The caller's [onValueChange] checks. */
@Composable
fun UsernameFieldBlock(
    checker: UsernameAvailabilityChecker,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    serverError: String? = null,
    isDirty: Boolean = false,
    showCurrentLink: Boolean = true,
    testTag: String = "field_username",
) {
    val state by checker.state.collectAsStateWithLifecycle()
    val desired = UsernameAvailabilityChecker.normalize(value)
    val changed = desired.isNotEmpty() && desired != checker.current.lowercase()
    val errorMessage = serverError ?: (state as? UsernameCheckState.Unavailable)?.message
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        PantopusTextField(
            label = "Username",
            value = value,
            onValueChange = onValueChange,
            placeholder = if (checker.currentIsMadeUp) "Choose a username" else checker.current,
            state =
                when {
                    errorMessage != null -> PantopusFieldState.Error(errorMessage)
                    state == UsernameCheckState.Available -> PantopusFieldState.Valid
                    else -> PantopusFieldState.Default
                },
            isDirty = isDirty,
            fieldTestTag = testTag,
        )
        if (errorMessage == null) {
            when (state) {
                UsernameCheckState.Checking -> Note("Checking…")
                UsernameCheckState.Failed -> Note("Couldn't check that username. It's checked again when you save.")
                UsernameCheckState.Available ->
                    Text("@$desired is available.", style = PantopusTextStyle.caption, color = PantopusColors.success)
                else -> Unit
            }
            if (changed) {
                Note(
                    "Your profile link becomes ${UsernameAvailabilityChecker.linkLabel(desired)}. " +
                        "Links to ${UsernameAvailabilityChecker.linkLabel(checker.current)} will stop working.",
                )
            } else if (showCurrentLink && checker.current.isNotEmpty()) {
                val link = UsernameAvailabilityChecker.linkLabel(checker.current)
                Note(
                    if (checker.currentIsMadeUp) {
                        "You haven't chosen one yet, so your profile link is $link for now."
                    } else {
                        "Your profile link is $link."
                    },
                )
            }
        }
        Note("3 to 30 lowercase letters, numbers or underscores.")
    }
}

@Composable
private fun Note(text: String) {
    Text(text, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
}
