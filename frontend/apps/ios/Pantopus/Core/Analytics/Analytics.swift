//
//  Analytics.swift
//  Pantopus
//
//  Typed analytics taxonomy + shim. The taxonomy is closed — any new
//  event must be added to `AnalyticsEvent` so untyped strings never
//  reach the wire. In Debug builds events log to the console.
//
//  `track(_:)` fans out to two sinks:
//    1. `Observability` — mirrors the event into the Sentry breadcrumb
//       stream so it shows up as context on the next crash / error.
//    2. `PostHogAnalytics` — the product-analytics vendor. Matches the
//       Android vendor (PostHog) and sends the SAME event names. No-ops
//       until `POSTHOG_API_KEY` is configured, so dev / CI stay silent.
//

import Foundation

/// Closed list of analytics events. Mirrors the P15 taxonomy 1:1; do
/// not invent ad-hoc names — extend the enum instead.
public enum AnalyticsEvent: Sendable, Equatable {
    case screenHubViewed
    case screenMailboxRootViewed
    case screenMyHomesViewed
    case screenHomeDashboardViewed
    case screenMailboxItemDetailViewed(category: String, trustLevel: String)
    case screenEditProfileViewed
    case screenAddHomeWizardStepViewed(stepNumber: Int, stepName: String)
    case screenClaimOwnershipStepViewed(stepName: String)
    case screenMyClaimsViewed
    case screenBillsViewed
    case screenBillDetailViewed
    case screenAddBillWizardStepViewed(stepNumber: Int, stepName: String)
    case ctaAddBillSubmit(result: AnalyticsResult)
    case screenHomeMaintenanceViewed
    case screenLogMaintenanceViewed
    case screenMaintenanceDetailViewed
    case ctaLogMaintenanceSubmit(result: AnalyticsResult)
    case ctaMaintenanceDelete(result: AnalyticsResult)
    case screenPetsListViewed
    case screenPetsWizardStepViewed(stepNumber: Int, stepName: String)
    case screenHomeCalendarViewed
    case screenEmergencyInfoViewed
    case screenDocumentsViewed
    case screenPackagesViewed
    case screenPackageDetailViewed
    case ctaLogPackageSubmit(result: AnalyticsResult)
    case screenPollsViewed
    case screenPollDetailViewed
    case ctaPollVoteSubmit(result: AnalyticsResult)
    case screenHouseholdTasksViewed
    case screenOwnersListViewed
    case screenMembersListViewed
    case screenMembersWizardStepViewed(stepNumber: Int, stepName: String)
    case screenPulseFeedViewed(intent: String)
    /// T6.3f / P14 — My listings index (the seller's tabbed list).
    case screenMyListingsViewed
    /// T6.3f / P14 — My businesses index (owner/staff roster).
    case screenMyBusinessesViewed
    case ctaHubActionStripTapped(label: String)
    case ctaHubPillarTapped(pillar: String)
    case ctaMailboxItemLogReceived
    case ctaAddHomeSubmit
    /// P2.3 — Snap & Sell wizard step view event.
    case screenListingComposeWizardStepViewed(stepNumber: Int, stepName: String)
    /// P2.3 — submit the listing-compose wizard (final POST).
    case ctaListingComposeSubmit
    case ctaClaimOwnershipSubmit(result: AnalyticsResult)
    case formEditProfileSubmit(result: AnalyticsResult)
    case formEditProfileValidationError(field: String)
    /// P2.1 — Pulse compose form submitted. `intent` is one of
    /// `ask / recommend / event / lost / announce`.
    case formPulseComposeSubmit(intent: String, result: AnalyticsResult)
    /// P2.1 — Pulse compose validation failure. `intent` matches the
    /// form's active variant; `field` is the failing field's id.
    case formPulseComposeValidationError(intent: String, field: String)
    /// P2.1 — Pulse compose screen viewed.
    case screenPulseComposeViewed(intent: String)
    /// P2.2 — Post-a-Task wizard step view.
    case screenComposeGigWizardStepViewed(stepNumber: Int, stepName: String)
    /// P2.2 — Post-a-Task wizard submit tap (fires before the POST).
    case ctaComposeGigSubmit
    /// A12.10 Create Business wizard — step view.
    case screenCreateBusinessStepViewed(stepNumber: Int, stepName: String)
    /// A12.10 Create Business wizard — "Add as custom category" tap on
    /// the search frame's dashed-violet fallback row.
    case ctaCreateBusinessCustomCategorySubmit(label: String)

    /// A14.8 Vacation hold screen view. `mode` is `scheduling` (composing
    /// a hold) or `active` (a hold is in flight).
    case screenVacationHoldViewed(mode: String)

    /// A17.11 Stamps (postage wallet) screen view. `state` is `populated`,
    /// `empty`, `loading`, or `error`.
    case screenStampsViewed(state: String)

    /// Wire-format event name. Stable across versions — vendor / dashboard
    /// owners depend on these strings.
    public var name: String {
        switch self {
        case .screenHubViewed: "screen.hub.viewed"
        case .screenMailboxRootViewed: "screen.mailbox_root.viewed"
        case .screenMyHomesViewed: "screen.my_homes.viewed"
        case .screenHomeDashboardViewed: "screen.home_dashboard.viewed"
        case .screenMailboxItemDetailViewed: "screen.mailbox_item_detail.viewed"
        case .screenEditProfileViewed: "screen.edit_profile.viewed"
        case .screenAddHomeWizardStepViewed: "screen.add_home_wizard.step_viewed"
        case .screenClaimOwnershipStepViewed: "screen.claim_ownership_wizard.step_viewed"
        case .screenMyClaimsViewed: "screen.my_claims.viewed"
        case .screenBillsViewed: "screen.bills.viewed"
        case .screenBillDetailViewed: "screen.bill_detail.viewed"
        case .screenAddBillWizardStepViewed: "screen.add_bill_wizard.step_viewed"
        case .ctaAddBillSubmit: "cta.add_bill.submit"
        case .screenHomeMaintenanceViewed: "screen.home_maintenance.viewed"
        case .screenLogMaintenanceViewed: "screen.log_maintenance.viewed"
        case .screenMaintenanceDetailViewed: "screen.maintenance_detail.viewed"
        case .ctaLogMaintenanceSubmit: "cta.log_maintenance.submit"
        case .ctaMaintenanceDelete: "cta.maintenance.delete"
        case .screenPetsListViewed: "screen.pets_list.viewed"
        case .screenPetsWizardStepViewed: "screen.pets_wizard.step_viewed"
        case .screenHomeCalendarViewed: "screen.home_calendar.viewed"
        case .screenEmergencyInfoViewed: "screen.emergency_info.viewed"
        case .screenDocumentsViewed: "screen.documents.viewed"
        case .screenPackagesViewed: "screen.packages.viewed"
        case .screenPackageDetailViewed: "screen.package_detail.viewed"
        case .ctaLogPackageSubmit: "cta.log_package.submit"
        case .screenPollsViewed: "screen.polls.viewed"
        case .screenPollDetailViewed: "screen.poll_detail.viewed"
        case .ctaPollVoteSubmit: "cta.poll_vote.submit"
        case .screenHouseholdTasksViewed: "screen.household_tasks.viewed"
        case .screenOwnersListViewed: "screen.owners_list.viewed"
        case .screenMembersListViewed: "screen.members_list.viewed"
        case .screenMembersWizardStepViewed: "screen.members_wizard.step_viewed"
        case .screenPulseFeedViewed: "screen.pulse_feed.viewed"
        case .screenMyListingsViewed: "screen.my_listings.viewed"
        case .screenMyBusinessesViewed: "screen.my_businesses.viewed"
        case .ctaHubActionStripTapped: "cta.hub.action_strip_tapped"
        case .ctaHubPillarTapped: "cta.hub.pillar_tapped"
        case .ctaMailboxItemLogReceived: "cta.mailbox_item.log_received"
        case .ctaAddHomeSubmit: "cta.add_home.submit"
        case .screenListingComposeWizardStepViewed: "screen.listing_compose_wizard.step_viewed"
        case .ctaListingComposeSubmit: "cta.listing_compose.submit"
        case .ctaClaimOwnershipSubmit: "cta.claim_ownership.submit"
        case .formEditProfileSubmit: "form.edit_profile.submit"
        case .formEditProfileValidationError: "form.edit_profile.validation_error"
        case .formPulseComposeSubmit: "form.pulse_compose.submit"
        case .formPulseComposeValidationError: "form.pulse_compose.validation_error"
        case .screenPulseComposeViewed: "screen.pulse_compose.viewed"
        case .screenComposeGigWizardStepViewed: "screen.compose_gig_wizard.step_viewed"
        case .ctaComposeGigSubmit: "cta.compose_gig.submit"
        case .screenCreateBusinessStepViewed: "screen.create_business_wizard.step_viewed"
        case .ctaCreateBusinessCustomCategorySubmit: "cta.create_business.custom_category_submit"
        case .screenVacationHoldViewed: "screen.vacation_hold.viewed"
        case .screenStampsViewed: "screen.stamps.viewed"
        }
    }

    /// Per-event property bag. Properties are flat string-keyed so the
    /// vendor schema doesn't need nested types.
    public var properties: [String: String] {
        switch self {
        case let .screenMailboxItemDetailViewed(category, trustLevel):
            ["category": category, "trust_level": trustLevel]
        case let .screenAddHomeWizardStepViewed(stepNumber, stepName):
            ["step_number": "\(stepNumber)", "step_name": stepName]
        case let .screenComposeGigWizardStepViewed(stepNumber, stepName):
            ["step_number": "\(stepNumber)", "step_name": stepName]
        case let .screenCreateBusinessStepViewed(stepNumber, stepName):
            ["step_number": "\(stepNumber)", "step_name": stepName]
        case let .ctaCreateBusinessCustomCategorySubmit(label):
            ["label": label]
        case let .screenVacationHoldViewed(mode):
            ["mode": mode]
        case let .screenStampsViewed(state):
            ["state": state]
        case let .screenListingComposeWizardStepViewed(stepNumber, stepName):
            ["step_number": "\(stepNumber)", "step_name": stepName]
        case let .screenPetsWizardStepViewed(stepNumber, stepName):
            ["step_number": "\(stepNumber)", "step_name": stepName]
        case let .screenMembersWizardStepViewed(stepNumber, stepName):
            ["step_number": "\(stepNumber)", "step_name": stepName]
        case let .screenClaimOwnershipStepViewed(stepName):
            ["step_name": stepName]
        case let .ctaHubActionStripTapped(label):
            ["label": label]
        case let .ctaHubPillarTapped(pillar):
            ["pillar": pillar]
        case let .screenPulseFeedViewed(intent):
            ["intent": intent]
        case let .ctaClaimOwnershipSubmit(result):
            ["result": result.rawValue]
        case let .formEditProfileSubmit(result):
            ["result": result.rawValue]
        case let .formEditProfileValidationError(field):
            ["field": field]
        case let .formPulseComposeSubmit(intent, result):
            ["intent": intent, "result": result.rawValue]
        case let .formPulseComposeValidationError(intent, field):
            ["intent": intent, "field": field]
        case let .screenPulseComposeViewed(intent):
            ["intent": intent]
        case let .screenAddBillWizardStepViewed(stepNumber, stepName):
            ["step_number": "\(stepNumber)", "step_name": stepName]
        case let .ctaAddBillSubmit(result):
            ["result": result.rawValue]
        case let .ctaLogPackageSubmit(result):
            ["result": result.rawValue]
        case let .ctaLogMaintenanceSubmit(result):
            ["result": result.rawValue]
        case let .ctaMaintenanceDelete(result):
            ["result": result.rawValue]
        case let .ctaPollVoteSubmit(result):
            ["result": result.rawValue]
        case .screenHubViewed,
             .screenMailboxRootViewed,
             .screenMyHomesViewed,
             .screenHomeDashboardViewed,
             .screenMyClaimsViewed,
             .screenBillsViewed,
             .screenBillDetailViewed,
             .screenHomeMaintenanceViewed,
             .screenLogMaintenanceViewed,
             .screenMaintenanceDetailViewed,
             .screenPetsListViewed,
             .screenHomeCalendarViewed,
             .screenPackagesViewed,
             .screenPackageDetailViewed,
             .screenPollsViewed,
             .screenPollDetailViewed,
             .screenMyListingsViewed,
             .screenMyBusinessesViewed,
             .screenHouseholdTasksViewed,
             .screenOwnersListViewed,
             .screenMembersListViewed,
             .screenEmergencyInfoViewed,
             .screenDocumentsViewed,
             .screenEditProfileViewed,
             .ctaMailboxItemLogReceived,
             .ctaAddHomeSubmit,
             .ctaComposeGigSubmit,
             .ctaListingComposeSubmit:
            [:]
        }
    }
}

/// Standard outcomes for form submissions and other yes/no telemetry.
public enum AnalyticsResult: String, Sendable {
    case success
    case error
}

/// Analytics shim. Feature code calls `Analytics.track(.screenHubViewed)`
/// and we fan the event out to Observability (Sentry breadcrumb) and the
/// PostHog product-analytics vendor. In Debug builds the event also lands
/// in the Xcode console for quick verification.
public enum Analytics {
    /// Boot the analytics vendor. Call once from `AppDelegate` at launch,
    /// alongside `Observability.shared.start`.
    @MainActor
    static func start(environment: AppEnvironment) {
        PostHogAnalytics.shared.start(environment: environment)
    }

    public static func track(_ event: AnalyticsEvent) {
        #if DEBUG
        let propsDescription = event.properties.isEmpty
            ? ""
            : " " + event.properties.map { "\($0.key)=\($0.value)" }.joined(separator: " ")
        print("📊 analytics \(event.name)\(propsDescription)")
        #endif
        let name = event.name
        let properties = event.properties
        Task { @MainActor in
            Observability.shared.track(name, properties: properties)
            PostHogAnalytics.shared.capture(name, properties: properties)
        }
    }

    /// Associate (or, with `nil`, clear) the app user id on the analytics
    /// vendor. Mirror of `Observability.identify`; pass the user id only —
    /// never email / name — so the vendor stays pseudonymous.
    @MainActor
    static func identify(userId: String?) {
        if let userId {
            PostHogAnalytics.shared.identify(userId: userId)
        } else {
            PostHogAnalytics.shared.reset()
        }
    }
}
