package app.pantopus.android.data.mailday

import app.pantopus.android.data.api.models.mailbox.v2.MailDayActionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayFinishResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayTodayResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailDayApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [MailDayApi] in the typed [NetworkResult] taxonomy. */
@Singleton
class MailDayRepository
    @Inject
    constructor(
        private val api: MailDayApi,
    ) {
        /** `GET /api/mailbox/v2/mailday/today`. */
        suspend fun today(): NetworkResult<MailDayTodayResponse> = safeApiCall { api.today() }

        /** `POST /api/mailbox/v2/mailday/items/:itemId/route`. */
        suspend fun route(itemId: String): NetworkResult<MailDayActionResponse> = safeApiCall { api.route(itemId) }

        /** `POST /api/mailbox/v2/mailday/finish`. */
        suspend fun finish(): NetworkResult<MailDayFinishResponse> = safeApiCall { api.finish() }
    }
