package app.pantopus.android.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.annotation.VisibleForTesting
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.SecureRandom
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Per-install device identity for the trusted-device registry
 * (design docs/persistent-login §9, CONTRACT §"Client storage keys").
 *
 *  - `device_id` — UUIDv4 sent as `X-Device-Id` on every request and in the
 *    `device` descriptor. Generated together with the Keystore device key
 *    and **regenerated whenever that key is regenerated** (a device row is
 *    keyed by `(user, deviceId, key_thumbprint)` server-side, so a new key
 *    must present as a new device — never as the old one with a different
 *    key, which the server would flag as `DEVICE_MISMATCH`).
 *  - `install_id` — 32 hex chars of `SecureRandom`, minted once per install.
 *    Rotates on reinstall (the prefs file dies with the app) which is how
 *    the server tells "same device, fresh install" from "same install".
 *
 * Storage: plain `SharedPreferences` file `device_identity` — nothing here
 * is secret (both values are sent to the server in the clear), but the file
 * IS excluded from Auto Backup / D2D transfer (`res/xml/backup_rules.xml`,
 * `data_extraction_rules.xml`) so a restored backup on another phone does
 * not impersonate this device's identity. All reads are cached in memory
 * after first access; `AuthInterceptor` calls [deviceId] on every request.
 */
@Singleton
class DeviceIdentity
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        @VisibleForTesting
        internal var prefsOverride: SharedPreferences? = null

        private val prefs: SharedPreferences by lazy {
            prefsOverride ?: context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
        }

        @Volatile
        private var cachedDeviceId: String? = null

        @Volatile
        private var cachedInstallId: String? = null

        /** Stable UUIDv4 for this (device key, install). Created on first read. */
        fun deviceId(): String {
            cachedDeviceId?.let { return it }
            synchronized(this) {
                cachedDeviceId?.let { return it }
                val existing = prefs.getString(Keys.DEVICE_ID, null)?.takeIf { it.isNotBlank() }
                val value = existing ?: UUID.randomUUID().toString().also { persist(Keys.DEVICE_ID, it) }
                cachedDeviceId = value
                return value
            }
        }

        /** 32-hex-char per-install random; rotates on reinstall. */
        fun installId(): String {
            cachedInstallId?.let { return it }
            synchronized(this) {
                cachedInstallId?.let { return it }
                val existing = prefs.getString(Keys.INSTALL_ID, null)?.takeIf { it.length == INSTALL_ID_HEX_LENGTH }
                val value = existing ?: newInstallId().also { persist(Keys.INSTALL_ID, it) }
                cachedInstallId = value
                return value
            }
        }

        /**
         * Mint a fresh `deviceId`. Called by [DeviceKeyStore] whenever the
         * device key is (re)generated so key and id always travel together.
         * Returns the new id.
         */
        fun regenerateDeviceId(): String {
            synchronized(this) {
                val value = UUID.randomUUID().toString()
                persist(Keys.DEVICE_ID, value)
                cachedDeviceId = value
                // A new identity also invalidates any registration fingerprint
                // and step-up enrolment recorded for the old identity.
                prefs
                    .edit()
                    .remove(Keys.REGISTRATION_FINGERPRINT)
                    .remove(Keys.STEP_UP_ENROLLED_FOR)
                    .apply()
                return value
            }
        }

        /**
         * `"<userId>|<appVersion>|<pushToken>"` of the last successful
         * `POST /api/auth/devices/register`, so app-update / FCM-rotation
         * re-registration (CONTRACT §"Client behaviour") is idempotent
         * without a network round trip on every launch.
         */
        fun lastRegistrationFingerprint(): String? = prefs.getString(Keys.REGISTRATION_FINGERPRINT, null)

        fun markRegistered(fingerprint: String) {
            persist(Keys.REGISTRATION_FINGERPRINT, fingerprint)
        }

        /** User id whose interactive session enrolled the step-up key on this device, if any. */
        fun stepUpEnrolledFor(): String? = prefs.getString(Keys.STEP_UP_ENROLLED_FOR, null)

        fun markStepUpEnrolled(userId: String?) {
            if (userId == null) {
                prefs.edit().remove(Keys.STEP_UP_ENROLLED_FOR).apply()
            } else {
                persist(Keys.STEP_UP_ENROLLED_FOR, userId)
            }
        }

        private fun persist(
            key: String,
            value: String,
        ) {
            prefs.edit().putString(key, value).apply()
        }

        private fun newInstallId(): String {
            val bytes = ByteArray(INSTALL_ID_HEX_LENGTH / 2)
            SecureRandom().nextBytes(bytes)
            return bytes.joinToString("") { "%02x".format(it) }
        }

        private object Keys {
            const val DEVICE_ID = "device_id"
            const val INSTALL_ID = "install_id"
            const val REGISTRATION_FINGERPRINT = "registration_fingerprint"
            const val STEP_UP_ENROLLED_FOR = "step_up_enrolled_for"
        }

        companion object {
            /** `shared_prefs/device_identity.xml` — backup-excluded. */
            const val PREFS_FILE = "device_identity"
            private const val INSTALL_ID_HEX_LENGTH = 32
        }
    }
