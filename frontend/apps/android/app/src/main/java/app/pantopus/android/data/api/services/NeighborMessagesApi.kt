package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.NeighborMessageAck
import app.pantopus.android.data.api.models.place.NeighborMessageTemplates
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessagesResponse
import app.pantopus.android.data.api.models.place.ReplyNeighborMessageRequest
import app.pantopus.android.data.api.models.place.ReportNeighborMessageRequest
import app.pantopus.android.data.api.models.place.SendNeighborMessageRequest
import app.pantopus.android.data.api.models.place.SentNeighborMessage
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Neighbor messages — verified-only (T4), template-only neighbor
 * heads-ups. Route `backend/routes/neighborMessages.js`, mounted at
 * `/api/neighbor-messages`.
 */
interface NeighborMessagesApi {
    /**
     * The pre-written note catalog + templated quick-replies (server
     * source of truth). Route `backend/routes/neighborMessages.js:89`.
     */
    @GET("api/neighbor-messages/templates")
    suspend fun templates(): NeighborMessageTemplates

    /**
     * Send a template-only note to a verified home on your block. The
     * server enforces the T4 sender gate, same-block recipient, and the
     * weekly cap. Route `backend/routes/neighborMessages.js:102`.
     */
    @POST("api/neighbor-messages")
    suspend fun send(
        @Body body: SendNeighborMessageRequest,
    ): SentNeighborMessage

    /**
     * The caller's received messages, most recent first. Sender is
     * always anonymized. Route `backend/routes/neighborMessages.js:209`.
     */
    @GET("api/neighbor-messages/received")
    suspend fun received(): ReceivedNeighborMessagesResponse

    /**
     * A single received message (recipient only). Marks it read.
     * Route `backend/routes/neighborMessages.js:246`.
     */
    @GET("api/neighbor-messages/{id}")
    suspend fun message(
        @Path("id") id: String,
    ): ReceivedNeighborMessage

    /**
     * Reply with a templated quick-reply (anonymous both ways).
     * Route `backend/routes/neighborMessages.js:273`.
     */
    @POST("api/neighbor-messages/{id}/reply")
    suspend fun reply(
        @Path("id") id: String,
        @Body body: ReplyNeighborMessageRequest,
    ): ReceivedNeighborMessage

    /**
     * Mark not helpful — the sender is never notified.
     * Route `backend/routes/neighborMessages.js:325`.
     */
    @POST("api/neighbor-messages/{id}/not-helpful")
    suspend fun notHelpful(
        @Path("id") id: String,
    ): NeighborMessageAck

    /**
     * Report to the trust team — the sender is never notified.
     * Route `backend/routes/neighborMessages.js:348`.
     */
    @POST("api/neighbor-messages/{id}/report")
    suspend fun report(
        @Path("id") id: String,
        @Body body: ReportNeighborMessageRequest,
    ): NeighborMessageAck

    /**
     * Block the (still anonymous) sender — they are never notified.
     * Route `backend/routes/neighborMessages.js:370`.
     */
    @POST("api/neighbor-messages/{id}/block")
    suspend fun block(
        @Path("id") id: String,
    ): NeighborMessageAck
}
