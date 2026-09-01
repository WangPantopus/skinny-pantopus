package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.BlockInviteRequest
import app.pantopus.android.data.api.models.place.BlockInviteResult
import app.pantopus.android.data.api.models.place.BlockStatusResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Block Founders (Wave 3) — the growth surface. Route
 * `backend/routes/blockFounders.js` (mounted under `/api/homes`).
 * Both routes are hard-gated to VERIFIED occupants: the rank is a
 * claim only a verified home can hold, the meters surface the raw
 * insider count, and invites spend real money in the sender's name.
 */
interface BlockFoundersApi {
    /**
     * The founders panel: permanent rank, established date, the cell's
     * verified count and rent-report count, the three unlock meters,
     * and this week's remaining invite budget.
     * Route `backend/routes/blockFounders.js:54`.
     */
    @GET("api/homes/{id}/block-founders")
    suspend fun status(
        @Path("id") homeId: String,
    ): BlockStatusResponse

    /**
     * Send one template postcard invite. 429 `WEEKLY_CAP`, 502
     * `SEND_FAILED`, 400 for `BAD_ADDRESS` / `OPTED_OUT` /
     * `ALREADY_MEMBER` / `RECENTLY_INVITED`.
     * Route `backend/routes/blockFounders.js:67`.
     */
    @POST("api/homes/{id}/block-founders/invites")
    suspend fun invite(
        @Path("id") homeId: String,
        @Body body: BlockInviteRequest,
    ): BlockInviteResult
}
