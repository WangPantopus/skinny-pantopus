package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.FridgeCardResponse
import app.pantopus.android.data.api.models.place.FridgeCardsResponse
import app.pantopus.android.data.api.models.place.IssueFridgeCardRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * The Fridge Card — the 911-ready household card. Route
 * `backend/routes/fridgeCards.js` (mounted under `/api/homes`).
 * Cards are HOUSEHOLD documents: any member lists them, managers
 * revoke, issuing needs home-manage + verified occupancy.
 */
interface FridgeCardsApi {
    /**
     * Issue (verified home managers only; 10/day limiter server-side).
     * Content outside the section vocabulary is rejected with 400.
     * Route `backend/routes/fridgeCards.js:34`.
     */
    @POST("api/homes/{id}/fridge-cards")
    suspend fun issue(
        @Path("id") homeId: String,
        @Body body: IssueFridgeCardRequest,
    ): FridgeCardResponse

    /**
     * The home's cards, any member, newest first.
     * Route `backend/routes/fridgeCards.js:66`.
     */
    @GET("api/homes/{id}/fridge-cards")
    suspend fun list(
        @Path("id") homeId: String,
    ): FridgeCardsResponse

    /**
     * Pulls the card's public content immediately (health-adjacent).
     * Route `backend/routes/fridgeCards.js:83`.
     */
    @POST("api/homes/{id}/fridge-cards/{cardId}/revoke")
    suspend fun revoke(
        @Path("id") homeId: String,
        @Path("cardId") cardId: String,
    ): FridgeCardResponse
}
