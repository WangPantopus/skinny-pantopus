@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
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

/**
 * What Suggestions from Pantopus are (AI assistant phase 2 contract §3.4): the notice's words under its title, and the
 * caption of the Settings → Notifications switch.
 */
const val SUGGESTIONS_CAPTION = "A morning brief with buttons, and at most two nudges a day, never during quiet hours."

/**
 * The one-time Suggestions notice (AI assistant phase 2 contract §3.4): shown while the person has never chosen, on a
 * server that has Suggestions. Turn on and Not now each save their answer, so it doesn't come back. It waits until the
 * briefing notice has been seen, so the two never stack.
 */
@Composable
fun SuggestionsNotice(viewModel: SuggestionsNoticeViewModel = hiltViewModel()) {
    val locked by viewModel.locked.collectAsStateWithLifecycle()
    if (locked) return
    val preferences by viewModel.preferences.collectAsStateWithLifecycle()
    val saving by viewModel.saving.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    HomeCopyLifecycle(viewModel::enter, viewModel::leave)
    if (preferences == null) return
    AlertDialog(
        // Closing it without a choice counts as Not now: it is off until they choose, and it asks once.
        onDismissRequest = { viewModel.choose(false) },
        title = { Text("Suggestions from Pantopus") },
        text = {
            Text(
                "$SUGGESTIONS_CAPTION\n\nYou can change this any time in Settings → Notifications." +
                    (error?.let { "\n\n$it" } ?: ""),
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
                if (response is NetworkResult.Success && asks(response.data)) _preferences.value = response.data
            }
        }

        fun leave() {
            active = false
            entryScope?.cancel()
            _preferences.value = null
            _saving.value = false
        }

        /** Turn on (true) or Not now (false): saved as the person's choice; a failure keeps the notice up to try again. */
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
                    if (result is NetworkResult.Success && result.data.suggestionsEnabled != null) {
                        _preferences.value = null
                    } else {
                        _error.value = SAVE_FAILED
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: IllegalStateException) {
                    if (scope.isCurrent) _error.value = SAVE_FAILED else _preferences.value = null
                } finally {
                    if (entryScope === entry) _saving.value = false
                }
            }
        }

        /** Never chosen, on a server that has Suggestions, once the briefing notice is behind them. */
        private fun asks(preferences: NotificationPreferences): Boolean =
            preferences.supportsSuggestions && preferences.suggestionsEnabled == null && preferences.dailyBriefingPromptedAt != null

        private companion object {
            const val SAVE_FAILED = "Couldn’t save your choice. You can change it in Settings → Notifications."
        }
    }
