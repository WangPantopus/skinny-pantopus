@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.settings.security

import androidx.annotation.VisibleForTesting
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.security.StepUpCoordinator
import app.pantopus.android.data.api.models.auth.AuthDeviceDto
import app.pantopus.android.data.api.models.auth.AuthSessionDto
import app.pantopus.android.data.api.models.auth.DevicesResponse
import app.pantopus.android.data.api.models.auth.SecurityEventDto
import app.pantopus.android.data.api.models.auth.SecurityPrefsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.DevicesRepository
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import java.time.Instant
import java.time.OffsetDateTime
import java.util.Locale
import javax.inject.Inject
import kotlin.math.abs

/**
 * Settings → Security → Devices (design §7.6, §7.7, §9; CONTRACT
 * `/api/auth/devices`, `/sessions/revoke-others`, `/sessions/revoke-all`,
 * `DELETE /devices/:id`, `/security-prefs`). Projects the registry into the
 * shared GroupedList archetype:
 *
 *  · **This device** — the current device pinned first, trust badge, never
 *    removable from here (sign out instead).
 *  · **Other devices** — trust badge + chevron; tap → confirm → step-up
 *    (`revoke_device`) → `DELETE /api/auth/devices/:id`.
 *  · **Web sessions** — read-only list (no per-session revoke in v1).
 *  · **Security** — `allowRestoreGrants` / `newDeviceEmail` toggles; each
 *    flip is optimistic and PATCHes with a `change_security_prefs` step-up.
 *  · **Actions** — *Sign out of all other devices* (`revoke_sessions`) and
 *    *Lockdown* (`revoke-all`; the repository then signs this device out).
 *  · **Recent activity** — security events, newest first.
 *
 * Every step-up goes through [StepUpCoordinator], which owns the Tier-2
 * gesture: the biometric `CryptoObject` prompt *is* the gate for
 * `device_key`, and `AppLockManager.verifySensitiveAction` runs before the
 * password sheet — so this view-model never double-prompts.
 */
@HiltViewModel
class DevicesViewModel
    @Inject
    constructor(
        private val devices: DevicesRepository,
        private val authRepository: AuthRepository,
        private val stepUp: StepUpCoordinator,
    ) : ViewModel() {
        /** A destructive action awaiting the user's confirmation dialog. */
        sealed interface Confirmation {
            data class RemoveDevice(
                val device: AuthDeviceDto,
            ) : Confirmation

            data object SignOutOthers : Confirmation

            data object Lockdown : Confirmation
        }

        val title: String = "Devices"

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        private val _confirmation = MutableStateFlow<Confirmation?>(null)
        val confirmation: StateFlow<Confirmation?> = _confirmation.asStateFlow()

        /** A step-up + mutation is in flight; the confirm dialog shows a spinner and rows ignore taps. */
        private val _busy = MutableStateFlow(false)
        val busy: StateFlow<Boolean> = _busy.asStateFlow()

        private var registry: DevicesResponse = DevicesResponse()
        private var prefs: SecurityPrefsDto = SecurityPrefsDto()
        private var prefsLoadFailed: Boolean = false

        /** Test seam for the relative-time captions. */
        @VisibleForTesting
        internal var nowMillis: () -> Long = System::currentTimeMillis

        fun load() {
            _state.value = GroupedListUiState.Loading
            viewModelScope.launch { fetch() }
        }

        /** Pull-to-refresh / retry — keeps the loaded frame up while re-fetching. */
        fun refresh() {
            viewModelScope.launch { fetch() }
        }

        private suspend fun fetch() {
            when (val result = devices.devices()) {
                is NetworkResult.Success -> registry = result.data
                is NetworkResult.Failure -> {
                    _state.value = GroupedListUiState.Error(result.error.message)
                    return
                }
            }
            when (val result = devices.securityPrefs()) {
                is NetworkResult.Success -> {
                    prefs = result.data
                    prefsLoadFailed = false
                }
                is NetworkResult.Failure -> prefsLoadFailed = true
            }
            rebuild()
        }

        fun consumeToast() {
            _toast.value = null
        }

        fun dismissConfirmation() {
            if (_busy.value) return
            _confirmation.value = null
        }

        // ── Row taps ──────────────────────────────────────────────────────

        fun onTapRow(rowId: String) {
            if (_busy.value) return
            when {
                rowId == ROW_SIGN_OUT_OTHERS -> _confirmation.value = Confirmation.SignOutOthers
                rowId == ROW_LOCKDOWN -> _confirmation.value = Confirmation.Lockdown
                rowId.startsWith(DEVICE_ROW_PREFIX) -> {
                    val id = rowId.removePrefix(DEVICE_ROW_PREFIX)
                    val device = registry.devices.firstOrNull { it.id == id } ?: return
                    // The current device is signed out from Settings, not removed here.
                    if (device.isCurrent == true) return
                    _confirmation.value = Confirmation.RemoveDevice(device)
                }
            }
        }

        /**
         * Security-pref toggles — optimistic flip, `PATCH /api/auth/security-prefs`
         * behind a `change_security_prefs` step-up, rollback on failure /
         * cancel.
         */
        fun onToggle(
            rowId: String,
            isOn: Boolean,
            hostActivity: FragmentActivity?,
        ) {
            if (_busy.value || prefsLoadFailed) {
                rebuild()
                return
            }
            val previous = prefs
            val next =
                when (rowId) {
                    ROW_PREF_RESTORE_GRANTS -> prefs.copy(allowRestoreGrants = isOn)
                    ROW_PREF_NEW_DEVICE_EMAIL -> prefs.copy(newDeviceEmail = isOn)
                    else -> return
                }
            val patch =
                when (rowId) {
                    ROW_PREF_RESTORE_GRANTS -> SecurityPrefsDto(allowRestoreGrants = isOn)
                    else -> SecurityPrefsDto(newDeviceEmail = isOn)
                }
            prefs = next
            rebuild()
            viewModelScope.launch {
                _busy.value = true
                val outcome =
                    stepUp.obtainToken(
                        purpose = StepUpCoordinator.PURPOSE_CHANGE_SECURITY_PREFS,
                        activity = hostActivity,
                    )
                when (outcome) {
                    is StepUpCoordinator.Outcome.Token ->
                        when (val result = devices.updateSecurityPrefs(patch, outcome.stepUpToken)) {
                            is NetworkResult.Success -> {
                                prefs = result.data.mergedOver(next)
                                _toast.value = ToastMessage("Security settings updated.", ToastKind.Success)
                            }
                            is NetworkResult.Failure -> {
                                prefs = previous
                                _toast.value = ToastMessage(result.error.message, ToastKind.Error)
                            }
                        }
                    StepUpCoordinator.Outcome.Cancelled -> prefs = previous
                    is StepUpCoordinator.Outcome.Failed -> {
                        prefs = previous
                        _toast.value = ToastMessage(outcome.message, ToastKind.Error)
                    }
                }
                _busy.value = false
                rebuild()
            }
        }

        // ── Confirmed destructive actions ─────────────────────────────────

        /** The confirm dialog's primary button, for whatever [confirmation] is pending. */
        fun confirmPending(hostActivity: FragmentActivity?) {
            when (val pending = _confirmation.value ?: return) {
                is Confirmation.RemoveDevice -> removeDevice(pending.device, hostActivity)
                Confirmation.SignOutOthers -> signOutOthers(hostActivity)
                Confirmation.Lockdown -> lockdown(hostActivity)
            }
        }

        /** Step-up (`revoke_device`) → `DELETE /api/auth/devices/:id`. */
        fun removeDevice(
            device: AuthDeviceDto,
            hostActivity: FragmentActivity?,
        ) {
            runGuarded(StepUpCoordinator.PURPOSE_REVOKE_DEVICE, hostActivity) { token ->
                authRepository.revokeDevice(device.id, token)
                registry = registry.copy(devices = registry.devices.filterNot { it.id == device.id })
                _toast.value = ToastMessage("Removed ${deviceTitle(device)}.", ToastKind.Success)
                rebuild()
                fetch()
            }
        }

        /** Step-up (`revoke_sessions`) → `POST /api/auth/sessions/revoke-others`. */
        fun signOutOthers(hostActivity: FragmentActivity?) {
            runGuarded(StepUpCoordinator.PURPOSE_REVOKE_SESSIONS, hostActivity) { token ->
                val revoked = authRepository.revokeOtherSessions(token)
                _toast.value =
                    ToastMessage(
                        when (revoked) {
                            0 -> "No other sessions to sign out."
                            1 -> "Signed out of 1 other session."
                            else -> "Signed out of $revoked other sessions."
                        },
                        ToastKind.Success,
                    )
                fetch()
            }
        }

        /**
         * Step-up (`revoke_sessions`) → `POST /api/auth/sessions/revoke-all`.
         * On success the repository signs this device out locally, so the
         * host leaves this screen on its own.
         */
        fun lockdown(hostActivity: FragmentActivity?) {
            runGuarded(StepUpCoordinator.PURPOSE_REVOKE_SESSIONS, hostActivity) { token ->
                authRepository.revokeAllSessions(token)
            }
        }

        /**
         * Shared step-up → action → error plumbing. Cancel is silent; a
         * step-up failure or an [AuthError] from the action toasts; the
         * confirmation dialog closes either way.
         */
        private fun runGuarded(
            purpose: String,
            hostActivity: FragmentActivity?,
            action: suspend (stepUpToken: String) -> Unit,
        ) {
            if (_busy.value) return
            _busy.value = true
            viewModelScope.launch {
                try {
                    when (val outcome = stepUp.obtainToken(purpose = purpose, activity = hostActivity)) {
                        is StepUpCoordinator.Outcome.Token -> action(outcome.stepUpToken)
                        StepUpCoordinator.Outcome.Cancelled -> Unit
                        is StepUpCoordinator.Outcome.Failed -> _toast.value = ToastMessage(outcome.message, ToastKind.Error)
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: AuthError) {
                    _toast.value = ToastMessage(e.message, ToastKind.Error)
                } catch (
                    @Suppress("TooGenericExceptionCaught") t: Throwable,
                ) {
                    Timber.w(t, "step-up guarded action failed (%s)", purpose)
                    _toast.value = ToastMessage(AuthError.Unknown.message, ToastKind.Error)
                } finally {
                    _busy.value = false
                    _confirmation.value = null
                }
            }
        }

        // ── Projection ────────────────────────────────────────────────────

        private fun rebuild() {
            _state.value = GroupedListUiState.Loaded(groups())
        }

        /**
         * The full GroupedList projection. Each group is built by its own
         * helper below — the shell drops a group with no rows (helper
         * included), so every "nothing here" state is a row of its own.
         */
        @VisibleForTesting
        internal fun groups(): List<GroupedListGroup> {
            val now = nowMillis()
            return buildList {
                add(thisDeviceGroup(now))
                add(otherDevicesGroup(now))
                if (registry.sessions.isNotEmpty()) add(webSessionsGroup(now))
                add(securityGroup())
                add(actionsGroup())
                add(activityGroup(now))
            }
        }

        private fun thisDeviceGroup(now: Long): GroupedListGroup =
            GroupedListGroup(
                id = GROUP_THIS_DEVICE,
                overline = "This device",
                rows =
                    registry.devices
                        .filter { it.isCurrent == true }
                        .map { deviceRow(it, now, tappable = false) }
                        .ifEmpty {
                            listOf(
                                GroupedListRow(
                                    id = ROW_THIS_DEVICE_UNBOUND,
                                    label = "Not registered yet",
                                    subtext = "Sign in again on this device to register it as trusted.",
                                    leadingIcon = PantopusIcon.Smartphone,
                                    control = RowControl.ChipStatus("Unbound", RowControl.ChipTone.Neutral, includesChevron = false),
                                    testTag = TAG_THIS_DEVICE_UNBOUND,
                                ),
                            )
                        },
            )

        private fun otherDevicesGroup(now: Long): GroupedListGroup {
            val others =
                registry.devices
                    .filterNot { it.isCurrent == true }
                    .sortedByDescending { parseMillis(it.lastSeenAt) ?: 0L }
            return GroupedListGroup(
                id = GROUP_OTHER_DEVICES,
                overline = "Other devices",
                helper =
                    if (others.isEmpty()) {
                        null
                    } else {
                        "Tap a device to remove it. It will be signed out and will need to sign in again."
                    },
                rows =
                    others.map { deviceRow(it, now, tappable = true) }.ifEmpty {
                        listOf(
                            GroupedListRow(
                                id = ROW_OTHER_DEVICES_EMPTY,
                                label = "No other devices",
                                subtext = "Only this device is signed in to your account.",
                                leadingIcon = PantopusIcon.ShieldCheck,
                                control = RowControl.ChipStatus("None", RowControl.ChipTone.Neutral, includesChevron = false),
                                testTag = TAG_OTHER_DEVICES_EMPTY,
                            ),
                        )
                    },
            )
        }

        private fun webSessionsGroup(now: Long): GroupedListGroup =
            GroupedListGroup(
                id = GROUP_WEB_SESSIONS,
                overline = "Web sessions",
                helper = "Browser sessions end with \"Sign out of all other devices\".",
                rows = registry.sessions.map { sessionRow(it, now) },
            )

        private fun actionsGroup(): GroupedListGroup =
            GroupedListGroup(
                id = GROUP_ACTIONS,
                overline = null,
                rows =
                    listOf(
                        GroupedListRow(
                            id = ROW_SIGN_OUT_OTHERS,
                            label = "Sign out of all other devices",
                            subtext = "Keeps this device signed in.",
                            leadingIcon = PantopusIcon.Power,
                            control = RowControl.Chevron,
                            testTag = TAG_SIGN_OUT_OTHERS,
                        ),
                        GroupedListRow(
                            id = ROW_LOCKDOWN,
                            label = "Lockdown",
                            subtext = "Sign out everywhere, including this device.",
                            leadingIcon = PantopusIcon.ShieldAlert,
                            control = RowControl.Chevron,
                            destructive = true,
                            testTag = TAG_LOCKDOWN,
                        ),
                    ),
            )

        private fun activityGroup(now: Long): GroupedListGroup =
            GroupedListGroup(
                id = GROUP_ACTIVITY,
                overline = "Recent activity",
                rows =
                    registry.events.take(MAX_EVENTS).map { eventRow(it, now) }.ifEmpty {
                        listOf(
                            GroupedListRow(
                                id = ROW_ACTIVITY_EMPTY,
                                label = "No security activity yet",
                                subtext = "Sign-ins, device changes and verifications show up here.",
                                control = RowControl.ChipStatus("None", RowControl.ChipTone.Neutral, includesChevron = false),
                                testTag = TAG_ACTIVITY_EMPTY,
                            ),
                        )
                    },
            )

        private fun securityGroup(): GroupedListGroup =
            GroupedListGroup(
                id = GROUP_SECURITY,
                overline = "Security",
                helper =
                    if (prefsLoadFailed) {
                        "Security settings could not load. Retry before changing them."
                    } else {
                        "Changing these asks you to confirm it's you."
                    },
                rows =
                    listOf(
                        GroupedListRow(
                            id = ROW_PREF_RESTORE_GRANTS,
                            label = "Remember me after reinstall",
                            subtext = "Continue with your screen lock after reinstalling on this device.",
                            control = RowControl.Toggle(prefs.allowRestoreGrants ?: true),
                            testTag = TAG_PREF_RESTORE_GRANTS,
                        ),
                        GroupedListRow(
                            id = ROW_PREF_NEW_DEVICE_EMAIL,
                            label = "Email me about new sign-ins",
                            subtext = "Get an email when a new device signs in to your account.",
                            control = RowControl.Toggle(prefs.newDeviceEmail ?: true),
                            testTag = TAG_PREF_NEW_DEVICE_EMAIL,
                        ),
                    ),
            )

        private fun deviceRow(
            device: AuthDeviceDto,
            now: Long,
            tappable: Boolean,
        ): GroupedListRow {
            val detail =
                listOfNotNull(
                    device.model?.takeIf { it.isNotBlank() },
                    platformLabel(device.platform, device.osVersion),
                    device.lastSeenAt?.let { "Active ${relativeTime(it, now)}" },
                ).joinToString(" · ")
            return GroupedListRow(
                id = "$DEVICE_ROW_PREFIX${device.id}",
                label = deviceTitle(device),
                subtext = detail.ifBlank { null },
                leadingIcon = iconFor(device.platform),
                control =
                    RowControl.ChipStatus(
                        label = trustLabel(device.trustLevel),
                        tone = trustTone(device.trustLevel),
                        includesChevron = tappable,
                    ),
                testTag = "$TAG_DEVICE_ROW_PREFIX${device.id}",
            )
        }

        private fun sessionRow(
            session: AuthSessionDto,
            now: Long,
        ): GroupedListRow =
            GroupedListRow(
                id = "$SESSION_ROW_PREFIX${session.id}",
                label = browserLabel(session.userAgent) + if (session.isCurrent == true) " (this session)" else "",
                subtext =
                    listOfNotNull(
                        session.platform?.replaceFirstChar { it.titlecase(Locale.US) },
                        session.lastSeenAt?.let { "Active ${relativeTime(it, now)}" },
                    ).joinToString(" · ").ifBlank { null },
                leadingIcon = PantopusIcon.Globe,
                control =
                    RowControl.ChipStatus(
                        label = "Web",
                        tone = RowControl.ChipTone.Neutral,
                        includesChevron = false,
                    ),
                testTag = "$TAG_SESSION_ROW_PREFIX${session.id}",
            )

        private fun eventRow(
            event: SecurityEventDto,
            now: Long,
        ): GroupedListRow =
            GroupedListRow(
                id = "$EVENT_ROW_PREFIX${event.id}",
                label = eventLabel(event.type),
                subtext = event.createdAt?.let { relativeTime(it, now) },
                control =
                    RowControl.ChipStatus(
                        label = if (event.type in ALERT_EVENTS) "Alert" else "Info",
                        tone = if (event.type in ALERT_EVENTS) RowControl.ChipTone.Warning else RowControl.ChipTone.Neutral,
                        includesChevron = false,
                    ),
                testTag = "$TAG_EVENT_ROW_PREFIX${event.id}",
            )

        private fun SecurityPrefsDto.mergedOver(fallback: SecurityPrefsDto): SecurityPrefsDto =
            SecurityPrefsDto(
                allowRestoreGrants = allowRestoreGrants ?: fallback.allowRestoreGrants,
                newDeviceEmail = newDeviceEmail ?: fallback.newDeviceEmail,
            )

        companion object {
            const val GROUP_THIS_DEVICE = "thisDevice"
            const val GROUP_OTHER_DEVICES = "otherDevices"
            const val GROUP_WEB_SESSIONS = "webSessions"
            const val GROUP_SECURITY = "security"
            const val GROUP_ACTIONS = "actions"
            const val GROUP_ACTIVITY = "activity"

            const val DEVICE_ROW_PREFIX = "device."
            const val SESSION_ROW_PREFIX = "session."
            const val EVENT_ROW_PREFIX = "event."
            const val ROW_PREF_RESTORE_GRANTS = "pref.allowRestoreGrants"
            const val ROW_PREF_NEW_DEVICE_EMAIL = "pref.newDeviceEmail"
            const val ROW_SIGN_OUT_OTHERS = "signOutOthers"
            const val ROW_LOCKDOWN = "lockdown"
            const val ROW_THIS_DEVICE_UNBOUND = "thisDevice.unbound"
            const val ROW_OTHER_DEVICES_EMPTY = "otherDevices.empty"
            const val ROW_ACTIVITY_EMPTY = "activity.empty"

            /** Test tags — mirror iOS `settings.devices.*` accessibility identifiers. */
            const val TAG_ROOT = "settings.devices.root"
            const val TAG_DEVICE_ROW_PREFIX = "settings.devices.device."
            const val TAG_SESSION_ROW_PREFIX = "settings.devices.session."
            const val TAG_EVENT_ROW_PREFIX = "settings.devices.event."
            const val TAG_PREF_RESTORE_GRANTS = "settings.devices.prefs.allowRestoreGrants"
            const val TAG_PREF_NEW_DEVICE_EMAIL = "settings.devices.prefs.newDeviceEmail"
            const val TAG_SIGN_OUT_OTHERS = "settings.devices.signOutOthers"
            const val TAG_LOCKDOWN = "settings.devices.lockdown"
            const val TAG_CONFIRM_DIALOG = "settings.devices.confirm"
            const val TAG_CONFIRM_PRIMARY = "settings.devices.confirm.primary"
            const val TAG_CONFIRM_CANCEL = "settings.devices.confirm.cancel"
            const val TAG_TOAST = "settings.devices.toast"
            const val TAG_THIS_DEVICE_UNBOUND = "settings.devices.thisDevice.unbound"
            const val TAG_OTHER_DEVICES_EMPTY = "settings.devices.otherDevices.empty"
            const val TAG_ACTIVITY_EMPTY = "settings.devices.activity.empty"

            private const val MAX_EVENTS = 20

            /** `(user-agent marker, label)` — first match wins, most specific first. */
            private val BROWSER_MARKERS =
                listOf(
                    "Edg/" to "Edge",
                    "OPR/" to "Opera",
                    "Opera" to "Opera",
                    "Firefox/" to "Firefox",
                    "Chrome/" to "Chrome",
                    "Safari/" to "Safari",
                )

            private val OS_MARKERS =
                listOf(
                    "Windows" to "Windows",
                    "Mac OS X" to "Mac",
                    "Macintosh" to "Mac",
                    "CrOS" to "ChromeOS",
                    "Android" to "Android",
                    "iPhone" to "iOS",
                    "iPad" to "iOS",
                    "Linux" to "Linux",
                )

            /**
             * The complete `AuthSecurityEvent.type` vocabulary the backend
             * writes (`authSessionService.recordSecurityEvent` call sites in
             * `authDeviceService.js`, `authNotifyService.js`,
             * `routes/authDevices.js`, `routes/users.js`) → copy. Keep in sync
             * with iOS `DevicesViewModel.eventTitles` and web
             * `securityActivity.ts`: a missing type renders as raw snake_case.
             */
            private val EVENT_LABELS =
                mapOf(
                    "login" to "Signed in",
                    "logout" to "Signed out",
                    "resume" to "Session restored after reinstall",
                    "refresh_reuse" to "Refresh token reuse detected",
                    "device_mismatch" to "Device key mismatch",
                    "device_revoked" to "Device removed",
                    "session_revoked" to "Session revoked",
                    "inactivity_expired" to "Session expired (inactive)",
                    "step_up" to "Identity verified",
                    "step_up_key_enrolled" to "Biometric verification enabled",
                    "security_prefs_changed" to "Security settings changed",
                    "revoke_others" to "Signed out other devices",
                    "lockdown" to "Lockdown — signed out everywhere",
                    "password_changed" to "Password changed",
                    "password_reset" to "Password reset",
                    "account_deleted" to "Account deleted",
                    "new_device_email_sent" to "New sign-in email sent",
                    "device_removed_email_sent" to "Device-removed email sent",
                    "password_changed_email_sent" to "Password-changed email sent",
                    "security_signout_email_sent" to "Security sign-out email sent",
                    "lockdown_email_sent" to "Signed-out-everywhere email sent",
                )

            private val ALERT_EVENTS =
                setOf("refresh_reuse", "device_mismatch", "session_revoked", "device_revoked", "lockdown", "password_reset")

            private const val MINUTE_MS = 60_000L
            private const val HOUR_MS = 60 * MINUTE_MS
            private const val DAY_MS = 24 * HOUR_MS
            private const val WEEK_MS = 7 * DAY_MS
            private const val MONTH_MS = 30 * DAY_MS

            /** "Ying's Pixel 9" / model / platform — whatever the registry has. */
            fun deviceTitle(device: AuthDeviceDto): String =
                device.name?.takeIf { it.isNotBlank() }
                    ?: device.model?.takeIf { it.isNotBlank() }
                    ?: platformLabel(device.platform, null)
                    ?: "Device"

            fun platformLabel(
                platform: String?,
                osVersion: String?,
            ): String? {
                val base =
                    when (platform?.lowercase(Locale.US)) {
                        "ios" -> "iOS"
                        "android" -> "Android"
                        "web" -> "Web"
                        null, "" -> null
                        else -> platform.replaceFirstChar { it.titlecase(Locale.US) }
                    } ?: return null
                return if (osVersion.isNullOrBlank()) base else "$base $osVersion"
            }

            fun iconFor(platform: String?): PantopusIcon =
                when (platform?.lowercase(Locale.US)) {
                    "ios", "android" -> PantopusIcon.Smartphone
                    "web" -> PantopusIcon.Globe
                    else -> PantopusIcon.Monitor
                }

            fun trustLabel(trustLevel: String?): String =
                when (trustLevel?.lowercase(Locale.US)) {
                    "trusted" -> "Trusted"
                    "suspect" -> "Needs attention"
                    else -> "Unverified"
                }

            fun trustTone(trustLevel: String?): RowControl.ChipTone =
                when (trustLevel?.lowercase(Locale.US)) {
                    "trusted" -> RowControl.ChipTone.Success
                    "suspect" -> RowControl.ChipTone.Warning
                    else -> RowControl.ChipTone.Neutral
                }

            /**
             * Very light UA sniffing — just enough for "Chrome on Mac".
             * Order matters: Edge and Opera also advertise `Chrome/`, and
             * Chrome advertises `Safari/`.
             */
            fun browserLabel(userAgent: String?): String {
                val ua = userAgent.orEmpty()
                val browser = BROWSER_MARKERS.firstOrNull { (marker, _) -> ua.contains(marker) }?.second ?: "Browser"
                val os = OS_MARKERS.firstOrNull { (marker, _) -> ua.contains(marker) }?.second
                return if (os != null) "$browser on $os" else browser
            }

            /** Human label for a `SecurityEvent.type` (unknown types are humanised). */
            fun eventLabel(type: String): String =
                EVENT_LABELS[type]
                    ?: type
                        .replace('_', ' ')
                        .replaceFirstChar { it.titlecase(Locale.US) }

            /** ISO-8601 → epoch millis, `null` when unparsable. */
            fun parseMillis(iso: String?): Long? {
                if (iso.isNullOrBlank()) return null
                return runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull()
                    ?: runCatching { OffsetDateTime.parse(iso).toInstant().toEpochMilli() }.getOrNull()
            }

            /** "just now" / "5 min ago" / "3 h ago" / "2 d ago" / "3 w ago" / "4 mo ago". */
            fun relativeTime(
                iso: String?,
                now: Long,
            ): String {
                val then = parseMillis(iso) ?: return "recently"
                val delta = abs(now - then)
                return when {
                    delta < MINUTE_MS -> "just now"
                    delta < HOUR_MS -> "${delta / MINUTE_MS} min ago"
                    delta < DAY_MS -> "${delta / HOUR_MS} h ago"
                    delta < WEEK_MS -> "${delta / DAY_MS} d ago"
                    delta < MONTH_MS -> "${delta / WEEK_MS} w ago"
                    else -> "${delta / MONTH_MS} mo ago"
                }
            }
        }
    }
