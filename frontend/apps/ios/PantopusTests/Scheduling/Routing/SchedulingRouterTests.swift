//
//  SchedulingRouterTests.swift
//  PantopusTests
//
//  Smoke-tests the Foundation routing layer: every one of the 74 routed
//  SchedulingRoute cases resolves through SchedulingRouter to a stub view that
//  constructs without trapping (the @ViewBuilder switch is exhaustive at compile
//  time; this proves the stub view-models build for every payload shape).
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class SchedulingRouterTests: XCTestCase {
    /// Every routed destination with representative payloads.
    private let allRoutes: [SchedulingRoute] = [
        // I1 Setup & Hub
        .hub(owner: .personal),
        .firstRunWizard(owner: .home(homeId: "h")),
        .settingsRoot(owner: .business(id: "b")),
        .notificationPreferences(owner: .personal),
        .onboardingHomeBusiness(owner: .personal),
        // I2 Event Types
        .eventTypeList(owner: .business(id: "b")),
        .eventTypeEditor(owner: .personal, eventTypeId: nil),
        .intakeQuestionsEditor(owner: .personal, eventTypeId: "e"),
        .connectedCalendars(owner: .personal),
        // I3 Availability
        .availabilityScheduleList,
        .weeklyHoursEditor(scheduleId: "s"),
        .dateOverrides(scheduleId: "s"),
        .bookingLimits(owner: .personal, eventTypeId: "e"),
        .blockOffTime,
        // I4 Booking Page
        .bookingPageManagement(owner: .personal),
        .bookingPagePreview(owner: .personal, slug: "ada"),
        .oneOffLinkGenerator(owner: .personal),
        .bookingPageZeroState(owner: .personal),
        // I5 Invitee Discovery
        .inviteeLanding(slug: "ada"),
        .inviteeSlotPicker(slug: "ada", eventTypeSlug: "intro", tz: "UTC", oneOffToken: nil),
        .inviteeNoAvailability(slug: "ada", eventTypeSlug: "intro", tz: "UTC"),
        // I6 Invitee Confirm
        .inviteeIntakeForm(slug: "ada", eventTypeSlug: "intro", start: "2026-07-01T16:00:00Z", tz: "UTC"),
        .inviteeReviewConfirm(slug: "ada", eventTypeSlug: "intro", start: "2026-07-01T16:00:00Z", tz: "UTC"),
        .inviteeConfirmed(manageToken: "mt"),
        .inviteeManageBooking(token: "mt"),
        // I7 Invitee Edge
        .inviteeSlotTaken(slug: "ada", eventTypeSlug: "intro", tz: "UTC"),
        .inviteePaymentFailed(token: "mt"),
        .inviteeUnavailable(slug: nil, oneOffToken: nil),
        .deepLinkInterstitial(token: "mt"),
        .inviteePolicyBlocked(token: "mt"),
        .customerMyBookings,
        .recurringSetup(owner: .personal, eventTypeId: "e"),
        // I8 Bookings
        .bookingsInbox(owner: .business(id: "b")),
        .bookingDetail(owner: .business(id: "b"), bookingId: "bk"),
        // I9 Bookings Extras
        .groupRoster(owner: .business(id: "b"), bookingId: "bk"),
        .manualBooking(owner: .business(id: "b")),
        .waitlistManagement(owner: .business(id: "b"), eventTypeId: "e"),
        // I10 Home Calendar
        .homeCalendar(homeId: "h"),
        .homeEventDetail(homeId: "h", eventId: "ev"),
        .homeEventEditor(homeId: "h", eventId: nil),
        .householdAvailability(homeId: "h"),
        .permissionGatedScheduler(homeId: "h"),
        // I11 Find a Time
        .findATimeSetup(homeId: "h"),
        .findATimeSuggested(homeId: "h", tz: "UTC"),
        .findATimePollResponse(pollId: "p"),
        .whosFree(homeId: "h", tz: "UTC"),
        // I12 Resources
        .resourceList(homeId: "h"),
        .resourceEditor(homeId: "h", resourceId: nil),
        .resourceDetail(homeId: "h", resourceId: "r"),
        .bookResource(homeId: "h", resourceId: "r"),
        .scheduleVisit(homeId: "h"),
        .visitDetail(homeId: "h", eventId: "ev"),
        // I13 Business
        .teamBookingAvailability(owner: .business(id: "b"), tz: "UTC"),
        .businessSchedulingSettings(owner: .business(id: "b")),
        // I14 Payments
        .paymentsSetup(owner: .business(id: "b")),
        .payoutsEarnings(owner: .business(id: "b")),
        .cancellationPolicyEditor(owner: .business(id: "b"), eventTypeId: nil),
        // I15 Packages & Invoices
        .packagesList(owner: .business(id: "b")),
        .packageEditor(owner: .business(id: "b"), packageId: nil),
        .buyPackage(owner: .business(id: "b"), packageId: "pk"),
        .myPackages,
        .invoicesList(owner: .business(id: "b")),
        .invoiceDetail(owner: .business(id: "b"), invoiceId: "inv"),
        // I16 Automations
        .defaultReminders(owner: .personal),
        .workflowsList(owner: .personal),
        .workflowEditor(owner: .personal, workflowId: nil),
        .messageTemplateEditor(owner: .personal, templateId: nil),
        .messagePreview(owner: .personal, templateId: "t"),
        .messageTemplateLibrary(owner: .personal),
        // I17 Insights
        .insightsDashboard(owner: .business(id: "b")),
        .perEventTypePerformance(owner: .business(id: "b"), eventTypeId: "e"),
        .noShowReport(owner: .business(id: "b")),
        .teamPerformance(owner: .business(id: "b")),
        // I18 Polish
        .notificationPermissionPrompt(owner: .personal)
    ]

    func testAllRoutesResolveToAView() {
        XCTAssertEqual(allRoutes.count, 74, "Expected the 74 routed screens")
        for route in allRoutes {
            // Constructs the destination view + its stub view-model; a trap here
            // (e.g. a force-unwrap) would fail the test.
            let view = SchedulingRouter.destination(for: route, owner: .personal) { _ in }
            _ = AnyView(view)
        }
    }

    func testRoutesAreHashableAndDistinct() {
        XCTAssertEqual(Set(allRoutes).count, allRoutes.count, "Routes should be distinct")
    }
}
