package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardLinkResponse
import app.pantopus.android.data.api.models.mailbox.HolidayCardListPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardSharedBody
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardBody
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardListBody
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardListResponse
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardResponse
import app.pantopus.android.data.api.models.mailbox.SentCardResponse
import app.pantopus.android.data.api.models.mailbox.SentMailResponse
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.data.api.models.mailbox.StampConfirmation
import app.pantopus.android.data.api.models.mailbox.StampConfirmed
import app.pantopus.android.data.api.models.mailbox.TakeBackHolidayCardResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Christmas cards (launch keys `holiday_cards` + `mailbox`; every route answers 404 while either is off), from
 * `backend/routes/mailbox.js`. The people a card can go to come from [MailComposeApi.recipients] with `people=1`.
 */
@Suppress("TooManyFunctions")
interface HolidayCardsApi {
    /**
     * `GET /api/mailbox/stamp-books?history=` — route `backend/routes/mailStamps.js:29`: the digital stamps left and the
     * books; with `history=1` also the latest stamp moves and the stamps used.
     */
    @GET("api/mailbox/stamp-books")
    suspend fun stampBooks(
        @Query("history") history: String? = null,
    ): StampBalance

    /** `POST /api/mailbox/stamp-books/confirm` — route `backend/routes/mailStamps.js:68`: credits a Google Play purchase. */
    @POST("api/mailbox/stamp-books/confirm")
    suspend fun confirmStamps(
        @Body body: StampConfirmation,
    ): StampConfirmed

    /** `GET /api/mailbox/cards` — route `backend/routes/mailbox.js:1776`: the season's pictures and today's card. */
    @GET("api/mailbox/cards")
    suspend fun cards(): HolidayCardsResponse

    /**
     * `GET /api/mailbox/cards/arrivals?to=` — route `backend/routes/mailbox.js:1809`: when a card to this person can
     * come, by their clock; the same checks as sending them one.
     */
    @GET("api/mailbox/cards/arrivals")
    suspend fun arrivals(
        @Query("to") userId: String,
    ): HolidayCardArrivalsFor

    /** `POST /api/mailbox/cards` — route `backend/routes/mailbox.js:1837`: send today's card (201). */
    @POST("api/mailbox/cards")
    suspend fun send(
        @Body body: SendHolidayCardBody,
    ): SendHolidayCardResponse

    /**
     * `GET /api/mailbox/cards/:id/link` (sender only, launch key `card_table`): the link of a card by link that's still
     * waiting. 409 with what happened once it's been opened, taken back or lost; 404 for anyone else.
     */
    @GET("api/mailbox/cards/{id}/link")
    suspend fun cardLink(
        @Path("id") id: String,
    ): HolidayCardLinkResponse

    /**
     * `POST /api/mailbox/cards/batch/preview` — route `backend/routes/mailbox.js:2441`: a list's look (digital stamps on),
     * every check its send runs, storing and sending nothing.
     */
    @POST("api/mailbox/cards/batch/preview")
    suspend fun previewList(
        @Body body: SendHolidayCardListBody,
    ): HolidayCardListPreview

    /**
     * `POST /api/mailbox/cards/batch` — route `backend/routes/mailbox.js:2484`: one card to every person and address on
     * the list, each its own card; answers card by card (402 when the cards need more stamps than are left).
     */
    @POST("api/mailbox/cards/batch")
    suspend fun sendList(
        @Body body: SendHolidayCardListBody,
    ): SendHolidayCardListResponse

    /** `POST /api/mailbox/cards/shared` — counts what was shared (launch key `card_table`). Answers 204. */
    @POST("api/mailbox/cards/shared")
    suspend fun shared(
        @Body body: HolidayCardSharedBody,
    ): Response<Unit>

    /**
     * `POST /api/mailbox/cards/preview` — route `backend/routes/mailbox.js` (before `POST /cards`): the card exactly as
     * the other person will see it, after every check sending runs; it stores and sends nothing. The same errors as
     * [send]. The whole response, so a 404's body can be read (a server from before Look it over answers 404 without
     * the server's code).
     */
    @POST("api/mailbox/cards/preview")
    suspend fun preview(
        @Body body: SendHolidayCardBody,
    ): Response<HolidayCardPreview>

    /**
     * `POST /api/mailbox/cards/:id/take-back` — route `backend/routes/mailbox.js:1988`: before the 7 a.m. pickup (by
     * email: before they open it); 409 once it's gone.
     */
    @POST("api/mailbox/cards/{id}/take-back")
    suspend fun takeBack(
        @Path("id") id: String,
    ): TakeBackHolidayCardResponse

    /**
     * `GET /api/mailbox/sent?before=&limit=` — route `backend/routes/mailbox.js` (before `GET /:id`; launch key
     * `mailbox`): the cards the person sent, newest first; [before] is the last page's `next`.
     */
    @GET("api/mailbox/sent")
    suspend fun sent(
        @Query("before") before: String?,
        @Query("limit") limit: Int,
        /** `not_delivered` (launch key `holiday_card_memories`): a card a block withdrew comes back as "Couldn't be delivered". */
        @Query("include") include: String? = null,
    ): SentMailResponse

    /** `GET /api/mailbox/sent/:id` — the same route file: one card the person sent, its note and trail; 404 for anyone else. */
    @GET("api/mailbox/sent/{id}")
    suspend fun sentCard(
        @Path("id") id: String,
        @Query("include") include: String? = null,
    ): SentCardResponse
}
