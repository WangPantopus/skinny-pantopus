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
import java.time.ZoneId
import javax.inject.Inject

@Composable
fun BriefingNotice(
    onManage: () -> Unit,
    viewModel: BriefingNoticeViewModel = hiltViewModel(),
) {
    val locked by viewModel.locked.collectAsStateWithLifecycle()
    if (locked) return
    val preferences by viewModel.preferences.collectAsStateWithLifecycle()
    val saving by viewModel.saving.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    HomeCopyLifecycle(viewModel::enter, viewModel::leave)
    val prefs = preferences ?: return
    LaunchedEffect(Unit) { viewModel.record() }
    val morning = if (prefs.dailyBriefingEnabled) "On at ${prefs.dailyBriefingTimeLocal}" else "Off"
    val evening = if (prefs.eveningBriefingEnabled) "On at ${prefs.eveningBriefingTimeLocal}" else "Off"
    AlertDialog(
        onDismissRequest = { viewModel.finish() },
        title = { Text("Your daily briefings") },
        text = {
            Text(
                "Morning: $morning\nEvening: $evening\n\n" +
                    "Times follow your briefing location’s time zone. We only notify you when there’s something useful.\n\n" +
                    "Change the times or turn either briefing off in Settings → Notifications. " +
                    "Your phone also needs to allow Pantopus notifications." +
                    (error?.let { "\n\n$it" } ?: ""),
                modifier = Modifier.verticalScroll(rememberScrollState()),
            )
        },
        confirmButton = {
            TextButton(onClick = { viewModel.finish(onManage) }, enabled = !saving) { Text("Manage notifications") }
        },
        dismissButton = { TextButton(onClick = { viewModel.finish() }, enabled = !saving) { Text("Got it") } },
        modifier = Modifier.testTag("briefingDefaultsNotice"),
    )
}

@HiltViewModel
class BriefingNoticeViewModel
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
        private var acknowledged = false
        private val _preferences = MutableStateFlow<NotificationPreferences?>(null)
        val preferences = _preferences.asStateFlow()
        private val _saving = MutableStateFlow(false)
        val saving = _saving.asStateFlow()
        private val _error = MutableStateFlow<String?>(null)
        val error = _error.asStateFlow()

        fun enter() {
            active = true
            acknowledged = false
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
                if (response is NetworkResult.Success && response.data.dailyBriefingPromptedAt == null) {
                    _preferences.value = response.data
                }
            }
        }

        fun leave() {
            active = false
            entryScope?.cancel()
            _preferences.value = null
            _saving.value = false
        }

        fun finish(onFinished: () -> Unit = {}) {
            if (_saving.value || !active || session?.isCurrent != true) return
            _preferences.value = null
            onFinished()
        }

        fun record() {
            val scope = session ?: return
            val entry = entryScope ?: return
            if (_saving.value || !active || acknowledged) return
            _saving.value = true
            _error.value = null
            entry.launch {
                try {
                    scope.requireCurrent()
                    val result =
                        repository.updatePreferences(
                            NotificationPreferencesPatch(dailyBriefingPrompted = true, deviceTimezone = ZoneId.systemDefault().id),
                            dispatchGuard =
                                AuthenticatedDispatchGuard { credentials ->
                                    check(active)
                                    scope.requireDispatchCredentials(credentials)
                                },
                        )
                    if (!active || !scope.confirmCurrent()) return@launch
                    if (result is NetworkResult.Success && result.data.dailyBriefingPromptedAt != null) {
                        _preferences.value = result.data
                        acknowledged = true
                    } else {
                        _error.value = "Couldn’t save your briefing settings. You can change them in notification settings."
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: IllegalStateException) {
                    if (scope.isCurrent) {
                        _error.value = "Couldn’t save your briefing settings. You can change them in notification settings."
                    } else {
                        _preferences.value = null
                    }
                } finally {
                    if (entryScope === entry) _saving.value = false
                }
            }
        }
    }
