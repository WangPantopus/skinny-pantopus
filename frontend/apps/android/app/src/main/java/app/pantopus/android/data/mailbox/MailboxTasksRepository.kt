package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.v2.P3CreateTaskFromMailRequest
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskResponse
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskToGigRequest
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskToGigResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxTasksApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Mail-linked task writes (A17.12 list surface). Kept separate from
 * [MailboxRepository] so the shared mailbox repository does not grow a
 * second dependency for two routes.
 */
@Singleton
class MailboxTasksRepository
    @Inject
    constructor(
        private val api: MailboxTasksApi,
    ) {
        /** `POST api/mailbox/v2/p3/tasks/from-mail`. */
        suspend fun createTaskFromMail(request: P3CreateTaskFromMailRequest): NetworkResult<P3TaskResponse> =
            safeApiCall { api.createTaskFromMail(request) }

        /** `POST api/mailbox/v2/p3/tasks/:id/to-gig`. */
        suspend fun convertTaskToGig(
            taskId: String,
            request: P3TaskToGigRequest,
        ): NetworkResult<P3TaskToGigResponse> = safeApiCall { api.convertTaskToGig(taskId, request) }
    }
