//
//  VacationHoldSampleData.swift
//  Pantopus
//
//  A14.8 — deterministic fixtures for the Vacation Hold screen. Mirrors
//  the populated + active frames in `vacation-frames.jsx` so previews,
//  snapshot tests, and the no-backend wiring render the same numbers
//  the designer specified ("May 28 → Jun 9", "5 days left", "4 / 12 / 1"
//  stats grid, "142 Mulberry St" forwarding, "Sam Park (spouse)"
//  emergency).
//

import Foundation

/// Static fixtures backing the Vacation Hold sample mode. The backend
/// endpoint is stubbed in the spec — until that lands the screen drives
/// off these projections.
public enum VacationHoldSampleData {
    /// 13-day span anchored on the JSX dates (Tue, May 28 → Mon, Jun 9).
    /// Built via a fixed Gregorian calendar so the snapshot stays
    /// reproducible regardless of the host time-zone.
    public static var schedulingDraft: VacationScheduleDraft {
        VacationScheduleDraft(
            fromDate: date(year: 2026, month: 5, day: 28),
            toDate: date(year: 2026, month: 6, day: 9),
            scopes: [
                VacationHoldScope(
                    kind: .mail,
                    label: "Mail & flyers",
                    sub: "Postal hold via USPS API",
                    isOn: true
                ),
                VacationHoldScope(
                    kind: .packages,
                    label: "Packages",
                    sub: "Carriers hold at neighborhood hub",
                    isOn: true
                ),
                VacationHoldScope(
                    kind: .marketplacePickups,
                    label: "Marketplace pickups",
                    sub: "Buyers see away status",
                    isOn: true
                ),
                VacationHoldScope(
                    kind: .civic,
                    label: "Civic notices",
                    sub: "Permits, voting, service alerts",
                    isOn: false,
                    isLocked: true
                )
            ],
            forwardingEnabled: true,
            forwarding: VacationForwardingTarget(
                title: "142 Mulberry St, Apt 3B",
                sub: "New York, NY 10013 · Mom's place"
            ),
            emergency: VacationEmergencyContact(
                name: "Sam Park",
                initials: "SP",
                relation: "Spouse",
                phone: "(•••) 555-0247"
            ),
            footerBlurb: "14 Elm Park Lane · Last hold Jul 2023"
        )
    }

    /// Active hold mirroring the JSX "5 days left" frame.
    public static var activeHold: VacationActiveHold {
        VacationActiveHold(
            daysLeft: 5,
            untilLabel: "Jun 9",
            resumeBlurb: "Everything held resumes delivery the morning of Jun 9.",
            stats: [
                VacationHoldStat(id: "packages", count: 4, label: "Packages"),
                VacationHoldStat(id: "mailItems", count: 12, label: "Mail items"),
                VacationHoldStat(id: "forwarded", count: 1, label: "Forwarded")
            ],
            heldItems: [
                VacationHeldItem(
                    icon: .packages,
                    label: "Packages",
                    sub: "Held at Park Slope hub",
                    count: 4
                ),
                VacationHeldItem(
                    icon: .mail,
                    label: "Mail & flyers",
                    sub: "USPS holding",
                    count: 12
                ),
                VacationHeldItem(
                    icon: .forwarded,
                    label: "Forwarded urgent",
                    sub: "→ 142 Mulberry St",
                    count: 1
                ),
                VacationHeldItem(
                    icon: .civic,
                    label: "Civic notices",
                    sub: "Delivered as normal",
                    count: 2
                )
            ],
            forwarding: VacationForwardingTarget(
                title: "142 Mulberry St, Apt 3B",
                sub: "Mom's place · 1 item sent"
            ),
            emergency: VacationEmergencyContact(
                name: "Sam Park",
                initials: "SP",
                relation: "Spouse",
                phone: "(•••) 555-0247"
            ),
            activeSinceLabel: "14 Elm Park Lane · Active since May 28"
        )
    }

    private static func date(year: Int, month: Int, day: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = day
        return calendar.date(from: comps) ?? Date()
    }
}
