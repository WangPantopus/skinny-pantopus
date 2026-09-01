package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.UpdateHomeRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeResponse
import retrofit2.http.Body
import retrofit2.http.PATCH
import retrofit2.http.Path

/**
 * Mutations owned by the per-home Settings index (A14.1). Kept out of
 * `HomesApi` so the settings surface can grow without contending on that
 * heavily-shared interface.
 */
interface HomeSettingsApi {
    /**
     * `PATCH /api/homes/:id` — route `backend/routes/home.js:3097`,
     * validated by `updateHomeSchema` (same file, line 132). The handler
     * requires the `home.edit` IAM permission and 403s otherwise.
     */
    @PATCH("api/homes/{id}")
    suspend fun updateHome(
        @Path("id") homeId: String,
        @Body body: UpdateHomeRequest,
    ): UpdateHomeResponse
}
