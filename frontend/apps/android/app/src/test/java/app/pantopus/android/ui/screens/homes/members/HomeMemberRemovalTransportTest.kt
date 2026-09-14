package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.api.services.HomeMemberRemovalApi
import app.pantopus.android.data.homes.APIHomeMemberRemovalTransport
import app.pantopus.android.data.homes.HomeMemberRemovalFailure
import app.pantopus.android.data.homes.HomeMemberRemovalFailureKind
import app.pantopus.android.data.homes.HomeMemberRemovalRecovery
import app.pantopus.android.data.homes.HomeMemberRemovalRequest
import app.pantopus.android.data.homes.PendingHomeMemberRemoval
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit

class HomeMemberRemovalTransportTest {
    private val fixture = RemovalFixture()
    private val server = MockWebServer()
    private val request =
        HomeMemberRemovalRequest("ddc24300-0000-4000-8000-000000000004", fixture.intent(), fixture.occupancy, fixture.decision)
    private val original = PendingHomeMemberRemoval(fixture.scope, request, fixture.codec.encode(request), "Fixture Home\n@member_fixture")
    private lateinit var transport: APIHomeMemberRemovalTransport

    @Before fun setup() {
        server.start()
        val api = Retrofit.Builder().baseUrl(server.url("/")).build().create(HomeMemberRemovalApi::class.java)
        transport = APIHomeMemberRemovalTransport(api, fixture.codec)
    }

    @After fun shutdown() {
        server.shutdown()
    }

    @Test fun exact_original_post_and_cancel_bytes_and_scope_headers_are_preserved() =
        runTest {
            server.enqueue(MockResponse().setBody(fixture.resultJson(original)))
            transport.resolve(original, HomeMemberRemovalRecovery.Retry, fixture.serverSession)
            val post = server.takeRequest()
            assertEquals("/api/homes/member-removals/commands", post.path)
            assertEquals("POST", post.method)
            assertEquals(original.requestJson, post.body.readUtf8())
            assertEquals(fixture.serverSession, post.getHeader("X-Pantopus-Session-Scope"))
            server.enqueue(MockResponse().setBody(fixture.resultJson(original, "cancelled")))
            transport.resolve(original, HomeMemberRemovalRecovery.Cancel, fixture.serverSession)
            val cancel = server.takeRequest()
            assertEquals("/api/homes/member-removals/commands/${request.requestId}/cancel", cancel.path)
            assertEquals(fixture.codec.cancel(original), cancel.body.readUtf8())
        }

    @Test fun receipt_http_status_is_exact_and_read_has_no_replay_claim() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(409).setBody(fixture.resultJson(original, "rejected")))
            assertEquals("rejected", transport.resolve(original, HomeMemberRemovalRecovery.Check, fixture.serverSession).state)
            assertEquals("GET", server.takeRequest().method)
            for ((status, json) in listOf(
                200 to fixture.resultJson(original, "rejected"),
                201 to fixture.resultJson(original),
                200 to fixture.resultJson(original).replace("\"state\":", "\"replayed\":true,\"state\":"),
            )) {
                server.enqueue(MockResponse().setResponseCode(status).setBody(json))
                assertTrue(runCatching { transport.resolve(original, HomeMemberRemovalRecovery.Check, fixture.serverSession) }.isFailure)
            }
        }

    @Test fun unknown_and_nonreceipt_failures_never_prove_completion_or_cancel() =
        runTest {
            for ((status, json) in listOf(
                404 to """{"state":"unknown","code":"MEMBER_REMOVAL_NOT_FOUND",
                    "session":{"actor_id":"${fixture.scope.actorId}","session_scope":"${fixture.serverSession}"}}""",
                409 to """{"state":"error","code":"MEMBER_REMOVAL_CONFLICT"}""",
                503 to "{}",
                200 to "[]",
                200 to fixture.resultJson(original).replace(fixture.serverSession, "f".repeat(64)),
            )) {
                server.enqueue(MockResponse().setResponseCode(status).setBody(json))
                assertEquals(
                    HomeMemberRemovalFailureKind.Unknown,
                    (
                        runCatching {
                            transport.resolve(original, HomeMemberRemovalRecovery.Retry, fixture.serverSession)
                        }.exceptionOrNull() as HomeMemberRemovalFailure
                    ).kind,
                )
            }
        }

    @Test fun current_context_uses_only_home_target_and_retires_changed_session() =
        runTest {
            server.enqueue(MockResponse().setBody(fixture.contextJson()))
            assertEquals(fixture.occupancy, transport.context(fixture.scope, fixture.intent(), fixture.serverSession).occupancyId)
            assertEquals(fixture.codec.intent(fixture.intent()), server.takeRequest().body.readUtf8())
            server.enqueue(MockResponse().setResponseCode(409).setBody("""{"code":"SESSION_SCOPE_CHANGED"}"""))
            assertEquals(
                HomeMemberRemovalFailureKind.SessionChanged,
                (
                    runCatching {
                        transport.context(fixture.scope, fixture.intent(), fixture.serverSession)
                    }.exceptionOrNull() as HomeMemberRemovalFailure
                ).kind,
            )
            server.enqueue(MockResponse().setResponseCode(401).setBody("expired"))
            assertEquals(
                HomeMemberRemovalFailureKind.SessionChanged,
                (
                    runCatching {
                        transport.session(fixture.scope)
                    }.exceptionOrNull() as HomeMemberRemovalFailure
                ).kind,
            )
        }

    @Test fun roster_is_separate_and_needs_current_server_session_after_read() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"occupants":[]}"""))
            server.enqueue(
                MockResponse().setBody("""{"session":{"actor_id":"${fixture.scope.actorId}","session_scope":"${"f".repeat(64)}"}}"""),
            )
            assertTrue(runCatching { transport.currentRoster(original, fixture.serverSession) }.isFailure)
            assertEquals("/api/homes/${fixture.home}/occupants", server.takeRequest().path)
            assertEquals("/api/homes/member-removals/session", server.takeRequest().path)
            server.enqueue(MockResponse().setResponseCode(403).setBody("{}"))
            assertTrue(runCatching { transport.currentRoster(original, fixture.serverSession) }.isFailure)
        }
}
