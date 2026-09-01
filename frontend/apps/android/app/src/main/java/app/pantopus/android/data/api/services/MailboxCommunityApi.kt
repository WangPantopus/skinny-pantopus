package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.p3.CommunityFeedResponse
import app.pantopus.android.data.api.models.mailbox.p3.CommunityFlagRequest
import app.pantopus.android.data.api.models.mailbox.p3.CommunityFlagResponse
import app.pantopus.android.data.api.models.mailbox.p3.CommunityReactRequest
import app.pantopus.android.data.api.models.mailbox.p3.CommunityReactResponse
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpRequest
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * A17.4 Community-mail routes from `backend/routes/mailboxV2Phase3.js`.
 * The Phase-3 router is mounted at `api/mailbox/v2/p3` —
 * `backend/app.js:317` — so each path below is that prefix plus the
 * route-relative declaration.
 *
 * Mirrors `Core/Networking/Endpoints/MailboxCommunityEndpoints.swift` on iOS.
 */
interface MailboxCommunityApi {
    /**
     * `GET api/mailbox/v2/p3/community/feed` — route
     * `backend/routes/mailboxV2Phase3.js:565`. Neighborhood / civic feed
     * across every home the caller occupies, newest first. `type` filters
     * on `community_type`; omit it for "All".
     */
    @GET("api/mailbox/v2/p3/community/feed")
    suspend fun feed(
        @Query("type") type: String? = null,
        @Query("limit") limit: Int = 30,
        @Query("offset") offset: Int = 0,
    ): CommunityFeedResponse

    /**
     * `POST api/mailbox/v2/p3/community/react` — route
     * `backend/routes/mailboxV2Phase3.js:694`. Toggles one of the four
     * reaction types and returns the recomputed counts.
     */
    @POST("api/mailbox/v2/p3/community/react")
    suspend fun react(
        @Body body: CommunityReactRequest,
    ): CommunityReactResponse

    /**
     * `POST api/mailbox/v2/p3/community/rsvp` — route
     * `backend/routes/mailboxV2Phase3.js:746`. Idempotent: adds a
     * `will_attend` reaction when absent, then returns the RSVP count.
     */
    @POST("api/mailbox/v2/p3/community/rsvp")
    suspend fun rsvp(
        @Body body: CommunityRsvpRequest,
    ): CommunityRsvpResponse

    /**
     * `POST api/mailbox/v2/p3/community/flag` — route
     * `backend/routes/mailboxV2Phase3.js:790`. Reports an item for review;
     * server-side this records a `concerned` reaction and logs a
     * `community_flagged` mail event.
     */
    @POST("api/mailbox/v2/p3/community/flag")
    suspend fun flag(
        @Body body: CommunityFlagRequest,
    ): CommunityFlagResponse
}
