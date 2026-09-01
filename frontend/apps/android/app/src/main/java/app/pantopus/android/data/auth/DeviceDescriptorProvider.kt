package app.pantopus.android.data.auth

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.provider.Settings
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.auth.DeviceDescriptorDto
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Builds the CONTRACT `device` descriptor sent on login / OAuth / resume /
 * `devices/register`. Pure metadata — the binding itself is the DPoP proof
 * that travels alongside. `attestation` stays `null` in v1.
 */
@Singleton
open class DeviceDescriptorProvider
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val deviceIdentity: DeviceIdentity,
    ) {
        open fun descriptor(keyBacking: String): DeviceDescriptorDto =
            DeviceDescriptorDto(
                deviceId = deviceIdentity.deviceId(),
                platform = PLATFORM,
                installId = deviceIdentity.installId(),
                name = deviceName(),
                model = model(),
                osVersion = Build.VERSION.RELEASE,
                appVersion = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                hasOsLock = hasOsLock(),
                keyBacking = keyBacking,
                attestation = null,
            )

        /** `"1.4.0 (312)"` — also the app-update trigger for re-registration. */
        open fun appVersion(): String = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"

        /** `KeyguardManager.isDeviceSecure` — PIN / pattern / password / biometric set. */
        open fun hasOsLock(): Boolean =
            runCatching {
                (context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager)?.isDeviceSecure == true
            }.getOrDefault(false)

        private fun deviceName(): String? =
            runCatching { Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME) }
                .getOrNull()
                ?.takeIf { it.isNotBlank() }
                ?: model()

        private fun model(): String? {
            val manufacturer = Build.MANUFACTURER.orEmpty()
            val model = Build.MODEL.orEmpty()
            return when {
                model.isBlank() -> manufacturer.takeIf { it.isNotBlank() }
                model.startsWith(manufacturer, ignoreCase = true) -> model
                else -> "$manufacturer $model".trim()
            }
        }

        companion object {
            const val PLATFORM = "android"
        }
    }
