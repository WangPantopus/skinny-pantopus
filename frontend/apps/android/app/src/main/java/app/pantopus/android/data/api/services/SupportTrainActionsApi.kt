@file:Suppress("TooManyFunctions")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.support_trains.AddSupportTrainOrganizerBody
import app.pantopus.android.data.api.models.support_trains.CancelReservationBody
import app.pantopus.android.data.api.models.support_trains.EnableSupportTrainFundBody
import app.pantopus.android.data.api.models.support_trains.ReserveSlotBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainFundDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainNudgeBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainNudgeDraftResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainOrganizersResponse
import app.pantopus.android.data.api.models.support_trains.UpdateSupportTrainSlotBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * The *write* half of the Support Trains surface: helper reservations
 * (reserve / cancel / deliver / confirm), the organizer address share,
 * and the organizer management actions (lifecycle, co-organizers,
 * slots, nudges, gift fund).
 *
 * Every route was read out of `backend/routes/supportTrains.js` and
 * composed against the mount in `backend/app.js:404`
 * (`app.use('/api/activities/support-trains', supportTrainRoutes)`).
 * Reads live in [SupportTrainsApi].
 */
interface SupportTrainActionsApi {
    /**
     * `POST /:id/slots/:slotId/reserve` — reserve one open slot as a
     * helper. Body validated by `reserveSchema`; `contribution_mode`
     * must be `cook` / `takeout` / `groceries` and the matching
     * `enable_[*]` flag must be on. Route
     * `backend/routes/supportTrains.js:2252`.
     */
    @POST("api/activities/support-trains/{id}/slots/{slotId}/reserve")
    suspend fun reserve(
        @Path("id") supportTrainId: String,
        @Path("slotId") slotId: String,
        @Body body: ReserveSlotBody,
    ): ResponseBody

    /**
     * `POST /:id/reservations/:reservationId/cancel` — the helper leaves
     * their own slot (`helper_reason`) or an organizer reopens it
     * (`organizer_reason`). Route
     * `backend/routes/supportTrains.js:2959`.
     */
    @POST("api/activities/support-trains/{id}/reservations/{reservationId}/cancel")
    suspend fun cancelReservation(
        @Path("id") supportTrainId: String,
        @Path("reservationId") reservationId: String,
        @Body body: CancelReservationBody,
    ): ResponseBody

    /**
     * `POST /:id/reservations/:reservationId/reveal-address` — share the
     * exact address with one helper (or email a guest signup).
     * **Organizer-only**; the handler 403s otherwise. Route
     * `backend/routes/supportTrains.js:2757`.
     */
    @POST("api/activities/support-trains/{id}/reservations/{reservationId}/reveal-address")
    suspend fun revealAddress(
        @Path("id") supportTrainId: String,
        @Path("reservationId") reservationId: String,
    ): ResponseBody

    /**
     * `POST /:id/reservations/:reservationId/deliver` — helper (or an
     * organizer for guest signups) marks the contribution delivered.
     * Valid only from `reserved`. Route
     * `backend/routes/supportTrains.js:3133`.
     */
    @POST("api/activities/support-trains/{id}/reservations/{reservationId}/deliver")
    suspend fun markDelivered(
        @Path("id") supportTrainId: String,
        @Path("reservationId") reservationId: String,
    ): ResponseBody

    /**
     * `POST /:id/reservations/:reservationId/confirm` — recipient or
     * organizer confirms a delivered contribution. Route
     * `backend/routes/supportTrains.js:3214`.
     */
    @POST("api/activities/support-trains/{id}/reservations/{reservationId}/confirm")
    suspend fun confirmDelivery(
        @Path("id") supportTrainId: String,
        @Path("reservationId") reservationId: String,
    ): ResponseBody

    /**
     * `POST /:id/pause` — primary or co-organizer; `published` /
     * `active` only. Route `backend/routes/supportTrains.js:1440`.
     */
    @POST("api/activities/support-trains/{id}/pause")
    suspend fun pause(
        @Path("id") supportTrainId: String,
    ): ResponseBody

    /**
     * `POST /:id/resume` — primary or co-organizer; `paused` only.
     * Route `backend/routes/supportTrains.js:1473`.
     */
    @POST("api/activities/support-trains/{id}/resume")
    suspend fun resume(
        @Path("id") supportTrainId: String,
    ): ResponseBody

    /**
     * `POST /:id/unpublish` — **primary only**, and only while there are
     * no active reservations (409 otherwise). Route
     * `backend/routes/supportTrains.js:1387`.
     */
    @POST("api/activities/support-trains/{id}/unpublish")
    suspend fun unpublish(
        @Path("id") supportTrainId: String,
    ): ResponseBody

    /**
     * `POST /:id/archive` — **primary only**, `completed` → `archived`.
     * Route `backend/routes/supportTrains.js:1540`.
     */
    @POST("api/activities/support-trains/{id}/archive")
    suspend fun archive(
        @Path("id") supportTrainId: String,
    ): ResponseBody

    /**
     * `DELETE /:id` — **primary only**; 409s once helpers have committed
     * or gift-fund contributions exist. Route
     * `backend/routes/supportTrains.js:3886`.
     */
    @DELETE("api/activities/support-trains/{id}")
    suspend fun deleteTrain(
        @Path("id") supportTrainId: String,
    ): ResponseBody

    /**
     * `GET /:id/organizers` — roster for any viewer. Route
     * `backend/routes/supportTrains.js:1128`.
     */
    @GET("api/activities/support-trains/{id}/organizers")
    suspend fun organizers(
        @Path("id") supportTrainId: String,
    ): SupportTrainOrganizersResponse

    /**
     * `POST /:id/organizers` — add a co-organizer / recipient delegate.
     * **Primary only.** Route `backend/routes/supportTrains.js:1050`.
     */
    @POST("api/activities/support-trains/{id}/organizers")
    suspend fun addOrganizer(
        @Path("id") supportTrainId: String,
        @Body body: AddSupportTrainOrganizerBody,
    ): ResponseBody

    /**
     * `DELETE /:id/organizers/:userId` — **primary only**; the primary
     * organizer can't be removed (409). Responds 204. Route
     * `backend/routes/supportTrains.js:1091`.
     */
    @DELETE("api/activities/support-trains/{id}/organizers/{userId}")
    suspend fun removeOrganizer(
        @Path("id") supportTrainId: String,
        @Path("userId") userId: String,
    ): ResponseBody

    /**
     * `PATCH /:id/slots/:slotId` — label / mode / date / times /
     * capacity, or `status = "canceled"` to drop the date. Primary or
     * co-organizer; 409 `SLOT_HAS_RESERVATIONS` when taken. Route
     * `backend/routes/supportTrains.js:971`.
     */
    @PATCH("api/activities/support-trains/{id}/slots/{slotId}")
    suspend fun updateSlot(
        @Path("id") supportTrainId: String,
        @Path("slotId") slotId: String,
        @Body body: UpdateSupportTrainSlotBody,
    ): ResponseBody

    /**
     * `POST /:id/nudges/draft` — AI-drafted open-slots reminder.
     * Primary or co-organizer. Route
     * `backend/routes/supportTrains.js:2139`.
     */
    @POST("api/activities/support-trains/{id}/nudges/draft")
    suspend fun draftNudge(
        @Path("id") supportTrainId: String,
    ): SupportTrainNudgeDraftResponse

    /**
     * `POST /:id/nudges/send` — post the reminder to the campaign chat.
     * Primary or co-organizer; 422 `NO_CHAT_THREAD` before publish.
     * Route `backend/routes/supportTrains.js:2196`.
     */
    @POST("api/activities/support-trains/{id}/nudges/send")
    suspend fun sendNudge(
        @Path("id") supportTrainId: String,
        @Body body: SupportTrainNudgeBody,
    ): ResponseBody

    /**
     * `GET /:id/fund` — fund summary for any viewer; amounts in cents.
     * Route `backend/routes/supportTrains.js:1938`.
     */
    @GET("api/activities/support-trains/{id}/fund")
    suspend fun fund(
        @Path("id") supportTrainId: String,
    ): SupportTrainFundDto

    /**
     * `POST /:id/fund/enable` — enable / re-goal the gift fund. Primary
     * or co-organizer; `goal_amount` in cents. Route
     * `backend/routes/supportTrains.js:1691`.
     */
    @POST("api/activities/support-trains/{id}/fund/enable")
    suspend fun enableFund(
        @Path("id") supportTrainId: String,
        @Body body: EnableSupportTrainFundBody,
    ): ResponseBody

    /**
     * `POST /:id/fund/disable` — **primary only**. Route
     * `backend/routes/supportTrains.js:1754`.
     */
    @POST("api/activities/support-trains/{id}/fund/disable")
    suspend fun disableFund(
        @Path("id") supportTrainId: String,
    ): ResponseBody
}
