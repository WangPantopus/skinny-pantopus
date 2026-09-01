package app.pantopus.android.data.auth

import dagger.Lazy
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * The three request-path hooks of the persistent-login layer, driven through
 * a real OkHttp client against MockWebServer:
 *  - [DeviceIdentityInterceptor] — `X-Client-Platform` + `X-Device-Id`
 *  - [AuthInterceptor] — bearer + pre-flight refresh (never on `/refresh`)
 *  - [StepUpInterceptor] — 403 `STEP_UP_REQUIRED` → provider → retry once
 */
class AuthInterceptorsTest {
    private val server = MockWebServer()
    private val storage = mockk<TokenStorage>(relaxed = true)
    private val repo = mockk<AuthRepository>(relaxed = true)
    private val lazyRepo = mockk<Lazy<AuthRepository>>().also { every { it.get() } returns repo }
    private val identity = AuthTestSupport.deviceIdentity()
    private val registry = StepUpTokenProviderRegistry()

    @Before
    fun setUp() {
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun client(): OkHttpClient =
        OkHttpClient
            .Builder()
            .addInterceptor(DeviceIdentityInterceptor(identity))
            .addInterceptor(AuthInterceptor(storage, lazyRepo))
            .addInterceptor(StepUpInterceptor(registry))
            .build()

    private fun get(path: String) = Request.Builder().url(server.url(path)).build()

    @Test
    fun `identity headers ride on every request`() {
        coEvery { storage.accessToken() } returns null
        server.enqueue(MockResponse().setResponseCode(200))

        client().newCall(get("/api/hub")).execute().close()

        val recorded = server.takeRequest()
        assertEquals("android", recorded.getHeader("X-Client-Platform"))
        assertEquals(identity.deviceId(), recorded.getHeader("X-Device-Id"))
        assertNull(recorded.getHeader("Authorization"))
    }

    @Test
    fun `bearer is attached and a rotated pre-flight token wins`() {
        coEvery { storage.accessToken() } returns "old-at"
        coEvery { repo.refreshIfExpiringSoon(any()) } returns AuthRepository.RefreshOutcome.Rotated("new-at")
        server.enqueue(MockResponse().setResponseCode(200))

        client().newCall(get("/api/hub")).execute().close()

        assertEquals("Bearer new-at", server.takeRequest().getHeader("Authorization"))
        coVerify(exactly = 1) { repo.refreshIfExpiringSoon(any()) }
    }

    @Test
    fun `no pre-flight when nothing needs refreshing, and a rejected pre-flight never signs out here`() {
        coEvery { storage.accessToken() } returns "at"
        coEvery { repo.refreshIfExpiringSoon(any()) } returns null
        server.enqueue(MockResponse().setResponseCode(200))
        client().newCall(get("/api/hub")).execute().close()
        assertEquals("Bearer at", server.takeRequest().getHeader("Authorization"))

        coEvery { repo.refreshIfExpiringSoon(any()) } returns AuthRepository.RefreshOutcome.AuthRejected()
        server.enqueue(MockResponse().setResponseCode(200))
        client().newCall(get("/api/hub")).execute().close()
        assertEquals("Bearer at", server.takeRequest().getHeader("Authorization"))
        coVerify(exactly = 0) { repo.signOut(any()) }
    }

    @Test
    fun `the refresh endpoint itself is never pre-flighted`() {
        coEvery { storage.accessToken() } returns "at"
        server.enqueue(MockResponse().setResponseCode(200))

        client().newCall(get("/api/users/refresh")).execute().close()

        server.takeRequest()
        coVerify(exactly = 0) { repo.refreshIfExpiringSoon(any()) }
    }

    @Test
    fun `403 STEP_UP_REQUIRED asks the provider and retries once with X-Step-Up`() {
        coEvery { storage.accessToken() } returns "at"
        val asked = mutableListOf<Pair<String, List<String>>>()
        registry.delegate =
            StepUpTokenProvider { purpose, methods ->
                asked += purpose to methods
                "step-token"
            }
        server.enqueue(
            MockResponse()
                .setResponseCode(403)
                .setBody(
                    "{\"error\":\"Step-up required\",\"code\":\"STEP_UP_REQUIRED\"," +
                        "\"purpose\":\"revoke_device\",\"methods\":[\"password\",\"device_key\"]}",
                ),
        )
        server.enqueue(MockResponse().setResponseCode(200).setBody("{\"ok\":true}"))

        val response = client().newCall(get("/api/auth/devices/1")).execute()

        assertEquals(200, response.code)
        response.close()
        assertEquals(listOf("revoke_device" to listOf("password", "device_key")), asked)
        assertNull(server.takeRequest().getHeader("X-Step-Up"))
        assertEquals("step-token", server.takeRequest().getHeader("X-Step-Up"))
    }

    @Test
    fun `403 STEP_UP_REQUIRED without a provider (or a declined prompt) passes the 403 through intact`() {
        coEvery { storage.accessToken() } returns "at"
        registry.delegate = null
        val body =
            "{\"error\":\"Step-up required\",\"code\":\"STEP_UP_REQUIRED\"," +
                "\"purpose\":\"delete_account\",\"methods\":[\"password\"]}"
        server.enqueue(MockResponse().setResponseCode(403).setBody(body))

        val response = client().newCall(get("/api/users/account")).execute()

        assertEquals(403, response.code)
        assertEquals(body, response.body?.string())
        assertEquals(1, server.requestCount)
    }

    @Test
    fun `a second 403 after the retry is not retried again and other 403s are untouched`() {
        coEvery { storage.accessToken() } returns "at"
        var calls = 0
        registry.delegate =
            StepUpTokenProvider { _, _ ->
                calls++
                "t"
            }
        val stepUp = "{\"error\":\"x\",\"code\":\"STEP_UP_REQUIRED\",\"purpose\":\"p\",\"methods\":[\"password\"]}"
        server.enqueue(MockResponse().setResponseCode(403).setBody(stepUp))
        server.enqueue(MockResponse().setResponseCode(403).setBody(stepUp))
        assertEquals(403, client().newCall(get("/api/x")).execute().also { it.close() }.code)
        assertEquals(1, calls)
        assertEquals(2, server.requestCount)

        server.enqueue(MockResponse().setResponseCode(403).setBody("{\"error\":\"forbidden\"}"))
        assertEquals(403, client().newCall(get("/api/y")).execute().also { it.close() }.code)
        assertEquals(1, calls)
        assertEquals(3, server.requestCount)
    }
}
