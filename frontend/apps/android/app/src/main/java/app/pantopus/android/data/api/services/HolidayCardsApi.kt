package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardBody
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardResponse
import app.pantopus.android.data.api.models.mailbox.TakeBackHolidayCardResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Christmas cards (launch keys `holiday_cards` + `mailbox`; every route answers 404 while either is off), from
 * `backend/routes/mailbox.js`. The people a card can go to come from [MailComposeApi.recipients] with `people=1`.
 */
interface HolidayCardsApi {
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
     * `POST /api/mailbox/cards/:id/take-back` — route `backend/routes/mailbox.js:1988`: before the 7 a.m. pickup (by
     * email: before they open it); 409 once it's gone.
     */
    @POST("api/mailbox/cards/{id}/take-back")
    suspend fun takeBack(
        @Path("id") id: String,
    ): TakeBackHolidayCardResponse
}
