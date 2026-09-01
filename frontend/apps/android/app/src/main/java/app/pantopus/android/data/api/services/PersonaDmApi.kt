package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.audience.PersonaThreadsResponse
import app.pantopus.android.data.api.models.personadm.PersonaDmMessageBody
import app.pantopus.android.data.api.models.personadm.PersonaDmOpenThreadResponse
import app.pantopus.android.data.api.models.personadm.PersonaDmSendMessageResponse
import app.pantopus.android.data.api.models.personadm.PersonaDmThreadDetailResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * C5 — Persona DM threads. A distinct surface from generic chat: threads are
 * addressed by `threadId` and the wire shape deliberately carries no
 * `user_id` for either party. Router mounted at `/api/personas/:id/dms`
 * (`backend/app.js:370`), UUID-gated on `:id`.
 */
interface PersonaDmApi {
    /** `GET /api/personas/:id/dms/threads` — thread list. Owner sees every
     *  thread on the persona, a fan only their own (empty when they hold no
     *  active membership). Route `backend/routes/personaDms.js:185`. */
    @GET("api/personas/{id}/dms/threads")
    suspend fun threads(
        @Path("id") personaId: String,
    ): PersonaThreadsResponse

    /** `GET /api/personas/:id/dms/threads/:threadId` — thread detail. The
     *  read also marks the other side's messages read and zeroes the
     *  caller's unread counter, so this is the canonical "open thread"
     *  call. Route `backend/routes/personaDms.js:235`. */
    @GET("api/personas/{id}/dms/threads/{threadId}")
    suspend fun thread(
        @Path("id") personaId: String,
        @Path("threadId") threadId: String,
    ): PersonaDmThreadDetailResponse

    /** `POST /api/personas/:id/dms/threads` — a fan opens a brand-new
     *  thread. Burns one message-thread quota. Rejections are first-class
     *  states: `402 quota_exhausted`, `403 blocked`, `403 no_membership`,
     *  `403 tier_does_not_allow`. Route `backend/routes/personaDms.js:135`. */
    @POST("api/personas/{id}/dms/threads")
    suspend fun openThread(
        @Path("id") personaId: String,
        @Body body: PersonaDmMessageBody,
    ): PersonaDmOpenThreadResponse

    /** `POST /api/personas/:id/dms/threads/:threadId/messages` — append to
     *  an existing thread. Consumes no quota; a blocked fan still gets
     *  `403 blocked`. Route `backend/routes/personaDms.js:314`. */
    @POST("api/personas/{id}/dms/threads/{threadId}/messages")
    suspend fun sendMessage(
        @Path("id") personaId: String,
        @Path("threadId") threadId: String,
        @Body body: PersonaDmMessageBody,
    ): PersonaDmSendMessageResponse
}
