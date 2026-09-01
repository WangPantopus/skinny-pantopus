package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.MailboxCheckResponse
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Mailbox Reality Check — the claim-time postal validation surfaced as
 * a diagnostic. Route `backend/routes/mailboxCheck.js` (mounted under
 * `/api/homes`).
 */
interface MailboxCheckApi {
    /**
     * Read-only, zero vendor calls; any home member. The physical-leg
     * copy is per-caller. Route `backend/routes/mailboxCheck.js:24`.
     */
    @GET("api/homes/{id}/mailbox-check")
    suspend fun check(
        @Path("id") homeId: String,
    ): MailboxCheckResponse
}
