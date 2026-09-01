package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.CreatePetRequest
import app.pantopus.android.data.api.models.homes.PetDeleteResponse
import app.pantopus.android.data.api.models.homes.PetResponse
import app.pantopus.android.data.api.models.homes.PetsResponse
import app.pantopus.android.data.api.models.homes.UpdatePetRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Home pets endpoints from `backend/routes/home.js`. Kept separate from
 * [HomesApi] so the Pets feature owns its own service surface; the two
 * are wired to the same Retrofit instance in `di/NetworkModule.kt`.
 */
interface HomePetsApi {
    /** `GET /api/homes/:id/pets` — route `backend/routes/home.js:6789`. */
    @GET("api/homes/{id}/pets")
    suspend fun list(
        @Path("id") homeId: String,
    ): PetsResponse

    /** `POST /api/homes/:id/pets` — route `backend/routes/home.js:6826`. */
    @POST("api/homes/{id}/pets")
    suspend fun create(
        @Path("id") homeId: String,
        @Body body: CreatePetRequest,
    ): PetResponse

    /** `PUT /api/homes/:id/pets/:petId` — route `backend/routes/home.js:6880`. */
    @PUT("api/homes/{id}/pets/{petId}")
    suspend fun update(
        @Path("id") homeId: String,
        @Path("petId") petId: String,
        @Body body: UpdatePetRequest,
    ): PetResponse

    /** `DELETE /api/homes/:id/pets/:petId` — route `backend/routes/home.js:6926`. */
    @DELETE("api/homes/{id}/pets/{petId}")
    suspend fun delete(
        @Path("id") homeId: String,
        @Path("petId") petId: String,
    ): PetDeleteResponse
}
