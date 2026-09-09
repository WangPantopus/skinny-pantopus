package app.pantopus.android.data.api.net

import okhttp3.Interceptor
import okhttp3.Response
import timber.log.Timber
import java.io.IOException
import java.util.concurrent.TimeUnit

/** HTTP diagnostics never include URLs, headers or request/response bodies. */
class SafeHttpLoggingInterceptor(
    private val enabled: Boolean,
    private val writeLog: (String) -> Unit = { Timber.tag("HTTP").d(it) },
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        if (!enabled) return chain.proceed(chain.request())
        val method = chain.request().method.takeIf { it in METHODS } ?: "OTHER"
        val started = System.nanoTime()
        return try {
            chain.proceed(chain.request()).also { response ->
                val elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)
                writeLog("HTTP $method -> ${response.code} (${elapsed}ms)")
            }
        } catch (error: IOException) {
            writeLog("HTTP $method -> transport failure")
            throw error
        }
    }

    private companion object {
        val METHODS = setOf("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
    }
}
