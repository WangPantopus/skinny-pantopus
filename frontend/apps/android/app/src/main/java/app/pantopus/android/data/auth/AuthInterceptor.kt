@file:Suppress("TooGenericExceptionCaught")

package app.pantopus.android.data.auth

import app.pantopus.android.data.api.net.ApiOrigin
import app.pantopus.android.data.api.net.NonRetriableIOException
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import timber.log.Timber
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/** In-memory request tag only; never serialized or included in headers/logs. */
class AuthenticatedDispatchGuard(val verify: suspend (TokenStorage.SessionCredentials?) -> Unit) {
    suspend fun requireCredentials(tokens: TokenStorage): TokenStorage.SessionCredentials {
        val selected = tokens.sessionCredentials()
        verify(selected)
        return checkNotNull(selected)
    }
}

/** The same tagged guard runs for each OkHttp network attempt, including follow-ups. */
class AuthenticatedDispatchGuardInterceptor(private val tokens: TokenStorage) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val guard = request.tag(AuthenticatedDispatchGuard::class.java) ?: return chain.proceed(request)
        try {
            runBlocking {
                val selected = guard.requireCredentials(tokens)
                check(request.header("Authorization") == "Bearer ${selected.accessToken}")
            }
        } catch (_: Exception) {
            throw NonRetriableIOException("Session changed before dispatch")
        }
        return chain.proceed(request)
    }
}

/**
 * OkHttp interceptor that attaches `Authorization: Bearer <token>` to every
 * request of the main client that goes to the API origin ([ApiOrigin]). The
 * same client loads Coil images from any host, and those go out without it
 * (the platform / device headers are stamped by [DeviceIdentityInterceptor],
 * which runs on BOTH clients).
 *
 * Persistent login (CONTRACT §"Client behaviour"): before an authenticated
 * request goes out, the access token's stored `expiresAt` is checked and a
 * **pre-flight refresh** runs when it is within 120 s of expiring — so a
 * cold-start `GET /profile` or a foreground burst never pays the 401 + replay
 * tax. The refresh endpoint itself is exempt (it lives on the dedicated
 * `@Named("authRefresh")` client anyway, which has no interceptors) and so
 * are requests that carry no bearer. A rejected pre-flight refresh does NOT
 * sign out here — the request proceeds with the old token and the normal 401
 * path ([TokenAuthenticator]) decides, keeping one sign-out decision point.
 *
 * Recovery from a 401 (silent token refresh + replay) is handled by
 * [TokenAuthenticator], which OkHttp invokes automatically.
 *
 * Using runBlocking here is pragmatic: OkHttp interceptors are synchronous.
 * Reads from EncryptedSharedPreferences are fast (cached) and bounded to the
 * OkHttp dispatcher thread; the refresh runs on the separate refresh client so
 * it can never starve this client's dispatcher.
 */

@Singleton
class AuthInterceptor
    @Inject
    constructor(
        private val tokenStorage: TokenStorage,
        private val authRepositoryProvider: dagger.Lazy<AuthRepository>,
        private val apiOrigin: ApiOrigin,
    ) : Interceptor {
        fun dispatchGuardInterceptor(): Interceptor = AuthenticatedDispatchGuardInterceptor(tokenStorage)

        override fun intercept(chain: Interceptor.Chain): Response {
            val original = chain.request()
            // Another host (an og:image, a storage URL) never gets the token, so a 401
            // or 403 from it can't start a refresh, a sign-out or a step-up either.
            if (!apiOrigin.matches(original.url)) return chain.proceed(original)
            val token =
                runBlocking {
                    val guard = original.tag(AuthenticatedDispatchGuard::class.java)
                    if (guard != null) {
                        try {
                            val before = guard.requireCredentials(tokenStorage)
                            if (!original.url.encodedPath.endsWith(REFRESH_PATH_SUFFIX)) {
                                preflightRefresh(before.accessToken)
                            }
                            return@runBlocking guard.requireCredentials(tokenStorage).accessToken
                        } catch (_: Exception) {
                            throw IOException("Session changed before dispatch")
                        }
                    }
                    val current = tokenStorage.accessToken()
                    if (current.isNullOrBlank() || original.url.encodedPath.endsWith(REFRESH_PATH_SUFFIX)) {
                        current
                    } else {
                        preflightRefresh(current)
                    }
                }
            val request =
                original
                    .newBuilder()
                    .apply {
                        if (!token.isNullOrBlank()) {
                            header("Authorization", "Bearer $token")
                        }
                    }.build()

            return chain.proceed(request)
        }

        /**
         * Returns the token to send: the rotated one when a proactive refresh
         * happened, otherwise [current]. Never throws — any failure just means
         * "send what we have".
         */
        private suspend fun preflightRefresh(current: String): String =
            try {
                when (val outcome = authRepositoryProvider.get().refreshIfExpiringSoon()) {
                    is AuthRepository.RefreshOutcome.Rotated -> outcome.accessToken
                    // AuthRejected / Transient / no refresh needed: fall through
                    // to the existing token; the 401 path owns the decision.
                    else -> tokenStorage.accessToken() ?: current
                }
            } catch (t: Throwable) {
                Timber.w(t, "pre-flight refresh failed; sending existing token")
                current
            }

        private companion object {
            const val REFRESH_PATH_SUFFIX = "/api/users/refresh"
        }
    }
