package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.v2.MailDayActionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayFinishResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayTodayResponse
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/** My Mail Day triage routes from `backend/routes/mailDay.js`. */
interface MailDayApi {
    /** `GET /api/mailbox/v2/mailday/today` — route `backend/routes/mailDay.js:376`. */
    @GET("api/mailbox/v2/mailday/today")
    suspend fun today(): MailDayTodayResponse

    /**
     * `POST /api/mailbox/v2/mailday/items/:itemId/route` — route
     * `backend/routes/mailDay.js:520`. The server derives the recipient +
     * tint from the stored piece's suggestion, so no body is sent.
     */
    @POST("api/mailbox/v2/mailday/items/{itemId}/route")
    suspend fun route(
        @Path("itemId") itemId: String,
    ): MailDayActionResponse

    /** `POST /api/mailbox/v2/mailday/finish` — route `backend/routes/mailDay.js:557`. */
    @POST("api/mailbox/v2/mailday/finish")
    suspend fun finish(): MailDayFinishResponse
}
