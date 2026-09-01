package app.pantopus.android.data.personadm

import app.pantopus.android.data.api.models.audience.PersonaThreadsResponse
import app.pantopus.android.data.api.models.personadm.PersonaDmMessageBody
import app.pantopus.android.data.api.models.personadm.PersonaDmOpenThreadResponse
import app.pantopus.android.data.api.models.personadm.PersonaDmSendMessageResponse
import app.pantopus.android.data.api.models.personadm.PersonaDmThreadDetailResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PersonaDmApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the `/api/personas/:id/dms` routes in [NetworkResult]. */
@Singleton
class PersonaDmRepository
    @Inject
    constructor(
        private val api: PersonaDmApi,
    ) {
        suspend fun threads(personaId: String): NetworkResult<PersonaThreadsResponse> = safeApiCall { api.threads(personaId) }

        suspend fun thread(
            personaId: String,
            threadId: String,
        ): NetworkResult<PersonaDmThreadDetailResponse> = safeApiCall { api.thread(personaId, threadId) }

        /** Opens a NEW thread — burns one message-thread credit. */
        suspend fun openThread(
            personaId: String,
            body: String,
        ): NetworkResult<PersonaDmOpenThreadResponse> = safeApiCall { api.openThread(personaId, PersonaDmMessageBody(body)) }

        /** Appends to an existing thread — no quota consumed. */
        suspend fun sendMessage(
            personaId: String,
            threadId: String,
            body: String,
        ): NetworkResult<PersonaDmSendMessageResponse> =
            safeApiCall {
                api.sendMessage(personaId, threadId, PersonaDmMessageBody(body))
            }
    }
