//
//  SchedulingRouter.swift
//  Pantopus
//
//  Foundation (I0b) — the route → view switch. Feature streams consume this
//  read-only; they replace their own stub bodies, never this switch.
//
//  The ONE place the route -> view mapping lives. Feature streams never edit
//  this switch; they replace their own stub bodies. `ambientOwner` is the entry
//  owner (default .personal from Hub/You); routes self-carry their owner for
//  deep-nav correctness. `push` appends a deeper scheduling route.
//

import SwiftUI

/// Resolves a `SchedulingRoute` to its destination view. Called from the
/// `HubRoute.scheduling` / `YouRoute.scheduling` arms in the tab roots.
@MainActor
enum SchedulingRouter {
    // One arm per routed screen keeps the route→view mapping in a single
    // auditable place; the switch is necessarily large.
    // swiftlint:disable cyclomatic_complexity function_body_length
    @ViewBuilder
    static func destination(
        for route: SchedulingRoute,
        owner _: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) -> some View {
        switch route {
        // I1 — Setup & Hub
        case let .hub(owner):
            SchedulingHubStubView(viewModel: SchedulingHubStubViewModel(owner: owner, push: push))
        case let .firstRunWizard(owner):
            FirstRunWizardStubView(viewModel: FirstRunWizardStubViewModel(owner: owner, push: push))
        case let .settingsRoot(owner):
            SchedulingSettingsStubView(viewModel: SchedulingSettingsStubViewModel(owner: owner, push: push))
        case let .notificationPreferences(owner):
            SchedulingNotificationPrefsStubView(viewModel: SchedulingNotificationPrefsStubViewModel(owner: owner, push: push))
        case let .onboardingHomeBusiness(owner):
            SchedulingOnboardingStubView(viewModel: SchedulingOnboardingStubViewModel(owner: owner, push: push))
        // I2 — Event Types
        case let .eventTypeList(owner):
            EventTypeListStubView(viewModel: EventTypeListStubViewModel(owner: owner, push: push))
        case let .eventTypeEditor(owner, eventTypeId):
            EventTypeEditorStubView(viewModel: EventTypeEditorStubViewModel(owner: owner, eventTypeId: eventTypeId, push: push))
        case let .intakeQuestionsEditor(owner, eventTypeId):
            IntakeQuestionsEditorStubView(viewModel: IntakeQuestionsEditorStubViewModel(owner: owner, eventTypeId: eventTypeId, push: push))
        case let .connectedCalendars(owner):
            ConnectedCalendarsStubView(viewModel: ConnectedCalendarsStubViewModel(owner: owner, push: push))
        // I3 — Availability
        case .availabilityScheduleList:
            AvailabilityScheduleListStubView(viewModel: AvailabilityScheduleListStubViewModel(push: push))
        case let .weeklyHoursEditor(scheduleId):
            WeeklyHoursEditorStubView(viewModel: WeeklyHoursEditorStubViewModel(scheduleId: scheduleId, push: push))
        case let .dateOverrides(scheduleId):
            DateOverridesStubView(viewModel: DateOverridesStubViewModel(scheduleId: scheduleId, push: push))
        case let .bookingLimits(owner, eventTypeId):
            BookingLimitsStubView(viewModel: BookingLimitsStubViewModel(owner: owner, eventTypeId: eventTypeId, push: push))
        case .blockOffTime:
            BlockOffTimeStubView(viewModel: BlockOffTimeStubViewModel(push: push))
        // I4 — Booking Page & Sharing
        case let .bookingPageManagement(owner):
            BookingPageManagementStubView(viewModel: BookingPageManagementStubViewModel(owner: owner, push: push))
        case let .bookingPagePreview(owner, slug):
            BookingPagePreviewStubView(viewModel: BookingPagePreviewStubViewModel(owner: owner, slug: slug, push: push))
        case let .oneOffLinkGenerator(owner):
            OneOffLinkGeneratorStubView(viewModel: OneOffLinkGeneratorStubViewModel(owner: owner, push: push))
        case let .bookingPageZeroState(owner):
            BookingPageZeroStateStubView(viewModel: BookingPageZeroStateStubViewModel(owner: owner, push: push))
        // I5 — Invitee Discovery (public)
        case let .inviteeLanding(slug):
            InviteeLandingStubView(viewModel: InviteeLandingStubViewModel(slug: slug, push: push))
        case let .inviteeSlotPicker(slug, eventTypeSlug, tz, oneOffToken):
            InviteeSlotPickerStubView(viewModel: InviteeSlotPickerStubViewModel(
                slug: slug,
                eventTypeSlug: eventTypeSlug,
                tz: tz,
                oneOffToken: oneOffToken,
                push: push
            ))
        case let .inviteeNoAvailability(slug, eventTypeSlug, tz):
            InviteeNoAvailabilityStubView(viewModel: InviteeNoAvailabilityStubViewModel(
                slug: slug,
                eventTypeSlug: eventTypeSlug,
                tz: tz,
                push: push
            ))
        // I6 — Invitee Confirm & Manage (public)
        case let .inviteeIntakeForm(slug, eventTypeSlug, start, tz):
            InviteeIntakeFormStubView(viewModel: InviteeIntakeFormStubViewModel(
                slug: slug,
                eventTypeSlug: eventTypeSlug,
                start: start,
                tz: tz,
                push: push
            ))
        case let .inviteeReviewConfirm(slug, eventTypeSlug, start, tz):
            InviteeReviewConfirmStubView(viewModel: InviteeReviewConfirmStubViewModel(
                slug: slug,
                eventTypeSlug: eventTypeSlug,
                start: start,
                tz: tz,
                push: push
            ))
        case let .inviteeConfirmed(manageToken):
            InviteeConfirmedStubView(viewModel: InviteeConfirmedStubViewModel(manageToken: manageToken, push: push))
        case let .inviteeManageBooking(token):
            InviteeManageBookingStubView(viewModel: InviteeManageBookingStubViewModel(token: token, push: push))
        // I7 — Invitee Edge & Customer
        case let .inviteeSlotTaken(slug, eventTypeSlug, tz):
            InviteeSlotTakenStubView(viewModel: InviteeSlotTakenStubViewModel(slug: slug, eventTypeSlug: eventTypeSlug, tz: tz, push: push))
        case let .inviteePaymentFailed(token):
            InviteePaymentFailedStubView(viewModel: InviteePaymentFailedStubViewModel(token: token, push: push))
        case let .inviteeUnavailable(slug, oneOffToken):
            InviteeUnavailableStubView(viewModel: InviteeUnavailableStubViewModel(slug: slug, oneOffToken: oneOffToken, push: push))
        case let .deepLinkInterstitial(token):
            DeepLinkInterstitialStubView(viewModel: DeepLinkInterstitialStubViewModel(token: token, push: push))
        case let .inviteePolicyBlocked(token):
            InviteePolicyBlockedStubView(viewModel: InviteePolicyBlockedStubViewModel(token: token, push: push))
        case .customerMyBookings:
            CustomerMyBookingsStubView(viewModel: CustomerMyBookingsStubViewModel(push: push))
        case let .recurringSetup(owner, eventTypeId):
            RecurringSetupStubView(viewModel: RecurringSetupStubViewModel(owner: owner, eventTypeId: eventTypeId, push: push))
        // I8 — Bookings Inbox & Core
        case let .bookingsInbox(owner):
            BookingsInboxStubView(viewModel: BookingsInboxStubViewModel(owner: owner, push: push))
        case let .bookingDetail(owner, bookingId):
            BookingDetailStubView(viewModel: BookingDetailStubViewModel(owner: owner, bookingId: bookingId, push: push))
        // I9 — Bookings Extras
        case let .groupRoster(owner, bookingId):
            GroupRosterStubView(viewModel: GroupRosterStubViewModel(owner: owner, bookingId: bookingId, push: push))
        case let .manualBooking(owner):
            ManualBookingStubView(viewModel: ManualBookingStubViewModel(owner: owner, push: push))
        case let .waitlistManagement(owner, eventTypeId):
            WaitlistManagementStubView(viewModel: WaitlistManagementStubViewModel(owner: owner, eventTypeId: eventTypeId, push: push))
        // I10 — Home Calendar & RSVP
        case let .homeCalendar(homeId):
            HomeCalendarStubView(viewModel: HomeCalendarStubViewModel(homeId: homeId, push: push))
        case let .homeEventDetail(homeId, eventId):
            HomeEventDetailStubView(viewModel: HomeEventDetailStubViewModel(homeId: homeId, eventId: eventId, push: push))
        case let .homeEventEditor(homeId, eventId):
            HomeEventEditorStubView(viewModel: HomeEventEditorStubViewModel(homeId: homeId, eventId: eventId, push: push))
        case let .householdAvailability(homeId):
            HouseholdAvailabilityStubView(viewModel: HouseholdAvailabilityStubViewModel(homeId: homeId, push: push))
        case let .permissionGatedScheduler(homeId):
            PermissionGatedSchedulerStubView(viewModel: PermissionGatedSchedulerStubViewModel(homeId: homeId, push: push))
        // I11 — Find a Time & Who's Free
        case let .findATimeSetup(homeId):
            FindATimeSetupStubView(viewModel: FindATimeSetupStubViewModel(homeId: homeId, push: push))
        case let .findATimeSuggested(homeId, tz):
            FindATimeSuggestedStubView(viewModel: FindATimeSuggestedStubViewModel(homeId: homeId, tz: tz, push: push))
        case let .findATimePollResponse(pollId):
            FindATimePollResponseStubView(viewModel: FindATimePollResponseStubViewModel(pollId: pollId, push: push))
        case let .whosFree(homeId, tz):
            WhosFreeStubView(viewModel: WhosFreeStubViewModel(homeId: homeId, tz: tz, push: push))
        // I12 — Home Resources & Visits
        case let .resourceList(homeId):
            ResourceListStubView(viewModel: ResourceListStubViewModel(homeId: homeId, push: push))
        case let .resourceEditor(homeId, resourceId):
            ResourceEditorStubView(viewModel: ResourceEditorStubViewModel(homeId: homeId, resourceId: resourceId, push: push))
        case let .resourceDetail(homeId, resourceId):
            ResourceDetailStubView(viewModel: ResourceDetailStubViewModel(homeId: homeId, resourceId: resourceId, push: push))
        case let .bookResource(homeId, resourceId):
            BookResourceStubView(viewModel: BookResourceStubViewModel(homeId: homeId, resourceId: resourceId, push: push))
        case let .scheduleVisit(homeId):
            ScheduleVisitStubView(viewModel: ScheduleVisitStubViewModel(homeId: homeId, push: push))
        case let .visitDetail(homeId, eventId):
            VisitDetailStubView(viewModel: VisitDetailStubViewModel(homeId: homeId, eventId: eventId, push: push))
        // I13 — Business Config & Team
        case let .teamBookingAvailability(owner, tz):
            TeamBookingAvailabilityStubView(viewModel: TeamBookingAvailabilityStubViewModel(owner: owner, tz: tz, push: push))
        case let .businessSchedulingSettings(owner):
            BusinessSchedulingSettingsStubView(viewModel: BusinessSchedulingSettingsStubViewModel(owner: owner, push: push))
        // I14 — Payments & Payouts
        case let .paymentsSetup(owner):
            PaymentsSetupStubView(viewModel: PaymentsSetupStubViewModel(owner: owner, push: push))
        case let .payoutsEarnings(owner):
            PayoutsEarningsStubView(viewModel: PayoutsEarningsStubViewModel(owner: owner, push: push))
        case let .cancellationPolicyEditor(owner, eventTypeId):
            CancellationPolicyEditorStubView(viewModel: CancellationPolicyEditorStubViewModel(
                owner: owner,
                eventTypeId: eventTypeId,
                push: push
            ))
        // I15 — Packages & Invoices
        case let .packagesList(owner):
            PackagesListStubView(viewModel: PackagesListStubViewModel(owner: owner, push: push))
        case let .packageEditor(owner, packageId):
            PackageEditorStubView(viewModel: PackageEditorStubViewModel(owner: owner, packageId: packageId, push: push))
        case let .buyPackage(owner, packageId):
            BuyPackageStubView(viewModel: BuyPackageStubViewModel(owner: owner, packageId: packageId, push: push))
        case .myPackages:
            MyPackagesStubView(viewModel: MyPackagesStubViewModel(push: push))
        case let .invoicesList(owner):
            InvoicesListStubView(viewModel: InvoicesListStubViewModel(owner: owner, push: push))
        case let .invoiceDetail(owner, invoiceId):
            InvoiceDetailStubView(viewModel: InvoiceDetailStubViewModel(owner: owner, invoiceId: invoiceId, push: push))
        // I16 — Reminders / Workflows / Templates
        case let .defaultReminders(owner):
            DefaultRemindersStubView(viewModel: DefaultRemindersStubViewModel(owner: owner, push: push))
        case let .workflowsList(owner):
            WorkflowsListStubView(viewModel: WorkflowsListStubViewModel(owner: owner, push: push))
        case let .workflowEditor(owner, workflowId):
            WorkflowEditorStubView(viewModel: WorkflowEditorStubViewModel(owner: owner, workflowId: workflowId, push: push))
        case let .messageTemplateEditor(owner, templateId):
            MessageTemplateEditorStubView(viewModel: MessageTemplateEditorStubViewModel(owner: owner, templateId: templateId, push: push))
        case let .messagePreview(owner, templateId):
            MessagePreviewStubView(viewModel: MessagePreviewStubViewModel(owner: owner, templateId: templateId, push: push))
        case let .messageTemplateLibrary(owner):
            MessageTemplateLibraryStubView(viewModel: MessageTemplateLibraryStubViewModel(owner: owner, push: push))
        // I17 — Insights & Reports
        case let .insightsDashboard(owner):
            InsightsDashboardStubView(viewModel: InsightsDashboardStubViewModel(owner: owner, push: push))
        case let .perEventTypePerformance(owner, eventTypeId):
            PerEventTypePerformanceStubView(viewModel: PerEventTypePerformanceStubViewModel(
                owner: owner,
                eventTypeId: eventTypeId,
                push: push
            ))
        case let .noShowReport(owner):
            NoShowReportStubView(viewModel: NoShowReportStubViewModel(owner: owner, push: push))
        case let .teamPerformance(owner):
            TeamPerformanceStubView(viewModel: TeamPerformanceStubViewModel(owner: owner, push: push))
        // I18 — Cross-cutting & Polish
        case let .notificationPermissionPrompt(owner):
            NotifPermissionPromptStubView(viewModel: NotifPermissionPromptStubViewModel(owner: owner, push: push))
        }
    }
    // swiftlint:enable cyclomatic_complexity function_body_length
}
