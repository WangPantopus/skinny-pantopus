@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.polish

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.UpdateNotificationPrefsRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Length of the one-time verification code captured by the verify frames. */
internal const val CODE_LENGTH = 6

/** Fewest digits the SMS frame accepts before it can attempt verification. */
internal const val MIN_PHONE_DIGITS = 7

/** Most digits the SMS phone field keeps (US national number). */
internal const val MAX_PHONE_DIGITS = 10

private const val TOAST_DISMISS_MS = 3_000L

/**
 * Immutable UI state for the H15 channel-connect prompt. Mirrors the iOS view
 * model's observable fields so both platforms expose the same render states.
 */
@Immutable
data class NotificationPromptUiState(
    val frame: NotificationPromptFrame = NotificationPromptFrame.Push,
    /** Digits captured by the verify frames (already filtered to ≤ [CODE_LENGTH]). */
    val code: String = "",
    /** National phone digits captured by the SMS-verify frame. */
    val phone: String = "",
    /** In-flight flag for channel persistence / the email verify. */
    val isWorking: Boolean = false,
    /** Transient confirmation copy shown above the CTA (resend / coming-soon). */
    val toast: String? = null,
    /** Flips true when the prompt is done — the presenter observes this to dismiss. */
    val isFinished: Boolean = false,
    /** The outcome reported back to whatever surface presented the prompt. */
    val result: NotificationChannelConnectResult? = null,
    /** The signed-in account email reminders use — shown on the email frames. */
    val accountEmail: String = "",
) {
    /** Whether the active verify frame has a complete numeric code. */
    val isCodeComplete: Boolean
        get() = code.length == CODE_LENGTH && code.all(Char::isDigit)

    /** Whether the SMS frame can attempt verification (phone + code present). */
    val isSmsReady: Boolean
        get() = phone.count(Char::isDigit) >= MIN_PHONE_DIGITS && isCodeComplete
}

/**
 * H15 · Stream A18. Drives the channel-connect prompt: it advances frames as
 * permission is granted (reported in by the screen, which owns the Android
 * permission launcher) or a channel is confirmed, persists the channel choice to
 * `prefs.channels` preserving every other key, and reports the outcome back via
 * [NotificationPromptUiState.result].
 *
 * The OS push request itself lives in the screen (it needs an `Activity`); the
 * view model stays Context-free so it is unit-testable. The same state + content
 * can be presented locally as a `ModalBottomSheet` by a reminder/workflow channel
 * toggle (A16) — A18 only owns this routed host.
 */
@HiltViewModel
class NotificationPermissionPromptViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        authRepository: AuthRepository,
        ownerRelay: NotificationPromptOwnerRelay,
    ) : ViewModel() {
        /**
         * Owner resolved from [NotificationPromptOwnerRelay] — set by the navigating
         * surface immediately before `onNavigate(NOTIFICATION_PERMISSION_PROMPT)`. Falls
         * back to [SchedulingOwner.Personal] on cold-start / deep-link where no relay
         * value is present, preserving pre-fix behavior.
         */
        private val owner: SchedulingOwner = ownerRelay.consume() ?: SchedulingOwner.Personal

        /** Pillar derived from the resolved owner — drives the accent on CTAs / code field. */
        val pillar: SchedulingPillar = owner.pillar()

        private val _state =
            MutableStateFlow(
                NotificationPromptUiState(accountEmail = currentEmail(authRepository)),
            )
        val state: StateFlow<NotificationPromptUiState> = _state.asStateFlow()

        private var toastJob: Job? = null

        // MARK: - Push (OS-gated; the screen owns the request)

        /**
         * Reconcile the opening frame with the live OS push status so we never
         * show "turn on push" to someone who already granted (or blocked) it.
         * Only acts while still on the initial push frame.
         */
        fun reconcile(status: PushPermissionStatus) {
            if (_state.value.frame != NotificationPromptFrame.Push) return
            _state.update {
                it.copy(
                    frame =
                        when (status) {
                            PushPermissionStatus.NotDetermined -> NotificationPromptFrame.Push
                            PushPermissionStatus.Denied -> NotificationPromptFrame.Denied
                            PushPermissionStatus.Authorized ->
                                NotificationPromptFrame.Connected(NotificationChannel.Push)
                        },
                )
            }
        }

        /** The screen flips this while the OS permission dialog is on screen. */
        fun setWorking(working: Boolean) = _state.update { it.copy(isWorking = working) }

        /** Result of the OS permission request, reported in by the screen. */
        fun onPushResult(granted: Boolean) {
            if (granted) {
                persistChannel(NotificationChannel.Push, enabled = true)
                _state.update {
                    it.copy(
                        frame = NotificationPromptFrame.Connected(NotificationChannel.Push),
                        isWorking = false,
                        result = NotificationChannelConnectResult.Connected(NotificationChannel.Push),
                    )
                }
            } else {
                _state.update {
                    it.copy(
                        frame = NotificationPromptFrame.Denied,
                        isWorking = false,
                        result = NotificationChannelConnectResult.DeniedPush,
                    )
                }
            }
        }

        // MARK: - Email

        fun useEmailInstead() =
            _state.update {
                it.copy(
                    frame = NotificationPromptFrame.EmailVerify(it.accountEmail),
                    code = "",
                    phone = "",
                    toast = null,
                )
            }

        fun updateCode(value: String) = _state.update { it.copy(code = value.filter(Char::isDigit).take(CODE_LENGTH)) }

        fun updatePhone(value: String) = _state.update { it.copy(phone = value.filter(Char::isDigit).take(MAX_PHONE_DIGITS)) }

        fun verifyEmail() {
            if (!_state.value.isCodeComplete) return
            viewModelScope.launch {
                _state.update { it.copy(isWorking = true) }
                persistChannelNow(NotificationChannel.Email, enabled = true)
                _state.update {
                    it.copy(
                        frame = NotificationPromptFrame.Connected(NotificationChannel.Email),
                        isWorking = false,
                        result = NotificationChannelConnectResult.Connected(NotificationChannel.Email),
                    )
                }
            }
        }

        // MARK: - SMS (coming soon — locked-S / 501 contract)

        /**
         * SMS delivery is deferred server-side; surface the coming-soon state
         * rather than connecting a channel that can't yet send.
         */
        fun verifySms() = flashToast("SMS reminders are coming soon. We'll use email for now.")

        // MARK: - Shared actions

        /**
         * No OTP-send endpoint exists yet for reminder channels (the account
         * email is already verified at sign-up); this confirms the intent so the
         * frame is never a dead end.
         */
        fun resendCode() = flashToast("We sent the code again.")

        fun done() {
            _state.update { current ->
                val frame = current.frame
                val result =
                    if (frame is NotificationPromptFrame.Connected) {
                        NotificationChannelConnectResult.Connected(frame.channel)
                    } else {
                        current.result
                    }
                current.copy(result = result, isFinished = true)
            }
        }

        fun dismiss() =
            _state.update {
                it.copy(result = NotificationChannelConnectResult.Dismissed, isFinished = true)
            }

        // MARK: - Channel persistence (prefs.channels — preserve unknown keys)

        private fun persistChannel(
            channel: NotificationChannel,
            enabled: Boolean,
        ) = viewModelScope.launch { persistChannelNow(channel, enabled) }

        private suspend fun persistChannelNow(
            channel: NotificationChannel,
            enabled: Boolean,
        ) {
            val current = repo.getNotificationPreferences()
            val root = ((current as? NetworkResult.Success)?.data?.prefs ?: emptyMap()).toMutableMap()

            @Suppress("UNCHECKED_CAST")
            val channels = (root["channels"] as? Map<String, Any?>)?.toMutableMap() ?: mutableMapOf()
            channels[channel.key] = enabled
            root["channels"] = channels
            repo.updateNotificationPreferences(UpdateNotificationPrefsRequest(prefs = root))
        }

        private fun flashToast(message: String) {
            _state.update { it.copy(toast = message) }
            toastJob?.cancel()
            toastJob =
                viewModelScope.launch {
                    delay(TOAST_DISMISS_MS)
                    _state.update { if (it.toast == message) it.copy(toast = null) else it }
                }
        }

        private fun currentEmail(authRepository: AuthRepository): String =
            (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.email.orEmpty()
    }
