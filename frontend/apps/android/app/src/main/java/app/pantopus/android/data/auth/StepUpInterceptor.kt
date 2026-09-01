@file:Suppress("TooGenericExceptionCaught")

package app.pantopus.android.data.auth

import app.pantopus.android.data.api.models.auth.AuthErrorBodyParser
import app.pantopus.android.data.api.models.auth.AuthErrorCodes
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Supplies an `X-Step-Up` token on demand. Implemented by the UI layer
 * (stage 2: a coordinator that shows the step-up sheet — biometric
 * `device_key` when enrolled + interactive session, otherwise password —
 * and resolves with the token from `POST /api/auth/step-up`). Returning
 * `null` means "the user declined / no method available" and the original
 * 403 is handed back to the caller untouched.
 */
fun interface StepUpTokenProvider {
    /**
     * @param purpose the server's `purpose` (`delete_account`, `revoke_device`,
     *   `revoke_sessions`, `change_security_prefs`, …).
     * @param methods methods the server will accept (`password`, `device_key`).
     */
    suspend fun requestStepUpToken(
        purpose: String,
        methods: List<String>,
    ): String?
}

/**
 * Process-wide slot for the [StepUpTokenProvider]. Networking is wired at
 * app start while the UI that can actually run a step-up sheet exists only
 * once an Activity is up, so the coordinator registers itself here at
 * runtime (and unregisters on teardown). With no delegate the interceptor
 * is a pass-through — behaviour identical to before this feature.
 */
@Singleton
class StepUpTokenProviderRegistry
    @Inject
    constructor() : StepUpTokenProvider {
        @Volatile
        var delegate: StepUpTokenProvider? = null

        override suspend fun requestStepUpToken(
            purpose: String,
            methods: List<String>,
        ): String? = delegate?.requestStepUpToken(purpose, methods)
    }

/**
 * 403 `STEP_UP_REQUIRED` interceptor (CONTRACT §"Client behaviour"): when
 * a bearer request is refused with `{ code: "STEP_UP_REQUIRED", purpose,
 * methods }`, ask the [StepUpTokenProvider] for a token and retry the
 * request ONCE with `X-Step-Up`. Requests that already carried `X-Step-Up`
 * (the retry, or callers that pre-fetched a token) are never retried again
 * — a second 403 is the caller's to handle.
 *
 * Application-level interceptor on the main client only; the body is read
 * via `peekBody` so an unhandled 403 reaches the caller intact. Streaming /
 * one-shot request bodies cannot be replayed safely, so they are excluded.
 */
@Singleton
class StepUpInterceptor
    @Inject
    constructor(
        private val provider: StepUpTokenProviderRegistry,
    ) : Interceptor {
        @Suppress("ReturnCount")
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val response = chain.proceed(request)
            if (response.code != HTTP_FORBIDDEN) return response
            if (request.header(HEADER_STEP_UP) != null) return response
            if (request.header("Authorization").isNullOrBlank()) return response
            if (request.body?.isOneShot() == true) return response

            val body =
                runCatching { AuthErrorBodyParser.parseStepUp(response.peekBody(MAX_PEEK_BYTES).string()) }.getOrNull()
            if (body?.code != AuthErrorCodes.STEP_UP_REQUIRED) return response

            val token =
                try {
                    runBlocking { provider.requestStepUpToken(body.purpose.orEmpty(), body.methods.orEmpty()) }
                } catch (t: Throwable) {
                    Timber.w(t, "step-up provider failed; returning the 403")
                    null
                }
            if (token.isNullOrBlank()) return response

            response.close()
            return chain.proceed(request.newBuilder().header(HEADER_STEP_UP, token).build())
        }

        companion object {
            const val HEADER_STEP_UP = "X-Step-Up"
            private const val HTTP_FORBIDDEN = 403
            private const val MAX_PEEK_BYTES = 8_192L
        }
    }
