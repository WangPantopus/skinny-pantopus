package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mail_compose.MailComposeRecipientsResponse
import app.pantopus.android.data.api.models.mail_compose.MailHomeContextResponse
import app.pantopus.android.data.api.models.mail_compose.SendMailBody
import app.pantopus.android.data.api.models.mail_compose.SendMailResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Ceremonial Mail Compose endpoints. Mounted under
 * `/api/mailbox/compose/[*]` plus the existing `/api/mailbox/send`
 * for the final send — see `backend/app.js:311` and
 * `backend/routes/mailbox.js:1697`.
 */
interface MailComposeApi {
    /** `GET /api/mailbox/compose/recipients`. */
    @GET("api/mailbox/compose/recipients")
    suspend fun recipients(
        @Query("q") query: String,
        @Query("homeId") homeId: String? = null,
    ): MailComposeRecipientsResponse

    /** `GET /api/mailbox/compose/home-context/:homeId`. */
    @GET("api/mailbox/compose/home-context/{homeId}")
    suspend fun homeContext(
        @Path("homeId") homeId: String,
    ): MailHomeContextResponse

    /** `POST /api/mailbox/send`. */
    @POST("api/mailbox/send")
    suspend fun send(
        @Body body: SendMailBody,
    ): SendMailResponse
}
