package app.pantopus.android.data.ai

import app.pantopus.android.data.api.services.AIApi
import app.pantopus.android.data.auth.TokenStorage
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/**
 * Exercises the real SSE wire format `backend/routes/ai.js:136` emits
 * against [AIChatRepository.streamChat]. The injected client carries a
 * BODY-level [HttpLoggingInterceptor] like debug builds do — streamChat
 * must strip it (it buffers the whole response, freezing the stream on
 * "Thinking…" until generation finishes) and still parse every event.
 */
class AIChatRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var repo: AIChatRepository

    @Before
    fun setUp() {
        server = MockWebServer().also { it.start() }
        // streamChat builds its URL from BuildConfig — rewrite every
        // request onto the MockWebServer, mirroring how debug builds
        // resolve the host.
        val redirectToServer =
            Interceptor { chain ->
                val original = chain.request()
                chain.proceed(original.newBuilder().url(server.url(original.url.encodedPath)).build())
            }
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }
        val client =
            OkHttpClient
                .Builder()
                .addInterceptor(redirectToServer)
                .addInterceptor(logging)
                .build()
        val tokenStorage = mockk<TokenStorage>()
        coEvery { tokenStorage.accessToken() } returns "test-token"
        repo = AIChatRepository(client, tokenStorage, mockk<AIApi>())
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun streamChat_parses_sse_events_from_backend_wire_format() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setHeader("Content-Type", "text/event-stream")
                    .setBody(
                        "event: conversation\ndata: {\"conversationId\":\"c1\",\"isNew\":true}\n\n" +
                            "event: text_delta\ndata: {\"delta\":\"Hello\"}\n\n" +
                            "event: text_delta\ndata: {\"delta\":\" there\"}\n\n" +
                            "event: done\ndata: {\"conversationId\":\"c1\",\"toolCalls\":0}\n\n" +
                            "event: close\ndata: {}\n\n",
                    ),
            )

            val events = repo.streamChat(message = "hi", conversationId = null).toList()

            assertEquals(
                listOf(
                    AIChatStreamEvent.Conversation("c1"),
                    AIChatStreamEvent.TextDelta("Hello"),
                    AIChatStreamEvent.TextDelta(" there"),
                    AIChatStreamEvent.Done,
                ),
                events,
            )
        }

    @Test
    fun streamChat_emits_error_event_from_stream() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setHeader("Content-Type", "text/event-stream")
                    .setBody("event: error\ndata: {\"message\":\"AI timed out.\"}\n\n"),
            )

            val events = repo.streamChat(message = "hi", conversationId = null).toList()

            assertEquals(listOf<AIChatStreamEvent>(AIChatStreamEvent.Error("AI timed out.")), events)
        }

    @Test
    fun streamChat_emits_error_on_http_failure() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(401).setBody("{\"error\":\"No token provided\"}"))

            val events = repo.streamChat(message = "hi", conversationId = null).toList()

            assertEquals(listOf<AIChatStreamEvent>(AIChatStreamEvent.Error("Failed to connect to AI.")), events)
        }
}
