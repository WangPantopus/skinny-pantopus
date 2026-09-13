package app.pantopus.android.ui.screens.homes.residencyqueue

import app.pantopus.android.data.api.services.HomeResidencyQueueApi
import app.pantopus.android.data.homes.APIHomeResidencyQueueTransport
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeResidencyQueueFailure
import app.pantopus.android.data.homes.HomeResidencyQueueFailureKind
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit

class HomeResidencyQueueTransportTest {
    private val f = QueueFixture()
    private val server = MockWebServer()
    private lateinit var transport: APIHomeResidencyQueueTransport

    @Before fun setup() {
        server.start()
        transport =
            APIHomeResidencyQueueTransport(
                Retrofit.Builder().baseUrl(server.url("/")).build().create(HomeResidencyQueueApi::class.java), f.codec,
            )
    }

    @After fun teardown() {
        server.shutdown()
    }

    @Test fun reads_use_uncached_get_with_current_scope_and_no_command_body() =
        runTest {
            server.enqueue(
                MockResponse().setBody(f.json(mapOf("session" to mapOf("actor_id" to f.actor, "session_scope" to f.scope.sessionScope)))),
            )
            val session = transport.session(HomeCreationScope(server.url("/").toString(), f.actor))
            assertEquals(f.scope, session)
            val bootstrap = server.takeRequest()
            assertEquals("/api/homes/residency-claims/session", bootstrap.path)
            assertEquals("GET", bootstrap.method)
            assertEquals("no-cache, no-store", bootstrap.getHeader("Cache-Control"))
            server.enqueue(MockResponse().setBody(f.page()))
            assertEquals(f.decoded(), transport.list(f.home, session))
            val list = server.takeRequest()
            assertEquals("GET", list.method)
            assertEquals("/api/homes/${f.home}/claims", list.path)
            assertEquals(f.scope.sessionScope, list.getHeader("X-Pantopus-Session-Scope"))
            assertEquals("no-cache, no-store", list.getHeader("Cache-Control"))
            assertEquals(0L, list.bodySize)
        }

    @Test fun invalid_success_cannot_become_an_empty_queue() =
        runTest {
            for ((status, body) in listOf(200 to "null", 200 to "{}", 200 to "[]", 200 to "{\"claims\":[]}", 204 to "")) {
                server.enqueue(MockResponse().setResponseCode(status).setBody(body))
                val failure = runCatching { transport.list(f.home, f.scope) }.exceptionOrNull() as HomeResidencyQueueFailure
                assertEquals(HomeResidencyQueueFailureKind.Unavailable, failure.kind)
            }
        }

    @Test fun denied_missing_and_session_failures_are_not_empty() =
        runTest {
            for ((status, code, kind) in listOf(
                Triple(403, "MEMBERS_MANAGE_REQUIRED", HomeResidencyQueueFailureKind.Forbidden),
                Triple(404, "HOME_NOT_FOUND", HomeResidencyQueueFailureKind.MissingHome),
                Triple(409, "SESSION_SCOPE_CHANGED", HomeResidencyQueueFailureKind.SessionChanged),
                Triple(503, "RESIDENCY_CLAIMS_UNAVAILABLE", HomeResidencyQueueFailureKind.Unavailable),
            )) {
                server.enqueue(
                    MockResponse().setResponseCode(status).setBody("{\"code\":\"$code\",\"error\":\"untrusted private diagnostic\"}"),
                )
                val error = runCatching { transport.list(f.home, f.scope) }.exceptionOrNull() as HomeResidencyQueueFailure
                assertEquals(kind, error.kind)
                assertTrue(!error.message.orEmpty().contains("untrusted"))
            }
            server.enqueue(MockResponse().setResponseCode(401).setBody("not JSON"))
            assertEquals(
                HomeResidencyQueueFailureKind.SessionChanged,
                (runCatching { transport.list(f.home, f.scope) }.exceptionOrNull() as HomeResidencyQueueFailure).kind,
            )
        }
}
