package app.pantopus.android.data.scheduling

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
import app.pantopus.android.data.api.models.scheduling.BuyPackageResponse
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
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.MessageTemplateResponse
import app.pantopus.android.data.api.models.scheduling.MyPackagesResponse
import app.pantopus.android.data.api.models.scheduling.NoShowReportResponse
import app.pantopus.android.data.api.models.scheduling.NotificationPrefsResponse
import app.pantopus.android.data.api.models.scheduling.NudgeRequest
import app.pantopus.android.data.api.models.scheduling.OneOffBookingView
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
import app.pantopus.android.data.api.models.scheduling.PublicBookingCreatedResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingMutationResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingPageResponse
import app.pantopus.android.data.api.models.scheduling.PublicCancelRequest
import app.pantopus.android.data.api.models.scheduling.PublicCreateBookingRequest
import app.pantopus.android.data.api.models.scheduling.PublicPollVoteRequest
import app.pantopus.android.data.api.models.scheduling.PublicRescheduleRequest
import app.pantopus.android.data.api.models.scheduling.PublicSlotsResponse
import app.pantopus.android.data.api.models.scheduling.PublicWaitlistJoinRequest
import app.pantopus.android.data.api.models.scheduling.PublicWaitlistJoinResponse
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
import app.pantopus.android.data.api.models.scheduling.UpdateNotificationPrefsRequest
import app.pantopus.android.data.api.models.scheduling.UpdatePackageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateResourceRequest
import app.pantopus.android.data.api.models.scheduling.UpdateScheduleRequest
import app.pantopus.android.data.api.models.scheduling.UpdateSlugRequest
import app.pantopus.android.data.api.models.scheduling.UpdateWorkflowRequest
import app.pantopus.android.data.api.models.scheduling.VisitResponse
import app.pantopus.android.data.api.models.scheduling.WorkflowResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.SchedulingApi
import app.pantopus.android.data.api.services.SchedulingPublicApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The single entry point every Calendarly stream calls (never the `*Api`
 * directly). Wraps [SchedulingApi] (host, authed) and [SchedulingPublicApi]
 * (public, unauth) in `safeApiCall` → [NetworkResult].
 *
 * Owner context is derived from [SchedulingOwner]: [SchedulingOwner.basePath]
 * selects the `/api/scheduling` vs `/api/homes/{homeId}/scheduling` mount, and
 * Business owner fields are sent as query params (reads + bodyless actions)
 * and injected into the create bodies that carry them.
 */
@Singleton
@Suppress("TooManyFunctions", "LongParameterList")
open class SchedulingRepository
    @Inject
    constructor(
        private val api: SchedulingApi,
        private val publicApi: SchedulingPublicApi,
    ) {
        // ─── Booking page ──────────────────────────────────────────────────

        open suspend fun getBookingPage(owner: SchedulingOwner): NetworkResult<BookingPageResponse> =
            safeApiCall { api.getBookingPage(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun updateBookingPage(
            owner: SchedulingOwner,
            body: UpdateBookingPageRequest,
        ): NetworkResult<BookingPageResponse> =
            safeApiCall {
                api.updateBookingPage(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId))
            }

        open suspend fun checkSlug(
            owner: SchedulingOwner,
            slug: String,
        ): NetworkResult<CheckSlugResponse> = safeApiCall { api.checkSlug(owner.basePath, slug, owner.ownerType, owner.ownerId) }

        open suspend fun updateSlug(
            owner: SchedulingOwner,
            slug: String,
        ): NetworkResult<BookingPageResponse> =
            safeApiCall {
                api.updateSlug(owner.basePath, UpdateSlugRequest(slug = slug, ownerType = owner.ownerType, ownerId = owner.ownerId))
            }

        open suspend fun resetSlug(owner: SchedulingOwner): NetworkResult<BookingPageResponse> =
            safeApiCall { api.resetSlug(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun disableBookingPage(owner: SchedulingOwner): NetworkResult<BookingPageResponse> =
            safeApiCall { api.disableBookingPage(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun createOneOffLink(
            owner: SchedulingOwner,
            body: OneOffLinkRequest,
        ): NetworkResult<OneOffLinkResponse> =
            safeApiCall {
                api.createOneOffLink(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId))
            }

        // ─── Event types ───────────────────────────────────────────────────

        open suspend fun getEventTypes(owner: SchedulingOwner): NetworkResult<GetEventTypesResponse> =
            safeApiCall { api.getEventTypes(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun createEventType(
            owner: SchedulingOwner,
            body: CreateEventTypeRequest,
        ): NetworkResult<EventTypeResponse> =
            safeApiCall {
                api.createEventType(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId))
            }

        open suspend fun getEventType(
            owner: SchedulingOwner,
            eventTypeId: String,
        ): NetworkResult<EventTypeDetailResponse> = safeApiCall { api.getEventType(owner.basePath, eventTypeId) }

        open suspend fun updateEventType(
            owner: SchedulingOwner,
            eventTypeId: String,
            body: UpdateEventTypeRequest,
        ): NetworkResult<EventTypeResponse> = safeApiCall { api.updateEventType(owner.basePath, eventTypeId, body) }

        open suspend fun deleteEventType(
            owner: SchedulingOwner,
            eventTypeId: String,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { api.deleteEventType(owner.basePath, eventTypeId) }

        open suspend fun setAssignees(
            owner: SchedulingOwner,
            eventTypeId: String,
            body: AssigneesRequest,
        ): NetworkResult<AssigneesResponse> = safeApiCall { api.setAssignees(owner.basePath, eventTypeId, body) }

        open suspend fun setQuestions(
            owner: SchedulingOwner,
            eventTypeId: String,
            body: QuestionsRequest,
        ): NetworkResult<QuestionsResponse> = safeApiCall { api.setQuestions(owner.basePath, eventTypeId, body) }

        open suspend fun getWaitlist(
            owner: SchedulingOwner,
            eventTypeId: String,
        ): NetworkResult<GetWaitlistResponse> = safeApiCall { api.getWaitlist(owner.basePath, eventTypeId) }

        // ─── Availability (always personal) ──────────────────────────────────

        open suspend fun getAvailability(): NetworkResult<GetAvailabilityResponse> = safeApiCall { api.getAvailability() }

        open suspend fun createSchedule(body: CreateScheduleRequest): NetworkResult<ScheduleResponse> =
            safeApiCall { api.createSchedule(body) }

        open suspend fun updateSchedule(
            scheduleId: String,
            body: UpdateScheduleRequest,
        ): NetworkResult<ScheduleResponse> = safeApiCall { api.updateSchedule(scheduleId, body) }

        open suspend fun deleteSchedule(scheduleId: String): NetworkResult<SchedulingOkResponse> =
            safeApiCall { api.deleteSchedule(scheduleId) }

        open suspend fun setRules(
            scheduleId: String,
            body: RulesRequest,
        ): NetworkResult<RulesResponse> = safeApiCall { api.setRules(scheduleId, body) }

        open suspend fun setOverrides(
            scheduleId: String,
            body: OverridesRequest,
        ): NetworkResult<OverridesResponse> = safeApiCall { api.setOverrides(scheduleId, body) }

        open suspend fun createBlock(body: CreateBlockRequest): NetworkResult<BlockResponse> = safeApiCall { api.createBlock(body) }

        open suspend fun deleteBlock(blockId: String): NetworkResult<SchedulingOkResponse> = safeApiCall { api.deleteBlock(blockId) }

        // ─── Notification preferences / connected calendars (personal) ───────

        open suspend fun getNotificationPreferences(): NetworkResult<NotificationPrefsResponse> =
            safeApiCall { api.getNotificationPreferences() }

        open suspend fun updateNotificationPreferences(body: UpdateNotificationPrefsRequest): NetworkResult<NotificationPrefsResponse> =
            safeApiCall { api.updateNotificationPreferences(body) }

        open suspend fun getConnectedCalendars(): NetworkResult<GetConnectedCalendarsResponse> = safeApiCall { api.getConnectedCalendars() }

        /** Returns 501 NOT_AVAILABLE → decode to [SchedulingError.NotAvailable501] ("coming soon"). */
        open suspend fun connectCalendar(): NetworkResult<SchedulingOkResponse> = safeApiCall { api.connectCalendar() }

        // ─── Workflows ───────────────────────────────────────────────────────

        open suspend fun getWorkflows(owner: SchedulingOwner): NetworkResult<GetWorkflowsResponse> =
            safeApiCall { api.getWorkflows(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun createWorkflow(
            owner: SchedulingOwner,
            body: CreateWorkflowRequest,
        ): NetworkResult<WorkflowResponse> =
            safeApiCall { api.createWorkflow(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId)) }

        open suspend fun updateWorkflow(
            owner: SchedulingOwner,
            workflowId: String,
            body: UpdateWorkflowRequest,
        ): NetworkResult<WorkflowResponse> = safeApiCall { api.updateWorkflow(owner.basePath, workflowId, body) }

        open suspend fun deleteWorkflow(
            owner: SchedulingOwner,
            workflowId: String,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { api.deleteWorkflow(owner.basePath, workflowId) }

        // ─── Message templates ────────────────────────────────────────────────

        open suspend fun getMessageTemplates(owner: SchedulingOwner): NetworkResult<GetMessageTemplatesResponse> =
            safeApiCall { api.getMessageTemplates(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun createMessageTemplate(
            owner: SchedulingOwner,
            body: CreateMessageTemplateRequest,
        ): NetworkResult<MessageTemplateResponse> =
            safeApiCall {
                api.createMessageTemplate(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId))
            }

        open suspend fun previewMessageTemplate(
            owner: SchedulingOwner,
            body: PreviewTemplateRequest,
        ): NetworkResult<PreviewTemplateResponse> = safeApiCall { api.previewMessageTemplate(owner.basePath, body) }

        open suspend fun updateMessageTemplate(
            owner: SchedulingOwner,
            templateId: String,
            body: UpdateMessageTemplateRequest,
        ): NetworkResult<MessageTemplateResponse> = safeApiCall { api.updateMessageTemplate(owner.basePath, templateId, body) }

        open suspend fun deleteMessageTemplate(
            owner: SchedulingOwner,
            templateId: String,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { api.deleteMessageTemplate(owner.basePath, templateId) }

        // ─── Payments status ──────────────────────────────────────────────────

        open suspend fun getPaymentsStatus(owner: SchedulingOwner): NetworkResult<PaymentStatusResponse> =
            safeApiCall { api.getPaymentsStatus(owner.basePath, owner.ownerType, owner.ownerId) }

        // ─── Bookings ─────────────────────────────────────────────────────────

        open suspend fun getBookings(
            owner: SchedulingOwner,
            status: String? = null,
            eventTypeId: String? = null,
            from: String? = null,
            to: String? = null,
            query: String? = null,
        ): NetworkResult<GetBookingsResponse> =
            safeApiCall {
                api.getBookings(owner.basePath, status, eventTypeId, from, to, query, owner.ownerType, owner.ownerId)
            }

        open suspend fun getBookingsSummary(owner: SchedulingOwner): NetworkResult<BookingSummaryResponse> =
            safeApiCall { api.getBookingsSummary(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun getBooking(
            owner: SchedulingOwner,
            bookingId: String,
        ): NetworkResult<BookingDetailResponse> = safeApiCall { api.getBooking(owner.basePath, bookingId) }

        open suspend fun getBookingAvailableSlots(
            owner: SchedulingOwner,
            bookingId: String,
            from: String,
            to: String,
            tz: String? = null,
        ): NetworkResult<AvailableSlotsResponse> = safeApiCall { api.getBookingAvailableSlots(owner.basePath, bookingId, from, to, tz) }

        open suspend fun createBooking(
            owner: SchedulingOwner,
            body: CreateBookingRequest,
        ): NetworkResult<CreateBookingResponse> =
            safeApiCall { api.createBooking(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId)) }

        open suspend fun approveBooking(
            owner: SchedulingOwner,
            bookingId: String,
        ): NetworkResult<BookingResponse> = safeApiCall { api.approveBooking(owner.basePath, bookingId, owner.ownerType, owner.ownerId) }

        open suspend fun declineBooking(
            owner: SchedulingOwner,
            bookingId: String,
            reason: String? = null,
        ): NetworkResult<BookingResponse> = safeApiCall { api.declineBooking(owner.basePath, bookingId, BookingReasonRequest(reason)) }

        open suspend fun cancelBooking(
            owner: SchedulingOwner,
            bookingId: String,
            reason: String? = null,
        ): NetworkResult<BookingResponse> = safeApiCall { api.cancelBooking(owner.basePath, bookingId, BookingReasonRequest(reason)) }

        open suspend fun rescheduleBooking(
            owner: SchedulingOwner,
            bookingId: String,
            body: HostRescheduleRequest,
        ): NetworkResult<BookingResponse> = safeApiCall { api.rescheduleBooking(owner.basePath, bookingId, body) }

        open suspend fun markNoShow(
            owner: SchedulingOwner,
            bookingId: String,
        ): NetworkResult<BookingResponse> = safeApiCall { api.markNoShow(owner.basePath, bookingId, owner.ownerType, owner.ownerId) }

        open suspend fun reassignBooking(
            owner: SchedulingOwner,
            bookingId: String,
            body: ReassignRequest,
        ): NetworkResult<BookingResponse> = safeApiCall { api.reassignBooking(owner.basePath, bookingId, body) }

        open suspend fun rsvpBooking(
            owner: SchedulingOwner,
            bookingId: String,
            status: String,
        ): NetworkResult<AttendeeResponse> = safeApiCall { api.rsvpBooking(owner.basePath, bookingId, RsvpRequest(status)) }

        open suspend fun createRecurringBookings(
            owner: SchedulingOwner,
            body: CreateRecurringRequest,
        ): NetworkResult<RecurringBookingsResponse> =
            safeApiCall {
                api.createRecurringBookings(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId))
            }

        open suspend fun nudgeBooking(
            owner: SchedulingOwner,
            bookingId: String,
            message: String? = null,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { api.nudgeBooking(owner.basePath, bookingId, NudgeRequest(message)) }

        open suspend fun proposeReschedule(
            owner: SchedulingOwner,
            bookingId: String,
            body: ProposeRescheduleRequest,
        ): NetworkResult<BookingResponse> = safeApiCall { api.proposeReschedule(owner.basePath, bookingId, body) }

        open suspend fun applyCredit(
            owner: SchedulingOwner,
            bookingId: String,
            creditId: String,
        ): NetworkResult<ApplyCreditResponse> = safeApiCall { api.applyCredit(owner.basePath, bookingId, ApplyCreditRequest(creditId)) }

        open suspend fun getNoShowInsights(
            owner: SchedulingOwner,
            days: Int? = null,
        ): NetworkResult<NoShowReportResponse> = safeApiCall { api.getNoShowInsights(owner.basePath, days, owner.ownerType, owner.ownerId) }

        open suspend fun getTeamInsights(
            owner: SchedulingOwner,
            days: Int? = null,
        ): NetworkResult<TeamPerformanceResponse> =
            safeApiCall { api.getTeamInsights(owner.basePath, days, owner.ownerType, owner.ownerId) }

        // ─── Invoices ─────────────────────────────────────────────────────────

        open suspend fun getInvoices(owner: SchedulingOwner): NetworkResult<GetInvoicesResponse> =
            safeApiCall { api.getInvoices(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun getInvoice(
            owner: SchedulingOwner,
            invoiceId: String,
        ): NetworkResult<InvoiceResponse> = safeApiCall { api.getInvoice(owner.basePath, invoiceId) }

        open suspend fun sendInvoice(
            owner: SchedulingOwner,
            invoiceId: String,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { api.sendInvoice(owner.basePath, invoiceId, owner.ownerType, owner.ownerId) }

        // ─── Packages ─────────────────────────────────────────────────────────

        open suspend fun getPackages(owner: SchedulingOwner): NetworkResult<GetPackagesResponse> =
            safeApiCall { api.getPackages(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun createPackage(
            owner: SchedulingOwner,
            body: CreatePackageRequest,
        ): NetworkResult<PackageResponse> =
            safeApiCall { api.createPackage(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId)) }

        open suspend fun updatePackage(
            owner: SchedulingOwner,
            packageId: String,
            body: UpdatePackageRequest,
        ): NetworkResult<PackageResponse> = safeApiCall { api.updatePackage(owner.basePath, packageId, body) }

        open suspend fun deletePackage(
            owner: SchedulingOwner,
            packageId: String,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { api.deletePackage(owner.basePath, packageId) }

        open suspend fun buyPackage(
            owner: SchedulingOwner,
            packageId: String,
        ): NetworkResult<BuyPackageResponse> = safeApiCall { api.buyPackage(owner.basePath, packageId) }

        open suspend fun getMyPackages(): NetworkResult<MyPackagesResponse> = safeApiCall { api.getMyPackages() }

        open suspend fun getMyBookings(): NetworkResult<GetBookingsResponse> = safeApiCall { api.getMyBookings() }

        // ─── Home coordination / business team availability ──────────────────

        open suspend fun findATime(
            home: SchedulingOwner.Home,
            memberIds: List<String>,
            from: String,
            to: String,
            mode: String? = null,
            durationMin: Int? = null,
            slotIntervalMin: Int? = null,
            timezone: String? = null,
        ): NetworkResult<FindATimeResponse> =
            safeApiCall {
                api.findATime(
                    home.basePath,
                    FindATimeRequest(
                        memberIds = memberIds,
                        from = from,
                        to = to,
                        mode = mode,
                        durationMin = durationMin,
                        slotIntervalMin = slotIntervalMin,
                        timezone = timezone,
                    ),
                )
            }

        open suspend fun whosFree(
            home: SchedulingOwner.Home,
            from: String,
            to: String,
            tz: String? = null,
        ): NetworkResult<FreeByMemberResponse> = safeApiCall { api.whosFree(home.basePath, from, to, tz) }

        open suspend fun teamAvailability(
            business: SchedulingOwner.Business,
            from: String,
            to: String,
            tz: String? = null,
        ): NetworkResult<FreeByMemberResponse> =
            safeApiCall { api.teamAvailability(business.basePath, from, to, tz, business.ownerType, business.ownerId) }

        // ─── Resources & visits (home) ────────────────────────────────────────

        open suspend fun getResources(home: SchedulingOwner.Home): NetworkResult<GetResourcesResponse> =
            safeApiCall { api.getResources(home.basePath, home.ownerType, home.ownerId) }

        open suspend fun createResource(
            home: SchedulingOwner.Home,
            body: CreateResourceRequest,
        ): NetworkResult<ResourceResponse> = safeApiCall { api.createResource(home.basePath, body) }

        open suspend fun updateResource(
            home: SchedulingOwner.Home,
            resourceId: String,
            body: UpdateResourceRequest,
        ): NetworkResult<ResourceResponse> = safeApiCall { api.updateResource(home.basePath, resourceId, body) }

        open suspend fun deleteResource(
            home: SchedulingOwner.Home,
            resourceId: String,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { api.deleteResource(home.basePath, resourceId) }

        open suspend fun bookResource(
            home: SchedulingOwner.Home,
            resourceId: String,
            body: BookResourceRequest,
        ): NetworkResult<BookResourceResponse> = safeApiCall { api.bookResource(home.basePath, resourceId, body) }

        open suspend fun createVisit(
            home: SchedulingOwner.Home,
            body: CreateVisitRequest,
        ): NetworkResult<VisitResponse> = safeApiCall { api.createVisit(home.basePath, body) }

        // ─── Polls ────────────────────────────────────────────────────────────

        open suspend fun createPoll(
            owner: SchedulingOwner,
            body: CreatePollRequest,
        ): NetworkResult<PollCreatedResponse> =
            safeApiCall { api.createPoll(owner.basePath, body.copy(ownerType = owner.ownerType, ownerId = owner.ownerId)) }

        open suspend fun getPolls(owner: SchedulingOwner): NetworkResult<GetPollsResponse> =
            safeApiCall { api.getPolls(owner.basePath, owner.ownerType, owner.ownerId) }

        open suspend fun getPoll(
            owner: SchedulingOwner,
            pollId: String,
        ): NetworkResult<PollDetailResponse> = safeApiCall { api.getPoll(owner.basePath, pollId) }

        open suspend fun finalizePoll(
            owner: SchedulingOwner,
            pollId: String,
            optionId: String,
        ): NetworkResult<FinalizePollResponse> = safeApiCall { api.finalizePoll(owner.basePath, pollId, FinalizePollRequest(optionId)) }

        // ─── Waitlist ─────────────────────────────────────────────────────────

        open suspend fun promoteWaitlist(
            owner: SchedulingOwner,
            waitlistId: String,
        ): NetworkResult<SchedulingOkResponse> =
            safeApiCall { api.promoteWaitlist(owner.basePath, waitlistId, owner.ownerType, owner.ownerId) }

        // ─── Public invitee flow (unauthenticated) ───────────────────────────

        open suspend fun publicGetPage(slug: String): NetworkResult<PublicBookingPageResponse> =
            safeApiCall { publicApi.getBookingPage(slug) }

        open suspend fun publicGetSlots(
            slug: String,
            eventTypeSlug: String,
            from: String,
            to: String,
            tz: String? = null,
        ): NetworkResult<PublicSlotsResponse> = safeApiCall { publicApi.getSlots(slug, eventTypeSlug, from, to, tz) }

        open suspend fun publicCreateBooking(
            slug: String,
            eventTypeSlug: String,
            body: PublicCreateBookingRequest,
        ): NetworkResult<PublicBookingCreatedResponse> = safeApiCall { publicApi.createBooking(slug, eventTypeSlug, body) }

        open suspend fun publicJoinWaitlist(
            slug: String,
            eventTypeSlug: String,
            body: PublicWaitlistJoinRequest,
        ): NetworkResult<PublicWaitlistJoinResponse> = safeApiCall { publicApi.joinWaitlist(slug, eventTypeSlug, body) }

        open suspend fun publicGetOneOff(
            token: String,
            tz: String? = null,
            from: String? = null,
            to: String? = null,
        ): NetworkResult<OneOffBookingView> = safeApiCall { publicApi.getOneOff(token, tz, from, to) }

        open suspend fun publicCreateOneOffBooking(
            token: String,
            body: PublicCreateBookingRequest,
        ): NetworkResult<PublicBookingCreatedResponse> = safeApiCall { publicApi.createOneOffBooking(token, body) }

        open suspend fun publicGetManageBooking(token: String): NetworkResult<ManageBookingResponse> =
            safeApiCall { publicApi.getManageBooking(token) }

        open suspend fun publicGetManageSlots(
            token: String,
            from: String? = null,
            to: String? = null,
            tz: String? = null,
        ): NetworkResult<AvailableSlotsResponse> = safeApiCall { publicApi.getManageAvailableSlots(token, from, to, tz) }

        /**
         * Fetch the booking's .ics and decode it to text. The `@Streaming` body is
         * consumed (and closed) on IO here so callers never touch the raw socket
         * on the main thread — `ResponseBody.string()` is a blocking read.
         */
        open suspend fun publicGetIcs(token: String): NetworkResult<String> =
            safeApiCall {
                withContext(Dispatchers.IO) {
                    publicApi.getIcs(token).use { it.string() }
                }
            }

        open suspend fun publicReschedule(
            token: String,
            startAt: String,
        ): NetworkResult<PublicBookingMutationResponse> = safeApiCall { publicApi.reschedule(token, PublicRescheduleRequest(startAt)) }

        open suspend fun publicCancel(
            token: String,
            reason: String? = null,
        ): NetworkResult<PublicBookingMutationResponse> = safeApiCall { publicApi.cancel(token, PublicCancelRequest(reason)) }

        open suspend fun publicUnsubscribe(token: String): NetworkResult<SchedulingOkResponse> =
            safeApiCall { publicApi.unsubscribe(token) }

        open suspend fun publicAcceptReschedule(token: String): NetworkResult<PublicBookingMutationResponse> =
            safeApiCall { publicApi.acceptReschedule(token) }

        open suspend fun publicDeclineReschedule(token: String): NetworkResult<PublicBookingMutationResponse> =
            safeApiCall { publicApi.declineReschedule(token) }

        open suspend fun publicGetPoll(pollId: String): NetworkResult<PollDetailResponse> = safeApiCall { publicApi.getPoll(pollId) }

        open suspend fun publicVotePoll(
            pollId: String,
            body: PublicPollVoteRequest,
        ): NetworkResult<SchedulingOkResponse> = safeApiCall { publicApi.votePoll(pollId, body) }
    }
