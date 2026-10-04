package app.pantopus.android.data.auth

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatchJsonAdapter
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.HomeTasksApi
import app.pantopus.android.data.api.services.NotificationPreferencesApi
import app.pantopus.android.data.api.services.PlaceApi
import app.pantopus.android.data.homes.HomeTaskEditPatch
import app.pantopus.android.data.homes.HomeTasksRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Lazy
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.Base64

/**
 * The three request-path hooks of the persistent-login layer, driven through
 * a real OkHttp client against MockWebServer:
 *  - [DeviceIdentityInterceptor] — `X-Client-Platform` + `X-Device-Id`
 *  - [AuthInterceptor] — bearer + pre-flight refresh (never on `/refresh`)
 *  - [StepUpInterceptor] — 403 `STEP_UP_REQUIRED` → provider → retry once
 *  - [DPoPReplayGuard] — a DPoP proof already sent goes out re-minted
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
            .addNetworkInterceptor(AuthenticatedDispatchGuardInterceptor(storage))
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
        val starting = TokenStorage.SessionCredentials("actor-a", "session-a", "old-at")
        val replacement = TokenStorage.SessionCredentials("actor-b", "session-b", "replacement-at")
        coEvery { storage.sessionCredentials() } returnsMany listOf(starting, replacement)
        val guarded =
            get("/api/hub/funnel-events").newBuilder().tag(
                AuthenticatedDispatchGuard::class.java,
                AuthenticatedDispatchGuard { selected ->
                    check(selected != null && selected.userId == "actor-a" && selected.sessionId == "session-a")
                },
            ).build()
        try {
            client().newCall(guarded).execute().close()
            org.junit.Assert.fail("Replacement actor was dispatched")
        } catch (_: java.io.IOException) {
            assertEquals(1, server.requestCount)
        }
        val retrofit =
            Retrofit.Builder().baseUrl(server.url("/"))
                .client(client())
                .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().add(NotificationPreferencesPatchJsonAdapter()).build()))
                .build()
        val preferences = retrofit.create(NotificationPreferencesApi::class.java)
        val places = retrofit.create(PlaceApi::class.java)
        for (operation in listOf("preferences", "set_pickup", "clear_pickup")) {
            var credentials = starting
            coEvery { storage.sessionCredentials() } answers { credentials }
            coEvery { storage.accessToken() } answers { credentials.accessToken }
            coEvery { repo.refreshIfExpiringSoon(any()) } answers {
                credentials = replacement
                AuthRepository.RefreshOutcome.Rotated(replacement.accessToken)
            }
            val guard =
                AuthenticatedDispatchGuard { selected ->
                    check(selected != null && selected.userId == starting.userId && selected.sessionId == starting.sessionId)
                }
            val before = server.requestCount
            try {
                runBlocking {
                    when (operation) {
                        "preferences" -> preferences.updatePreferences(NotificationPreferencesPatch(eveningBriefingEnabled = true), guard)
                        "set_pickup" -> places.setPickupDay("home", SetPickupDayRequest("TH"), guard)
                        else -> places.clearPickupDay("home", "version", guard)
                    }
                }
                org.junit.Assert.fail("Replacement actor dispatched $operation")
            } catch (_: java.io.IOException) {
                assertEquals(before, server.requestCount)
            }
            // Existing unscoped callers retain their normal current-token behavior.
            coEvery { repo.refreshIfExpiringSoon(any()) } returns null
            server.enqueue(MockResponse().setResponseCode(200).setBody("""{"preferences":{},"calendar":{}}"""))
            runBlocking {
                when (operation) {
                    "preferences" -> preferences.updatePreferences(NotificationPreferencesPatch(eveningBriefingEnabled = true))
                    "set_pickup" -> places.setPickupDay("home", SetPickupDayRequest("TH"))
                    else -> places.clearPickupDay("home", "version")
                }
            }
            val recorded = server.takeRequest()
            assertEquals("Bearer replacement-at", recorded.getHeader("Authorization"))
            assertEquals(if (operation == "clear_pickup") "DELETE" else "PUT", recorded.method)
            assertEquals(
                if (operation == "preferences") {
                    "/api/hub/preferences"
                } else {
                    "/api/homes/home/calendar/pickup-day" + if (operation == "clear_pickup") "?expected_version=version" else ""
                },
                recorded.path,
            )
            assertEquals(before + 1, server.requestCount)
        }
    }

    @Test
    fun `task repository guards refuse changed dispatch after auth wait and preserve unscoped callers`() {
        val starting = TokenStorage.SessionCredentials("actor-a", "session-a", "old-at")
        val replacement = TokenStorage.SessionCredentials("actor-b", "session-b", "replacement-at")
        val session = "a".repeat(64)
        val task = """{"id":"task","home_id":"home","task_type":"chore","title":"Current","created_by":"actor-a"}"""
        val receipt =
            """{"home_id":"home","actor_id":"actor-a","request_id":"request","task_id":"task",""" +
                """"payload_hash":"$session","created_at":"2026-10-04T00:00:00Z"}"""
        val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
        val repository =
            HomeTasksRepository(
                Retrofit.Builder().baseUrl(server.url("/"))
                    .client(client()).addConverterFactory(MoshiConverterFactory.create(moshi))
                    .build().create(HomeTasksApi::class.java),
            )
        for (operation in listOf("list", "create", "edit", "delete")) {
            var credentials = starting
            var unlocked = true
            coEvery { storage.sessionCredentials() } answers { credentials }
            coEvery { storage.accessToken() } answers { credentials.accessToken }
            val guard =
                AuthenticatedDispatchGuard { selected ->
                    check(selected != null && selected.userId == starting.userId && selected.sessionId == starting.sessionId)
                    check(unlocked)
                }

            suspend fun invoke(dispatchGuard: AuthenticatedDispatchGuard? = null): NetworkResult<*> =
                when (operation) {
                    "list" -> repository.getHomeTasks("home", session, dispatchGuard)
                    "create" ->
                        repository.createHomeTaskWithReceipt(
                            "home",
                            CreateHomeTaskRequest("chore", "Original", requestId = "request"),
                            session,
                            dispatchGuard,
                        )
                    "edit" ->
                        repository.patchHomeTask(
                            "home",
                            "task",
                            HomeTaskEditPatch(mapOf("description" to null)),
                            session,
                            dispatchGuard,
                        )
                    else -> repository.deleteHomeTask("home", "task", session, dispatchGuard)
                }
            val before = server.requestCount
            for (change in listOf("actor", "lock")) {
                credentials = starting
                unlocked = true
                coEvery { repo.refreshIfExpiringSoon(any()) } answers {
                    if (change == "actor") credentials = replacement else unlocked = false
                    AuthRepository.RefreshOutcome.Rotated(credentials.accessToken)
                }
                val result = runBlocking { invoke(guard) }
                assertTrue(result is NetworkResult.Failure && result.error is NetworkError.Transport)
                assertEquals(before, server.requestCount)
            }
            credentials = replacement
            coEvery { repo.refreshIfExpiringSoon(any()) } returns null
            val body =
                when (operation) {
                    "list" -> """{"tasks":[$task]}"""
                    "create" ->
                        """{"task":$task,"creation_receipt":$receipt,""" +
                            """"task_session":{"actor_id":"actor-a","home_id":"home","session_scope":"$session"},"replayed":true}"""
                    "edit" -> """{"task":$task}"""
                    else -> """{"message":"Task deleted"}"""
                }
            server.enqueue(MockResponse().setBody(body))
            assertTrue(runBlocking { invoke() } is NetworkResult.Success)
            val recorded = server.takeRequest()
            assertEquals("Bearer replacement-at", recorded.getHeader("Authorization"))
            assertEquals(session, recorded.getHeader("x-pantopus-session-scope"))
            assertEquals(
                if (operation in listOf("list", "create")) "/api/homes/home/tasks" else "/api/homes/home/tasks/task",
                recorded.path,
            )
            assertEquals(mapOf("list" to "GET", "create" to "POST", "edit" to "PUT", "delete" to "DELETE")[operation], recorded.method)
            assertEquals(before + 1, server.requestCount)
        }
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
        val replayClient = client().newBuilder().authenticator(TokenAuthenticator(storage, lazyRepo)).build()
        for (mode in listOf("refresh_same", "refresh_actor", "refresh_os", "refresh_app", "rotated_same", "rotated_actor")) {
            var credentials = TokenStorage.SessionCredentials("actor-a", "session-a", "old-at")
            var osUnlocked = true
            var appUnlocked = true
            var tokenReads = 0
            coEvery { repo.refreshIfExpiringSoon(any()) } returns null
            coEvery { storage.sessionCredentials() } answers { credentials }
            coEvery { storage.accessToken() } answers {
                tokenReads += 1
                if (mode.startsWith("rotated") && tokenReads > 1) {
                    credentials =
                        if (mode == "rotated_actor") {
                            TokenStorage.SessionCredentials("actor-b", "session-b", "new-at")
                        } else {
                            TokenStorage.SessionCredentials(credentials.userId, credentials.sessionId, "new-at")
                        }
                }
                credentials.accessToken
            }
            coEvery { repo.refreshTokens() } answers {
                credentials =
                    if (mode == "refresh_actor") {
                        TokenStorage.SessionCredentials("actor-b", "session-b", "new-at")
                    } else {
                        TokenStorage.SessionCredentials(credentials.userId, credentials.sessionId, "new-at")
                    }
                osUnlocked = mode != "refresh_os"
                appUnlocked = mode != "refresh_app"
                AuthRepository.RefreshOutcome.Rotated(credentials.accessToken)
            }
            val guarded =
                get("/api/homes/home/tasks/task").newBuilder().put("{}".toRequestBody()).tag(
                    AuthenticatedDispatchGuard::class.java,
                    AuthenticatedDispatchGuard { selected ->
                        check(selected != null && selected.userId == "actor-a" && selected.sessionId == "session-a")
                        check(osUnlocked && appUnlocked)
                    },
                ).build()
            val before = server.requestCount
            val allowed = mode.endsWith("same")
            server.enqueue(MockResponse().setResponseCode(401))
            if (allowed) server.enqueue(MockResponse().setResponseCode(200))
            replayClient.newCall(guarded).execute().use { assertEquals(if (allowed) 200 else 401, it.code) }
            assertEquals(before + if (allowed) 2 else 1, server.requestCount)
            assertEquals("Bearer old-at", server.takeRequest().getHeader("Authorization"))
            if (allowed) assertEquals("Bearer new-at", server.takeRequest().getHeader("Authorization"))
        }
    }

    @Test
    fun `the refresh endpoint itself is never pre-flighted`() {
        coEvery { storage.accessToken() } returns "at"
        server.enqueue(MockResponse().setResponseCode(200))

        client().newCall(get("/api/users/refresh")).execute().close()

        server.takeRequest()
        coVerify(exactly = 0) { repo.refreshIfExpiringSoon(any()) }
        val credentials = TokenStorage.SessionCredentials("actor-a", "session-a", "at")
        var unlocked = true
        coEvery { storage.sessionCredentials() } returns credentials
        coEvery { repo.refreshIfExpiringSoon(any()) } returns null
        val retryClient =
            client().newBuilder().addInterceptor(
                app.pantopus.android.data.api.net.RetryInterceptor(maxRetries = 1, sleep = { unlocked = false }),
            ).build()
        val guarded =
            get("/api/homes/home/tasks/task").newBuilder().tag(
                AuthenticatedDispatchGuard::class.java,
                AuthenticatedDispatchGuard { selected ->
                    check(selected == credentials)
                    check(unlocked)
                },
            ).build()
        val before = server.requestCount
        server.enqueue(MockResponse().setResponseCode(503))
        server.enqueue(MockResponse().setResponseCode(200))
        try {
            retryClient.newCall(guarded).execute().close()
            org.junit.Assert.fail("Locked transport retry was dispatched")
        } catch (_: java.io.IOException) {
            assertEquals(before + 1, server.requestCount)
        }
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
        assertNull(server.takeRequest().getHeader("X-Step-Up"))
        assertEquals("t", server.takeRequest().getHeader("X-Step-Up"))
        assertNull(server.takeRequest().getHeader("X-Step-Up"))
        for (mode in listOf("actor", "session", "os", "app", "same")) {
            var selected = TokenStorage.SessionCredentials("actor-a", "session-a", "at")
            var osUnlocked = true
            var appUnlocked = true
            coEvery { storage.sessionCredentials() } answers { selected }
            coEvery { repo.refreshIfExpiringSoon(any()) } returns null
            registry.delegate =
                StepUpTokenProvider { _, _ ->
                    when (mode) {
                        "actor" -> selected = TokenStorage.SessionCredentials("actor-b", selected.sessionId, selected.accessToken)
                        "session" -> selected = TokenStorage.SessionCredentials(selected.userId, "session-b", selected.accessToken)
                        "os" -> osUnlocked = false
                        "app" -> appUnlocked = false
                    }
                    "step-token"
                }
            val guarded =
                get("/api/homes/home/tasks/task").newBuilder().tag(
                    AuthenticatedDispatchGuard::class.java,
                    AuthenticatedDispatchGuard { credentials ->
                        check(credentials != null && credentials.userId == "actor-a" && credentials.sessionId == "session-a")
                        check(osUnlocked && appUnlocked)
                    },
                ).build()
            val before = server.requestCount
            val allowed = mode == "same"
            server.enqueue(MockResponse().setResponseCode(403).setBody(stepUp))
            if (allowed) server.enqueue(MockResponse().setResponseCode(200))
            try {
                client().newCall(guarded).execute().use { assertEquals(200, it.code) }
                org.junit.Assert.assertTrue(allowed)
            } catch (_: java.io.IOException) {
                assertFalse(allowed)
            }
            assertEquals(before + if (allowed) 2 else 1, server.requestCount)
            server.takeRequest()
            if (allowed) assertEquals("step-token", server.takeRequest().getHeader("X-Step-Up"))
        }
    }

    private val claimsAdapter =
        Moshi.Builder().build().adapter<Map<String, Any?>>(Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java))

    private fun claims(proof: String): Map<String, Any?> =
        claimsAdapter.fromJson(String(Base64.getUrlDecoder().decode(proof.split(".")[1]), Charsets.UTF_8))!!

    private fun guardedClient(key: DeviceSigningKey?): OkHttpClient {
        val keyStore = mockk<DeviceKeyStore>().also { every { it.existing() } returns key }
        return OkHttpClient.Builder().addNetworkInterceptor(DPoPReplayGuard(DPoPProofBuilder(), keyStore)).build()
    }

    private fun refreshWith(proof: String) =
        Request
            .Builder()
            .url(server.url("/api/users/refresh"))
            .header("DPoP", proof)
            .post("{}".toRequestBody("application/json".toMediaType()))
            .build()

    @Test
    fun `a DPoP proof sent a second time goes out re-minted with the same claims`() {
        val key = SoftwareSigningKey()
        val proof =
            DPoPProofBuilder().build(
                key,
                htm = "POST",
                htu = DPoPProofBuilder.htu(server.url("/api/users/refresh")),
                refreshToken = "rt-1",
            )
        val client = guardedClient(key)
        server.enqueue(MockResponse().setResponseCode(200))
        server.enqueue(MockResponse().setResponseCode(200))

        // The same request twice, as OkHttp's own re-send after a dropped connection sends it.
        client.newCall(refreshWith(proof)).execute().close()
        client.newCall(refreshWith(proof)).execute().close()

        val first = server.takeRequest().getHeader("DPoP")!!
        val second = server.takeRequest().getHeader("DPoP")!!
        assertEquals(proof, first)
        assertNotEquals(first, second)
        val (a, b) = claims(first) to claims(second)
        assertNotEquals(a["jti"], b["jti"])
        assertEquals(a["htm"], b["htm"])
        assertEquals(a["htu"], b["htu"])
        assertEquals(a["rth"], b["rth"])
    }

    @Test
    fun `a proof the guard can't re-mint goes out as it is`() {
        val signer = SoftwareSigningKey()
        val proof =
            DPoPProofBuilder().build(signer, htm = "POST", htu = DPoPProofBuilder.htu(server.url("/api/users/refresh")))
        // The device key is a different key (or there is none): nothing to re-mint with.
        val client = guardedClient(SoftwareSigningKey())
        server.enqueue(MockResponse().setResponseCode(200))
        server.enqueue(MockResponse().setResponseCode(200))

        client.newCall(refreshWith(proof)).execute().close()
        client.newCall(refreshWith(proof)).execute().close()

        assertEquals(proof, server.takeRequest().getHeader("DPoP"))
        assertEquals(proof, server.takeRequest().getHeader("DPoP"))
    }
}
