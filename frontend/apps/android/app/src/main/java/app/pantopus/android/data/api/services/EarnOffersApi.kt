package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.earn.EarnCloseOfferRequest
import app.pantopus.android.data.api.models.earn.EarnCloseOfferResponse
import app.pantopus.android.data.api.models.earn.EarnOffersResponse
import app.pantopus.android.data.api.models.earn.EarnOpenOfferRequest
import app.pantopus.android.data.api.models.earn.EarnOpenOfferResponse
import app.pantopus.android.data.api.models.earn.EarnRevealOfferResponse
import app.pantopus.android.data.api.models.earn.EarnSaveOfferResponse
import app.pantopus.android.data.api.models.mailbox.v2.EarnBalanceResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Mailbox Earn drawer — paid-offer wall. Mounted at
 * `app.use('/api/mailbox/v2', require('./routes/mailboxV2'))`
 * (`backend/app.js:315`); handlers live in the EARN ENDPOINTS block of
 * `backend/routes/mailboxV2.js`.
 *
 * Mirrors iOS `EarnOffersEndpoints`.
 */
interface EarnOffersApi {
    /**
     * `GET /api/mailbox/v2/earn/offers` — route
     * `backend/routes/mailboxV2.js:794`. Active, unexpired `EarnOffer`
     * rows (max 20, newest first), each enriched with the caller's
     * `opened` flag and `EarnTransaction`.
     */
    @GET("api/mailbox/v2/earn/offers")
    suspend fun offers(): EarnOffersResponse

    /**
     * `GET /api/mailbox/v2/earn/balance` — route
     * `backend/routes/mailboxV2.js:831`. Server-computed
     * `{ balance: { total, available, pending } }`.
     */
    @GET("api/mailbox/v2/earn/balance")
    suspend fun balance(): EarnBalanceResponse

    /**
     * `POST /api/mailbox/v2/earn/open` — route
     * `backend/routes/mailboxV2.js:858`. Creates the pending
     * `EarnTransaction` and starts the dwell window. Answers **429** with
     * `{ capped: true }` once the caller has opened 10 offers today.
     */
    @POST("api/mailbox/v2/earn/open")
    suspend fun openOffer(
        @Body body: EarnOpenOfferRequest,
    ): EarnOpenOfferResponse

    /**
     * `POST /api/mailbox/v2/earn/close/:offerId` — route
     * `backend/routes/mailboxV2.js:940`. Banks the reward when
     * `dwellMs >= 15000`; the response's `consumed` flag is the only
     * authority on whether it counted.
     */
    @POST("api/mailbox/v2/earn/close/{offerId}")
    suspend fun closeOffer(
        @Path("offerId") offerId: String,
        @Body body: EarnCloseOfferRequest,
    ): EarnCloseOfferResponse

    /**
     * `POST /api/mailbox/v2/earn/save/:offerId` — route
     * `backend/routes/mailboxV2.js:979`. Logs an `offer_saved` mail event.
     */
    @POST("api/mailbox/v2/earn/save/{offerId}")
    suspend fun saveOffer(
        @Path("offerId") offerId: String,
    ): EarnSaveOfferResponse

    /**
     * `POST /api/mailbox/v2/earn/reveal/:offerId` — route
     * `backend/routes/mailboxV2.js:989`. Returns `{ code }` (nullable) and
     * logs `offer_code_revealed`.
     */
    @POST("api/mailbox/v2/earn/reveal/{offerId}")
    suspend fun revealOffer(
        @Path("offerId") offerId: String,
    ): EarnRevealOfferResponse
}
