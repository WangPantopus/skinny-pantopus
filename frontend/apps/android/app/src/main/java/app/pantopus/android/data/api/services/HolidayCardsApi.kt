package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.CardEmailedAgainResponse
import app.pantopus.android.data.api.models.mailbox.CardExchange
import app.pantopus.android.data.api.models.mailbox.CardMediaUploaded
import app.pantopus.android.data.api.models.mailbox.CardReplyBody
import app.pantopus.android.data.api.models.mailbox.CardReplyResponse
import app.pantopus.android.data.api.models.mailbox.CardReplyTakenBack
import app.pantopus.android.data.api.models.mailbox.CardSignatureBody
import app.pantopus.android.data.api.models.mailbox.CardTownBody
import app.pantopus.android.data.api.models.mailbox.CardTownKept
import app.pantopus.android.data.api.models.mailbox.CardTownsResponse
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardLinkResponse
import app.pantopus.android.data.api.models.mailbox.HolidayCardListPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardNoteHelpBody
import app.pantopus.android.data.api.models.mailbox.HolidayCardNoteIdeas
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardShareVideo
import app.pantopus.android.data.api.models.mailbox.HolidayCardSharedBody
import app.pantopus.android.data.api.models.mailbox.HolidayCardWaitingResponse
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
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
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
     * `PUT /api/mailbox/cards/signature` — route `backend/routes/mailbox.js` (next to `GET /cards`): keeps this signature
     * on the account for the next cards, replacing any saved one; answers `{ signature }` as kept.
     */
    @PUT("api/mailbox/cards/signature")
    suspend fun saveSignature(
        @Body body: CardSignatureBody,
    ): CardSignatureBody

    /**
     * `DELETE /api/mailbox/cards/signature` — route `backend/routes/mailbox.js` (next to `GET /cards`): forgets the saved
     * signature (cards already sent keep theirs). Answers 204.
     */
    @DELETE("api/mailbox/cards/signature")
    suspend fun forgetSignature(): Response<Unit>

    /**
     * `GET /api/mailbox/cards/arrivals?to=` — route `backend/routes/mailbox.js:1809`: when a card to this person can
     * come, by their clock; the same checks as sending them one.
     */
    @GET("api/mailbox/cards/arrivals")
    suspend fun arrivals(
        @Query("to") userId: String,
    ): HolidayCardArrivalsFor

    /**
     * `GET /api/mailbox/cards/waiting` — route `backend/routes/mailbox.js:2314` (TABCARD §3): the
     * newest unopened Christmas card in the caller's own Mailbox while the account is under 14 days old; `card: null`
     * otherwise (always 200 for "nothing").
     */
    @GET("api/mailbox/cards/waiting")
    suspend fun waiting(): HolidayCardWaitingResponse

    /**
     * `POST /api/ai/draft/card-note` — route `backend/routes/ai.js:451`: "Help me write it" (the server's launch key
     * `card_note_help`; 404 while it's off). Up to three notes for the back of the card; nothing is stored or sent.
     */
    @POST("api/ai/draft/card-note")
    suspend fun noteHelp(
        @Body body: HolidayCardNoteHelpBody,
    ): HolidayCardNoteIdeas

    /**
     * `GET /api/mailbox/cards/towns?q=` — route `backend/routes/mailbox.js` (travelling card plan Part 1, launch key
     * `card_travel`; 404 while it's off): up to 8 towns for a few letters or a ZIP code; with no [q], the town nearest
     * where the person is, to offer as "Use Vancouver, WA".
     */
    @GET("api/mailbox/cards/towns")
    suspend fun cardTowns(
        @Query("q") q: String?,
    ): CardTownsResponse

    /** `PUT /api/mailbox/cards/town` — the same route file: keeps the chosen town in the person's profile town fields (D4). */
    @PUT("api/mailbox/cards/town")
    suspend fun keepCardTown(
        @Body body: CardTownBody,
    ): CardTownKept

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

    /**
     * `POST /api/mailbox/cards/media` (launch key `holiday_card_memories`; 404 while it's off): a card's own photo or
     * voice greeting, [kind] first, then the file. 201 with the stored file, sendable on one card for 72 hours; 415 an
     * unreadable or moving picture or recording, 413 too large or too long, 429 too many in an hour, 503 to try again.
     */
    @Multipart
    @POST("api/mailbox/cards/media")
    suspend fun uploadMedia(
        @Part("kind") kind: RequestBody,
        @Part file: MultipartBody.Part,
    ): CardMediaUploaded

    /**
     * `GET /api/mailbox/cards/share-video/:design` — route `backend/routes/mailbox.js` (next to `POST /cards/shared`).
     * The video a card shares as (the server's launch key `card_share_video`; 404 while it's off): the picture's card
     * arriving on the table, the same for everyone, with no note or name in it.
     */
    @GET("api/mailbox/cards/share-video/{design}")
    suspend fun shareVideo(
        @Path("design") design: String,
    ): HolidayCardShareVideo

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
     * `GET /api/mailbox/cards/:id/exchange` — route `backend/routes/mailbox.js` (plan Part 3): the joined card, `:id` the
     * card or its reply; needs only `mailbox`. 404 for anyone but the two people.
     */
    @GET("api/mailbox/cards/{id}/exchange")
    suspend fun exchange(
        @Path("id") id: String,
    ): CardExchange

    /**
     * `POST /api/mailbox/cards/:id/reply` — the same route file (plan Part 3; `mailbox` + `holiday_card_memories` +
     * `card_replies`): one reply per card, from the person it went to; 201, or 200 for the same request again.
     */
    @POST("api/mailbox/cards/{id}/reply")
    suspend fun reply(
        @Path("id") id: String,
        @Body body: CardReplyBody,
    ): CardReplyResponse

    /** `POST /api/mailbox/cards/:id/reply/take-back` — the writer's waiting reply, until the 7 a.m. pickup. */
    @POST("api/mailbox/cards/{id}/reply/take-back")
    suspend fun takeBackReply(
        @Path("id") id: String,
    ): CardReplyTakenBack

    /**
     * `POST /api/mailbox/cards/:id/email-again` — the same route file (after take-back): one more try at a card by
     * email's email that didn't go out (Sent's `email_status`), sender only. 503 `CARD_EMAIL_FAILED` when it still
     * didn't go, 429 `CARD_EMAIL_BUSY` within a minute of the last try, 409 once it went, was taken back or they have
     * it, 404 for anyone else; each with the server's sentence.
     */
    @POST("api/mailbox/cards/{id}/email-again")
    suspend fun emailAgain(
        @Path("id") id: String,
    ): CardEmailedAgainResponse

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
