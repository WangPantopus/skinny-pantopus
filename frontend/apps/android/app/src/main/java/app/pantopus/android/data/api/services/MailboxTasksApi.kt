package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.v2.P3CreateTaskFromMailRequest
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskResponse
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskToGigRequest
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskToGigResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Mail-linked task writes from `backend/routes/mailboxV2Phase3.js`
 * (mounted at `api/mailbox/v2/p3`, `backend/app.js:317`). The read
 * (`GET …/p3/tasks`) and the partial update (`PATCH …/p3/tasks/:id`)
 * already live on [MailboxV2Api]; this interface adds the two writes the
 * Mail-tasks list surface needs so the heavily-shared V2 interface stays
 * small.
 */
interface MailboxTasksApi {
    /**
     * `POST api/mailbox/v2/p3/tasks/from-mail` — route
     * `backend/routes/mailboxV2Phase3.js:886`. Creates a `HomeTask`
     * linked to a mail item and stamps `Mail.linked_task_id`.
     */
    @POST("api/mailbox/v2/p3/tasks/from-mail")
    suspend fun createTaskFromMail(
        @Body body: P3CreateTaskFromMailRequest,
    ): P3TaskResponse

    /**
     * `POST api/mailbox/v2/p3/tasks/:id/to-gig` — route
     * `backend/routes/mailboxV2Phase3.js:977`. Posts the task as a
     * neighbor gig, links it back onto the task
     * (`converted_to_gig_id`), and flips the task to `in_progress`.
     */
    @POST("api/mailbox/v2/p3/tasks/{id}/to-gig")
    suspend fun convertTaskToGig(
        @Path("id") id: String,
        @Body body: P3TaskToGigRequest,
    ): P3TaskToGigResponse
}
