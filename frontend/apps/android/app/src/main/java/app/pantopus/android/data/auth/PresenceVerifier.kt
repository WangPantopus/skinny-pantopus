package app.pantopus.android.data.auth

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * The **client-side presence gate** in front of "Continue as X" (design §2.5,
 * §3 L2): `BiometricPrompt(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)`. Nothing
 * cryptographic is derived from it — server-verifiable presence is the
 * separate step-up key. Abstracted so `AuthRepository.resume()` is
 * unit-testable without an Activity.
 *
 * "No OS lock ⇒ no one-tap resume" (design §2.2): when
 * `canAuthenticate(...) != BIOMETRIC_SUCCESS` the outcome is
 * [Outcome.Unavailable] and the caller drops to L3.
 */
interface PresenceVerifier {
    sealed interface Outcome {
        data object Verified : Outcome

        /** The user dismissed the sheet — stay on the card. */
        data object Cancelled : Outcome

        /** No screen lock / no biometrics enrolled / hardware missing — go to L3. */
        data object Unavailable : Outcome

        data class Failed(
            val message: String,
        ) : Outcome
    }

    /** True when the device can show the prompt at all (has an OS lock). */
    fun canVerify(): Boolean

    suspend fun verifyPresence(
        activity: FragmentActivity,
        title: String,
        subtitle: String? = null,
    ): Outcome
}

/** Production [PresenceVerifier] over `androidx.biometric`. */
@Singleton
class BiometricPresenceVerifier
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : PresenceVerifier {
        override fun canVerify(): Boolean =
            BiometricManager.from(context).canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS

        override suspend fun verifyPresence(
            activity: FragmentActivity,
            title: String,
            subtitle: String?,
        ): PresenceVerifier.Outcome {
            if (!canVerify()) return PresenceVerifier.Outcome.Unavailable
            // BiometricPrompt must be driven from the main thread; callers may
            // arrive from any dispatcher.
            return withContext(Dispatchers.Main.immediate) { showPrompt(activity, title, subtitle) }
        }

        private suspend fun showPrompt(
            activity: FragmentActivity,
            title: String,
            subtitle: String?,
        ): PresenceVerifier.Outcome =
            suspendCancellableCoroutine { cont ->
                val prompt =
                    BiometricPrompt(
                        activity,
                        ContextCompat.getMainExecutor(activity),
                        object : BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                if (cont.isActive) cont.resume(PresenceVerifier.Outcome.Verified)
                            }

                            override fun onAuthenticationError(
                                errorCode: Int,
                                errString: CharSequence,
                            ) {
                                if (!cont.isActive) return
                                cont.resume(
                                    when (errorCode) {
                                        BiometricPrompt.ERROR_USER_CANCELED,
                                        BiometricPrompt.ERROR_CANCELED,
                                        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                                        -> PresenceVerifier.Outcome.Cancelled
                                        BiometricPrompt.ERROR_NO_BIOMETRICS,
                                        BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL,
                                        BiometricPrompt.ERROR_HW_NOT_PRESENT,
                                        BiometricPrompt.ERROR_HW_UNAVAILABLE,
                                        -> PresenceVerifier.Outcome.Unavailable
                                        else -> PresenceVerifier.Outcome.Failed(errString.toString().ifBlank { "Authentication failed." })
                                    },
                                )
                            }

                            override fun onAuthenticationFailed() {
                                // Wrong finger / face — the sheet stays up for another try.
                            }
                        },
                    )
                cont.invokeOnCancellation { runCatching { prompt.cancelAuthentication() } }
                val info =
                    BiometricPrompt.PromptInfo
                        .Builder()
                        .setTitle(title)
                        .apply { if (!subtitle.isNullOrBlank()) setSubtitle(subtitle) }
                        .setAllowedAuthenticators(AUTHENTICATORS)
                        .build()
                prompt.authenticate(info)
            }

        private companion object {
            const val AUTHENTICATORS =
                BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        }
    }

@Module
@InstallIn(SingletonComponent::class)
abstract class PresenceVerifierModule {
    @Binds
    @Singleton
    abstract fun bindPresenceVerifier(impl: BiometricPresenceVerifier): PresenceVerifier
}
