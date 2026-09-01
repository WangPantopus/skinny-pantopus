//
//  SchedulingRoute.swift
//  Pantopus
//
//  Foundation (I0b) — the type-safe route enum for every navigable Calendarly
//  full screen. Feature streams consume this read-only; they never add cases.
//
//  One case per NAVIGABLE FULL-SCREEN destination only. Sheets, modals,
//  and embedded cards are presented locally by the owning stream and have
//  NO case here. Owner-scoped host screens carry `owner: SchedulingOwner`;
//  public invitee screens carry slug/eventTypeSlug/token/start/tz; home
//  screens carry `homeId`; personal availability carries no owner.
//

import Foundation

/// Type-safe destination for every routed Calendarly full screen. Pushed onto
/// the Hub/You navigation stacks wrapped in `HubRoute.scheduling`/`YouRoute.scheduling`.
public enum SchedulingRoute: Hashable, Sendable {
    // MARK: I1 — Setup & Hub

    case hub(owner: SchedulingOwner) // A1 Scheduling Hub
    case firstRunWizard(owner: SchedulingOwner) // A2 Set Up Booking Link
    case settingsRoot(owner: SchedulingOwner) // A3 Scheduling Settings
    case notificationPreferences(owner: SchedulingOwner) // A4 Notification Preferences
    case onboardingHomeBusiness(owner: SchedulingOwner) // A6 Scheduling Onboarding

    // MARK: I2 — Event Types

    case eventTypeList(owner: SchedulingOwner) // B1 Event Types
    case eventTypeEditor(owner: SchedulingOwner, eventTypeId: String?) // B2 Event Type Editor
    case intakeQuestionsEditor(owner: SchedulingOwner, eventTypeId: String) // B3 Intake Questions
    case connectedCalendars(owner: SchedulingOwner) // B8 Connected Calendars

    // MARK: I3 — Availability

    case availabilityScheduleList // B4 Availability
    case weeklyHoursEditor(scheduleId: String) // B5 Weekly Hours
    case dateOverrides(scheduleId: String) // B6 Date Overrides
    case bookingLimits(owner: SchedulingOwner, eventTypeId: String) // B7 Booking Limits
    case blockOffTime // B9 Block Off Time

    // MARK: I4 — Booking Page & Sharing

    case bookingPageManagement(owner: SchedulingOwner) // C1 Booking Page
    case bookingPagePreview(owner: SchedulingOwner, slug: String) // C2 Page Preview
    case oneOffLinkGenerator(owner: SchedulingOwner) // C4 One-off Link
    case bookingPageZeroState(owner: SchedulingOwner) // H16 Get Started

    // MARK: I5 — Invitee Discovery (public)

    case inviteeLanding(slug: String) // C5 Book
    case inviteeSlotPicker(slug: String, eventTypeSlug: String, tz: String, oneOffToken: String?) // C6 Pick a Time
    case inviteeNoAvailability(slug: String, eventTypeSlug: String, tz: String) // C8 No Availability

    // MARK: I6 — Invitee Confirm & Manage (public)

    case inviteeIntakeForm(slug: String, eventTypeSlug: String, start: String, tz: String) // D1 Your Details
    case inviteeReviewConfirm(slug: String, eventTypeSlug: String, start: String, tz: String) // D2 Review & Confirm
    case inviteeConfirmed(manageToken: String) // D3 Confirmed
    case inviteeManageBooking(token: String) // D4 Manage Booking

    // MARK: I7 — Invitee Edge & Customer

    case inviteeSlotTaken(slug: String, eventTypeSlug: String, tz: String) // D5 Slot Taken
    case inviteePaymentFailed(token: String) // D6 Payment Failed
    case inviteeUnavailable(slug: String?, oneOffToken: String?) // D7 Unavailable
    case deepLinkInterstitial(token: String) // D9 Open in App
    case inviteePolicyBlocked(token: String) // D10 Booking Policy
    case customerMyBookings // D11 My Bookings
    case recurringSetup(owner: SchedulingOwner, eventTypeId: String) // D12 Recurring Setup

    // MARK: I8 — Bookings Inbox & Core

    case bookingsInbox(owner: SchedulingOwner) // E1 Bookings
    case bookingDetail(owner: SchedulingOwner, bookingId: String) // E2 Booking

    // MARK: I9 — Bookings Extras

    case groupRoster(owner: SchedulingOwner, bookingId: String) // E8 Roster & Seats
    case manualBooking(owner: SchedulingOwner) // E12 Manual Booking
    case waitlistManagement(owner: SchedulingOwner, eventTypeId: String) // E13 Waitlist

    // MARK: I10 — Home Calendar & RSVP

    case homeCalendar(homeId: String) // F1 Home Calendar
    case homeEventDetail(homeId: String, eventId: String) // F2 Event
    case homeEventEditor(homeId: String, eventId: String?) // F3 Add Event
    case householdAvailability(homeId: String) // F8 My Availability
    case permissionGatedScheduler(homeId: String) // F15 Scheduler

    // MARK: I11 — Find a Time & Who's Free

    case findATimeSetup(homeId: String) // F4 Find a Time
    case findATimeSuggested(homeId: String, tz: String) // F5 Suggested Times
    case findATimePollResponse(pollId: String) // F6 Poll
    case whosFree(homeId: String, tz: String) // F7 Who's Free

    // MARK: I12 — Home Resources & Visits

    case resourceList(homeId: String) // F9 Resources
    case resourceEditor(homeId: String, resourceId: String?) // F10 Resource Editor
    case resourceDetail(homeId: String, resourceId: String) // F11 Resource
    case bookResource(homeId: String, resourceId: String) // F12 Book Resource
    case scheduleVisit(homeId: String) // F13 Schedule a Visit
    case visitDetail(homeId: String, eventId: String) // F14 Visit

    // MARK: I13 — Business Config & Team

    case teamBookingAvailability(owner: SchedulingOwner, tz: String) // G3 Team Availability
    case businessSchedulingSettings(owner: SchedulingOwner) // G5 Business Settings

    // MARK: I14 — Payments & Payouts

    case paymentsSetup(owner: SchedulingOwner) // G6 Payments Setup
    case payoutsEarnings(owner: SchedulingOwner) // G7 Payouts & Earnings
    case cancellationPolicyEditor(owner: SchedulingOwner, eventTypeId: String?) // G14 Cancellation Policy

    // MARK: I15 — Packages & Invoices

    case packagesList(owner: SchedulingOwner) // G8 Packages
    case packageEditor(owner: SchedulingOwner, packageId: String?) // G9 Package Editor
    case buyPackage(owner: SchedulingOwner, packageId: String) // G10 Buy Package
    case myPackages // G11 My Packages
    case invoicesList(owner: SchedulingOwner) // G12 Invoices
    case invoiceDetail(owner: SchedulingOwner, invoiceId: String) // G13 Invoice

    // MARK: I16 — Reminders / Workflows / Templates

    case defaultReminders(owner: SchedulingOwner) // H1 Reminders
    case workflowsList(owner: SchedulingOwner) // H2 Workflows
    case workflowEditor(owner: SchedulingOwner, workflowId: String?) // H3 Workflow Editor
    case messageTemplateEditor(owner: SchedulingOwner, templateId: String?) // H5 Template Editor
    case messagePreview(owner: SchedulingOwner, templateId: String) // H7 Message Preview
    case messageTemplateLibrary(owner: SchedulingOwner) // H8 Template Library

    // MARK: I17 — Insights & Reports

    case insightsDashboard(owner: SchedulingOwner) // H9 Insights
    case perEventTypePerformance(owner: SchedulingOwner, eventTypeId: String) // H10 Performance
    case noShowReport(owner: SchedulingOwner) // H11 No-show Report
    case teamPerformance(owner: SchedulingOwner) // H12 Team Performance

    // MARK: I18 — Cross-cutting & Polish

    case notificationPermissionPrompt(owner: SchedulingOwner) // H15 Notifications
}
