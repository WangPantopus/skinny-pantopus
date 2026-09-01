package app.pantopus.android.data.mail_compose

import app.pantopus.android.data.api.models.mail_compose.MailComposeRecipientsResponse
import app.pantopus.android.data.api.models.mail_compose.MailHomeContextResponse
import app.pantopus.android.data.api.models.mail_compose.SendMailBody
import app.pantopus.android.data.api.models.mail_compose.SendMailResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailComposeApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the mail-compose calls in [NetworkResult]. */
@Singleton
class MailComposeRepository
    @Inject
    constructor(
        private val api: MailComposeApi,
    ) {
        suspend fun recipients(
            query: String,
            homeId: String? = null,
        ): NetworkResult<MailComposeRecipientsResponse> = safeApiCall { api.recipients(query, homeId) }

        suspend fun homeContext(homeId: String): NetworkResult<MailHomeContextResponse> = safeApiCall { api.homeContext(homeId) }

        suspend fun send(body: SendMailBody): NetworkResult<SendMailResponse> = safeApiCall { api.send(body) }
    }
