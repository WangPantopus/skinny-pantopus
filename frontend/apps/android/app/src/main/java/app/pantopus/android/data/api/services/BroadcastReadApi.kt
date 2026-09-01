package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.broadcast.BroadcastReadResponse
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Broadcast read receipts. RN marks a broadcast read as soon as it renders
 * on the public Beacon profile
 * (`src/app/persona/[personaHandle]/index.tsx:63-72`); the increment is what
 * feeds the creator's read-count analytics on the broadcast timeline.
 *
 * Mirrors iOS `BroadcastReadEndpoints.swift`.
 */
interface BroadcastReadApi {
    /** `POST /api/broadcast/messages/:messageId/read` — increment the
     *  broadcast's `read_count` for the calling viewer. The owner's own
     *  reads are ignored server-side; blocked or under-tier viewers get a
     *  403. Route `backend/routes/broadcastChannels.js:602`; mounted at
     *  `/api/broadcast` (`backend/app.js:383`). */
    @POST("api/broadcast/messages/{messageId}/read")
    suspend fun markRead(
        @Path("messageId") messageId: String,
    ): BroadcastReadResponse
}
