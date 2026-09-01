package app.pantopus.android.data.auth

import app.pantopus.android.data.api.models.auth.DevicesResponse
import app.pantopus.android.data.api.models.auth.SecurityEventsResponse
import app.pantopus.android.data.api.models.auth.SecurityPrefsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AuthApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Read side of Settings → Security → Devices (design §7.6/§7.7, CONTRACT
 * `/api/auth/devices`, `/security-prefs`, `/security-events`). The
 * mutations that need an `X-Step-Up` token and carry session side effects
 * (revoke device / revoke others / lockdown) live on [AuthRepository] so
 * the local sign-out after *Lockdown* stays next to the rest of the
 * session state machine.
 */
@Singleton
class DevicesRepository
    @Inject
    constructor(
        private val api: AuthApi,
    ) {
        /** `GET /api/auth/devices` — devices + web sessions + recent security events. */
        suspend fun devices(): NetworkResult<DevicesResponse> = safeApiCall { api.devices() }

        /** `GET /api/auth/security-prefs`. */
        suspend fun securityPrefs(): NetworkResult<SecurityPrefsDto> = safeApiCall { api.securityPrefs() }

        /** `PATCH /api/auth/security-prefs` with a `change_security_prefs` step-up token. */
        suspend fun updateSecurityPrefs(
            prefs: SecurityPrefsDto,
            stepUpToken: String,
        ): NetworkResult<SecurityPrefsDto> = safeApiCall { api.updateSecurityPrefs(prefs, stepUpToken) }

        /** `GET /api/auth/security-events?limit=`. */
        suspend fun securityEvents(limit: Int = DEFAULT_EVENT_LIMIT): NetworkResult<SecurityEventsResponse> =
            safeApiCall { api.securityEvents(limit) }

        private companion object {
            const val DEFAULT_EVENT_LIMIT = 50
        }
    }
