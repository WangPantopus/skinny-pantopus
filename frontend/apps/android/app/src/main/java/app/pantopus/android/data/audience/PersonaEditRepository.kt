package app.pantopus.android.data.audience

import app.pantopus.android.data.api.models.audience.PersonaCategoryPoliciesResponse
import app.pantopus.android.data.api.models.audience.PersonaWriteBody
import app.pantopus.android.data.api.models.audience.PersonaWriteResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PersonaEditApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the Beacon (persona) write routes in [NetworkResult]. */
@Singleton
class PersonaEditRepository
    @Inject
    constructor(
        private val api: PersonaEditApi,
    ) {
        /** `POST /api/personas` — create the caller's Beacon. */
        suspend fun createPersona(body: PersonaWriteBody): NetworkResult<PersonaWriteResponse> = safeApiCall { api.createPersona(body) }

        /** `PATCH /api/personas/:id` — update an owned Beacon. */
        suspend fun updatePersona(
            personaId: String,
            body: PersonaWriteBody,
        ): NetworkResult<PersonaWriteResponse> = safeApiCall { api.updatePersona(personaId, body) }

        /** `GET /api/personas/compliance/categories` — selectable categories. */
        suspend fun categoryPolicies(): NetworkResult<PersonaCategoryPoliciesResponse> = safeApiCall { api.categoryPolicies() }
    }
