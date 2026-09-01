package app.pantopus.android.core.security

import androidx.fragment.app.FragmentActivity
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.StepUpTokenProvider
import app.pantopus.android.data.auth.StepUpTokenProviderRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The **step-up UI coordinator** (design §2.5, §7.9, CONTRACT §"Client
 * behaviour"): turns "this action needs an `X-Step-Up` token for
 * [purpose]" into the right user gesture and the matching
 * `POST /api/auth/step-up` call.
 *
 * Method choice — strongest available, server rules respected:
 *  1. **`device_key`** when the biometry-bound step-up key is enrolled for
 *     the current user *and* the session is `interactive`
 *     ([AuthRepository.canStepUpWithDeviceKey]) *and* the server advertised
 *     (or did not restrict) it. The `CryptoObject` BiometricPrompt
 *     ([AppLockManager.promptWithCrypto]) IS the Tier-2 gesture. A 403 from
 *     the server (password-first purpose such as `delete_account`, restored
 *     session) drops to 2.
 *  2. **`password`** — the Tier-2 presence gate
 *     ([AppLockManager.verifySensitiveAction], pass-through with no OS
 *     credential) followed by the in-app password sheet
 *     ([passwordRequest] → `StepUpPasswordSheet`); wrong password → retry
 *     in place.
 *
 * Call sites either pre-fetch a token ([obtainToken]) and send it on the
 * request themselves (Devices screen, account deletion), or simply issue
 * the request and let the 403 `STEP_UP_REQUIRED` interceptor
 * (`data/auth/StepUpInterceptor`) call [requestStepUpToken] and retry once
 * — this class registers itself as that interceptor's provider while an
 * Activity is attached ([attach] / [detach], driven by `StepUpHost`).
 *
 * One step-up at a time: concurrent callers queue on [mutex]; a re-entrant
 * request (the interceptor firing for the coordinator's own
 * `/api/auth/step-up` call) is answered `null` instead of deadlocking.
 */
@Singleton
class StepUpCoordinator
    @Inject
    constructor(
        private val authRepository: AuthRepository,
        private val appLockManager: AppLockManager,
        private val registry: StepUpTokenProviderRegistry,
    ) : StepUpTokenProvider {
        /** Result of [obtainToken]. */
        sealed interface Outcome {
            data class Token(
                val stepUpToken: String,
                /** `password` | `device_key`. */
                val method: String,
            ) : Outcome

            /** The user backed out of the biometric sheet / password sheet. Callers stay put silently. */
            data object Cancelled : Outcome

            /** Verification could not be completed; callers surface [message]. */
            data class Failed(
                val message: String,
            ) : Outcome
        }

        /**
         * A pending password prompt for the UI host to render. `null` when
         * no password is being asked for.
         */
        data class PasswordRequest(
            val purpose: String,
            /** Human title for the sheet, e.g. "Approve account deletion". */
            val title: String,
            /** Inline error from the previous attempt (wrong password, offline …). */
            val error: String? = null,
            /** `POST /api/auth/step-up` in flight — disable the field + button. */
            val isSubmitting: Boolean = false,
        )

        private val _passwordRequest = MutableStateFlow<PasswordRequest?>(null)
        val passwordRequest: StateFlow<PasswordRequest?> = _passwordRequest.asStateFlow()

        private val mutex = Mutex()

        /** One interceptor-driven step-up at a time — see [requestStepUpToken]. */
        private val interceptorSlot = AtomicBoolean(false)

        @Volatile
        private var inFlight = false

        @Volatile
        private var activityRef: WeakReference<FragmentActivity>? = null

        @Volatile
        private var passwordAnswers: Channel<String?>? = null

        /** The host Activity is up: biometric prompts + interceptor-driven step-ups become possible. */
        fun attach(activity: FragmentActivity) {
            activityRef = WeakReference(activity)
            registry.delegate = this
        }

        /** The host Activity is gone: the interceptor becomes a pass-through again. */
        fun detach(activity: FragmentActivity) {
            if (activityRef?.get() === activity) {
                activityRef = null
                if (registry.delegate === this) registry.delegate = null
                cancelPassword()
            }
        }

        /** The Activity attached via [attach], if still alive. */
        fun currentActivity(): FragmentActivity? = activityRef?.get()

        /**
         * Obtain an `X-Step-Up` token for [purpose].
         *
         * @param methods methods the server accepts (`password` / `device_key`),
         *   e.g. from a 403 body; `null` / empty = unknown → try the strongest
         *   and let the server steer.
         * @param activity host for the BiometricPrompt; defaults to the
         *   attached one. Without an Activity only nothing can be verified.
         * @param reason prompt title; defaults to a per-purpose phrase.
         */
        suspend fun obtainToken(
            purpose: String,
            methods: List<String>? = null,
            activity: FragmentActivity? = currentActivity(),
            reason: String = reasonFor(purpose),
        ): Outcome =
            mutex.withLock {
                inFlight = true
                try {
                    run(purpose, methods, activity, reason)
                } finally {
                    inFlight = false
                }
            }

        /**
         * [StepUpTokenProvider] for the 403 interceptor — same flow, token or
         * `null`.
         *
         * Called from `StepUpInterceptor` inside `runBlocking` on an OkHttp
         * dispatcher thread, so **at most one caller may ever park here**:
         *  - `inFlight` short-circuits re-entrancy (the interceptor firing for
         *    the coordinator's own `/api/auth/step-up`, or a request racing
         *    while the sheet is already up) — waiting on the mutex we hold
         *    would deadlock that thread outright;
         *  - [interceptorSlot] then caps the queue at one. Without it a burst
         *    of concurrent 403s could park every per-host OkHttp slot (5 by
         *    default) and starve the `/api/auth/step-up` call itself, which
         *    rides the same client. Losers simply get their 403 back.
         */
        override suspend fun requestStepUpToken(
            purpose: String,
            methods: List<String>,
        ): String? {
            if (inFlight) return null
            if (!interceptorSlot.compareAndSet(false, true)) return null
            return try {
                withContext(Dispatchers.Main.immediate) {
                    (obtainToken(purpose, methods) as? Outcome.Token)?.stepUpToken
                }
            } finally {
                interceptorSlot.set(false)
            }
        }

        /** The password sheet's "Verify". */
        fun submitPassword(password: String) {
            passwordAnswers?.trySend(password)
        }

        /** The password sheet's "Cancel" / dismiss. */
        fun cancelPassword() {
            passwordAnswers?.trySend(null)
        }

        // ── internals ─────────────────────────────────────────────────────

        @Suppress("ReturnCount")
        private suspend fun run(
            purpose: String,
            methods: List<String>?,
            activity: FragmentActivity?,
            reason: String,
        ): Outcome {
            val allowed = methods?.filter { it.isNotBlank() }?.takeIf { it.isNotEmpty() } ?: ALL_METHODS
            if (activity == null) return Outcome.Failed(NO_ACTIVITY_MESSAGE)

            if (METHOD_DEVICE_KEY in allowed && authRepository.canStepUpWithDeviceKey()) {
                val result =
                    authRepository.stepUpWithDeviceKey(purpose) { crypto ->
                        appLockManager.promptWithCrypto(activity, crypto, reason, subtitle = BIOMETRIC_SUBTITLE)
                    }
                when (result) {
                    is AuthRepository.StepUpResult.Token -> return Outcome.Token(result.stepUpToken, METHOD_DEVICE_KEY)
                    AuthRepository.StepUpResult.Cancelled -> return Outcome.Cancelled
                    // Server / key refused this method: fall through to password.
                    AuthRepository.StepUpResult.Unavailable -> Unit
                    is AuthRepository.StepUpResult.Failed ->
                        when (result.error) {
                            AuthError.NetworkError, AuthError.RateLimited -> return Outcome.Failed(result.error.message)
                            else -> Timber.w(result.error, "device_key step-up failed; falling back to password")
                        }
                }
            }

            if (METHOD_PASSWORD !in allowed) return Outcome.Failed(NO_METHOD_MESSAGE)

            // Tier-2 presence gate (RN `useSensitiveActionGuard` parity), then the password.
            when (val gate = appLockManager.verifySensitiveAction(activity, reason)) {
                AppLockManager.SensitiveActionOutcome.Verified -> Unit
                AppLockManager.SensitiveActionOutcome.Cancelled -> return Outcome.Cancelled
                is AppLockManager.SensitiveActionOutcome.Failed -> return Outcome.Failed(gate.message)
            }
            return askPassword(purpose, reason)
        }

        /** One password attempt: a terminal [Outcome], or an inline error to retry with. */
        private sealed interface Attempt {
            data class Done(
                val outcome: Outcome,
            ) : Attempt

            data class Retry(
                val error: String,
            ) : Attempt
        }

        /** `POST /api/auth/step-up { method: "password" }` for one entered password. */
        private suspend fun submitPassword(
            purpose: String,
            password: String,
        ): Attempt =
            when (val result = authRepository.stepUpWithPassword(purpose, password)) {
                is AuthRepository.StepUpResult.Token -> Attempt.Done(Outcome.Token(result.stepUpToken, METHOD_PASSWORD))
                AuthRepository.StepUpResult.Cancelled -> Attempt.Done(Outcome.Cancelled)
                AuthRepository.StepUpResult.Unavailable -> Attempt.Done(Outcome.Failed(NO_METHOD_MESSAGE))
                is AuthRepository.StepUpResult.Failed ->
                    when (val cause = result.error) {
                        AuthError.InvalidCredentials -> Attempt.Retry(WRONG_PASSWORD_MESSAGE)
                        is AuthError.ServerError -> Attempt.Done(Outcome.Failed(cause.detail))
                        else -> Attempt.Retry(cause.message)
                    }
            }

        @Suppress("ReturnCount")
        private suspend fun askPassword(
            purpose: String,
            title: String,
        ): Outcome {
            val answers = Channel<String?>(capacity = 1)
            passwordAnswers = answers
            var error: String? = null
            try {
                while (true) {
                    _passwordRequest.value = PasswordRequest(purpose = purpose, title = title, error = error)
                    val password = answers.receive() ?: return Outcome.Cancelled
                    if (password.isBlank()) {
                        error = "Enter your password."
                        continue
                    }
                    _passwordRequest.update { it?.copy(isSubmitting = true, error = null) }
                    when (val attempt = submitPassword(purpose, password)) {
                        is Attempt.Done -> return attempt.outcome
                        is Attempt.Retry -> error = attempt.error
                    }
                }
            } finally {
                _passwordRequest.value = null
                if (passwordAnswers === answers) passwordAnswers = null
                answers.close()
            }
        }

        companion object {
            const val METHOD_PASSWORD = "password"
            const val METHOD_DEVICE_KEY = "device_key"

            const val PURPOSE_DELETE_ACCOUNT = "delete_account"
            const val PURPOSE_REVOKE_DEVICE = "revoke_device"
            const val PURPOSE_REVOKE_SESSIONS = "revoke_sessions"
            const val PURPOSE_CHANGE_SECURITY_PREFS = "change_security_prefs"

            private val ALL_METHODS = listOf(METHOD_PASSWORD, METHOD_DEVICE_KEY)

            const val NO_ACTIVITY_MESSAGE = "We couldn't verify your identity. Please try again."
            const val NO_METHOD_MESSAGE = "Verification isn't available for this account right now."
            const val WRONG_PASSWORD_MESSAGE = "Incorrect password. Try again."
            private const val BIOMETRIC_SUBTITLE = "Confirm it's you to continue"

            /** Prompt / sheet title per step-up purpose (mirrors iOS `StepUpReason`). */
            fun reasonFor(purpose: String): String =
                when (purpose) {
                    PURPOSE_DELETE_ACCOUNT -> "Approve account deletion"
                    PURPOSE_REVOKE_DEVICE -> "Remove this device"
                    PURPOSE_REVOKE_SESSIONS -> "Sign out other devices"
                    PURPOSE_CHANGE_SECURITY_PREFS -> "Change security settings"
                    else -> "Verify it's you"
                }
        }
    }
