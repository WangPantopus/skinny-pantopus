@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.core.content.ContextCompat
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
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/**
 * The daily briefings notice. It is also where the phone's notification question is asked, not at launch, so it shows
 * again on a phone that hasn't answered, for an account that has seen it elsewhere. While it asks it has one button,
 * "Continue", that opens the question, and no way to leave without it (Apple's rule for the iPhone notice).
 * [mayShow] is false while something else is asking (RootTabScreen): it waits. As on iPhone (`BriefingNoticeView`).
 */
@Composable
fun BriefingNotice(
    onManage: () -> Unit,
    mayShow: Boolean = true,
    viewModel: BriefingNoticeViewModel = hiltViewModel(),
) {
    val locked by viewModel.locked.collectAsStateWithLifecycle()
    if (locked) return
    val preferences by viewModel.preferences.collectAsStateWithLifecycle()
    val saving by viewModel.saving.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val needsPermission by viewModel.needsPermission.collectAsStateWithLifecycle()
    HomeCopyLifecycle(viewModel::enter, viewModel::leave)
    // Registered while the notice may come: the system's question pauses the activity, which hides the notice.
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { viewModel.finish() }
    val prefs = preferences ?: return
    if (!mayShow) return
    LaunchedEffect(Unit) {
        viewModel.markShown()
        viewModel.record()
    }
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
            if (needsPermission) {
                TextButton(
                    onClick = {
                        viewModel.markAsked()
                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    },
                    enabled = !saving,
                    modifier = Modifier.testTag("briefingNoticeAllowNotifications"),
                ) { Text("Continue") }
            } else {
                TextButton(onClick = { viewModel.finish(onManage) }, enabled = !saving) { Text("Manage notifications") }
            }
        },
        dismissButton =
            if (needsPermission) {
                null
            } else {
                { TextButton(onClick = { viewModel.finish() }, enabled = !saving) { Text("Got it") } }
            },
        modifier = Modifier.testTag("briefingDefaultsNotice"),
        properties = DialogProperties(dismissOnBackPress = !needsPermission, dismissOnClickOutside = !needsPermission),
    )
}

/** The briefing notice showed during this launch: the Suggestions notice waits for the next one (as on iPhone). */
internal object BriefingNoticeLaunch {
    @Volatile var shown = false
}

@HiltViewModel
class BriefingNoticeViewModel
    @Inject
    constructor(
        private val repository: NotificationPreferencesRepository,
        private val scopes: HomeClaimSessionScopeFactory,
        appLock: AppLockManager,
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        val locked = appLock.isLocked
        private val devicePrefs by lazy { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }
        private val _needsPermission = MutableStateFlow(false)

        /** Android 13+ hasn't been allowed to show notifications here: the notice asks. */
        val needsPermission = _needsPermission.asStateFlow()
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
                val undecided =
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
                        PackageManager.PERMISSION_GRANTED
                _needsPermission.value = undecided
                // Until "Continue" has asked this phone, for an account that saw the notice elsewhere.
                val askHere = undecided && !devicePrefs.getBoolean(KEY_ASKED_HERE, false)
                if (response is NetworkResult.Success && (response.data.dailyBriefingPromptedAt == null || askHere)) {
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

        /** On screen: Suggestions waits for a later launch. */
        fun markShown() {
            BriefingNoticeLaunch.shown = true
        }

        /** "Continue": the phone is asked once whatever the answer (Settings → Notifications tells a phone that said no). */
        fun markAsked() {
            devicePrefs.edit().putBoolean(KEY_ASKED_HERE, true).apply()
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

        private companion object {
            const val PREFS = "pantopus_briefing_notice"

            /** "Continue" asked this phone the notification question. */
            const val KEY_ASKED_HERE = "asked_for_notifications"
        }
    }
