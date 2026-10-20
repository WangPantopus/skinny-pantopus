@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.hub.NotificationPreferencesRepository
import app.pantopus.android.ui.screens.homes.HomeCopyLifecycle
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The switch's name (AI assistant phase 2 contract §3.4): the notice's title and the Settings row's label. */
const val SUGGESTIONS_TITLE = "Suggestions from Pantopus"

/** What Suggestions are (contract §3.4): the notice's words under its title, and the Settings switch's caption. */
const val SUGGESTIONS_CAPTION = "A morning brief with buttons, and at most two nudges a day, never during quiet hours."

/**
 * The one-time Suggestions notice (AI assistant phase 2 contract §3.4), built like [BriefingNotice]: it asks while the
 * server holds no answer, on a server that has Suggestions. Turn on and Not now each save their answer, so it never
 * comes back; it can't be closed without one. While the briefing notice shows ([waiting]) it waits, then follows it,
 * unless Settings (reached from "Manage notifications") answered meanwhile.
 */
@Composable
fun SuggestionsNotice(
    waiting: Boolean,
    viewModel: SuggestionsNoticeViewModel = hiltViewModel(),
) {
    val locked by viewModel.locked.collectAsStateWithLifecycle()
    if (locked) return
    val preferences by viewModel.preferences.collectAsStateWithLifecycle()
    val saving by viewModel.saving.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    HomeCopyLifecycle(viewModel::enter, viewModel::leave)
    LaunchedEffect(waiting) { if (!waiting) viewModel.recheck() }
    if (waiting || preferences == null) return
    AlertDialog(
        onDismissRequest = {},
        title = { Text(SUGGESTIONS_TITLE) },
        text = {
            Text(
                "$SUGGESTIONS_CAPTION\n\nYou can change this in Settings → Notifications." + (error?.let { "\n\n$it" } ?: ""),
                modifier = Modifier.verticalScroll(rememberScrollState()),
            )
        },
        confirmButton = {
            TextButton(
                onClick = { viewModel.choose(true) },
                enabled = !saving,
                modifier = Modifier.testTag("suggestionsNoticeTurnOn"),
            ) { Text("Turn on") }
        },
        dismissButton = {
            TextButton(
                onClick = { viewModel.choose(false) },
                enabled = !saving,
                modifier = Modifier.testTag("suggestionsNoticeNotNow"),
            ) { Text("Not now") }
        },
        // One tap answers it; closing it without one would only bring it back.
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false),
        modifier = Modifier.testTag("suggestionsNotice"),
    )
}

@HiltViewModel
class SuggestionsNoticeViewModel
    @Inject
    constructor(
        private val repository: NotificationPreferencesRepository,
        private val scopes: HomeClaimSessionScopeFactory,
        appLock: AppLockManager,
    ) : ViewModel() {
        val locked = appLock.isLocked
        private var entryScope: CoroutineScope? = null
        private var session: HomeClaimSessionScope? = null
        private var active = false
        private val _preferences = MutableStateFlow<NotificationPreferences?>(null)

        /** The preferences that call for the notice; null hides it. */
        val preferences = _preferences.asStateFlow()
        private val _saving = MutableStateFlow(false)
        val saving = _saving.asStateFlow()
        private val _error = MutableStateFlow<String?>(null)
        val error = _error.asStateFlow()

        fun enter() {
            active = true
            val entry = CoroutineScope(viewModelScope.coroutineContext + Job(viewModelScope.coroutineContext[Job]))
            entryScope?.cancel()
            entryScope = entry
            val scope = scopes.create(entry)
            session = scope
            entry.launch {
                scope.invalidated.collect { if (it) _preferences.value = null }
            }
            entry.launch {
                if (!scope.confirmCurrent()) return@launch
                val response = repository.preferences()
                if (!active || !scope.confirmCurrent()) return@launch
                if (response is NetworkResult.Success) _preferences.value = response.data.takeIf(::asks)
            }
        }

        fun leave() {
            active = false
            entryScope?.cancel()
            _preferences.value = null
            _saving.value = false
        }

        /** The briefing notice closed: Settings may have answered meanwhile (the stored copy holds what it saved). */
        fun recheck() {
            val entry = entryScope ?: return
            if (_preferences.value == null) return
            entry.launch {
                val stored = repository.preferencesStored(force = false).data ?: return@launch
                if (!asks(stored)) _preferences.value = null
            }
        }

        /**
         * Turn on (true) or Not now (false), saved as the person's answer. A failed Turn on stays up to try again;
         * a failed Not now closes, and the notice asks again on the next launch.
         */
        fun choose(enabled: Boolean) {
            val scope = session ?: return
            val entry = entryScope ?: return
            if (_saving.value || !active || _preferences.value == null) return
            _saving.value = true
            _error.value = null
            entry.launch {
                try {
                    scope.requireCurrent()
                    val result =
                        repository.updatePreferences(
                            NotificationPreferencesPatch(suggestionsEnabled = enabled),
                            dispatchGuard =
                                AuthenticatedDispatchGuard { credentials ->
                                    check(active)
                                    scope.requireDispatchCredentials(credentials)
                                },
                        )
                    if (!active || !scope.confirmCurrent()) return@launch
                    if ((result is NetworkResult.Success && result.data.suggestionsEnabled != null) || !enabled) {
                        _preferences.value = null
                    } else {
                        _error.value = TURN_ON_FAILED
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: IllegalStateException) {
                    if (scope.isCurrent && enabled) _error.value = TURN_ON_FAILED else _preferences.value = null
                } finally {
                    if (entryScope === entry) _saving.value = false
                }
            }
        }

        /** Asked while the server knows the switch and holds no answer. */
        private fun asks(preferences: NotificationPreferences): Boolean =
            preferences.supportsSuggestions && preferences.suggestionsEnabled == null

        private companion object {
            const val TURN_ON_FAILED = "Couldn’t turn on Suggestions. You can turn them on in Settings → Notifications."
        }
    }
