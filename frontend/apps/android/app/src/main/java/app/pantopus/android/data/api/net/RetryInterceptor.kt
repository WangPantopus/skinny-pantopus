@file:Suppress("MagicNumber")

package app.pantopus.android.data.api.net

import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.ThreadLocalRandom

/**
 * Retry idempotent GET/HEAD calls on transient server errors (502/503/504)
 * and network IOExceptions. Non-idempotent methods (POST/PATCH/PUT/DELETE)
 * are never retried — they may have partially executed server-side.
 *
 * Delays follow `baseDelayMs * 3^attempt`, with ±20% jitter and a hard cap.
 *
 * @param maxRetries Extra attempts on top of the initial one.
 *     `maxRetries = 2` means up to three requests total.
 * @param baseDelayMs Starting delay (first retry).
 * @param maxDelayMs Clamp for the exponential schedule.
 */
class RetryInterceptor(
    private val maxRetries: Int = DEFAULT_RETRIES,
    private val baseDelayMs: Long = DEFAULT_BASE_DELAY_MS,
    private val maxDelayMs: Long = DEFAULT_MAX_DELAY_MS,
    /** Sleep hook extracted so unit tests can run without wall-clock delays. */
    private val sleep: (Long) -> Unit = Thread::sleep,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (!request.method.isRetriable()) {
            return chain.proceed(request)
        }

        var attempt = 0
        var lastResponse: Response? = null
        var lastIoException: IOException? = null

        while (true) {
            lastResponse?.close()
            try {
                val response = chain.proceed(request)
                if (!response.code.isTransient() || attempt >= maxRetries) {
                    return response
                }
                lastResponse = response
                lastIoException = null
            } catch (error: NonRetriableIOException) {
                // e.g. a transient token-refresh failure surfaced by
                // TokenAuthenticator — must propagate as-is. Retrying would
                // re-drive the refresh and risk a TOKEN_REUSE logout.
                throw error
            } catch (error: IOException) {
                if (attempt >= maxRetries) throw error
                lastIoException = error
            }
            attempt += 1
            sleep(delayForAttempt(attempt))
        }
    }

    internal fun delayForAttempt(attempt: Int): Long {
        val exponential = baseDelayMs * Math.pow(3.0, (attempt - 1).toDouble()).toLong()
        val capped = exponential.coerceAtMost(maxDelayMs)
        val jitter = ThreadLocalRandom.current().nextDouble(JITTER_MIN, JITTER_MAX)
        return (capped * jitter).toLong().coerceAtLeast(1L)
    }

    private fun String.isRetriable(): Boolean = equals("GET", ignoreCase = true) || equals("HEAD", ignoreCase = true)

    private fun Int.isTransient(): Boolean = this == HTTP_BAD_GATEWAY || this == HTTP_UNAVAILABLE || this == HTTP_GATEWAY_TIMEOUT

    private companion object {
        const val DEFAULT_RETRIES = 2
        const val DEFAULT_BASE_DELAY_MS = 300L
        const val DEFAULT_MAX_DELAY_MS = 5_000L
        const val JITTER_MIN = 0.8
        const val JITTER_MAX = 1.2
        const val HTTP_BAD_GATEWAY = 502
        const val HTTP_UNAVAILABLE = 503
        const val HTTP_GATEWAY_TIMEOUT = 504
    }
}
