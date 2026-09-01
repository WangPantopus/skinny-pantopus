package app.pantopus.android.data.auth

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.security.GeneralSecurityException
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.ProviderException
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The **biometry-bound step-up key** (`pantopus_stepup_key`) — the Android
 * half of design §2.5 / §7.9: server-verifiable presence for destructive
 * actions (`POST /api/auth/step-up { method: "device_key" }`).
 *
 * Unlike the DPoP device key it IS gated by the OS: `setUserAuthenticationRequired(true)`
 * with, on API 30+, `setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG)`
 * (per-use, class-3 biometrics only) and, on the minSdk 26–29 legacy path,
 * `setUserAuthenticationValidityDurationSeconds(-1)` (which on those
 * releases means "biometric, per use"). `setInvalidatedByBiometricEnrollment(true)`
 * kills the key when a new fingerprint / face is enrolled — the server then
 * simply sees a step-up failure and offers `password`; nothing about the
 * session breaks (design §12 "Device-key loss").
 *
 * Signing goes through `BiometricPrompt` with a `CryptoObject(Signature)`:
 * [sign] initialises the `Signature`, hands it to the caller-supplied
 * [PromptLauncher] (UI shows the sheet, returns the authenticated
 * `CryptoObject` or `null` on cancel / failure) and finishes the signature.
 * The store itself never touches an Activity.
 *
 * Enrolment (`POST /api/auth/step-up-key`) happens after an *interactive*
 * login only, when `BIOMETRIC_STRONG` is available; whether the server
 * accepts a `device_key` step-up also depends on the *current* session
 * being interactive — see `AuthRepository.canStepUpWithDeviceKey`.
 */
@Singleton
open class StepUpKeyStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        /**
         * Runs the system BiometricPrompt for [cryptoObject] and returns the
         * authenticated object (`result.cryptoObject`) — or `null` when the
         * user cancelled / auth failed. Implemented by the UI layer
         * (`AppLockManager.promptWithCrypto` in stage 2).
         */
        fun interface PromptLauncher {
            suspend fun authenticate(cryptoObject: BiometricPrompt.CryptoObject): BiometricPrompt.CryptoObject?
        }

        /** Why [sign] produced no signature. */
        sealed interface SignFailure {
            /** No key enrolled on this device (or it was invalidated and removed). */
            data object NotEnrolled : SignFailure

            /** Biometric enrolment changed since the key was created — key deleted; re-enrol. */
            data object Invalidated : SignFailure

            /** The user cancelled or failed the prompt. */
            data object Cancelled : SignFailure

            data class Error(
                val cause: Throwable,
            ) : SignFailure
        }

        sealed interface SignResult {
            data class Signed(
                val rawSignature: ByteArray,
            ) : SignResult

            data class Failed(
                val failure: SignFailure,
            ) : SignResult
        }

        /** Public half of the enrolled step-up key. */
        data class PublicStepUpKey(
            val jwk: Map<String, String>,
            val keyBacking: String,
        )

        private val lock = Any()

        /** True when class-3 biometrics are enrolled — the only authenticator the key accepts. */
        open fun isBiometricStrongAvailable(): Boolean =
            BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
                BiometricManager.BIOMETRIC_SUCCESS

        /** A usable key exists in the Keystore. */
        open fun isEnrolled(): Boolean = runCatching { publicKey() != null }.getOrDefault(false)

        /**
         * Public JWK + backing of the enrolled key, or `null`. Used by the
         * enrolment call (`POST /api/auth/step-up-key { publicKeyJwk, keyBacking }`).
         */
        open fun publicKey(): PublicStepUpKey? {
            val ks = keyStore()
            if (!ks.containsAlias(ALIAS)) return null
            val entry = ks.getEntry(ALIAS, null) as? KeyStore.PrivateKeyEntry ?: return null
            val public = entry.certificate.publicKey as? ECPublicKey ?: return null
            return PublicStepUpKey(EcKeyCodec.jwkFor(public), KeystoreBacking.of(entry.privateKey, requestedStrongBox = null))
        }

        /**
         * Create the key (replacing any existing one). Requires biometrics
         * — returns `null` when `BIOMETRIC_STRONG` is not available. Creating
         * the key needs no user gesture; *using* it does.
         */
        open fun enrol(): PublicStepUpKey? {
            if (!isBiometricStrongAvailable()) return null
            synchronized(lock) {
                runCatching { keyStore().deleteEntry(ALIAS) }
                val attempts = if (KeystoreBacking.strongBoxAvailable(context)) listOf(true, false) else listOf(false)
                var lastError: Throwable? = null
                for (strongBox in attempts) {
                    try {
                        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KeystoreBacking.ANDROID_KEYSTORE)
                        generator.initialize(spec(strongBox))
                        val pair = generator.generateKeyPair()
                        return PublicStepUpKey(
                            EcKeyCodec.jwkFor(pair.public as ECPublicKey),
                            KeystoreBacking.of(pair.private, requestedStrongBox = strongBox),
                        )
                    } catch (e: ProviderException) {
                        // `StrongBoxUnavailableException` (API 28+) extends
                        // `ProviderException`; catching the base type covers
                        // it without referencing an API-28 class from
                        // minSdk-26 bytecode (lint `NewApi`).
                        lastError = e
                    } catch (e: GeneralSecurityException) {
                        lastError = e
                    }
                    Timber.w(lastError, "step-up key attempt failed (strongBox=%s)", strongBox)
                    runCatching { keyStore().deleteEntry(ALIAS) }
                }
                Timber.w(lastError, "step-up key: enrolment failed")
                return null
            }
        }

        /** Remove the key (sign-out of the enrolling account, account deletion). */
        open fun delete() {
            synchronized(lock) { runCatching { keyStore().deleteEntry(ALIAS) } }
        }

        /**
         * Sign [data] (the raw server challenge bytes) behind the biometric
         * prompt. Returns the 64-byte raw `r||s` signature on success.
         */
        @Suppress("ReturnCount")
        open suspend fun sign(
            data: ByteArray,
            launcher: PromptLauncher,
        ): SignResult {
            val entry =
                runCatching { keyStore().getEntry(ALIAS, null) as? KeyStore.PrivateKeyEntry }
                    .getOrNull() ?: return SignResult.Failed(SignFailure.NotEnrolled)
            val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
            try {
                signature.initSign(entry.privateKey)
            } catch (e: KeyPermanentlyInvalidatedException) {
                Timber.w(e, "step-up key invalidated by biometric enrolment change — deleting")
                delete()
                return SignResult.Failed(SignFailure.Invalidated)
            } catch (e: GeneralSecurityException) {
                return SignResult.Failed(SignFailure.Error(e))
            }
            val authenticated =
                launcher.authenticate(BiometricPrompt.CryptoObject(signature))
                    ?: return SignResult.Failed(SignFailure.Cancelled)
            val authedSignature = authenticated.signature ?: return SignResult.Failed(SignFailure.Cancelled)
            return try {
                authedSignature.update(data)
                SignResult.Signed(EcKeyCodec.derToRaw(authedSignature.sign()))
            } catch (e: UserNotAuthenticatedException) {
                Timber.d(e, "step-up key: signature attempted without a fresh authentication")
                SignResult.Failed(SignFailure.Cancelled)
            } catch (e: KeyPermanentlyInvalidatedException) {
                Timber.w(e, "step-up key invalidated during signing — deleting")
                delete()
                SignResult.Failed(SignFailure.Invalidated)
            } catch (e: GeneralSecurityException) {
                SignResult.Failed(SignFailure.Error(e))
            }
        }

        // ── internals ─────────────────────────────────────────────────────

        private fun keyStore(): KeyStore = KeyStore.getInstance(KeystoreBacking.ANDROID_KEYSTORE).apply { load(null) }

        private fun spec(strongBox: Boolean): KeyGenParameterSpec {
            val builder =
                KeyGenParameterSpec
                    .Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                    .setAlgorithmParameterSpec(ECGenParameterSpec(EC_CURVE))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .setUserAuthenticationRequired(true)
                    .setInvalidatedByBiometricEnrollment(true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Per-use (timeout 0) and class-3 biometrics only.
                builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
            } else {
                // API 26–29: -1 == "authenticate for every use, biometric only".
                @Suppress("DEPRECATION")
                builder.setUserAuthenticationValidityDurationSeconds(-1)
            }
            if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) builder.setIsStrongBoxBacked(true)
            return builder.build()
        }

        companion object {
            const val ALIAS = "pantopus_stepup_key"
            private const val EC_CURVE = "secp256r1"
            private const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
        }
    }
