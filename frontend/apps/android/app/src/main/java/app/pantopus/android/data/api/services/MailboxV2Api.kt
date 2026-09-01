package app.pantopus.android.data.api.services

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
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** V2 mailbox routes from `backend/routes/mailboxV2.js`. */
@Suppress("TooManyFunctions")
interface MailboxV2Api {
    /** `GET /api/mailbox/v2/drawers` — route `backend/routes/mailboxV2.js:214`. */
    @GET("api/mailbox/v2/drawers")
    suspend fun drawers(): DrawerListResponse

    /** `GET /api/mailbox/v2/drawer/:drawer` — route `backend/routes/mailboxV2.js:280`. */
    @GET("api/mailbox/v2/drawer/{drawer}")
    suspend fun drawer(
        @Path("drawer") drawer: String,
        @Query("tab") tab: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
        @Query("homeId") homeId: String? = null,
    ): DrawerItemsResponse

    /** `GET /api/mailbox/v2/item/:id` — route `backend/routes/mailboxV2.js:366`. */
    @GET("api/mailbox/v2/item/{id}")
    suspend fun item(
        @Path("id") id: String,
    ): MailboxV2ItemResponse

    /** `POST /api/mailbox/v2/item/:id/action` — route `backend/routes/mailboxV2.js:459`. */
    @POST("api/mailbox/v2/item/{id}/action")
    suspend fun itemAction(
        @Path("id") id: String,
        @Body body: MailboxItemActionRequest,
    ): MailboxItemActionResponse

    /** `GET /api/mailbox/v2/package/:mailId` — route `backend/routes/mailboxV2.js:634`. */
    @GET("api/mailbox/v2/package/{mailId}")
    suspend fun packageDetail(
        @Path("mailId") mailId: String,
    ): PackageDetailResponse

    /** `PATCH /api/mailbox/v2/package/:mailId/status` — route `backend/routes/mailboxV2.js:670`. */
    @PATCH("api/mailbox/v2/package/{mailId}/status")
    suspend fun packageStatusUpdate(
        @Path("mailId") mailId: String,
        @Body body: PackageStatusUpdateRequest,
    ): PackageStatusUpdateResponse

    /** `POST /api/mailbox/v2/resolve` — route `backend/routes/mailboxV2.js:555`. */
    @POST("api/mailbox/v2/resolve")
    suspend fun resolve(
        @Body body: ResolveRoutingRequest,
    ): ResolveRoutingResponse

    /**
     * `POST /api/mailbox/v2/p3/community/rsvp` — route
     * `backend/routes/mailboxV2Phase3.js:746`. Adds a `will_attend`
     * reaction to the `CommunityMailItem` and returns the updated
     * RSVP count. The backend treats RSVP as idempotent.
     *
     * The Phase-3 router is mounted at `api/mailbox/v2/p3`
     * (`backend/app.js:317`); the previously-shipped
     * `api/mailbox/v2/community/rsvp` spelling had no matching route.
     */
    @POST("api/mailbox/v2/p3/community/rsvp")
    suspend fun communityRsvp(
        @Body body: CommunityRsvpRequest,
    ): CommunityRsvpResponse

    /**
     * `POST /api/mailbox/v2/p3/translate` — route
     * `backend/routes/mailboxV2Phase3.js:1643`. Translates a mail item
     * (A17.13) and caches both versions. Doubles as the "confirm/trust"
     * write for the Translation screen until a dedicated confirm route ships.
     */
    @POST("api/mailbox/v2/p3/translate")
    suspend fun translate(
        @Body body: TranslateMailRequest,
    ): TranslationResult

    /**
     * `GET /api/mailbox/v2/pending` — route `backend/routes/mailboxV2.js:612`.
     * Unresolved `MailRoutingQueue` rows (with embedded `Mail`) backing the
     * A11 mail-day triage list. Returns all unresolved items (no paging).
     */
    @GET("api/mailbox/v2/pending")
    suspend fun pending(): PendingResponse

    /** `POST /api/mailbox/v2/route` — route `backend/routes/mailboxV2.js:488`. */
    @POST("api/mailbox/v2/route")
    suspend fun route(
        @Body body: RouteMailRequest,
    ): RouteMailResponse

    /** `POST /api/mailbox/v2/event` — route `backend/routes/mailboxV2.js:1007`. */
    @POST("api/mailbox/v2/event")
    suspend fun logEvent(
        @Body body: LogEventRequest,
    ): LogEventResponse

    /**
     * `GET /api/mailbox/v2/p3/tasks` — route
     * `backend/routes/mailboxV2Phase3.js:831`. Mail-linked `HomeTask` rows
     * split into `active` / `completed`. `homeId` is optional; omitted, the
     * backend falls back to every accessible home.
     */
    @GET("api/mailbox/v2/p3/tasks")
    suspend fun p3Tasks(
        @Query("homeId") homeId: String? = null,
    ): P3TasksResponse

    /** `GET /api/mailbox/v2/earn/balance` — route `backend/routes/mailboxV2.js:831`. */
    @GET("api/mailbox/v2/earn/balance")
    suspend fun earnBalance(): EarnBalanceResponse

    /**
     * `PATCH /api/mailbox/v2/p3/tasks/:id` — route
     * `backend/routes/mailboxV2Phase3.js:935`. Partial task update
     * (status / title / priority / dueAt).
     */
    @PATCH("api/mailbox/v2/p3/tasks/{id}")
    suspend fun updateP3Task(
        @Path("id") id: String,
        @Body body: P3TaskUpdateRequest,
    ): P3TaskResponse

    /**
     * `GET /api/mailbox/v2/p3/vacation/status` — route
     * `backend/routes/mailboxV2Phase3.js:1523`. Current scheduled / active
     * `VacationHold` (`{ active, upcoming }`).
     */
    @GET("api/mailbox/v2/p3/vacation/status")
    suspend fun vacationStatus(): VacationStatusResponse

    /**
     * `POST /api/mailbox/v2/p3/vacation/start` — route
     * `backend/routes/mailboxV2Phase3.js:1546`. Creates a hold; the backend
     * marks it `active` when the start date is past, else `scheduled`.
     */
    @POST("api/mailbox/v2/p3/vacation/start")
    suspend fun startVacation(
        @Body body: StartVacationRequest,
    ): StartVacationResponse

    /**
     * `POST /api/mailbox/v2/p3/vacation/cancel` — route
     * `backend/routes/mailboxV2Phase3.js:1601`. Ends a hold by id.
     */
    @POST("api/mailbox/v2/p3/vacation/cancel")
    suspend fun cancelVacation(
        @Body body: CancelVacationRequest,
    ): CancelVacationResponse

    /**
     * `GET /api/mailbox/v2/p3/map/pins` — route
     * `backend/routes/mailboxV2Phase3.js:431`. `HomeMapPin` rows for the
     * accessible homes (optionally scoped by `homeId` / `type` / bounds).
     */
    @Suppress("LongParameterList")
    @GET("api/mailbox/v2/p3/map/pins")
    suspend fun mapPins(
        @Query("homeId") homeId: String? = null,
        @Query("type") type: String? = null,
        @Query("north") north: Double? = null,
        @Query("south") south: Double? = null,
        @Query("east") east: Double? = null,
        @Query("west") west: Double? = null,
    ): MapPinsResponse

    /**
     * `POST /api/mailbox/v2/p3/map/pin` — route
     * `backend/routes/mailboxV2Phase3.js:472`. Creates a `HomeMapPin`.
     */
    @POST("api/mailbox/v2/p3/map/pin")
    suspend fun createMapPin(
        @Body body: CreateMapPinRequest,
    ): CreateMapPinResponse

    /**
     * `GET /api/mailbox/v2/p3/map/pin/:id` — route
     * `backend/routes/mailboxV2Phase3.js:511`. Pin detail (folds optional
     * `linked_mail`).
     */
    @GET("api/mailbox/v2/p3/map/pin/{id}")
    suspend fun mapPin(
        @Path("id") id: String,
    ): MapPinDetailResponse

    /**
     * `DELETE /api/mailbox/v2/p3/map/pin/:id` — route
     * `backend/routes/mailboxV2Phase3.js:540`. Deletes a pin (owner only).
     */
    @DELETE("api/mailbox/v2/p3/map/pin/{id}")
    suspend fun deleteMapPin(
        @Path("id") id: String,
    ): DeleteMapPinResponse
}
