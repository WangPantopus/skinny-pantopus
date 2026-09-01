@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling._shared

/**
 * The canonical Calendarly route paths, nav-arg keys, and path builders —
 * **public** so every feature stream can `onNavigate(SchedulingRoutes.x)` and
 * read nav args via `SavedStateHandle[SchedulingRoutes.ARG_*]` without touching
 * the private `ChildRoutes` in `RootTabScreen` (which references these same
 * constants when registering each `composable(...)`). A0 owns this file; the
 * paths are stable contracts the 18 streams build against.
 *
 * Screens receive `onNavigate: (String) -> Unit` (wired to
 * `navController.navigate`) + `onBack: () -> Unit`, so cross-stream links
 * compile without any stream editing another's files.
 */
object SchedulingRoutes {
    // ── Nav-arg keys ────────────────────────────────────────────────────────
    const val ARG_EVENT_TYPE_ID = "eventTypeId"
    const val ARG_SCHEDULE_ID = "scheduleId"
    const val ARG_SLUG = "slug"
    const val ARG_ONEOFF_TOKEN = "token"
    const val ARG_MANAGE_TOKEN = "manageToken"
    const val ARG_BOOKING_ID = "bookingId"
    const val ARG_POLL_ID = "pollId"
    const val ARG_RESOURCE_ID = "resourceId"
    const val ARG_VISIT_ID = "visitId"
    const val ARG_MEMBER_ID = "memberId"
    const val ARG_PACKAGE_ID = "packageId"
    const val ARG_WORKFLOW_ID = "workflowId"
    const val ARG_TEMPLATE_ID = "templateId"
    const val ARG_INVOICE_ID = "invoiceId"

    /**
     * Owner context carried as optional query args. Screens that read or MUTATE
     * owner-scoped data must take the owner explicitly rather than defaulting to Personal:
     * Scheduling Settings hosts a danger zone that resets the booking link, and defaulting
     * there silently destroys the user's *personal* page while the hub is on Business.
     * Query args (not a relay) so the owner survives process death and deep links.
     */
    const val ARG_OWNER_KIND = "ownerKind"
    const val ARG_OWNER_ID = "ownerId"

    /** Home context carried as an optional query arg (F8/F9-F14 home surfaces). */
    const val ARG_HOME_ID = "homeId"

    /** Onboarding flow discriminator (`home` | `business`) — see [onboarding]. */
    const val ARG_FLOW = "flow"

    const val OWNER_KIND_PERSONAL = "personal"
    const val OWNER_KIND_BUSINESS = "business"
    const val OWNER_KIND_HOME = "home"

    const val FLOW_HOME = "home"
    const val FLOW_BUSINESS = "business"

    /** Route-template suffix declaring the optional owner query args. */
    private const val OWNER_ARGS = "$ARG_OWNER_KIND={$ARG_OWNER_KIND}&$ARG_OWNER_ID={$ARG_OWNER_ID}"

    /** Route-template suffix declaring the optional home-id query arg. */
    private const val HOME_ARG = "$ARG_HOME_ID={$ARG_HOME_ID}"

    /** `?ownerKind=…&ownerId=…` for a concrete owner; empty for Personal. */
    fun ownerQuery(
        ownerKind: String?,
        ownerId: String?,
    ): String =
        if (ownerKind.isNullOrBlank() || ownerKind == OWNER_KIND_PERSONAL) {
            ""
        } else {
            "?$ARG_OWNER_KIND=$ownerKind&$ARG_OWNER_ID=${ownerId.orEmpty()}"
        }

    /** `?homeId=…` when a home is known; empty otherwise. */
    fun homeQuery(homeId: String?): String = if (homeId.isNullOrBlank()) "" else "?$ARG_HOME_ID=$homeId"

    // ── A1 Setup & hub ──────────────────────────────────────────────────────
    const val HUB = "scheduling/hub"
    const val SETUP_WIZARD = "scheduling/setup"
    const val SETTINGS = "scheduling/settings?$OWNER_ARGS"

    fun settings(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/settings" + ownerQuery(ownerKind, ownerId)

    const val NOTIFICATIONS = "scheduling/settings/notifications?$OWNER_ARGS"

    /** Notification prefs persist onto the owner's BookingPage — carry the owner like Settings. */
    fun notifications(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/settings/notifications" + ownerQuery(ownerKind, ownerId)

    const val ONBOARDING = "scheduling/onboarding?$ARG_FLOW={$ARG_FLOW}&$OWNER_ARGS"

    /**
     * Home/Business onboarding — the flow arg picks which wizard renders (default
     * Home); the owner args carry the hub's resolved Home/Business owner so
     * finish-setup writes against the pillar the user launched from.
     */
    fun onboarding(
        flow: String?,
        ownerKind: String? = null,
        ownerId: String? = null,
    ): String {
        val ownerPart = ownerQuery(ownerKind, ownerId).removePrefix("?")
        val parts = listOfNotNull(flow?.takeIf { it.isNotBlank() }?.let { "$ARG_FLOW=$it" }, ownerPart.takeIf { it.isNotEmpty() })
        return "scheduling/onboarding" + if (parts.isEmpty()) "" else "?${parts.joinToString("&")}"
    }

    // ── A2 Event types ────────────────────────────────────────────────────────
    const val EVENT_TYPE_LIST = "scheduling/event-types?$OWNER_ARGS"

    /** Event-type list scoped to the caller's owner (hub pillar); Personal when absent. */
    fun eventTypeList(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/event-types" + ownerQuery(ownerKind, ownerId)

    const val EVENT_TYPE_EDITOR = "scheduling/event-types/{$ARG_EVENT_TYPE_ID}"
    const val INTAKE_QUESTIONS_EDITOR = "scheduling/event-types/{$ARG_EVENT_TYPE_ID}/questions"
    const val CONNECTED_CALENDARS = "scheduling/connected-calendars"

    fun eventTypeEditor(eventTypeId: String) = "scheduling/event-types/$eventTypeId"

    fun intakeQuestionsEditor(eventTypeId: String) = "scheduling/event-types/$eventTypeId/questions"

    // ── A3 Availability ───────────────────────────────────────────────────────
    const val AVAILABILITY_LIST = "scheduling/availability"
    const val WEEKLY_HOURS_EDITOR = "scheduling/availability/{$ARG_SCHEDULE_ID}"
    const val DATE_OVERRIDES = "scheduling/availability/{$ARG_SCHEDULE_ID}/overrides"
    const val BOOKING_LIMITS = "scheduling/availability/limits"
    const val BLOCK_OFF_TIME = "scheduling/availability/blocks"

    fun weeklyHoursEditor(scheduleId: String) = "scheduling/availability/$scheduleId"

    fun dateOverrides(scheduleId: String) = "scheduling/availability/$scheduleId/overrides"

    // ── A4 Booking page & sharing ─────────────────────────────────────────────
    const val BOOKING_PAGE_MANAGE = "scheduling/booking-page?$OWNER_ARGS"
    const val PUBLIC_PAGE_PREVIEW = "scheduling/booking-page/preview?$OWNER_ARGS"
    const val ONE_OFF_LINK_GENERATOR = "scheduling/booking-page/one-off"

    /** Booking-page manage scoped to the caller's owner; Personal when absent. */
    fun bookingPageManage(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/booking-page" + ownerQuery(ownerKind, ownerId)

    /** Owner-side public-page preview scoped to the caller's owner; Personal when absent. */
    fun publicPagePreview(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/booking-page/preview" + ownerQuery(ownerKind, ownerId)

    // ── A5 Invitee discovery (public) ─────────────────────────────────────────
    const val PUBLIC_BOOKING = "book/{$ARG_SLUG}"
    const val PUBLIC_BOOKING_ONEOFF = "book/o/{$ARG_ONEOFF_TOKEN}"

    fun publicBooking(slug: String) = "book/$slug"

    fun publicBookingOneOff(token: String) = "book/o/$token"

    // ── A6 Invitee confirm & manage (public) ──────────────────────────────────
    const val MANAGE_BOOKING = "booking/{$ARG_MANAGE_TOKEN}"

    fun manageBooking(manageToken: String) = "booking/$manageToken"

    // ── A7 Invitee edge & customer ────────────────────────────────────────────
    const val MY_BOOKINGS = "scheduling/my-bookings"
    const val OPEN_IN_APP_INTERSTITIAL = "scheduling/open-in-app"
    const val RECURRING_SETUP = "scheduling/my-bookings/recurring"

    // ── A8 Bookings inbox & core ──────────────────────────────────────────────
    const val BOOKINGS_INBOX = "scheduling/bookings"
    const val BOOKING_DETAIL = "scheduling/bookings/{$ARG_BOOKING_ID}"

    fun bookingDetail(bookingId: String) = "scheduling/bookings/$bookingId"

    // ── A9 Bookings extras ────────────────────────────────────────────────────
    const val BOOKING_SEARCH = "scheduling/bookings/search"
    const val GROUP_ROSTER = "scheduling/bookings/{$ARG_BOOKING_ID}/roster"
    const val MANUAL_BOOKING = "scheduling/bookings/manual?$OWNER_ARGS"
    const val WAITLIST = "scheduling/waitlist"
    const val POST_MEETING_FOLLOWUP = "scheduling/bookings/{$ARG_BOOKING_ID}/followup"

    fun groupRoster(bookingId: String) = "scheduling/bookings/$bookingId/roster"

    /** Manual/on-behalf booking scoped to the caller's owner (roster's booking owner); Personal when absent. */
    fun manualBooking(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/bookings/manual" + ownerQuery(ownerKind, ownerId)

    fun postMeetingFollowup(bookingId: String) = "scheduling/bookings/$bookingId/followup"

    // ── A10 Home calendar & RSVP (new routes only) ────────────────────────────
    const val HOUSEHOLD_AVAILABILITY = "scheduling/home/availability?$HOME_ARG"
    const val PERMISSION_GATED_SCHEDULER = "scheduling/home/scheduler"

    /** F8 household availability bound to the home the user navigated from. */
    fun householdAvailability(homeId: String?) = "scheduling/home/availability" + homeQuery(homeId)

    // ── A11 Find-a-time & who's-free ──────────────────────────────────────────
    const val FIND_A_TIME = "scheduling/find-a-time"
    const val FIND_A_TIME_SLOTS = "scheduling/find-a-time/slots"
    const val MEMBER_POLL_RESPONSE = "scheduling/poll/{$ARG_POLL_ID}"
    const val WHOS_FREE = "scheduling/whos-free"

    fun memberPollResponse(pollId: String) = "scheduling/poll/$pollId"

    // ── A12 Home resources & visits ───────────────────────────────────────────
    // Every F9–F14 surface carries an explicit `homeId` (iOS parity) so multi-home
    // users act on the home they navigated from; VMs fall back to inference only
    // when the arg is absent (deep links).
    const val RESOURCE_LIST = "scheduling/resources?$HOME_ARG"
    const val RESOURCE_EDITOR = "scheduling/resources/{$ARG_RESOURCE_ID}/edit?$HOME_ARG"
    const val RESOURCE_DETAIL = "scheduling/resources/{$ARG_RESOURCE_ID}?$HOME_ARG"
    const val BOOK_RESOURCE = "scheduling/resources/{$ARG_RESOURCE_ID}/book?$HOME_ARG"
    const val VISIT_SETUP = "scheduling/visits/new?$HOME_ARG"
    const val VISIT_DETAIL = "scheduling/visits/{$ARG_VISIT_ID}?$HOME_ARG"

    fun resourceList(homeId: String?) = "scheduling/resources" + homeQuery(homeId)

    fun resourceEditor(
        resourceId: String,
        homeId: String? = null,
    ) = "scheduling/resources/$resourceId/edit" + homeQuery(homeId)

    fun resourceDetail(
        resourceId: String,
        homeId: String? = null,
    ) = "scheduling/resources/$resourceId" + homeQuery(homeId)

    fun bookResource(
        resourceId: String,
        homeId: String? = null,
    ) = "scheduling/resources/$resourceId/book" + homeQuery(homeId)

    fun visitSetup(homeId: String?) = "scheduling/visits/new" + homeQuery(homeId)

    fun visitDetail(
        visitId: String,
        homeId: String? = null,
    ) = "scheduling/visits/$visitId" + homeQuery(homeId)

    // ── A13 Business config & team ────────────────────────────────────────────
    const val BUSINESS_SCHEDULING_SETTINGS = "scheduling/business"
    const val TEAM_BOOKING_AVAILABILITY = "scheduling/business/team-availability"
    const val COLLECTIVE_EVENT_SETUP = "scheduling/business/collective/{$ARG_EVENT_TYPE_ID}"
    const val MEMBER_WORKING_HOURS = "scheduling/business/members/{$ARG_MEMBER_ID}/hours"

    fun collectiveEventSetup(eventTypeId: String) = "scheduling/business/collective/$eventTypeId"

    fun memberWorkingHours(memberId: String) = "scheduling/business/members/$memberId/hours"

    // ── A14 Payments & payouts ────────────────────────────────────────────────
    const val PAYMENTS_SETUP = "scheduling/payments"
    const val PAYOUTS = "scheduling/payments/payouts"
    const val CANCELLATION_REFUND_POLICY = "scheduling/payments/policy"

    // ── A15 Packages & invoices ───────────────────────────────────────────────
    const val PACKAGES_LIST = "scheduling/packages"
    const val PACKAGE_EDITOR = "scheduling/packages/{$ARG_PACKAGE_ID}/edit"
    const val BUY_PACKAGE = "scheduling/packages/{$ARG_PACKAGE_ID}/buy"
    const val MY_PACKAGES = "scheduling/my-packages"
    const val INVOICES_LIST = "scheduling/invoices"
    const val INVOICE_DETAIL = "scheduling/invoices/{$ARG_INVOICE_ID}"

    fun packageEditor(packageId: String) = "scheduling/packages/$packageId/edit"

    fun buyPackage(packageId: String) = "scheduling/packages/$packageId/buy"

    fun invoiceDetail(invoiceId: String) = "scheduling/invoices/$invoiceId"

    // ── A16 Reminders / workflows / templates ─────────────────────────────────
    // Owner-scoped (iOS parity: `.defaultReminders(owner:)` / `.workflowsList(owner:)`
    // / `.messageTemplateLibrary(owner:)`): reminders persist onto the owner's
    // BookingPage and workflows/templates mutate the owner's rows, so defaulting to
    // Personal from a Business/Home settings root corrupts the personal owner's data.
    const val REMINDERS_QUICK_SETUP = "scheduling/reminders?$OWNER_ARGS"
    const val WORKFLOWS_LIST = "scheduling/workflows?$OWNER_ARGS"
    const val WORKFLOW_EDITOR = "scheduling/workflows/{$ARG_WORKFLOW_ID}?$OWNER_ARGS"
    const val MESSAGE_TEMPLATE_EDITOR = "scheduling/templates/{$ARG_TEMPLATE_ID}?$OWNER_ARGS"
    const val TEMPLATE_LIBRARY = "scheduling/templates?$OWNER_ARGS"

    fun remindersQuickSetup(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/reminders" + ownerQuery(ownerKind, ownerId)

    fun workflowsList(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/workflows" + ownerQuery(ownerKind, ownerId)

    fun templateLibrary(
        ownerKind: String?,
        ownerId: String?,
    ) = "scheduling/templates" + ownerQuery(ownerKind, ownerId)

    fun workflowEditor(
        workflowId: String,
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = "scheduling/workflows/$workflowId" + ownerQuery(ownerKind, ownerId)

    fun messageTemplateEditor(
        templateId: String,
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = "scheduling/templates/$templateId" + ownerQuery(ownerKind, ownerId)

    // ── A17 Insights & reports ────────────────────────────────────────────────
    const val INSIGHTS_DASHBOARD = "scheduling/insights"
    const val EVENT_TYPE_PERFORMANCE = "scheduling/insights/event-types"
    const val NO_SHOW_REPORT = "scheduling/insights/no-shows"
    const val TEAM_PERFORMANCE = "scheduling/insights/team"

    // ── A18 Cross-cutting & polish ────────────────────────────────────────────
    const val NOTIFICATION_PERMISSION_PROMPT = "scheduling/notifications-permission"
}
