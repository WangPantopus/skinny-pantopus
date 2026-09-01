//
//  MailDaySampleData.swift
//  Pantopus
//
//  A13.16 — deterministic sample fixtures for the My Mail Day editor.
//  The view-model projects these into render states; previews / tests
//  stay stable.
//
//  Two fixtures:
//    `populated` — mid-afternoon, 8-piece stack: 2 still need a call, 6
//      reviewed (4 routed · 1 junked · 1 returned) with the latest row
//      pulsing a 5-second undo countdown. Mirrors the JSX
//      `FrameMailDayPopulated`.
//    `empty` — no mail scanned yet today; renders yesterday's recap and
//      two setup-nudge cards under the hero. Mirrors `FrameMailDayEmpty`.
//

import Foundation

public enum MailDaySampleData {
    public static let populated = MailDayContent(
        dateLabel: "Thu · Oct 9",
        streakDays: 12,
        lastScanLabel: "22 min ago",
        unreviewed: [
            UnreviewedMailDayItem(
                id: "mail-day-un-1",
                kind: .bill,
                label: "Con Edison bill",
                sender: "Con Edison · NY",
                suggestedName: "Maria Kovács",
                suggestedAvatar: .personalSky,
                confidencePercent: 94,
                secondaryLabel: "Other"
            ),
            UnreviewedMailDayItem(
                id: "mail-day-un-2",
                kind: .postcard,
                label: "Postcard from Lisbon",
                sender: "P. Almeida · Lisbon, PT",
                suggestedName: "Marcus Khan",
                suggestedAvatar: .householdGreen,
                confidencePercent: 71,
                secondaryLabel: "Route to…"
            )
        ],
        reviewed: [
            ReviewedMailDayItem(
                id: "mail-day-rv-1",
                kind: .magazine,
                label: "The New Yorker · Oct 9",
                action: .routed,
                routedTo: "Marcus",
                routedTint: .householdHome,
                whenLabel: "2 min ago",
                undoCountdown: 5
            ),
            ReviewedMailDayItem(
                id: "mail-day-rv-2",
                kind: .flyer,
                label: "Whole Foods circular",
                action: .junked,
                routedTo: nil,
                routedTint: nil,
                whenLabel: "14 min ago",
                undoCountdown: nil
            ),
            ReviewedMailDayItem(
                id: "mail-day-rv-3",
                kind: .package,
                label: "USPS package slip",
                action: .routed,
                routedTo: "Maria",
                routedTint: .personPrimary,
                whenLabel: "38 min ago",
                undoCountdown: nil
            ),
            ReviewedMailDayItem(
                id: "mail-day-rv-4",
                kind: .envelope,
                label: "Wedding invite · Costa Mesa",
                action: .routed,
                routedTo: "Maria",
                routedTint: .personPrimary,
                whenLabel: "1 hr ago",
                undoCountdown: nil
            ),
            ReviewedMailDayItem(
                id: "mail-day-rv-5",
                kind: .bill,
                label: "Spectrum statement",
                action: .routed,
                routedTo: "House · Bills",
                routedTint: .householdHome,
                whenLabel: "2 hr ago",
                undoCountdown: nil
            ),
            ReviewedMailDayItem(
                id: "mail-day-rv-6",
                kind: .envelope,
                label: "Unknown · no return address",
                action: .returned,
                routedTo: nil,
                routedTint: nil,
                whenLabel: "3 hr ago",
                undoCountdown: nil
            )
        ],
        yesterdayRecap: nil,
        setupNudges: []
    )

    public static let empty = MailDayContent(
        dateLabel: "Fri · Oct 10",
        streakDays: 12,
        lastScanLabel: "9h ago",
        unreviewed: [],
        reviewed: [],
        yesterdayRecap: YesterdayRecap(
            dateLabel: "Wed · Oct 8",
            pieces: 7,
            closedAtLabel: "closed 6:42 PM",
            segments: [
                YesterdayRecap.Segment(id: "maria", percent: 0.57, label: "4 to Maria", tint: .personPrimary),
                YesterdayRecap.Segment(id: "marcus", percent: 0.14, label: "1 to Marcus", tint: .household),
                YesterdayRecap.Segment(id: "junked", percent: 0.14, label: "1 junked", tint: .junked),
                YesterdayRecap.Segment(id: "returned", percent: 0.15, label: "1 returned", tint: .returned)
            ]
        ),
        setupNudges: [
            MailDaySetupNudge(
                id: "daily-reminder",
                icon: .bell,
                tint: .primary,
                title: "Daily reminder · 5:00 PM",
                subtitle: "Ping me to scan before the day closes."
            ),
            MailDaySetupNudge(
                id: "auto-route",
                icon: .users,
                tint: .home,
                title: "Auto-route rules",
                subtitle: "3 active · Con Ed always goes to Maria"
            )
        ]
    )
}
