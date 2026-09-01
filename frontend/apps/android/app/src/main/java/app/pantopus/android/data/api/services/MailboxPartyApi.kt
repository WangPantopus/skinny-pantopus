package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.v2.CreateMailPartyRequest
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyActiveResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyAssignRequest
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyAssignResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyCreateResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyDeclineResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyJoinResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyReactionRequest
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyReactionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartySessionRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Family Mail Party (co-opening) routes from
 * `backend/routes/mailboxV2Phase2.js`, mounted at `api/mailbox/v2/p2`
 * (`backend/app.js:316`).
 *
 * Mirrors `Core/Networking/Endpoints/MailboxPartyEndpoints.swift`.
 */
interface MailboxPartyApi {
    /**
     * `GET api/mailbox/v2/p2/party/active` — route
     * `backend/routes/mailboxV2Phase2.js:926`. Pending / active sessions
     * across every home the caller can access, newest first. Pending
     * sessions older than 90s are filtered out server-side.
     */
    @GET("api/mailbox/v2/p2/party/active")
    suspend fun activeSessions(): MailPartyActiveResponse

    /**
     * `POST api/mailbox/v2/p2/party/create` — route
     * `backend/routes/mailboxV2Phase2.js:741`. Opens a `MailPartySession`
     * for a Home-drawer mail item and enrols the caller as the first
     * participant.
     */
    @POST("api/mailbox/v2/p2/party/create")
    suspend fun createSession(
        @Body body: CreateMailPartyRequest,
    ): MailPartyCreateResponse

    /**
     * `POST api/mailbox/v2/p2/party/join` — route
     * `backend/routes/mailboxV2Phase2.js:816`. Adds the caller as a
     * present participant and flips the session to `active`.
     */
    @POST("api/mailbox/v2/p2/party/join")
    suspend fun joinSession(
        @Body body: MailPartySessionRequest,
    ): MailPartyJoinResponse

    /**
     * `POST api/mailbox/v2/p2/party/decline` — route
     * `backend/routes/mailboxV2Phase2.js:866`. Records the decline; the
     * caller can still open the item solo.
     */
    @POST("api/mailbox/v2/p2/party/decline")
    suspend fun declineSession(
        @Body body: MailPartySessionRequest,
    ): MailPartyDeclineResponse

    /**
     * `POST api/mailbox/v2/p2/party/reaction` — route
     * `backend/routes/mailboxV2Phase2.js:875`. Ephemeral reaction (max 10
     * chars); the response carries the `ttl` in seconds.
     */
    @POST("api/mailbox/v2/p2/party/reaction")
    suspend fun sendReaction(
        @Body body: MailPartyReactionRequest,
    ): MailPartyReactionResponse

    /**
     * `POST api/mailbox/v2/p2/party/assign` — route
     * `backend/routes/mailboxV2Phase2.js:887`. Moves the mail onto the
     * chosen member's Counter and completes the session.
     */
    @POST("api/mailbox/v2/p2/party/assign")
    suspend fun assignItem(
        @Body body: MailPartyAssignRequest,
    ): MailPartyAssignResponse
}
