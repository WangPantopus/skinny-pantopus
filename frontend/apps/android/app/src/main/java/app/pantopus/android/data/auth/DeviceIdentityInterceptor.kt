package app.pantopus.android.data.auth

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Stamps the client-identity headers on every request of BOTH OkHttp
 * clients (main + `@Named("authRefresh")`):
 *
 *  - `X-Client-Platform: android` (unchanged, moved here from
 *    [AuthInterceptor] so the refresh / resume / logout calls carry it too);
 *  - `X-Device-Id: <deviceId uuid>` — CONTRACT §"Headers": sent by native
 *    clients on every request once a device identity exists. Nothing secret:
 *    the id is the public half of the trusted-device registry row; the
 *    proof of possession is the DPoP header minted per call.
 *
 * Pure header stamping, no I/O beyond the cached prefs read in
 * [DeviceIdentity.deviceId].
 */
@Singleton
class DeviceIdentityInterceptor
    @Inject
    constructor(
        private val deviceIdentity: DeviceIdentity,
    ) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request =
                chain
                    .request()
                    .newBuilder()
                    .header(HEADER_PLATFORM, PLATFORM_ANDROID)
                    .apply {
                        val id = runCatching { deviceIdentity.deviceId() }.getOrNull()
                        if (!id.isNullOrBlank()) header(HEADER_DEVICE_ID, id)
                    }.build()
            return chain.proceed(request)
        }

        companion object {
            const val HEADER_PLATFORM = "X-Client-Platform"
            const val HEADER_DEVICE_ID = "X-Device-Id"
            const val PLATFORM_ANDROID = "android"
        }
    }
