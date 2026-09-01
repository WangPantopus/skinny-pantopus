package app.pantopus.android.data.api.net

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import java.io.IOException

/**
 * Drives a real OkHttp stack through a [MockWebServer] to verify that the
 * [RetryInterceptor] retries idempotent GETs on transient 5xx, does not
 * retry non-idempotent POSTs, and gives up after the configured attempts.
 */
class RetryInterceptorTest {
    private lateinit var server: MockWebServer
    private lateinit var client: OkHttpClient

    @Before
    fun setUp() {
        server = MockWebServer().also { it.start() }
        client =
            OkHttpClient
                .Builder()
                .addInterceptor(
                    RetryInterceptor(
                        maxRetries = 2,
                        baseDelayMs = 1,
                        maxDelayMs = 5,
                        sleep = {},
                    ),
                ).build()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun get_retries_and_succeeds() {
        server.enqueue(MockResponse().setResponseCode(503))
        server.enqueue(MockResponse().setResponseCode(503))
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        val response =
            client
                .newCall(
                    Request
                        .Builder()
                        .url(server.url("/x"))
                        .get()
                        .build(),
                ).execute()

        assertEquals(200, response.code)
        assertEquals(3, server.requestCount)
        response.close()
    }

    @Test
    fun get_exhausts_retries() {
        repeat(3) { server.enqueue(MockResponse().setResponseCode(503)) }
        val response =
            client
                .newCall(
                    Request
                        .Builder()
                        .url(server.url("/x"))
                        .get()
                        .build(),
                ).execute()
        assertEquals(503, response.code)
        assertEquals(3, server.requestCount)
        response.close()
    }

    @Test
    fun post_is_not_retried() {
        server.enqueue(MockResponse().setResponseCode(503))
        val body = okhttp3.RequestBody.create(null, "")
        val response =
            client
                .newCall(
                    Request
                        .Builder()
                        .url(server.url("/x"))
                        .post(body)
                        .build(),
                ).execute()
        assertEquals(503, response.code)
        assertEquals(1, server.requestCount)
        response.close()
    }

    @Test
    fun non_retriable_ioexception_is_not_retried() {
        var attempts = 0
        val throwing =
            Interceptor {
                attempts++
                throw NonRetriableIOException("transient refresh; do not retry")
            }
        val c =
            OkHttpClient
                .Builder()
                .addInterceptor(RetryInterceptor(maxRetries = 2, baseDelayMs = 1, maxDelayMs = 5, sleep = {}))
                .addInterceptor(throwing)
                .build()

        assertThrows(NonRetriableIOException::class.java) {
            c.newCall(Request.Builder().url(server.url("/x")).get().build()).execute()
        }
        assertEquals("Marker exception must be attempted exactly once", 1, attempts)
    }

    @Test
    fun plain_ioexception_on_get_is_retried() {
        var attempts = 0
        val throwing =
            Interceptor {
                attempts++
                throw IOException("transient network")
            }
        val c =
            OkHttpClient
                .Builder()
                .addInterceptor(RetryInterceptor(maxRetries = 2, baseDelayMs = 1, maxDelayMs = 5, sleep = {}))
                .addInterceptor(throwing)
                .build()

        assertThrows(IOException::class.java) {
            c.newCall(Request.Builder().url(server.url("/x")).get().build()).execute()
        }
        // Contrast with the marker case: a plain IOException IS retried (1 + 2).
        assertEquals(3, attempts)
    }

    @Test
    fun delay_schedule_grows() {
        val interceptor = RetryInterceptor(maxRetries = 2, baseDelayMs = 300, maxDelayMs = 5_000, sleep = {})
        val d1 = interceptor.delayForAttempt(1)
        val d2 = interceptor.delayForAttempt(2)
        // Base 300ms ±20% = 240..360, base 900ms ±20% = 720..1080.
        assert(d1 in 200..400) { "Unexpected attempt-1 delay: $d1" }
        assert(d2 in 700..1100) { "Unexpected attempt-2 delay: $d2" }
    }
}
