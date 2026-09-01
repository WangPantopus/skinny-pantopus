package app.pantopus.android.data.auth

import app.pantopus.android.data.api.models.auth.AuthErrorBodyParser
import app.pantopus.android.data.api.net.NonRetriableIOException
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp [Authenticator] that performs the industry-standard silent
 * refresh-and-replay on a 401. OkHttp invokes [authenticate] automatically
 * whenever a request comes back `401 Unauthorized`; returning a non-null
 * request makes OkHttp retry it with the new credentials.
 *
 * Why an Authenticator instead of handling 401 inside [AuthInterceptor]:
 *  - OkHttp drives the retry itself (correct request/connection reuse) and
 *    caps it via `responseCount`, so we can't accidentally loop forever.
 *  - It only fires on genuine 401s, after the request already ran.
 *
 * Concurrency: the backend rotates refresh tokens and flags a replayed
 * refresh token as theft (`TOKEN_REUSE` → forced logout). Several requests
 * can 401 at once (token just expired), so we serialize on a monitor and
 * double-check the stored token: only the first caller actually hits the
 * refresh endpoint; the rest pick up the freshly-rotated token and retry.
 *
 * Persistent login (CONTRACT §"Error envelope"): when the refresh itself is
 * refused, the backend `code` (`TOKEN_REUSE`, `DEVICE_MISMATCH`,
 * `SESSION_REVOKED`, …) rides on [AuthRepository.RefreshOutcome.AuthRejected]
 * and is handed to [AuthRepository.signOut] as a [SessionEndReason] so the
 * UI can show the *"signed out for security"* banner instead of a generic
 * expiry. The give-up branch peeks the 401 body for the same reason.
 */
@Singleton
class TokenAuthenticator
    @Inject
    constructor(
        private val tokenStorage: TokenStorage,
        private val authRepositoryProvider: dagger.Lazy<AuthRepository>,
    ) : Authenticator {
        override fun authenticate(
            route: Route?,
            response: Response,
        ): Request? {
            val failedToken =
                response.request
                    .header("Authorization")
                    ?.removePrefix("Bearer ")
                    ?.trim()

            // Give up (return null, no refresh) when this IS the refresh call
            // itself (would recurse) or the request carried no bearer (login /
            // register / public reads — their 401 is terminal, nothing to renew).
            val isRefreshCall = response.request.url.encodedPath.endsWith("/api/users/refresh")
            if (isRefreshCall || failedToken.isNullOrBlank()) return null

            synchronized(lock) {
                // Bail out of pathological loops: if we've already retried this
                // request twice and it still 401s, the (just-refreshed) token is
                // being rejected too — the session is dead. Carry the backend
                // code (e.g. SESSION_REVOKED from verifyToken) into the sign-out.
                if (responseCount(response) >= MAX_ATTEMPTS) {
                    val reason = SessionEndReason.fromCode(peekErrorCode(response))
                    runBlocking { authRepositoryProvider.get().signOut(reason = reason) }
                    return null
                }

                // Another thread may have refreshed while we waited on the lock.
                val current = runBlocking { tokenStorage.accessToken() }
                if (!current.isNullOrBlank() && current != failedToken) {
                    return response.request.withBearer(current)
                }

                // We are the designated refresher.
                return when (val outcome = runBlocking { authRepositoryProvider.get().refreshTokens() }) {
                    is AuthRepository.RefreshOutcome.Rotated ->
                        response.request.withBearer(outcome.accessToken)
                    is AuthRepository.RefreshOutcome.AuthRejected -> {
                        // Refresh token expired/revoked/replayed — sign out with
                        // the backend's code so the UI can explain why.
                        runBlocking { authRepositoryProvider.get().signOut(reason = outcome.reason) }
                        null
                    }
                    AuthRepository.RefreshOutcome.Transient ->
                        // Offline/timeout/5xx — do NOT sign out. Surface the
                        // failure as a NON-RETRIABLE network error so callers /
                        // restore() preserve the session. Non-retriable is key:
                        // letting RetryInterceptor re-drive the GET would replay
                        // the (possibly already-rotated) refresh token and risk a
                        // TOKEN_REUSE logout.
                        throw NonRetriableIOException("Token refresh failed transiently; session preserved")
                }
            }
        }

        private fun Request.withBearer(token: String): Request = newBuilder().header("Authorization", "Bearer $token").build()

        private fun responseCount(response: Response): Int {
            var count = 1
            var prior = response.priorResponse
            while (prior != null) {
                count++
                prior = prior.priorResponse
            }
            return count
        }

        /**
         * `code` from the 401 `{ error, code }` envelope, read via `peekBody`
         * so the body stays consumable by the caller. `null` when absent.
         */
        private fun peekErrorCode(response: Response): String? =
            runCatching { AuthErrorBodyParser.code(response.peekBody(MAX_PEEK_BYTES).string()) }.getOrNull()

        private companion object {
            /** Original + one refreshed replay = 2. A third 401 means give up. */
            const val MAX_ATTEMPTS = 2

            /** Error envelopes are tiny; never buffer more than this. */
            const val MAX_PEEK_BYTES = 4_096L
            val lock = Any()
        }
    }
