package app.pantopus.android.ui.screens.homes.residencyhistory

import app.pantopus.android.data.api.services.HomeResidencyReviewHistoryApi
import app.pantopus.android.data.homes.APIHomeResidencyReviewHistoryTransport
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeResidencyHistoryFailure
import app.pantopus.android.data.homes.HomeResidencyHistoryFailureKind
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit

class HomeResidencyHistoryTransportTest {
    private val f = HistoryFixture()
    private val server = MockWebServer()
    private lateinit var transport: APIHomeResidencyReviewHistoryTransport

    @Before fun setup() {
        server.start()
        transport = APIHomeResidencyReviewHistoryTransport(
            Retrofit.Builder().baseUrl(server.url("/")).build().create(HomeResidencyReviewHistoryApi::class.java), f.codec,
        )
    }

    @After fun teardown() { server.shutdown() }

    @Test fun fresh_session_list_and_detail_use_only_get_and_no_store() = runTest {
        server.enqueue(MockResponse().setBody(f.json(mapOf("session" to mapOf("actor_id" to f.actor, "session_scope" to f.scope.sessionScope)))))
        assertEquals(f.scope, transport.session(HomeCreationScope(server.url("/").toString(), f.actor)))
        val identity = server.takeRequest()
        assertEquals("GET", identity.method)
        assertEquals("no-cache, no-store", identity.getHeader("Cache-Control"))
        server.enqueue(MockResponse().setBody(f.page()))
        transport.list(f.home, f.scope, null)
        val list = server.takeRequest()
        assertEquals("GET", list.method)
        assertEquals("/api/homes/residency-review-history/${f.home}", list.path)
        assertEquals(f.scope.sessionScope, list.getHeader("X-Pantopus-Session-Scope"))
        assertEquals("no-cache, no-store", list.getHeader("Cache-Control"))
        server.enqueue(MockResponse().setBody(f.detail()))
        transport.read(f.reference(), f.scope)
        val detail = server.takeRequest()
        assertEquals("GET", detail.method)
        assertEquals("/api/homes/residency-review-history/${f.home}/${f.id(200)}", detail.path)
        assertEquals(0L, detail.bodySize)
    }

    @Test fun denied_missing_invalid_cursor_and_session_failures_are_not_empty() = runTest {
        for ((status, code, kind) in listOf(
            Triple(403, "MEMBERS_MANAGE_REQUIRED", HomeResidencyHistoryFailureKind.Forbidden),
            Triple(404, "HOME_NOT_FOUND", HomeResidencyHistoryFailureKind.MissingHome),
            Triple(404, "RESIDENCY_HISTORY_NOT_FOUND", HomeResidencyHistoryFailureKind.MissingDecision),
            Triple(400, "RESIDENCY_HISTORY_CURSOR_INVALID", HomeResidencyHistoryFailureKind.InvalidCursor),
            Triple(409, "SESSION_SCOPE_CHANGED", HomeResidencyHistoryFailureKind.SessionChanged),
            Triple(503, "RESIDENCY_HISTORY_UNAVAILABLE", HomeResidencyHistoryFailureKind.Unavailable),
        )) {
            server.enqueue(MockResponse().setResponseCode(status).setBody("{\"code\":\"$code\",\"error\":\"untrusted private diagnostic\"}"))
            val error = runCatching { transport.list(f.home, f.scope, null) }.exceptionOrNull() as HomeResidencyHistoryFailure
            assertEquals(kind, error.kind)
            assertTrue(!error.message.orEmpty().contains("untrusted"))
        }
        server.enqueue(MockResponse().setResponseCode(401).setBody("not JSON"))
        assertEquals(HomeResidencyHistoryFailureKind.SessionChanged,
            (runCatching { transport.list(f.home, f.scope, null) }.exceptionOrNull() as HomeResidencyHistoryFailure).kind)
    }

    @Test fun malformed_and_foreign_success_never_establish_authorized_history() = runTest {
        for (body in listOf("[]", "null", "{}", f.page().replace(f.actor, f.id(88)), f.page().replace(f.scope.sessionScope, "b".repeat(64)))) {
            server.enqueue(MockResponse().setBody(body))
            assertEquals(HomeResidencyHistoryFailureKind.Unavailable,
                (runCatching { transport.list(f.home, f.scope, null) }.exceptionOrNull() as HomeResidencyHistoryFailure).kind)
        }
        server.enqueue(MockResponse().setBody(f.page(emptyList())))
        assertTrue(transport.list(f.home, f.scope, null).items.isEmpty())
    }

    @Test fun pagination_transmits_exact_validated_cursor_and_refuses_forged_scope_locally() = runTest {
        val cursor = f.codec.cursor(f.cursor(), f.home, f.actor)
        server.enqueue(MockResponse().setBody(f.page(listOf(f.item(180)))))
        transport.list(f.home, f.scope, cursor)
        assertEquals(cursor.encoded, server.takeRequest().requestUrl?.queryParameter("after"))
        val before = server.requestCount
        assertTrue(runCatching { transport.list(f.id(90), f.scope, cursor) }.isFailure)
        assertEquals(before, server.requestCount)
    }
}
