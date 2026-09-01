package app.pantopus.android.data.auth

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyFactory
import java.security.PrivateKey

/**
 * Shared "what tier is this Keystore key in" probe for [DeviceKeyStore] and
 * [StepUpKeyStore]. Maps to the CONTRACT `keyBacking` vocabulary
 * (`strongbox | tee | software`).
 */
internal object KeystoreBacking {
    const val STRONGBOX = "strongbox"
    const val TEE = "tee"
    const val SOFTWARE = "software"
    const val ANDROID_KEYSTORE = "AndroidKeyStore"

    /** True when the device advertises a StrongBox Keymaster (API 28+). */
    fun strongBoxAvailable(context: Context): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)

    /**
     * Backing tier of [privateKey]: API 31+ reads `KeyInfo.securityLevel`,
     * older releases fall back to the legacy `isInsideSecureHardware` flag
     * combined with what we asked for ([requestedStrongBox]).
     */
    fun of(
        privateKey: PrivateKey,
        requestedStrongBox: Boolean?,
    ): String {
        val fallback = if (requestedStrongBox == true) STRONGBOX else TEE
        val info =
            runCatching {
                KeyFactory
                    .getInstance(privateKey.algorithm, ANDROID_KEYSTORE)
                    .getKeySpec(privateKey, KeyInfo::class.java)
            }.getOrNull() ?: return fallback
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return when (info.securityLevel) {
                KeyProperties.SECURITY_LEVEL_STRONGBOX -> STRONGBOX
                KeyProperties.SECURITY_LEVEL_SOFTWARE -> SOFTWARE
                KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT,
                KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE,
                -> TEE
                else -> fallback
            }
        }
        @Suppress("DEPRECATION")
        val insideSecureHardware = info.isInsideSecureHardware
        return when {
            !insideSecureHardware -> SOFTWARE
            requestedStrongBox == true -> STRONGBOX
            else -> TEE
        }
    }
}
