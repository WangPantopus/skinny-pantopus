@file:Suppress("TooManyFunctions")

package app.pantopus.android.core.security

import android.app.KeyguardManager
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Per-user biometric app-lock preference + lock lifecycle.
 *
 * Preference storage is intentionally separate from [app.pantopus.android.data.auth.TokenStorage]
 * — these are non-secret booleans/timestamps, not session tokens. Since the
 * persistent-login work they live in an `EncryptedSharedPreferences` file
 * (design §9: "app-lock pref → encrypted prefs, consistent with iOS", where
 * the pref moved to the Keychain) with a one-time migration from the legacy
 * plain file; a device whose Keystore refuses the master key silently keeps
 * the plain file so the lock never becomes unusable.
 *
 * Besides the app lock itself this is the app's single `BiometricPrompt`
 * wrapper: [verifySensitiveAction] (Tier-2 gate, passes through with no OS
 * credential), [verifyPresence] (strict presence check — never passes
 * through) and [promptWithCrypto] (a `CryptoObject`-backed prompt that
 * signs with the biometry-bound step-up key, see
 * `data/auth/StepUpKeyStore`).
 */
@Singleton
class AppLockManager
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        /**
         * The app came back from the background, and how long it was gone.
         * Sensitive screens read it: they ask again after a long enough
         * absence. Mirrors iOS `AppForegroundReturn`.
         */
        data class ForegroundReturn(
            val count: Long,
            val awayForMs: Long,
        )

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

        /**
         * Test seam — a plain in-memory `SharedPreferences` stands in for the
         * encrypted file on the JVM.
         */
        @androidx.annotation.VisibleForTesting
        internal var prefsOverride: SharedPreferences? = null

        /** Injectable OS prompt for deterministic delayed-result tests. */
        @androidx.annotation.VisibleForTesting
        internal var promptOverride: (suspend () -> Boolean)? = null

        /**
         * Encrypted preference file (falls back to the legacy plain file when
         * the Keystore-backed master key cannot be created). Opened lazily on
         * first use — [configure] — and migrated once from the plain file.
         */
        private val prefs: SharedPreferences by lazy { prefsOverride ?: openPrefs() }

        private fun openPrefs(): SharedPreferences {
            val legacy = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            val secure =
                runCatching {
                    val masterKey =
                        MasterKey
                            .Builder(context)
                            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                            .build()
                    EncryptedSharedPreferences.create(
                        context,
                        SECURE_PREFS_FILE,
                        masterKey,
                        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
                    )
                }.onFailure { Timber.w(it, "app-lock: encrypted prefs unavailable, keeping the plain file") }
                    .getOrNull() ?: return legacy
            migrateLegacyPrefs(from = legacy, to = secure)
            return secure
        }

        /** One-shot copy of every `appLock.*` entry from the plain file, then wipe it. */
        private fun migrateLegacyPrefs(
            from: SharedPreferences,
            to: SharedPreferences,
        ) {
            if (to.getBoolean(MIGRATED_KEY, false)) return
            val editor = to.edit()
            from.all.forEach { (key, value) ->
                when (value) {
                    is Boolean -> editor.putBoolean(key, value)
                    is Int -> editor.putInt(key, value)
                    is Long -> editor.putLong(key, value)
                    is String -> editor.putString(key, value)
                    else -> Unit
                }
            }
            editor.putBoolean(MIGRATED_KEY, true).apply()
            from.edit().clear().apply()
        }

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

        private val _foregroundReturn = MutableStateFlow<ForegroundReturn?>(null)

        /** The last time the app came back from the background. */
        val foregroundReturn: StateFlow<ForegroundReturn?> = _foregroundReturn.asStateFlow()

        private var userId: String? = null
        private var identityGeneration: Long = 0
        private var isPrompting = false
        private var attemptedCurrentLock = false

        /**
         * In-memory (never persisted, exactly like RN's `useRef`) timestamp of
         * the last *successful* sensitive-action check, moved up when someone
         * leaves a sensitive screen. Feeds [isWithinSensitiveGracePeriod].
         */
        private var lastSensitiveAuthAtMs: Long? = null

        /**
         * When someone last cancelled a sensitive-screen check. Cancelling on a
         * letter drops back to the Mailbox, whose own guard must not ask again
         * at once.
         */
        private var lastSensitiveCancelAtMs: Long? = null

        /**
         * The sensitive-screen check under way: guards that ask while it is up
         * share it, so two of them never raise two prompts. It belongs to no
         * screen: a link can replace the screen that started it, and the prompt
         * stays up for the one that took its place.
         */
        private var sensitiveScreenCheck: Deferred<SensitiveActionOutcome>? = null
        private val checkScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

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
            identityGeneration += 1
            lastSensitiveAuthAtMs = null
            lastSensitiveCancelAtMs = null
            sensitiveScreenCheck = null
            isPrompting = false
            backgroundedWhilePrompting = false
            this.userId = userId
            attemptedCurrentLock = false
            _lastError.value = null
            if (userId == null) {
                _preferenceEnabled.value = false
                _isLocked.value = false
                return
            }
            forgetRetiredLockSettings(userId)
            _preferenceEnabled.value = prefs.getBoolean(key(ON_LEAVE, userId), false)
            refreshCapability()
            autoDisableForUnavailableCapability()
            if (_preferenceEnabled.value) {
                _isLocked.value = true
            }
        }

        /**
         * The old switch and its one-time offer said "sensitive actions" and
         * locked the whole app (founder, 2026-11-06). Sensitive screens now
         * always ask, so nobody keeps the whole-app lock from that promise: its
         * settings are dropped, and only the renamed switch turns it on.
         */
        private fun forgetRetiredLockSettings(id: String) {
            val retired = listOf(key("enabled", id), key("setupPrompt", id)).filter(prefs::contains)
            if (retired.isEmpty()) return
            val editor = prefs.edit()
            retired.forEach(editor::remove)
            editor.apply()
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
                _lastError.value = null
            }
        }

        fun appDidBecomeActive() {
            if (!didEnterBackground) return
            didEnterBackground = false
            val id = userId ?: return
            val backgroundAt = prefs.getLong(key("backgroundAt", id), 0L)
            val elapsedMs =
                if (backgroundAt > 0L) {
                    (System.currentTimeMillis() - backgroundAt).coerceAtLeast(0L)
                } else {
                    0L
                }
            _foregroundReturn.value = ForegroundReturn((_foregroundReturn.value?.count ?: 0L) + 1, elapsedMs)
            if (!_preferenceEnabled.value) return
            if (elapsedMs >= lockAfterMs) {
                _isLocked.value = true
            }
        }

        /**
         * Turns the whole-app lock (the "Lock Pantopus when I leave the app"
         * switch) on or off. Sensitive screens ask either way.
         */
        suspend fun setEnabled(
            enabled: Boolean,
            activity: FragmentActivity,
        ): Boolean {
            val id = userId ?: return false
            if (!enabled) {
                prefs.edit().putBoolean(key(ON_LEAVE, id), false).apply()
                _preferenceEnabled.value = false
                _isLocked.value = false
                _lastError.value = null
                return true
            }
            return enableLock(id, activity)
        }

        private suspend fun enableLock(
            id: String,
            activity: FragmentActivity,
        ): Boolean {
            refreshCapability()
            if (_capability.value != Capability.Available) {
                autoDisableForUnavailableCapability()
                return false
            }
            val generation = identityGeneration
            val succeeded = authenticate(activity, reason = "Turn on app lock for Pantopus")
            if (generation != identityGeneration || !succeeded) return false
            prefs
                .edit()
                .putBoolean(key(ON_LEAVE, id), true)
                .putInt(key("lockAfterMs", id), 0)
                .apply()
            _preferenceEnabled.value = true
            _isLocked.value = false
            recordUnlock()
            return true
        }

        /** A lock is showing for a configured user with the preference on. */
        private val isUnlockable: Boolean
            get() = _isLocked.value && _preferenceEnabled.value && userId != null

        /**
         * @param automatic the try that needs no tap. It waits for the app to be
         *   back in front, and doesn't use up the one try on the way out. Identical
         *   on iOS, where asking any earlier fails.
         */
        suspend fun unlockIfNeeded(
            activity: FragmentActivity,
            automatic: Boolean = false,
        ) {
            if (!isUnlockable || isPrompting) return
            if (automatic && (didEnterBackground || attemptedCurrentLock)) return
            attemptedCurrentLock = true
            if (authenticate(activity, reason = "Unlock Pantopus")) {
                _isLocked.value = false
                _lastError.value = null
                lastSensitiveAuthAtMs = System.currentTimeMillis()
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
            activity: FragmentActivity?,
            reason: String,
        ): SensitiveActionOutcome {
            if (activity == null) return SensitiveActionOutcome.Failed(DEFAULT_VERIFY_FAILURE)
            refreshCapability()
            return when (_capability.value) {
                Capability.PasscodeNotSet,
                -> SensitiveActionOutcome.Verified
                Capability.NotAvailable,
                Capability.NotEnrolled,
                Capability.InvalidContext,
                ->
                    SensitiveActionOutcome.Failed(_capability.value.statusText)
                Capability.Available -> authenticateSensitiveAction(activity, reason)
            }
        }

        private suspend fun authenticateSensitiveAction(
            activity: FragmentActivity,
            reason: String,
        ): SensitiveActionOutcome {
            _lastError.value = null
            val generation = identityGeneration
            val verified = authenticate(activity, reason)
            if (generation != identityGeneration) {
                return SensitiveActionOutcome.Failed("Your account changed. Please verify again.")
            }
            if (verified) {
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

        /** Capability errors and a missing host must keep money surfaces covered. */
        suspend fun verifySensitiveScreen(
            activity: FragmentActivity?,
            reason: String,
            graceMs: Long = SENSITIVE_AUTH_GRACE_MS,
        ): SensitiveActionOutcome {
            if (activity == null) return SensitiveActionOutcome.Failed(DEFAULT_VERIFY_FAILURE)
            refreshCapability()
            if (_capability.value == Capability.Available) {
                if (isWithinSensitiveGracePeriod(graceMs)) return SensitiveActionOutcome.Verified
                if (wasJustCancelled()) return SensitiveActionOutcome.Cancelled
            }
            return sharedSensitiveScreenCheck(activity, reason).await()
        }

        private fun sharedSensitiveScreenCheck(
            activity: FragmentActivity,
            reason: String,
        ): Deferred<SensitiveActionOutcome> =
            sensitiveScreenCheck?.takeIf { it.isActive } ?: checkScope
                .async {
                    verifySensitiveAction(activity, reason).also { outcome ->
                        if (outcome == SensitiveActionOutcome.Cancelled) {
                            lastSensitiveCancelAtMs = System.currentTimeMillis()
                        }
                    }
                }.also { sensitiveScreenCheck = it }

        /** Nothing to ask inside the grace, so a guard shows no cover either. */
        fun passesSensitiveScreenWithoutAsking(graceMs: Long = SENSITIVE_AUTH_GRACE_MS): Boolean =
            _capability.value == Capability.Available && isWithinSensitiveGracePeriod(graceMs)

        /**
         * Someone was on a sensitive screen until now: the grace runs from here,
         * not from their last check, so a long read doesn't ask again on the way
         * back from a quick look at another tab.
         */
        fun noteSensitiveScreenLeft() {
            if (lastSensitiveAuthAtMs != null) lastSensitiveAuthAtMs = System.currentTimeMillis()
        }

        /** "Try again" on a guard, or coming back to one: this time it asks. */
        fun forgetSensitiveCancel() {
            lastSensitiveCancelAtMs = null
        }

        private fun wasJustCancelled(): Boolean {
            val last = lastSensitiveCancelAtMs ?: return false
            return System.currentTimeMillis() - last < SENSITIVE_CANCEL_ECHO_MS
        }

        /**
         * Outcome of [verifyPresence] — the strict variant of
         * [verifySensitiveAction] used where "no OS lock" must NOT pass
         * through (the L2 "Continue as …" gate, design §2.2).
         */
        sealed interface PresenceOutcome {
            data object Verified : PresenceOutcome

            /** The user dismissed the sheet. */
            data object Cancelled : PresenceOutcome

            /** No screen lock / biometrics enrolled — the caller degrades (L3). */
            data object Unavailable : PresenceOutcome

            data class Failed(
                val message: String,
            ) : PresenceOutcome
        }

        /**
         * Strict presence check: `BiometricPrompt(BIOMETRIC_STRONG or
         * DEVICE_CREDENTIAL)` titled [reason]. Unlike [verifySensitiveAction]
         * a device without any credential yields [PresenceOutcome.Unavailable]
         * instead of passing. Independent of the app-lock preference and of
         * whether a user is configured, so it is usable before sign-in.
         */
        suspend fun verifyPresence(
            activity: FragmentActivity,
            reason: String,
        ): PresenceOutcome {
            refreshCapability()
            when (_capability.value) {
                Capability.NotAvailable,
                Capability.NotEnrolled,
                Capability.PasscodeNotSet,
                -> return PresenceOutcome.Unavailable
                Capability.InvalidContext -> return PresenceOutcome.Failed(_capability.value.statusText)
                Capability.Available -> Unit
            }
            _lastError.value = null
            if (authenticate(activity, reason)) return PresenceOutcome.Verified
            val message = _lastError.value ?: DEFAULT_VERIFY_FAILURE
            return when {
                message == CANCELLED_MESSAGE -> PresenceOutcome.Cancelled
                _capability.value != Capability.Available -> PresenceOutcome.Unavailable
                else -> PresenceOutcome.Failed(message)
            }
        }

        /**
         * `CryptoObject`-backed prompt (class-3 biometrics ONLY — a
         * `CryptoObject` cannot be unlocked by the device credential on our
         * min SDK, and the step-up key is biometric-per-use anyway). Returns
         * the *authenticated* `CryptoObject` — its `Signature` is now allowed
         * exactly one operation — or `null` when the user cancelled / failed.
         * Shares the app-lock bookkeeping ([isPrompting] /
         * [backgroundedWhilePrompting]) so the OS sheet never re-locks the
         * app behind itself. This is the `StepUpKeyStore.PromptLauncher`
         * the UI hands to `AuthRepository.stepUpWithDeviceKey`.
         */
        suspend fun promptWithCrypto(
            activity: FragmentActivity,
            cryptoObject: BiometricPrompt.CryptoObject,
            reason: String,
            subtitle: String? = null,
        ): BiometricPrompt.CryptoObject? {
            val manager = BiometricManager.from(context)
            if (manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) != BiometricManager.BIOMETRIC_SUCCESS) {
                _lastError.value = Capability.NotEnrolled.statusText
                return null
            }
            isPrompting = true
            backgroundedWhilePrompting = false
            val generation = identityGeneration
            val result =
                try {
                    withContext(Dispatchers.Main.immediate) { cryptoPrompt(activity, cryptoObject, reason, subtitle) }
                } finally {
                    if (generation == identityGeneration) isPrompting = false
                }
            if (generation != identityGeneration) return null
            if (backgroundedWhilePrompting) {
                backgroundedWhilePrompting = false
                if (result == null) armBackground()
            }
            if (result != null) lastSensitiveAuthAtMs = System.currentTimeMillis()
            return result
        }

        private suspend fun cryptoPrompt(
            activity: FragmentActivity,
            cryptoObject: BiometricPrompt.CryptoObject,
            reason: String,
            subtitle: String?,
        ): BiometricPrompt.CryptoObject? =
            suspendCancellableCoroutine { cont ->
                val generation = identityGeneration
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
                                if (generation != identityGeneration) {
                                    if (cont.isActive) cont.resume(null)
                                    return
                                }
                                _lastError.value = messageFor(errorCode, errString.toString())
                                if (cont.isActive) cont.resume(null)
                            }

                            override fun onAuthenticationFailed() {
                                if (generation != identityGeneration) return
                                _lastError.value = "Authentication failed. Try again."
                            }

                            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                if (cont.isActive) cont.resume(result.cryptoObject)
                            }
                        },
                    )
                cont.invokeOnCancellation {
                    runCatching { biometricPrompt.cancelAuthentication() }
                }
                val info =
                    BiometricPrompt.PromptInfo
                        .Builder()
                        .setTitle(reason)
                        .apply { if (!subtitle.isNullOrBlank()) setSubtitle(subtitle) }
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                        .setNegativeButtonText("Cancel")
                        .build()
                biometricPrompt.authenticate(info, cryptoObject)
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

        /**
         * Whether a sensitive screen (Mail, the Wallet) would let the person in right now without asking: their
         * last check is still inside the grace, or the device has no screen lock to check against. Pantopus AI
         * sends this with each message ("identity"), so the server looks into Mail and the Wallet for it only when
         * those screens would open. It never prompts. Mirrors iOS `AppLockManager.passesSensitiveCheckNow`.
         */
        fun passesSensitiveCheckNow(): Boolean {
            refreshCapability()
            return when (_capability.value) {
                Capability.PasscodeNotSet -> true
                Capability.Available -> isWithinSensitiveGracePeriod()
                Capability.NotAvailable,
                Capability.NotEnrolled,
                Capability.InvalidContext,
                -> false
            }
        }

        fun clearTransientState() {
            identityGeneration += 1
            _isLocked.value = false
            isPrompting = false
            attemptedCurrentLock = false
            didEnterBackground = false
            backgroundedWhilePrompting = false
            _lastError.value = null
            userId = null
            _preferenceEnabled.value = false
            lastSensitiveAuthAtMs = null
            lastSensitiveCancelAtMs = null
            sensitiveScreenCheck = null
        }

        fun refreshCapability() {
            _biometricLabel.value = resolveBiometricLabel()
            val manager = BiometricManager.from(context)
            _capability.value = capabilityFor(manager.canAuthenticate(presenceAuthenticators()))
        }

        private suspend fun authenticate(
            activity: FragmentActivity,
            reason: String,
        ): Boolean {
            val generation = identityGeneration
            isPrompting = true
            backgroundedWhilePrompting = false
            val succeeded =
                try {
                    promptOverride?.invoke() ?: evaluate(activity, reason)
                } finally {
                    if (generation == identityGeneration) isPrompting = false
                }
            if (generation != identityGeneration) return false
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
                manager.canAuthenticate(presenceAuthenticators())
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
                val generation = identityGeneration
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
                                if (generation != identityGeneration) {
                                    if (cont.isActive) cont.resume(false)
                                    return
                                }
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
                                if (generation != identityGeneration) return
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
                        .setAllowedAuthenticators(presenceAuthenticators())
                        .build()
                biometricPrompt.authenticate(info)
            }

        private fun autoDisableForUnavailableCapability() {
            val id = userId ?: return
            if (_capability.value != Capability.PasscodeNotSet) return
            prefs.edit().putBoolean(key(ON_LEAVE, id), false).apply()
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

        private fun hasDeviceCredential(): Boolean? =
            runCatching { context.getSystemService(KeyguardManager::class.java)?.isDeviceSecure }.getOrNull()

        private fun capabilityFor(code: Int): Capability =
            when (code) {
                BiometricManager.BIOMETRIC_SUCCESS -> Capability.Available
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED,
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                -> if (hasDeviceCredential() == false) Capability.PasscodeNotSet else Capability.InvalidContext
                else -> Capability.InvalidContext
            }

        // STRONG | DEVICE_CREDENTIAL is unsupported on API 29 and below.
        // This non-cryptographic presence prompt keeps device-credential fallback;
        // the separate CryptoObject step-up still requires strong biometrics.
        private fun presenceAuthenticators(): Int =
            (
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                } else {
                    BiometricManager.Authenticators.BIOMETRIC_WEAK
                }
            ) or BiometricManager.Authenticators.DEVICE_CREDENTIAL

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
            /** Legacy plain file — drained into [SECURE_PREFS_FILE] on first open. */
            private const val PREFS_FILE = "app_lock_prefs"

            /** `EncryptedSharedPreferences` file holding the per-user app-lock prefs. */
            private const val SECURE_PREFS_FILE = "app_lock_prefs_secure"

            /** The whole-app lock's on/off field: the "Lock Pantopus when I leave the app" switch. */
            private const val ON_LEAVE = "onLeave"
            private const val MIGRATED_KEY = "appLock.migratedFromPlain"

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

            /** How long a cancel answers for the next screen that would ask. */
            private const val SENSITIVE_CANCEL_ECHO_MS: Long = 2_000

            private const val DEFAULT_VERIFY_FAILURE = "We couldn't verify your identity. Please try again."
        }
    }
