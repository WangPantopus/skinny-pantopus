package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.AckResponse
import app.pantopus.android.data.api.models.mailbox.EarningsHistoryResponse
import app.pantopus.android.data.api.models.mailbox.EarningsSummaryResponse
import app.pantopus.android.data.api.models.mailbox.MailDetailResponse
import app.pantopus.android.data.api.models.mailbox.MailboxListResponse
import app.pantopus.android.data.api.models.mailbox.v2.CancelVacationRequest
import app.pantopus.android.data.api.models.mailbox.v2.CancelVacationResponse
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpRequest
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpResponse
import app.pantopus.android.data.api.models.mailbox.v2.CreateMapPinRequest
import app.pantopus.android.data.api.models.mailbox.v2.CreateMapPinResponse
import app.pantopus.android.data.api.models.mailbox.v2.DeleteMapPinResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerItemsResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerListResponse
import app.pantopus.android.data.api.models.mailbox.v2.EarnBalanceResponse
import app.pantopus.android.data.api.models.mailbox.v2.LogEventRequest
import app.pantopus.android.data.api.models.mailbox.v2.LogEventResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailboxItemActionRequest
import app.pantopus.android.data.api.models.mailbox.v2.MailboxItemActionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2ItemResponse
import app.pantopus.android.data.api.models.mailbox.v2.MapPinDetailResponse
import app.pantopus.android.data.api.models.mailbox.v2.MapPinsResponse
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskResponse
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskUpdateRequest
import app.pantopus.android.data.api.models.mailbox.v2.P3TasksResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageDetailResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageStatusUpdateRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageStatusUpdateResponse
import app.pantopus.android.data.api.models.mailbox.v2.PendingResponse
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingRequest
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingResponse
import app.pantopus.android.data.api.models.mailbox.v2.RouteMailRequest
import app.pantopus.android.data.api.models.mailbox.v2.RouteMailResponse
import app.pantopus.android.data.api.models.mailbox.v2.StartVacationRequest
import app.pantopus.android.data.api.models.mailbox.v2.StartVacationResponse
import app.pantopus.android.data.api.models.mailbox.v2.TranslateMailRequest
import app.pantopus.android.data.api.models.mailbox.v2.TranslationResult
import app.pantopus.android.data.api.models.mailbox.v2.VacationStatusResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxApi
import app.pantopus.android.data.api.services.MailboxV2Api
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [MailboxApi] + [MailboxV2Api] that returns the typed
 * [NetworkResult] taxonomy.
 */
@Singleton
@Suppress("TooManyFunctions")
class MailboxRepository
    @Inject
    constructor(
        private val mailboxApi: MailboxApi,
        private val v2Api: MailboxV2Api,
    ) {
        /** `GET /api/mailbox`. */
        @Suppress("LongParameterList")
        suspend fun list(
            viewed: Boolean?,
            archived: Boolean,
            starred: Boolean?,
            limit: Int,
            offset: Int,
        ): NetworkResult<MailboxListResponse> =
            safeApiCall {
                mailboxApi.list(
                    viewed = viewed,
                    archived = archived,
                    starred = starred,
                    limit = limit,
                    offset = offset,
                )
            }

        /** `GET /api/mailbox/:id` — V1 detail route used by the new
         *  generic A17.1 detail screen (T6.5b / P20). */
        suspend fun detail(mailId: String): NetworkResult<MailDetailResponse> = safeApiCall { mailboxApi.detail(mailId) }

        /** `PATCH /api/mailbox/:id/ack` — used by the generic A17.1
         *  detail screen's primary Acknowledge action. */
        suspend fun acknowledge(mailId: String): NetworkResult<AckResponse> = safeApiCall { mailboxApi.acknowledge(mailId) }

        /** `GET /api/mailbox/v2/drawers`. */
        suspend fun drawers(): NetworkResult<DrawerListResponse> = safeApiCall { v2Api.drawers() }

        /** `GET /api/mailbox/v2/drawer/:drawer?tab=…` — the (drawer, tab)
         *  mail window backing the B.1 Mailbox root. */
        suspend fun drawer(
            drawer: String,
            tab: String,
            limit: Int,
            offset: Int,
        ): NetworkResult<DrawerItemsResponse> = safeApiCall { v2Api.drawer(drawer = drawer, tab = tab, limit = limit, offset = offset) }

        /** `GET /api/mailbox/v2/item/:id`. */
        suspend fun item(mailId: String): NetworkResult<MailboxV2ItemResponse> = safeApiCall { v2Api.item(mailId) }

        /** `GET /api/mailbox/v2/package/:mailId`. */
        suspend fun packageDetail(mailId: String): NetworkResult<PackageDetailResponse> = safeApiCall { v2Api.packageDetail(mailId) }

        /** `POST /api/mailbox/v2/item/:id/action`. */
        suspend fun itemAction(
            mailId: String,
            action: String,
        ): NetworkResult<MailboxItemActionResponse> = safeApiCall { v2Api.itemAction(mailId, MailboxItemActionRequest(action)) }

        /** `PATCH /api/mailbox/v2/package/:mailId/status`. */
        suspend fun packageStatusUpdate(
            mailId: String,
            status: String,
        ): NetworkResult<PackageStatusUpdateResponse> =
            safeApiCall { v2Api.packageStatusUpdate(mailId, PackageStatusUpdateRequest(status = status)) }

        /** `POST /api/mailbox/v2/resolve`. */
        suspend fun resolve(request: ResolveRoutingRequest): NetworkResult<ResolveRoutingResponse> = safeApiCall { v2Api.resolve(request) }

        /** `POST /api/mailbox/v2/community/rsvp` — T6.5d community RSVP. */
        suspend fun communityRsvp(communityItemId: String): NetworkResult<CommunityRsvpResponse> =
            safeApiCall { v2Api.communityRsvp(CommunityRsvpRequest(communityItemId = communityItemId)) }

        /** `POST /api/mailbox/v2/p3/translate` — B2.3 (A17.13) translate /
         *  confirm-translation write for the Translation screen. */
        suspend fun translate(
            mailId: String,
            targetLang: String = "en",
        ): NetworkResult<TranslationResult> =
            safeApiCall { v2Api.translate(TranslateMailRequest(mailId = mailId, targetLang = targetLang)) }

        /** `GET /api/mailbox/v2/pending` — A11 mail-day triage list. */
        suspend fun pending(): NetworkResult<PendingResponse> = safeApiCall { v2Api.pending() }

        /** `POST /api/mailbox/v2/route` — ingest/route a new mail item. */
        suspend fun route(mailId: String): NetworkResult<RouteMailResponse> = safeApiCall { v2Api.route(RouteMailRequest(mailId = mailId)) }

        /** `POST /api/mailbox/v2/event` — client-side telemetry (e.g. mail-day finished). */
        suspend fun logEvent(
            eventType: String,
            mailId: String? = null,
            metadata: Map<String, String>? = null,
        ): NetworkResult<LogEventResponse> =
            safeApiCall { v2Api.logEvent(LogEventRequest(eventType = eventType, mailId = mailId, metadata = metadata)) }

        /** `GET /api/mailbox/v2/p3/tasks` — mail-linked tasks (active / completed). */
        suspend fun p3Tasks(homeId: String? = null): NetworkResult<P3TasksResponse> = safeApiCall { v2Api.p3Tasks(homeId) }

        /** `GET /api/mailbox/earnings/summary` — Earn dashboard balance. */
        suspend fun earningsSummary(): NetworkResult<EarningsSummaryResponse> = safeApiCall { mailboxApi.earningsSummary() }

        /** `GET /api/mailbox/earnings/history` — Earn dashboard recent earnings. */
        suspend fun earningsHistory(
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<EarningsHistoryResponse> = safeApiCall { mailboxApi.earningsHistory(limit, offset) }

        /** `PATCH /api/mailbox/v2/p3/tasks/:id` — partial task update. */
        suspend fun updateP3Task(
            taskId: String,
            request: P3TaskUpdateRequest,
        ): NetworkResult<P3TaskResponse> = safeApiCall { v2Api.updateP3Task(taskId, request) }

        /** `GET /api/mailbox/v2/earn/balance` — cleared / pending payout sums. */
        suspend fun earnBalance(): NetworkResult<EarnBalanceResponse> = safeApiCall { v2Api.earnBalance() }

        /** `GET /api/mailbox/v2/p3/vacation/status` — A14.8 active / upcoming hold. */
        suspend fun vacationStatus(): NetworkResult<VacationStatusResponse> = safeApiCall { v2Api.vacationStatus() }

        /** `POST /api/mailbox/v2/p3/vacation/start` — A14.8 schedule a hold. */
        suspend fun startVacation(request: StartVacationRequest): NetworkResult<StartVacationResponse> =
            safeApiCall { v2Api.startVacation(request) }

        /** `POST /api/mailbox/v2/p3/vacation/cancel` — A14.8 end the active hold. */
        suspend fun cancelVacation(holdId: String): NetworkResult<CancelVacationResponse> =
            safeApiCall { v2Api.cancelVacation(CancelVacationRequest(holdId = holdId)) }

        /** `GET /api/mailbox/v2/p3/map/pins` — A11.4 `HomeMapPin` rows. */
        suspend fun mapPins(
            homeId: String? = null,
            type: String? = null,
        ): NetworkResult<MapPinsResponse> = safeApiCall { v2Api.mapPins(homeId = homeId, type = type) }

        /** `GET /api/mailbox/v2/p3/map/pin/:id` — A11.4 pin detail. */
        suspend fun mapPin(id: String): NetworkResult<MapPinDetailResponse> = safeApiCall { v2Api.mapPin(id) }

        /** `POST /api/mailbox/v2/p3/map/pin` — A11.4 create a pin. */
        suspend fun createMapPin(request: CreateMapPinRequest): NetworkResult<CreateMapPinResponse> =
            safeApiCall { v2Api.createMapPin(request) }

        /** `DELETE /api/mailbox/v2/p3/map/pin/:id` — A11.4 delete a pin. */
        suspend fun deleteMapPin(id: String): NetworkResult<DeleteMapPinResponse> = safeApiCall { v2Api.deleteMapPin(id) }
    }
