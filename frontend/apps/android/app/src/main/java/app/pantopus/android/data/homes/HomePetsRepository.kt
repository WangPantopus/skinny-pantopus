package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreatePetRequest
import app.pantopus.android.data.api.models.homes.PetDeleteResponse
import app.pantopus.android.data.api.models.homes.PetResponse
import app.pantopus.android.data.api.models.homes.PetsResponse
import app.pantopus.android.data.api.models.homes.UpdatePetRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomePetsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [HomePetsApi] returning the typed [NetworkResult]
 * taxonomy. ViewModels depend on this so they can expose a single error
 * surface to the UI.
 */
@Singleton
open class HomePetsRepository
    @Inject
    constructor(
        private val api: HomePetsApi,
    ) {
        /** `GET /api/homes/:id/pets`. */
        open suspend fun list(homeId: String): NetworkResult<PetsResponse> = safeApiCall { api.list(homeId) }

        /** `POST /api/homes/:id/pets`. */
        open suspend fun create(
            homeId: String,
            request: CreatePetRequest,
        ): NetworkResult<PetResponse> = safeApiCall { api.create(homeId, request) }

        /** `PUT /api/homes/:id/pets/:petId`. */
        open suspend fun update(
            homeId: String,
            petId: String,
            request: UpdatePetRequest,
        ): NetworkResult<PetResponse> = safeApiCall { api.update(homeId, petId, request) }

        /** `DELETE /api/homes/:id/pets/:petId`. */
        open suspend fun delete(
            homeId: String,
            petId: String,
        ): NetworkResult<PetDeleteResponse> = safeApiCall { api.delete(homeId, petId) }
    }
