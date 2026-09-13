package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.api.services.HomeInvitationSenderApi
import app.pantopus.android.data.homes.APIHomeInvitationSenderTransport
import app.pantopus.android.data.homes.HomeInvitationSenderRecovery
import app.pantopus.android.data.homes.HomeInvitationSenderRequest
import app.pantopus.android.data.homes.PendingHomeInvitationSender
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit

class HomeInvitationSenderTransportTest {
    private val fixture = SenderFixture()
    private val server = MockWebServer()
    private val request =
        HomeInvitationSenderRequest("ddc24300-0000-4000-8000-000000000004", "b".repeat(64), fixture.intent(), fixture.decision)
    private val original = PendingHomeInvitationSender(fixture.scope, request, fixture.codec.encode(request), "Synthetic recipient")
    private lateinit var transport: APIHomeInvitationSenderTransport

    @Before fun setup() {
        server.start()
        val api = Retrofit.Builder().baseUrl(server.url("/")).build().create(HomeInvitationSenderApi::class.java)
        transport = APIHomeInvitationSenderTransport(api, fixture.codec)
    }

    @After fun shutdown() {
        server.shutdown()
    }

    private fun rejected(): String =
        fixture.resultJson(original, "rejected").replace(
            "\"state\":\"rejected\"",
            "\"state\":\"rejected\",\"code\":\"INVITE_SENDER_CHANGED\"",
        )

    @Test fun durable_422_rejection_is_recoverable_and_not_an_unknown_transport_failure() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(422).setBody(rejected()))
            val outcome = transport.resolve(original, HomeInvitationSenderRecovery.Check, fixture.serverSession)
            assertEquals("rejected", outcome.state)
            assertTrue(outcome.isTerminal)
            val read = server.takeRequest()
            assertEquals("GET", read.method)
            assertEquals("/api/homes/invitations/sender/commands/${request.requestId}", read.path)
            assertEquals(fixture.serverSession, read.getHeader("X-Pantopus-Session-Scope"))
        }

    @Test fun exact_original_bytes_are_posted_and_receipt_state_must_match_http_status() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(201).setBody(fixture.resultJson(original)))
            transport.resolve(original, HomeInvitationSenderRecovery.Retry, fixture.serverSession)
            assertEquals(original.requestJson, server.takeRequest().body.readUtf8())
            server.enqueue(MockResponse().setResponseCode(200).setBody(rejected()))
            assertTrue(runCatching { transport.resolve(original, HomeInvitationSenderRecovery.Check, fixture.serverSession) }.isFailure)
        }

    @Test fun nonreceipt_errors_or_wrong_session_do_not_resolve_an_original() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(409).setBody("""{"code":"INVITE_SENDER_CONFLICT"}"""))
            assertTrue(runCatching { transport.resolve(original, HomeInvitationSenderRecovery.Retry, fixture.serverSession) }.isFailure)
            server.enqueue(MockResponse().setResponseCode(422).setBody(rejected().replace(fixture.serverSession, "f".repeat(64))))
            assertTrue(runCatching { transport.resolve(original, HomeInvitationSenderRecovery.Check, fixture.serverSession) }.isFailure)
        }

    @Test fun cancellation_sends_the_original_capability_and_intent_without_request_id() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(200).setBody(fixture.resultJson(original, "cancelled")))
            val outcome = transport.resolve(original, HomeInvitationSenderRecovery.Cancel, fixture.serverSession)
            assertEquals("cancelled", outcome.state)
            val cancel = server.takeRequest()
            assertEquals("/api/homes/invitations/sender/commands/${request.requestId}/cancel", cancel.path)
            assertEquals(fixture.codec.cancel(original), cancel.body.readUtf8())
        }
}
