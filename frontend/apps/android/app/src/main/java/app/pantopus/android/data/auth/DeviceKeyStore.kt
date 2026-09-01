package app.pantopus.android.data.auth

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.security.GeneralSecurityException
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.ProviderException
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The non-exportable **DPoP device key** — an Android Keystore EC P-256
 * key pair (`pantopus_device_key`, `PURPOSE_SIGN`, SHA-256) whose signed
 * proof is required on `/api/users/refresh` and presented on every
 * credential-issuing call so the server binds the session to *this*
 * device at issuance (design §2.3/§2.4, §9).
 *
 * Properties (security invariants from the design — do not weaken):
 *  - **Never biometry-gated.** Background refresh, push-triggered fetches
 *    and socket reconnects must keep working; presence for "Continue as X"
 *    is a client gate ([PresenceVerifier]) and server-verifiable presence is
 *    the separate [StepUpKeyStore].
 *  - **StrongBox first, TEE fallback.** `setIsStrongBoxBacked(true)` when
 *    the device advertises `FEATURE_STRONGBOX_KEYSTORE`; a
 *    `StrongBoxUnavailableException` / `ProviderException` falls back to
 *    the TEE. [DeviceSigningKey.keyBacking] reports what we actually got.
 *  - **Attestation challenge when available.** `setAttestationChallenge` is
 *    set from a server nonce (`POST /api/auth/challenge`) so the certificate
 *    chain ([attestationChain]) can be verified in Phase 3; devices whose
 *    Keystore rejects attestation retry without a challenge.
 *  - **Regenerate on loss.** A missing / permanently-invalidated key is
 *    recreated together with a **new deviceId** ([DeviceIdentity.regenerateDeviceId])
 *    — the old binding is dead, so the device must present as a new one
 *    (the server will answer `DEVICE_MISMATCH` for the old session and the
 *    client falls back to L3).
 *  - Dies with uninstall (Keystore keys are wiped with the app) — that is
 *    why Android reinstall goes through the Block Store resume grant.
 */
@Singleton
open class DeviceKeyStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val deviceIdentity: DeviceIdentity,
    ) {
        private val lock = Any()

        @Volatile
        private var cached: KeystoreSigningKey? = null

        /**
         * The current key, or `null` when none exists / it is unusable.
         * Never generates.
         */
        open fun existing(): DeviceSigningKey? {
            cached?.let { return it }
            synchronized(lock) {
                cached?.let { return it }
                return runCatching { load() }
                    .onFailure { Timber.w(it, "device key: load failed") }
                    .getOrNull()
                    ?.also { cached = it }
            }
        }

        /**
         * Load-or-create. [attestationChallenge] (raw server nonce) is only
         * consulted when a key has to be generated. Generation implies a
         * fresh device identity — see class doc — so it happens ONLY when
         * [load] positively reports "no usable key" (alias absent, or
         * permanently invalidated and removed). A transient Keystore failure
         * (provider not ready right after boot, OEM hiccup) propagates to the
         * caller instead: every caller degrades gracefully (unbound login /
         * refresh without proof / retry later) and the identity is never
         * rotated over a hiccup.
         */
        open fun getOrCreate(attestationChallenge: ByteArray? = null): DeviceSigningKey {
            cached?.let { return it }
            synchronized(lock) {
                cached?.let { return it }
                load()?.let {
                    cached = it
                    return it
                }
                val created = generate(attestationChallenge)
                cached = created
                return created
            }
        }

        /**
         * Base64 (standard, as the server expects `chain: ["b64der", …]`)
         * DER certificates of the Keystore attestation chain, leaf first.
         * `null` when the key has no chain (software / no attestation).
         * Reserved for Phase 3 (`attestation` stays `null` in v1 bodies).
         */
        open fun attestationChain(): List<String>? =
            runCatching {
                val chain = keyStore().getCertificateChain(ALIAS) ?: return null
                if (chain.size <= 1) return null
                chain.map { Base64.getEncoder().encodeToString(it.encoded) }
            }.getOrNull()

        /** Delete the key (account deletion / "Not you? Remove"). Next use regenerates. */
        open fun delete() {
            synchronized(lock) {
                runCatching { keyStore().deleteEntry(ALIAS) }
                cached = null
            }
        }

        // ── internals ─────────────────────────────────────────────────────

        private fun keyStore(): KeyStore = KeyStore.getInstance(KeystoreBacking.ANDROID_KEYSTORE).apply { load(null) }

        private fun load(): KeystoreSigningKey? {
            val ks = keyStore()
            if (!ks.containsAlias(ALIAS)) return null
            val entry = ks.getEntry(ALIAS, null) as? KeyStore.PrivateKeyEntry ?: return null
            val publicKey = entry.certificate.publicKey as? ECPublicKey ?: return null
            val privateKey = entry.privateKey
            // Probe once: a permanently invalidated key throws on init.
            return try {
                Signature.getInstance(SIGNATURE_ALGORITHM).initSign(privateKey)
                KeystoreSigningKey(privateKey, publicKey, KeystoreBacking.of(privateKey, requestedStrongBox = null))
            } catch (e: KeyPermanentlyInvalidatedException) {
                Timber.w(e, "device key permanently invalidated — regenerating with a new deviceId")
                runCatching { ks.deleteEntry(ALIAS) }
                null
            }
        }

        private fun generate(attestationChallenge: ByteArray?): KeystoreSigningKey {
            // Any previous key is gone / unusable: rotate the device identity so
            // the new binding never masquerades as the old device row.
            deviceIdentity.regenerateDeviceId()
            val attempts =
                buildList {
                    if (KeystoreBacking.strongBoxAvailable(context)) {
                        if (attestationChallenge != null) add(true to attestationChallenge)
                        add(true to null)
                    }
                    if (attestationChallenge != null) add(false to attestationChallenge)
                    add(false to null)
                }
            var lastError: Throwable? = null
            for ((strongBox, challenge) in attempts) {
                try {
                    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KeystoreBacking.ANDROID_KEYSTORE)
                    generator.initialize(spec(strongBox, challenge))
                    val pair = generator.generateKeyPair()
                    Timber.i("device key generated (strongBox=%s, attested=%s)", strongBox, challenge != null)
                    return KeystoreSigningKey(
                        pair.private,
                        pair.public as ECPublicKey,
                        KeystoreBacking.of(pair.private, requestedStrongBox = strongBox),
                    )
                } catch (e: ProviderException) {
                    // `StrongBoxUnavailableException` (API 28+) extends
                    // `ProviderException`; catching the base type covers it
                    // without referencing an API-28 class from minSdk-26
                    // bytecode (lint `NewApi`).
                    lastError = e
                } catch (e: GeneralSecurityException) {
                    lastError = e
                }
                Timber.w(lastError, "device key attempt failed (strongBox=%s, attested=%s)", strongBox, challenge != null)
                runCatching { keyStore().deleteEntry(ALIAS) }
            }
            throw IllegalStateException("Unable to generate the device key", lastError)
        }

        private fun spec(
            strongBox: Boolean,
            challenge: ByteArray?,
        ): KeyGenParameterSpec {
            val builder =
                KeyGenParameterSpec
                    .Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                    .setAlgorithmParameterSpec(ECGenParameterSpec(EC_CURVE))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    // Deliberately NOT user-auth bound (see class doc).
                    .setUserAuthenticationRequired(false)
            if (challenge != null) builder.setAttestationChallenge(challenge)
            if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) builder.setIsStrongBoxBacked(true)
            return builder.build()
        }

        /** Keystore-backed [DeviceSigningKey]; JWK + thumbprint are computed once. */
        private class KeystoreSigningKey(
            private val privateKey: PrivateKey,
            publicKey: ECPublicKey,
            override val keyBacking: String,
        ) : DeviceSigningKey {
            override val jwk: Map<String, String> = EcKeyCodec.jwkFor(publicKey)
            override val thumbprint: String = EcKeyCodec.thumbprint(jwk)

            override fun sign(data: ByteArray): ByteArray {
                val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
                signature.initSign(privateKey)
                signature.update(data)
                return EcKeyCodec.derToRaw(signature.sign())
            }
        }

        companion object {
            const val ALIAS = "pantopus_device_key"
            private const val EC_CURVE = "secp256r1"
            private const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
        }
    }
