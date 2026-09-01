package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.scheduling.ApplyCreditRequest
import app.pantopus.android.data.api.models.scheduling.ApplyCreditResponse
import app.pantopus.android.data.api.models.scheduling.AssigneesRequest
import app.pantopus.android.data.api.models.scheduling.AssigneesResponse
import app.pantopus.android.data.api.models.scheduling.AttendeeResponse
import app.pantopus.android.data.api.models.scheduling.AvailableSlotsResponse
import app.pantopus.android.data.api.models.scheduling.BlockResponse
import app.pantopus.android.data.api.models.scheduling.BookResourceRequest
import app.pantopus.android.data.api.models.scheduling.BookResourceResponse
import app.pantopus.android.data.api.models.scheduling.BookingDetailResponse
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.BookingReasonRequest
import app.pantopus.android.data.api.models.scheduling.BookingResponse
import app.pantopus.android.data.api.models.scheduling.BookingSummaryResponse
import app.pantopus.android.data.api.models.scheduling.CheckSlugResponse
import app.pantopus.android.data.api.models.scheduling.CreateBlockRequest
import app.pantopus.android.data.api.models.scheduling.CreateBookingRequest
import app.pantopus.android.data.api.models.scheduling.CreateBookingResponse
import app.pantopus.android.data.api.models.scheduling.CreateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.CreateMessageTemplateRequest
import app.pantopus.android.data.api.models.scheduling.CreatePackageRequest
import app.pantopus.android.data.api.models.scheduling.CreatePollRequest
import app.pantopus.android.data.api.models.scheduling.CreateRecurringRequest
import app.pantopus.android.data.api.models.scheduling.CreateResourceRequest
import app.pantopus.android.data.api.models.scheduling.CreateScheduleRequest
import app.pantopus.android.data.api.models.scheduling.CreateVisitRequest
import app.pantopus.android.data.api.models.scheduling.CreateWorkflowRequest
import app.pantopus.android.data.api.models.scheduling.EventTypeDetailResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeResponse
import app.pantopus.android.data.api.models.scheduling.FinalizePollRequest
import app.pantopus.android.data.api.models.scheduling.FinalizePollResponse
import app.pantopus.android.data.api.models.scheduling.FindATimeRequest
import app.pantopus.android.data.api.models.scheduling.FindATimeResponse
import app.pantopus.android.data.api.models.scheduling.FreeByMemberResponse
import app.pantopus.android.data.api.models.scheduling.GetAvailabilityResponse
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetConnectedCalendarsResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.GetInvoicesResponse
import app.pantopus.android.data.api.models.scheduling.GetMessageTemplatesResponse
import app.pantopus.android.data.api.models.scheduling.GetPackagesResponse
import app.pantopus.android.data.api.models.scheduling.GetPollsResponse
import app.pantopus.android.data.api.models.scheduling.GetResourcesResponse
import app.pantopus.android.data.api.models.scheduling.GetWaitlistResponse
import app.pantopus.android.data.api.models.scheduling.GetWorkflowsResponse
import app.pantopus.android.data.api.models.scheduling.HostRescheduleRequest
import app.pantopus.android.data.api.models.scheduling.InvoiceResponse
import app.pantopus.android.data.api.models.scheduling.MessageTemplateResponse
import app.pantopus.android.data.api.models.scheduling.MyPackagesResponse
import app.pantopus.android.data.api.models.scheduling.NoShowReportResponse
import app.pantopus.android.data.api.models.scheduling.NotificationPrefsResponse
import app.pantopus.android.data.api.models.scheduling.NudgeRequest
import app.pantopus.android.data.api.models.scheduling.OneOffLinkRequest
import app.pantopus.android.data.api.models.scheduling.OneOffLinkResponse
import app.pantopus.android.data.api.models.scheduling.OverridesRequest
import app.pantopus.android.data.api.models.scheduling.OverridesResponse
import app.pantopus.android.data.api.models.scheduling.PackageResponse
import app.pantopus.android.data.api.models.scheduling.PaymentStatusResponse
import app.pantopus.android.data.api.models.scheduling.PollCreatedResponse
import app.pantopus.android.data.api.models.scheduling.PollDetailResponse
import app.pantopus.android.data.api.models.scheduling.PreviewTemplateRequest
import app.pantopus.android.data.api.models.scheduling.PreviewTemplateResponse
import app.pantopus.android.data.api.models.scheduling.ProposeRescheduleRequest
import app.pantopus.android.data.api.models.scheduling.QuestionsRequest
import app.pantopus.android.data.api.models.scheduling.QuestionsResponse
import app.pantopus.android.data.api.models.scheduling.ReassignRequest
import app.pantopus.android.data.api.models.scheduling.RecurringBookingsResponse
import app.pantopus.android.data.api.models.scheduling.ResourceResponse
import app.pantopus.android.data.api.models.scheduling.RsvpRequest
import app.pantopus.android.data.api.models.scheduling.RulesRequest
import app.pantopus.android.data.api.models.scheduling.RulesResponse
import app.pantopus.android.data.api.models.scheduling.ScheduleResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.models.scheduling.TeamPerformanceResponse
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.UpdateMessageTemplateRequest
import app.pantopus.android.data.api.models.scheduling.UpdatePackageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateResourceRequest
import app.pantopus.android.data.api.models.scheduling.UpdateScheduleRequest
import app.pantopus.android.data.api.models.scheduling.UpdateSlugRequest
import app.pantopus.android.data.api.models.scheduling.UpdateWorkflowRequest
import app.pantopus.android.data.api.models.scheduling.VisitResponse
import app.pantopus.android.data.api.models.scheduling.WorkflowResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The host (authenticated) Calendarly scheduling surface, covering the
 * `/api/scheduling/…` mount **and** its `/api/homes/{homeId}/scheduling/…`
 * alias. Both mounts share one router; the caller selects the base segment via
 * the [base] path param (`"scheduling"` for Personal/Business, or
 * `"homes/{homeId}/scheduling"` for Home), which `SchedulingOwner` produces.
 *
 * Owner context (Business) is sent as nullable `owner_type`/`owner_id` query
 * params (harmless on query-reading and bodyless endpoints) and, where a JSON
 * body exists, also as owner fields inside that body. Always-personal
 * endpoints (`availability*`, `notification-preferences`, `connected-calendars`,
 * `my-bookings`, `my-packages`) use the fixed `api/scheduling/...` path.
 *
 * All methods return the raw decoded body; throwables are mapped by
 * `safeApiCall` in `SchedulingRepository`. See `reference/calendarly-backend-api.md`.
 *
 * The `{base}` path param MUST be `encoded = true` so the home alias's slashes
 * pass through as path separators rather than being percent-encoded.
 */
@Suppress("TooManyFunctions", "LongParameterList")
interface SchedulingApi {
    // ─── Booking page (owner-polymorphic) ──────────────────────────────────

    /** `GET /api/scheduling/booking-page` — auto-creates if missing. */
    @GET("api/{base}/booking-page")
    suspend fun getBookingPage(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): BookingPageResponse

    /** `PUT /api/scheduling/booking-page` — partial update. */
    @PUT("api/{base}/booking-page")
    suspend fun updateBookingPage(
        @Path(value = "base", encoded = true) base: String,
        @Body body: UpdateBookingPageRequest,
    ): BookingPageResponse

    /** `GET /api/scheduling/booking-page/check-slug`. */
    @GET("api/{base}/booking-page/check-slug")
    suspend fun checkSlug(
        @Path(value = "base", encoded = true) base: String,
        @Query("slug") slug: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): CheckSlugResponse

    /** `PUT /api/scheduling/booking-page/slug`. */
    @PUT("api/{base}/booking-page/slug")
    suspend fun updateSlug(
        @Path(value = "base", encoded = true) base: String,
        @Body body: UpdateSlugRequest,
    ): BookingPageResponse

    /** `POST /api/scheduling/booking-page/reset-slug` — danger zone. */
    @POST("api/{base}/booking-page/reset-slug")
    suspend fun resetSlug(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): BookingPageResponse

    /** `POST /api/scheduling/booking-page/disable` — takes page offline. */
    @POST("api/{base}/booking-page/disable")
    suspend fun disableBookingPage(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): BookingPageResponse

    /** `POST /api/scheduling/booking-page/one-off-links` — token returned once. */
    @POST("api/{base}/booking-page/one-off-links")
    suspend fun createOneOffLink(
        @Path(value = "base", encoded = true) base: String,
        @Body body: OneOffLinkRequest,
    ): OneOffLinkResponse

    // ─── Event types (owner-polymorphic) ───────────────────────────────────

    /** `GET /api/scheduling/event-types`. */
    @GET("api/{base}/event-types")
    suspend fun getEventTypes(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetEventTypesResponse

    /** `POST /api/scheduling/event-types`. */
    @POST("api/{base}/event-types")
    suspend fun createEventType(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreateEventTypeRequest,
    ): EventTypeResponse

    /** `GET /api/scheduling/event-types/:id` — event type + assignees + questions. */
    @GET("api/{base}/event-types/{id}")
    suspend fun getEventType(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") eventTypeId: String,
    ): EventTypeDetailResponse

    /** `PUT /api/scheduling/event-types/:id` — partial update. */
    @PUT("api/{base}/event-types/{id}")
    suspend fun updateEventType(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") eventTypeId: String,
        @Body body: UpdateEventTypeRequest,
    ): EventTypeResponse

    /** `DELETE /api/scheduling/event-types/:id` — 409 `HAS_BOOKINGS` → deactivate instead. */
    @DELETE("api/{base}/event-types/{id}")
    suspend fun deleteEventType(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") eventTypeId: String,
    ): SchedulingOkResponse

    /** `PUT /api/scheduling/event-types/:id/assignees` — replace-all. */
    @PUT("api/{base}/event-types/{id}/assignees")
    suspend fun setAssignees(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") eventTypeId: String,
        @Body body: AssigneesRequest,
    ): AssigneesResponse

    /** `PUT /api/scheduling/event-types/:id/questions` — replace-all. */
    @PUT("api/{base}/event-types/{id}/questions")
    suspend fun setQuestions(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") eventTypeId: String,
        @Body body: QuestionsRequest,
    ): QuestionsResponse

    /** `GET /api/scheduling/event-types/:id/waitlist`. */
    @GET("api/{base}/event-types/{id}/waitlist")
    suspend fun getWaitlist(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") eventTypeId: String,
    ): GetWaitlistResponse

    // ─── Availability (always personal — fixed path, no owner) ──────────────

    /** `GET /api/scheduling/availability`. */
    @GET("api/scheduling/availability")
    suspend fun getAvailability(): GetAvailabilityResponse

    /** `POST /api/scheduling/availability`. */
    @POST("api/scheduling/availability")
    suspend fun createSchedule(
        @Body body: CreateScheduleRequest,
    ): ScheduleResponse

    /** `PUT /api/scheduling/availability/:id`. */
    @PUT("api/scheduling/availability/{id}")
    suspend fun updateSchedule(
        @Path("id") scheduleId: String,
        @Body body: UpdateScheduleRequest,
    ): ScheduleResponse

    /** `DELETE /api/scheduling/availability/:id` — 409 CANNOT_DELETE_DEFAULT. */
    @DELETE("api/scheduling/availability/{id}")
    suspend fun deleteSchedule(
        @Path("id") scheduleId: String,
    ): SchedulingOkResponse

    /** `PUT /api/scheduling/availability/:id/rules` — replace-all. */
    @PUT("api/scheduling/availability/{id}/rules")
    suspend fun setRules(
        @Path("id") scheduleId: String,
        @Body body: RulesRequest,
    ): RulesResponse

    /** `PUT /api/scheduling/availability/:id/overrides` — replace-all. */
    @PUT("api/scheduling/availability/{id}/overrides")
    suspend fun setOverrides(
        @Path("id") scheduleId: String,
        @Body body: OverridesRequest,
    ): OverridesResponse

    /** `POST /api/scheduling/availability/blocks`. */
    @POST("api/scheduling/availability/blocks")
    suspend fun createBlock(
        @Body body: CreateBlockRequest,
    ): BlockResponse

    /** `DELETE /api/scheduling/availability/blocks/:blockId`. */
    @DELETE("api/scheduling/availability/blocks/{blockId}")
    suspend fun deleteBlock(
        @Path("blockId") blockId: String,
    ): SchedulingOkResponse

    // ─── Notification preferences (personal) ────────────────────────────────

    /** `GET /api/scheduling/notification-preferences`. */
    @GET("api/scheduling/notification-preferences")
    suspend fun getNotificationPreferences(): NotificationPrefsResponse

    /** `PUT /api/scheduling/notification-preferences`. */
    @PUT("api/scheduling/notification-preferences")
    suspend fun updateNotificationPreferences(
        @Body body: app.pantopus.android.data.api.models.scheduling.UpdateNotificationPrefsRequest,
    ): NotificationPrefsResponse

    // ─── Connected calendars (personal; connect → 501) ─────────────────────

    /** `GET /api/scheduling/connected-calendars` — empty in v1. */
    @GET("api/scheduling/connected-calendars")
    suspend fun getConnectedCalendars(): GetConnectedCalendarsResponse

    /** `POST /api/scheduling/connected-calendars/connect` — returns 501. */
    @POST("api/scheduling/connected-calendars/connect")
    suspend fun connectCalendar(): SchedulingOkResponse

    // ─── Workflows (owner-polymorphic) ──────────────────────────────────────

    /** `GET /api/scheduling/workflows`. */
    @GET("api/{base}/workflows")
    suspend fun getWorkflows(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetWorkflowsResponse

    /** `POST /api/scheduling/workflows`. */
    @POST("api/{base}/workflows")
    suspend fun createWorkflow(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreateWorkflowRequest,
    ): WorkflowResponse

    /** `PUT /api/scheduling/workflows/:id`. */
    @PUT("api/{base}/workflows/{id}")
    suspend fun updateWorkflow(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") workflowId: String,
        @Body body: UpdateWorkflowRequest,
    ): WorkflowResponse

    /** `DELETE /api/scheduling/workflows/:id`. */
    @DELETE("api/{base}/workflows/{id}")
    suspend fun deleteWorkflow(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") workflowId: String,
    ): SchedulingOkResponse

    // ─── Message templates (owner-polymorphic) ──────────────────────────────

    /** `GET /api/scheduling/message-templates`. */
    @GET("api/{base}/message-templates")
    suspend fun getMessageTemplates(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetMessageTemplatesResponse

    /** `POST /api/scheduling/message-templates`. */
    @POST("api/{base}/message-templates")
    suspend fun createMessageTemplate(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreateMessageTemplateRequest,
    ): MessageTemplateResponse

    /** `POST /api/scheduling/message-templates/preview` — no owner gate. */
    @POST("api/{base}/message-templates/preview")
    suspend fun previewMessageTemplate(
        @Path(value = "base", encoded = true) base: String,
        @Body body: PreviewTemplateRequest,
    ): PreviewTemplateResponse

    /** `PUT /api/scheduling/message-templates/:id`. */
    @PUT("api/{base}/message-templates/{id}")
    suspend fun updateMessageTemplate(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") templateId: String,
        @Body body: UpdateMessageTemplateRequest,
    ): MessageTemplateResponse

    /** `DELETE /api/scheduling/message-templates/:id`. */
    @DELETE("api/{base}/message-templates/{id}")
    suspend fun deleteMessageTemplate(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") templateId: String,
    ): SchedulingOkResponse

    // ─── Payments status (owner-polymorphic, view) ──────────────────────────

    /** `GET /api/scheduling/payments/status`. */
    @GET("api/{base}/payments/status")
    suspend fun getPaymentsStatus(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): PaymentStatusResponse

    // ─── Bookings (owner-polymorphic) ───────────────────────────────────────

    /** `GET /api/scheduling/bookings`. */
    @GET("api/{base}/bookings")
    suspend fun getBookings(
        @Path(value = "base", encoded = true) base: String,
        @Query("status") status: String? = null,
        @Query("event_type_id") eventTypeId: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("q") query: String? = null,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetBookingsResponse

    /** `GET /api/scheduling/bookings/summary`. */
    @GET("api/{base}/bookings/summary")
    suspend fun getBookingsSummary(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): BookingSummaryResponse

    /** `GET /api/scheduling/bookings/:id`. */
    @GET("api/{base}/bookings/{id}")
    suspend fun getBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
    ): BookingDetailResponse

    /** `GET /api/scheduling/bookings/:id/available-slots` — reschedule/reassign. */
    @GET("api/{base}/bookings/{id}/available-slots")
    suspend fun getBookingAvailableSlots(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("tz") tz: String? = null,
    ): AvailableSlotsResponse

    /** `POST /api/scheduling/bookings` — manual / on-behalf create. */
    @POST("api/{base}/bookings")
    suspend fun createBooking(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreateBookingRequest,
    ): CreateBookingResponse

    /** `POST /api/scheduling/bookings/:id/approve`. */
    @POST("api/{base}/bookings/{id}/approve")
    suspend fun approveBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): BookingResponse

    /** `POST /api/scheduling/bookings/:id/decline`. */
    @POST("api/{base}/bookings/{id}/decline")
    suspend fun declineBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: BookingReasonRequest,
    ): BookingResponse

    /** `POST /api/scheduling/bookings/:id/cancel`. */
    @POST("api/{base}/bookings/{id}/cancel")
    suspend fun cancelBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: BookingReasonRequest,
    ): BookingResponse

    /** `POST /api/scheduling/bookings/:id/reschedule`. */
    @POST("api/{base}/bookings/{id}/reschedule")
    suspend fun rescheduleBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: HostRescheduleRequest,
    ): BookingResponse

    /** `POST /api/scheduling/bookings/:id/no-show`. */
    @POST("api/{base}/bookings/{id}/no-show")
    suspend fun markNoShow(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): BookingResponse

    /** `POST /api/scheduling/bookings/:id/reassign`. */
    @POST("api/{base}/bookings/{id}/reassign")
    suspend fun reassignBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: ReassignRequest,
    ): BookingResponse

    /** `POST /api/scheduling/bookings/:id/rsvp` — attendee self-service. */
    @POST("api/{base}/bookings/{id}/rsvp")
    suspend fun rsvpBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: RsvpRequest,
    ): AttendeeResponse

    /** `POST /api/scheduling/bookings/recurring`. */
    @POST("api/{base}/bookings/recurring")
    suspend fun createRecurringBookings(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreateRecurringRequest,
    ): RecurringBookingsResponse

    /** `POST /api/scheduling/bookings/:id/nudge`. */
    @POST("api/{base}/bookings/{id}/nudge")
    suspend fun nudgeBooking(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: NudgeRequest,
    ): SchedulingOkResponse

    /** `POST /api/scheduling/bookings/:id/propose-reschedule`. */
    @POST("api/{base}/bookings/{id}/propose-reschedule")
    suspend fun proposeReschedule(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: ProposeRescheduleRequest,
    ): BookingResponse

    /** `POST /api/scheduling/bookings/:id/apply-credit` — customer self-service. */
    @POST("api/{base}/bookings/{id}/apply-credit")
    suspend fun applyCredit(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") bookingId: String,
        @Body body: ApplyCreditRequest,
    ): ApplyCreditResponse

    /** `GET /api/scheduling/insights/no-shows`. */
    @GET("api/{base}/insights/no-shows")
    suspend fun getNoShowInsights(
        @Path(value = "base", encoded = true) base: String,
        @Query("days") days: Int? = null,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): NoShowReportResponse

    /** `GET /api/scheduling/insights/team` — business-only. */
    @GET("api/{base}/insights/team")
    suspend fun getTeamInsights(
        @Path(value = "base", encoded = true) base: String,
        @Query("days") days: Int? = null,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): TeamPerformanceResponse

    // ─── Invoices (business-only) ───────────────────────────────────────────

    /** `GET /api/scheduling/invoices`. */
    @GET("api/{base}/invoices")
    suspend fun getInvoices(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetInvoicesResponse

    /** `GET /api/scheduling/invoices/:id`. */
    @GET("api/{base}/invoices/{id}")
    suspend fun getInvoice(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") invoiceId: String,
    ): InvoiceResponse

    /** `POST /api/scheduling/invoices/:id/send`. */
    @POST("api/{base}/invoices/{id}/send")
    suspend fun sendInvoice(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") invoiceId: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): SchedulingOkResponse

    // ─── Packages ───────────────────────────────────────────────────────────

    /** `GET /api/scheduling/packages`. */
    @GET("api/{base}/packages")
    suspend fun getPackages(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetPackagesResponse

    /** `POST /api/scheduling/packages`. */
    @POST("api/{base}/packages")
    suspend fun createPackage(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreatePackageRequest,
    ): PackageResponse

    /** `PUT /api/scheduling/packages/:id`. */
    @PUT("api/{base}/packages/{id}")
    suspend fun updatePackage(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") packageId: String,
        @Body body: UpdatePackageRequest,
    ): PackageResponse

    /** `DELETE /api/scheduling/packages/:id` — soft-delete. */
    @DELETE("api/{base}/packages/{id}")
    suspend fun deletePackage(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") packageId: String,
    ): SchedulingOkResponse

    /** `POST /api/scheduling/packages/:id/buy` — customer; clientSecret if priced. */
    @POST("api/{base}/packages/{id}/buy")
    suspend fun buyPackage(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") packageId: String,
    ): app.pantopus.android.data.api.models.scheduling.BuyPackageResponse

    // ─── Customer self-service (personal) ───────────────────────────────────

    /** `GET /api/scheduling/my-packages`. */
    @GET("api/scheduling/my-packages")
    suspend fun getMyPackages(): MyPackagesResponse

    /** `GET /api/scheduling/my-bookings`. */
    @GET("api/scheduling/my-bookings")
    suspend fun getMyBookings(): GetBookingsResponse

    // ─── Home coordination (home-only) / business team availability ─────────

    /** `POST /api/scheduling/find-a-time` — home-only common slots (params in body). */
    @POST("api/{base}/find-a-time")
    suspend fun findATime(
        @Path(value = "base", encoded = true) base: String,
        @Body body: FindATimeRequest,
    ): FindATimeResponse

    /** `GET /api/scheduling/whos-free` — home-only per-member grids. */
    @GET("api/{base}/whos-free")
    suspend fun whosFree(
        @Path(value = "base", encoded = true) base: String,
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("tz") tz: String? = null,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): FreeByMemberResponse

    /** `GET /api/scheduling/team-availability` — business-only per-member grids. */
    @GET("api/{base}/team-availability")
    suspend fun teamAvailability(
        @Path(value = "base", encoded = true) base: String,
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("tz") tz: String? = null,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): FreeByMemberResponse

    // ─── Resources & visits (home-only) ─────────────────────────────────────

    /** `GET /api/homes/:homeId/scheduling/resources`. */
    @GET("api/{base}/resources")
    suspend fun getResources(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetResourcesResponse

    /** `POST /api/homes/:homeId/scheduling/resources`. */
    @POST("api/{base}/resources")
    suspend fun createResource(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreateResourceRequest,
    ): ResourceResponse

    /** `PUT /api/homes/:homeId/scheduling/resources/:rid`. */
    @PUT("api/{base}/resources/{rid}")
    suspend fun updateResource(
        @Path(value = "base", encoded = true) base: String,
        @Path("rid") resourceId: String,
        @Body body: UpdateResourceRequest,
    ): ResourceResponse

    /** `DELETE /api/homes/:homeId/scheduling/resources/:rid` — soft-delete. */
    @DELETE("api/{base}/resources/{rid}")
    suspend fun deleteResource(
        @Path(value = "base", encoded = true) base: String,
        @Path("rid") resourceId: String,
    ): SchedulingOkResponse

    /** `POST /api/homes/:homeId/scheduling/resources/:rid/book` — 409 RESOURCE_UNAVAILABLE. */
    @POST("api/{base}/resources/{rid}/book")
    suspend fun bookResource(
        @Path(value = "base", encoded = true) base: String,
        @Path("rid") resourceId: String,
        @Body body: BookResourceRequest,
    ): BookResourceResponse

    /** `POST /api/homes/:homeId/scheduling/visits` — 400 BAD_RANGE. */
    @POST("api/{base}/visits")
    suspend fun createVisit(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreateVisitRequest,
    ): VisitResponse

    // ─── Polls (owner-polymorphic) ──────────────────────────────────────────

    /** `POST /api/scheduling/polls`. */
    @POST("api/{base}/polls")
    suspend fun createPoll(
        @Path(value = "base", encoded = true) base: String,
        @Body body: CreatePollRequest,
    ): PollCreatedResponse

    /** `GET /api/scheduling/polls`. */
    @GET("api/{base}/polls")
    suspend fun getPolls(
        @Path(value = "base", encoded = true) base: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): GetPollsResponse

    /** `GET /api/scheduling/polls/:id`. */
    @GET("api/{base}/polls/{id}")
    suspend fun getPoll(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") pollId: String,
    ): PollDetailResponse

    /** `POST /api/scheduling/polls/:id/finalize`. */
    @POST("api/{base}/polls/{id}/finalize")
    suspend fun finalizePoll(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") pollId: String,
        @Body body: FinalizePollRequest,
    ): FinalizePollResponse

    // ─── Waitlist promote (owner-polymorphic) ───────────────────────────────

    /** `POST /api/scheduling/waitlist/:id/promote`. */
    @POST("api/{base}/waitlist/{id}/promote")
    suspend fun promoteWaitlist(
        @Path(value = "base", encoded = true) base: String,
        @Path("id") waitlistId: String,
        @Query("owner_type") ownerType: String? = null,
        @Query("owner_id") ownerId: String? = null,
    ): SchedulingOkResponse
}
