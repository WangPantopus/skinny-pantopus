@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.data.support_trains

import app.pantopus.android.data.api.models.support_trains.AddSupportTrainOrganizerBody
import app.pantopus.android.data.api.models.support_trains.AddSupportTrainSlotBody
import app.pantopus.android.data.api.models.support_trains.CancelReservationBody
import app.pantopus.android.data.api.models.support_trains.CreateSupportTrainBody
import app.pantopus.android.data.api.models.support_trains.CreateSupportTrainResponse
import app.pantopus.android.data.api.models.support_trains.EnableSupportTrainFundBody
import app.pantopus.android.data.api.models.support_trains.ReserveSlotBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainFundDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainNudgeBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainOrganizersResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationsResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainUpdateBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainsListResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainsNearbyResponse
import app.pantopus.android.data.api.models.support_trains.UpdateSupportTrainSlotBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.SupportTrainActionsApi
import app.pantopus.android.data.api.services.SupportTrainsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps `api/activities/support-trains/…` calls in the [NetworkResult]
 * taxonomy. Reads come from [SupportTrainsApi]; the S1 write half
 * (reserve / cancel / reveal / deliver / confirm + organizer management)
 * comes from [SupportTrainActionsApi].
 */
@Singleton
class SupportTrainsRepository
    @Inject
    constructor(
        private val api: SupportTrainsApi,
        private val actionsApi: SupportTrainActionsApi,
    ) {
        /**
         * `GET /api/support-trains/me/support-trains` — list trains
         * I participate in (organizer or helper). Route
         * `backend/routes/supportTrains.js:445`.
         */
        suspend fun mine(
            role: String? = null,
            status: String? = null,
            limit: Int = 20,
            offset: Int = 0,
        ): NetworkResult<SupportTrainsListResponse> =
            safeApiCall {
                api.mine(role = role, status = status, limit = limit, offset = offset)
            }

        /**
         * `GET /api/support-trains/nearby` — nearby feed.
         * Route `backend/routes/supportTrains.js:570`.
         */
        suspend fun nearby(
            latitude: Double,
            longitude: Double,
            radiusMeters: Double? = null,
            limit: Int = 40,
        ): NetworkResult<SupportTrainsNearbyResponse> =
            safeApiCall {
                api.nearby(latitude = latitude, longitude = longitude, radiusMeters = radiusMeters, limit = limit)
            }

        /**
         * `GET /api/support-trains/:id/reservations` — organizer-only
         * reservations feed. Route
         * `backend/routes/supportTrains.js:3306`.
         */
        suspend fun reservations(supportTrainId: String): NetworkResult<SupportTrainReservationsResponse> =
            safeApiCall { api.reservations(supportTrainId) }

        /**
         * `POST /api/support-trains/` — create draft. Route
         * `backend/routes/supportTrains.js:639`. P2.6.
         */
        suspend fun create(body: CreateSupportTrainBody): NetworkResult<CreateSupportTrainResponse> = safeApiCall { api.create(body) }

        /**
         * `POST /api/support-trains/:id/slots` — append one custom slot.
         * Route `backend/routes/supportTrains.js:921`. P2.6.
         */
        suspend fun addSlot(
            supportTrainId: String,
            body: AddSupportTrainSlotBody,
        ): NetworkResult<Unit> =
            safeApiCall {
                api.addSlot(supportTrainId, body).close()
            }

        /**
         * `POST /api/support-trains/:id/publish` — publish a draft.
         * Route `backend/routes/supportTrains.js:1236`. P2.6.
         */
        suspend fun publish(supportTrainId: String): NetworkResult<Unit> =
            safeApiCall {
                api.publish(supportTrainId).close()
            }

        /**
         * `GET /api/support-trains/:id` — participant-facing detail (A10.9
         * Detail / A13.13 Manage). Route
         * `backend/routes/supportTrains.js:3444`.
         */
        suspend fun detail(supportTrainId: String): NetworkResult<SupportTrainDetailDto> = safeApiCall { api.detail(supportTrainId) }

        /**
         * `POST /api/support-trains/:id/updates` — broadcast an update.
         * Route `backend/routes/supportTrains.js:1581`.
         */
        suspend fun postUpdate(
            supportTrainId: String,
            body: SupportTrainUpdateBody,
        ): NetworkResult<Unit> =
            safeApiCall {
                api.postUpdate(supportTrainId, body).close()
            }

        /**
         * `POST /api/support-trains/:id/complete` — mark the train
         * completed. Route `backend/routes/supportTrains.js:1508`.
         */
        suspend fun complete(supportTrainId: String): NetworkResult<Unit> =
            safeApiCall {
                api.complete(supportTrainId).close()
            }

        // ─── S1 · helper reservations ──────────────────────────────────

        /**
         * `POST /:id/slots/:slotId/reserve` — helper claims one open
         * slot. Route `backend/routes/supportTrains.js:2252`.
         */
        suspend fun reserve(
            supportTrainId: String,
            slotId: String,
            body: ReserveSlotBody,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.reserve(supportTrainId, slotId, body).close() }

        /**
         * `POST /:id/reservations/:reservationId/cancel` — helper leaves
         * or organizer reopens. Route
         * `backend/routes/supportTrains.js:2959`.
         */
        suspend fun cancelReservation(
            supportTrainId: String,
            reservationId: String,
            body: CancelReservationBody,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.cancelReservation(supportTrainId, reservationId, body).close() }

        /**
         * `POST /:id/reservations/:reservationId/reveal-address` —
         * organizer shares the exact address. Route
         * `backend/routes/supportTrains.js:2757`.
         */
        suspend fun revealAddress(
            supportTrainId: String,
            reservationId: String,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.revealAddress(supportTrainId, reservationId).close() }

        /**
         * `POST /:id/reservations/:reservationId/deliver`. Route
         * `backend/routes/supportTrains.js:3133`.
         */
        suspend fun markDelivered(
            supportTrainId: String,
            reservationId: String,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.markDelivered(supportTrainId, reservationId).close() }

        /**
         * `POST /:id/reservations/:reservationId/confirm`. Route
         * `backend/routes/supportTrains.js:3214`.
         */
        suspend fun confirmDelivery(
            supportTrainId: String,
            reservationId: String,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.confirmDelivery(supportTrainId, reservationId).close() }

        // ─── S1 · organizer management ─────────────────────────────────

        /** `POST /:id/pause`. Route `backend/routes/supportTrains.js:1440`. */
        suspend fun pause(supportTrainId: String): NetworkResult<Unit> = safeApiCall { actionsApi.pause(supportTrainId).close() }

        /** `POST /:id/resume`. Route `backend/routes/supportTrains.js:1473`. */
        suspend fun resume(supportTrainId: String): NetworkResult<Unit> = safeApiCall { actionsApi.resume(supportTrainId).close() }

        /** `POST /:id/unpublish`. Route `backend/routes/supportTrains.js:1387`. */
        suspend fun unpublish(supportTrainId: String): NetworkResult<Unit> = safeApiCall { actionsApi.unpublish(supportTrainId).close() }

        /** `POST /:id/archive`. Route `backend/routes/supportTrains.js:1540`. */
        suspend fun archive(supportTrainId: String): NetworkResult<Unit> = safeApiCall { actionsApi.archive(supportTrainId).close() }

        /** `DELETE /:id`. Route `backend/routes/supportTrains.js:3886`. */
        suspend fun deleteTrain(supportTrainId: String): NetworkResult<Unit> =
            safeApiCall {
                actionsApi.deleteTrain(supportTrainId).close()
            }

        /** `GET /:id/organizers`. Route `backend/routes/supportTrains.js:1128`. */
        suspend fun organizers(supportTrainId: String): NetworkResult<SupportTrainOrganizersResponse> =
            safeApiCall { actionsApi.organizers(supportTrainId) }

        /** `POST /:id/organizers`. Route `backend/routes/supportTrains.js:1050`. */
        suspend fun addOrganizer(
            supportTrainId: String,
            body: AddSupportTrainOrganizerBody,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.addOrganizer(supportTrainId, body).close() }

        /**
         * `DELETE /:id/organizers/:userId`. Route
         * `backend/routes/supportTrains.js:1091`.
         */
        suspend fun removeOrganizer(
            supportTrainId: String,
            userId: String,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.removeOrganizer(supportTrainId, userId).close() }

        /**
         * `PATCH /:id/slots/:slotId` — edit a date, or send
         * `status = "canceled"` to remove it. Route
         * `backend/routes/supportTrains.js:971`.
         */
        suspend fun updateSlot(
            supportTrainId: String,
            slotId: String,
            body: UpdateSupportTrainSlotBody,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.updateSlot(supportTrainId, slotId, body).close() }

        /** `POST /:id/nudges/draft`. Route `backend/routes/supportTrains.js:2139`. */
        suspend fun draftNudge(supportTrainId: String): NetworkResult<String> =
            safeApiCall {
                actionsApi.draftNudge(supportTrainId).message.orEmpty()
            }

        /** `POST /:id/nudges/send`. Route `backend/routes/supportTrains.js:2196`. */
        suspend fun sendNudge(
            supportTrainId: String,
            message: String,
        ): NetworkResult<Unit> = safeApiCall { actionsApi.sendNudge(supportTrainId, SupportTrainNudgeBody(message)).close() }

        /** `GET /:id/fund`. Route `backend/routes/supportTrains.js:1938`. */
        suspend fun fund(supportTrainId: String): NetworkResult<SupportTrainFundDto> = safeApiCall { actionsApi.fund(supportTrainId) }

        /**
         * `POST /:id/fund/enable` — `goalCents` is optional and omitted
         * when null. Route `backend/routes/supportTrains.js:1691`.
         */
        suspend fun enableFund(
            supportTrainId: String,
            goalCents: Int?,
        ): NetworkResult<Unit> =
            safeApiCall {
                actionsApi.enableFund(supportTrainId, EnableSupportTrainFundBody(goalCents)).close()
            }

        /** `POST /:id/fund/disable`. Route `backend/routes/supportTrains.js:1754`. */
        suspend fun disableFund(supportTrainId: String): NetworkResult<Unit> =
            safeApiCall {
                actionsApi.disableFund(supportTrainId).close()
            }
    }
