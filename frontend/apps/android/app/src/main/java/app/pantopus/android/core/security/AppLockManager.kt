@file:Suppress("TooManyFunctions")

package app.pantopus.android.core.security

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Per-user biometric app-lock preference + lock lifecycle.
 *
 * Preference storage is intentionally separate from [app.pantopus.android.data.auth.TokenStorage]
 * — these are non-secret booleans/timestamps, not session tokens.
 */
@Singleton
class AppLockManager
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        /**
         * Per-user answer to the one-time post-login "turn on app lock?"
         * offer. Persisted so the offer is made exactly once per account,
         * never on every launch. Mirrors RN's `AppLockSetupPromptState`
         * (`src/lib/biometrics.ts:10`) and iOS `AppLockSetupPromptState`.
         */
        enum class SetupPromptState(val wireValue: String) {
            /** Never answered — the prompt is still owed. */
            Pending("pending"),

            /** The user said "Not Now" (or the attempt failed) — never ask again. */
            Declined("declined"),

            /** App lock is on; nothing left to offer. */
            Enabled("enabled"),
            ;

            companion object {
                fun fromWire(value: String?): SetupPromptState = entries.firstOrNull { it.wireValue == value } ?: Pending
            }
        }

        /**
         * Which surface asked to enable app lock. Only the post-login offer
         * records a [SetupPromptState.Declined] answer when the user backs
         * out — turning the preference on from Settings and cancelling the
         * biometric sheet must not burn the one-time prompt. Mirrors RN's
         * `enableAppLock(source)` (`src/contexts/AppLockContext.tsx:118`).
         */
        enum class EnableSource {
            Settings,
            PostLoginPrompt,
        }

        enum class Capability(val wireValue: String) {
            Available("available"),
            NotAvailable("not_available"),
            NotEnrolled("not_enrolled"),
            PasscodeNotSet("passcode_not_set"),
            InvalidContext("invalid_context"),
            ;

            val statusText: String
                get() =
                    when (this) {
                        Available -> "Available"
                        NotAvailable -> "Not available on this device"
                        NotEnrolled -> "No biometrics enrolled"
                        PasscodeNotSet -> "Device passcode not set"
                        InvalidContext -> "Authentication unavailable"
                    }
        }

        private val prefs: SharedPreferences =
            context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)

        private val _isLocked = MutableStateFlow(false)
        val isLocked: StateFlow<Boolean> = _isLocked.asStateFlow()

        private val _preferenceEnabled = MutableStateFlow(false)
        val preferenceEnabled: StateFlow<Boolean> = _preferenceEnabled.asStateFlow()

        private val _capability = MutableStateFlow(Capability.NotAvailable)
        val capability: StateFlow<Capability> = _capability.asStateFlow()

        private val _biometricLabel = MutableStateFlow("Biometric")
        val biometricLabel: StateFlow<String> = _biometricLabel.asStateFlow()

        private val _lastError = MutableStateFlow<String?>(null)
        val lastError: StateFlow<String?> = _lastError.asStateFlow()

        /**
         * Per-user answer to the one-time post-login offer. `null` while
         * signed out. Hydrated by [configure] from the same per-user prefs
         * namespace as the preference itself. Mirrors RN's
         * `AppLockContext.setupPromptState`.
         */
        private val _setupPromptState = MutableStateFlow<SetupPromptState?>(null)
        val setupPromptState: StateFlow<SetupPromptState?> = _setupPromptState.asStateFlow()

        private var userId: String? = null
        private var isPrompting = false
        private var attemptedCurrentLock = false

        /**
         * In-memory (never persisted, exactly like RN's `useRef`) timestamp of
         * the last *successful* sensitive-action check. Feeds
         * [isWithinSensitiveGracePeriod].
         */
        private var lastSensitiveAuthAtMs: Long? = null

        /**
         * Set by [appDidEnterBackground], consumed by [appDidBecomeActive], so a
         * foreground pass without a matching background (a device-credential
         * prompt bouncing the Activity, say) can never re-lock the app.
         */
        private var didEnterBackground = false

        /**
         * A background signal that arrived while an auth prompt was up. The
         * prompt's own outcome decides what it meant, so the decision is
         * deferred to the tail of [authenticate]. Identical on iOS.
         */
        private var backgroundedWhilePrompting = false

        /** Immediate-on-resume today; persisted so 1/15 minute choices can land later. */
        val lockAfterMs: Int
            get() {
                val id = userId ?: return 0
                return prefs.getInt(key("lockAfterMs", id), 0)
            }

        init {
            refreshCapability()
        }

        fun configure(userId: String?) {
            if (this.userId == userId) return
            this.userId = userId
            attemptedCurrentLock = false
            _lastError.value = null
            if (userId == null) {
                _preferenceEnabled.value = false
                _isLocked.value = false
                _setupPromptState.value = null
                return
            }
            _preferenceEnabled.value = prefs.getBoolean(key("enabled", userId), false)
            _setupPromptState.value =
                SetupPromptState.fromWire(prefs.getString(key("setupPrompt", userId), null))
            refreshCapability()
            autoDisableForUnavailableCapability()
            // RN's "sync setup prompt state with preferences" effect
            // (`AppLockContext.tsx:395`): a user who already turned the lock
            // on is never offered it again.
            if (_preferenceEnabled.value && _setupPromptState.value == SetupPromptState.Pending) {
                persistSetupPromptState(SetupPromptState.Enabled)
            }
            if (_preferenceEnabled.value) {
                _isLocked.value = true
            }
        }

        /**
         * Record the user's answer to the one-time post-login offer. No-op
         * while signed out (there is no per-user namespace to write to).
         */
        private fun persistSetupPromptState(next: SetupPromptState) {
            val id = userId ?: return
            prefs.edit().putString(key("setupPrompt", id), next.wireValue).apply()
            _setupPromptState.value = next
        }

        /**
         * "Not Now" on the post-login offer — burn the prompt for this user.
         * Mirrors RN `AppLockContext.dismissSetupPrompt`.
         */
        fun dismissSetupPrompt() {
            persistSetupPromptState(SetupPromptState.Declined)
        }

        /**
         * The app left the foreground.
         *
         * `Activity.onStop()` is *not* that signal on its own: it also fires
         * when a configuration change (a rotation) destroys and recreates the
         * Activity, and while our own biometric / device-credential sheet
         * covers it. Callers therefore hand the manager the discriminators and
         * the manager decides, so the arming rule lives in exactly one place
         * and matches iOS, where `.background` never fires for either case.
         *
         * @param isConfigurationChange the host Activity's
         *   `isChangingConfigurations` — a rotation, never a real background.
         */
        fun appDidEnterBackground(isConfigurationChange: Boolean = false) {
            if (userId == null) return
            // Rotation / locale change / multi-window resize: the app never
            // left the foreground, so arming here would lock the device in the
            // user's hands. iOS sees no `.background` for these at all.
            if (isConfigurationChange) return
            // The system credential sheet stops the Activity. Whether that was
            // a real background is only knowable once the prompt resolves.
            if (isPrompting) {
                backgroundedWhilePrompting = true
                return
            }
            armBackground()
        }

        private fun armBackground() {
            val id = userId ?: return
            didEnterBackground = true
            prefs.edit().putLong(key("backgroundAt", id), System.currentTimeMillis()).apply()
            if (_preferenceEnabled.value) {
                _isLocked.value = true
                attemptedCurrentLock = false
            }
        }

        fun appDidBecomeActive() {
            if (!didEnterBackground) return
            didEnterBackground = false
            if (userId == null || !_preferenceEnabled.value) return
            val id = userId ?: return
            val backgroundAt = prefs.getLong(key("backgroundAt", id), 0L)
            val elapsedMs =
                if (backgroundAt > 0L) {
                    (System.currentTimeMillis() - backgroundAt).coerceAtLeast(0L).toInt()
                } else {
                    0
                }
            if (elapsedMs >= lockAfterMs) {
                _isLocked.value = true
            }
        }

        /**
         * @param source [EnableSource.PostLoginPrompt] records a
         *   [SetupPromptState.Declined] answer on every non-success path so
         *   the one-time offer is never repeated — RN's
         *   `enableAppLock('post_login_prompt')`
         *   (`AppLockContext.tsx:118-198`). [EnableSource.Settings] (the
         *   default) leaves the prompt state untouched on failure.
         */
        suspend fun setEnabled(
            enabled: Boolean,
            activity: FragmentActivity,
            source: EnableSource = EnableSource.Settings,
        ): Boolean {
            val id = userId ?: return false
            if (!enabled) {
                prefs.edit().putBoolean(key("enabled", id), false).apply()
                _preferenceEnabled.value = false
                _isLocked.value = false
                _lastError.value = null
                return true
            }
            return enableLock(id, activity, source)
        }

        private suspend fun enableLock(
            id: String,
            activity: FragmentActivity,
            source: EnableSource,
        ): Boolean {
            refreshCapability()
            if (_capability.value != Capability.Available) {
                autoDisableForUnavailableCapability()
                if (source == EnableSource.PostLoginPrompt) {
                    persistSetupPromptState(SetupPromptState.Declined)
                }
                return false
            }
            val succeeded = authenticate(activity, reason = "Turn on app lock for Pantopus")
            if (!succeeded) {
                if (source == EnableSource.PostLoginPrompt) {
                    persistSetupPromptState(SetupPromptState.Declined)
                }
                return false
            }
            prefs
                .edit()
                .putBoolean(key("enabled", id), true)
                .putInt(key("lockAfterMs", id), 0)
                .apply()
            _preferenceEnabled.value = true
            _isLocked.value = false
            recordUnlock()
            // Turning the lock on — from anywhere — resolves the one-time offer.
            persistSetupPromptState(SetupPromptState.Enabled)
            return true
        }

        /** A lock is showing for a configured user with the preference on. */
        private val isUnlockable: Boolean
            get() = _isLocked.value && _preferenceEnabled.value && userId != null

        suspend fun unlockIfNeeded(
            activity: FragmentActivity,
            automatic: Boolean = false,
        ) {
            if (!isUnlockable || isPrompting) return
            if (automatic && attemptedCurrentLock) return
            attemptedCurrentLock = true
            if (authenticate(activity, reason = "Unlock Pantopus")) {
                _isLocked.value = false
                _lastError.value = null
                recordUnlock()
            }
        }

        /**
         * Outcome of a one-shot re-auth gate in front of an irreversible
         * action (account deletion today). Mirrors the iOS
         * `SensitiveActionOutcome` and RN's `useSensitiveActionGuard`.
         */
        sealed interface SensitiveActionOutcome {
            /**
             * Identity confirmed — or the device carries no credential to
             * check against, which RN also treats as a pass-through.
             */
            data object Verified : SensitiveActionOutcome

            /** The user dismissed the system sheet. Callers stay put silently. */
            data object Cancelled : SensitiveActionOutcome

            /** Verification could not be completed; callers surface [message]. */
            data class Failed(
                val message: String,
            ) : SensitiveActionOutcome
        }

        /**
         * One-shot device-credential check in front of an irreversible action.
         *
         * Independent of the app-lock *preference*: deleting an account is
         * gated whether or not the user opted into lock-on-resume, exactly
         * like RN's `useSensitiveActionGuard` (which reads the capability,
         * not the preference). When the device has neither a biometric nor a
         * device credential there is nothing to check against, so the action
         * is let through rather than being made unreachable — RN's first
         * branch.
         */
        suspend fun verifySensitiveAction(
            activity: FragmentActivity,
            reason: String,
        ): SensitiveActionOutcome {
            refreshCapability()
            when (_capability.value) {
                Capability.NotAvailable,
                Capability.NotEnrolled,
                Capability.PasscodeNotSet,
                -> return SensitiveActionOutcome.Verified
                Capability.InvalidContext ->
                    return SensitiveActionOutcome.Failed(_capability.value.statusText)
                Capability.Available -> Unit
            }
            _lastError.value = null
            if (authenticate(activity, reason)) {
                lastSensitiveAuthAtMs = System.currentTimeMillis()
                return SensitiveActionOutcome.Verified
            }
            val message = _lastError.value ?: DEFAULT_VERIFY_FAILURE
            return if (message == CANCELLED_MESSAGE) {
                SensitiveActionOutcome.Cancelled
            } else {
                SensitiveActionOutcome.Failed(message)
            }
        }

        /**
         * `true` when a successful sensitive-action check happened inside the
         * grace window. Mirrors RN `AppLockContext.isWithinGracePeriod` and
         * iOS `AppLockManager.isWithinSensitiveGracePeriod`.
         */
        fun isWithinSensitiveGracePeriod(graceMs: Long = SENSITIVE_AUTH_GRACE_MS): Boolean {
            val last = lastSensitiveAuthAtMs ?: return false
            return System.currentTimeMillis() - last < graceMs
        }

        fun clearTransientState() {
            _isLocked.value = false
            isPrompting = false
            attemptedCurrentLock = false
            didEnterBackground = false
            backgroundedWhilePrompting = false
            _lastError.value = null
            userId = null
            _preferenceEnabled.value = false
            _setupPromptState.value = null
            lastSensitiveAuthAtMs = null
        }

        fun refreshCapability() {
            _biometricLabel.value = resolveBiometricLabel()
            val manager = BiometricManager.from(context)
            when (
                manager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL,
                )
            ) {
                BiometricManager.BIOMETRIC_SUCCESS -> {
                    _capability.value = Capability.Available
                }
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                    _capability.value =
                        if (hasDeviceCredential()) {
                            Capability.NotEnrolled
                        } else {
                            Capability.PasscodeNotSet
                        }
                }
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
                -> {
                    _capability.value = Capability.NotAvailable
                }
                BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> {
                    _capability.value = Capability.InvalidContext
                }
                else -> {
                    _capability.value = Capability.NotAvailable
                }
            }
        }

        private suspend fun authenticate(
            activity: FragmentActivity,
            reason: String,
        ): Boolean {
            isPrompting = true
            backgroundedWhilePrompting = false
            val succeeded =
                try {
                    evaluate(activity, reason)
                } finally {
                    isPrompting = false
                }
            // A background arrived mid-prompt. If the prompt then *succeeded*,
            // the cover was the OS auth sheet itself and the unlock stands. Any
            // other outcome means the OS cancelled the prompt because the user
            // really left, so the deferred background is applied now and the
            // lock stays armed. Identical on iOS.
            if (backgroundedWhilePrompting) {
                backgroundedWhilePrompting = false
                if (!succeeded) armBackground()
            }
            return succeeded
        }

        private suspend fun evaluate(
            activity: FragmentActivity,
            reason: String,
        ): Boolean {
            val manager = BiometricManager.from(context)
            val canAuth =
                manager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL,
                )
            if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
                _capability.value = capabilityFor(canAuth)
                autoDisableForUnavailableCapability()
                _lastError.value = _capability.value.statusText
                return false
            }
            return prompt(activity, reason)
        }

        private suspend fun prompt(
            activity: FragmentActivity,
            reason: String,
        ): Boolean =
            suspendCancellableCoroutine { cont ->
                val executor = ContextCompat.getMainExecutor(activity)
                val biometricPrompt =
                    BiometricPrompt(
                        activity,
                        executor,
                        object : BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationError(
                                errorCode: Int,
                                errString: CharSequence,
                            ) {
                                when (errorCode) {
                                    BiometricPrompt.ERROR_NO_BIOMETRICS,
                                    BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL,
                                    BiometricPrompt.ERROR_HW_NOT_PRESENT,
                                    BiometricPrompt.ERROR_HW_UNAVAILABLE,
                                    BiometricPrompt.ERROR_UNABLE_TO_PROCESS,
                                    -> {
                                        refreshCapability()
                                        autoDisableForUnavailableCapability()
                                    }
                                }
                                _lastError.value = messageFor(errorCode, errString.toString())
                                if (cont.isActive) cont.resume(false)
                            }

                            override fun onAuthenticationFailed() {
                                _lastError.value = "Authentication failed. Try again."
                                // Keep waiting for another attempt / cancel; do not resume yet.
                            }

                            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                if (cont.isActive) cont.resume(true)
                            }
                        },
                    )
                cont.invokeOnCancellation {
                    runCatching { biometricPrompt.cancelAuthentication() }
                }
                val info =
                    BiometricPrompt.PromptInfo.Builder()
                        .setTitle(reason)
                        .setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                                BiometricManager.Authenticators.DEVICE_CREDENTIAL,
                        )
                        .build()
                biometricPrompt.authenticate(info)
            }

        private fun autoDisableForUnavailableCapability() {
            val id = userId ?: return
            if (_capability.value == Capability.Available) return
            prefs.edit().putBoolean(key("enabled", id), false).apply()
            _preferenceEnabled.value = false
            _isLocked.value = false
        }

        private fun recordUnlock() {
            val id = userId ?: return
            prefs.edit().putLong(key("unlockedAt", id), System.currentTimeMillis()).apply()
        }

        private fun key(
            field: String,
            userId: String,
        ): String = "appLock.$userId.$field"

        private fun resolveBiometricLabel(): String {
            val pm = context.packageManager
            val hasFace =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    pm.hasSystemFeature(PackageManager.FEATURE_FACE)
                } else {
                    false
                }
            val hasFingerprint = pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
            return when {
                hasFace && !hasFingerprint -> "Face Unlock"
                hasFingerprint && !hasFace -> "Fingerprint"
                else -> "Biometric"
            }
        }

        private fun hasDeviceCredential(): Boolean {
            val manager = BiometricManager.from(context)
            return manager.canAuthenticate(BiometricManager.Authenticators.DEVICE_CREDENTIAL) ==
                BiometricManager.BIOMETRIC_SUCCESS
        }

        private fun capabilityFor(code: Int): Capability =
            when (code) {
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                    if (hasDeviceCredential()) Capability.NotEnrolled else Capability.PasscodeNotSet
                BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> Capability.InvalidContext
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
                -> Capability.NotAvailable
                else -> Capability.NotAvailable
            }

        private fun messageFor(
            errorCode: Int,
            fallback: String,
        ): String =
            when (errorCode) {
                BiometricPrompt.ERROR_USER_CANCELED,
                BiometricPrompt.ERROR_CANCELED,
                BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                -> CANCELLED_MESSAGE
                BiometricPrompt.ERROR_LOCKOUT,
                BiometricPrompt.ERROR_LOCKOUT_PERMANENT,
                -> "Biometrics are locked. Use your device passcode."
                BiometricPrompt.ERROR_NO_BIOMETRICS -> "Enroll biometrics in Device Settings."
                BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> "Set a device passcode to use app lock."
                BiometricPrompt.ERROR_HW_NOT_PRESENT,
                BiometricPrompt.ERROR_HW_UNAVAILABLE,
                -> "Biometric authentication is not available."
                BiometricPrompt.ERROR_UNABLE_TO_PROCESS -> "Authentication failed. Try again."
                else -> fallback.ifBlank { "Authentication failed. Try again." }
            }

        companion object {
            private const val PREFS_FILE = "app_lock_prefs"

            /**
             * The single string [messageFor] produces for every user- /
             * system-initiated cancel, matched by [verifySensitiveAction].
             * Mirrors iOS `AppLockManager.cancelledMessage`.
             */
            const val CANCELLED_MESSAGE = "Authentication was cancelled."

            /**
             * RN's `SENSITIVE_AUTH_GRACE_MS` (`contexts/AppLockContext.tsx:32`)
             * — a money surface guarded inside this window lets the next one
             * through without a second prompt.
             */
            const val SENSITIVE_AUTH_GRACE_MS: Long = 5 * 60 * 1000

            private const val DEFAULT_VERIFY_FAILURE = "We couldn't verify your identity. Please try again."
        }
    }
