//
//  SupportTrainDetailSampleData.swift
//  Pantopus
//
//  Deterministic stub fixtures for the Support Train detail screen.
//  Backend's `GET /api/support-trains/:id` is not yet wired to project
//  the full detail payload (slots / contributors / recipient profile),
//  so the view-model reads these fixtures directly and previews +
//  snapshot baselines drive off them. Values mirror the A10.9 design
//  frames in `docs/designs/A10/support-train-frames.jsx`:
//    - `populated`     12 / 21 slots covered · 9 open
//    - `fullyCovered`  every slot taken · viewer signed up · split dock
//

import Foundation

public enum SupportTrainDetailSampleData {
    /// FRAME 1 · POPULATED — 12 / 21 slots covered, 9 open.
    public static let populated: SupportTrainDetailContent = {
        let cal = Calendar(identifier: .gregorian)
        // 2025-11-24 (Mon) → 2025-12-21 (Sun) — 28 days, row-major.
        let base = baseStartDate(year: 2025, month: 11, day: 24)
        return SupportTrainDetailContent(
            trainId: "sample-populated",
            recipient: reyesRecipient,
            typeDates: TypeDatesCardContent(
                kind: .meals,
                title: "Meal train · dinner for 4",
                dateRange: "Mon Nov 24 → Sun Dec 22",
                daysLeft: 20,
                slotsFilled: 12,
                slotsTotal: 21,
                contributors: sampleContributors,
                extraCount: 8
            ),
            calendarDays: populatedCalendar(base: base, calendar: cal),
            sections: [
                SlotSection(
                    id: "open",
                    overline: "Open slots near you",
                    actionLabel: "See all 9",
                    rows: [
                        SlotRowContent(
                            id: "open-thu-4",
                            dayLabel: "Thu",
                            dateLabel: "4",
                            state: .open,
                            title: "Open · dinner for 4",
                            subtitle: "Drop off by 5:30 pm · porch shelf"
                        ),
                        SlotRowContent(
                            id: "open-sat-6",
                            dayLabel: "Sat",
                            dateLabel: "6",
                            state: .open,
                            title: "Open · dinner for 4",
                            subtitle: "Drop off by 5:30 pm · porch shelf"
                        ),
                        SlotRowContent(
                            id: "open-mon-8",
                            dayLabel: "Mon",
                            dateLabel: "8",
                            state: .open,
                            title: "Open · dinner for 4",
                            subtitle: "Drop off by 5:30 pm · porch shelf"
                        )
                    ]
                ),
                SlotSection(
                    id: "covered",
                    overline: "Already on the train",
                    rows: [
                        SlotRowContent(
                            id: "covered-tue-2",
                            dayLabel: "Tue",
                            dateLabel: "2",
                            state: .covered,
                            author: SlotRowContent.SlotAuthor(
                                initials: "SK",
                                displayName: "Sam Kowalski",
                                tone: .warning
                            ),
                            title: "Lentil soup + cornbread",
                            subtitle: "drop 5pm"
                        ),
                        SlotRowContent(
                            id: "covered-wed-3",
                            dayLabel: "Wed",
                            dateLabel: "3",
                            state: .covered,
                            author: SlotRowContent.SlotAuthor(
                                initials: "TP",
                                displayName: "Tomás Pérez",
                                tone: .primary
                            ),
                            title: "Chicken & rice (mild)",
                            subtitle: nil
                        ),
                        SlotRowContent(
                            id: "covered-fri-5",
                            dayLabel: "Fri",
                            dateLabel: "5",
                            state: .covered,
                            author: SlotRowContent.SlotAuthor(
                                initials: "MO",
                                displayName: "Maya O.",
                                tone: .business
                            ),
                            title: "Veg lasagna + salad",
                            subtitle: nil
                        )
                    ]
                )
            ],
            hostedBy: HostedByFooter(
                organizerInitials: "DK",
                organizerDisplayName: "Diane K.",
                neighborHint: "neighbor at 422 Elm"
            ),
            dock: .signUp(label: "Sign up for a slot"),
            celebrationBanner: nil
        )
    }()

    /// FRAME 2 · FULLY COVERED — 21 / 21 slots taken, viewer signed up
    /// for Thu Dec 4 (`myDayIdx == 10` in the JSX).
    public static let fullyCovered: SupportTrainDetailContent = {
        let cal = Calendar(identifier: .gregorian)
        let base = baseStartDate(year: 2025, month: 11, day: 24)
        return SupportTrainDetailContent(
            trainId: "sample-fully-covered",
            recipient: reyesRecipient,
            typeDates: TypeDatesCardContent(
                kind: .meals,
                title: "Meal train · dinner for 4",
                dateRange: "Mon Nov 24 → Sun Dec 22",
                daysLeft: 20,
                slotsFilled: 21,
                slotsTotal: 21,
                contributors: sampleContributors,
                extraCount: 17
            ),
            calendarDays: fullyCoveredCalendar(base: base, calendar: cal, myDayIdx: 10),
            sections: [
                SlotSection(
                    id: "mine",
                    overline: "Your commitment",
                    rows: [
                        SlotRowContent(
                            id: "mine-thu-4",
                            dayLabel: "Thu",
                            dateLabel: "4",
                            state: .covered,
                            author: SlotRowContent.SlotAuthor(
                                initials: "YO",
                                displayName: "You",
                                tone: .primary
                            ),
                            title: "Pad thai (no peanuts) + spring rolls",
                            subtitle: "6:00 pm",
                            mine: true
                        )
                    ]
                ),
                SlotSection(
                    id: "nextup",
                    overline: "Next up",
                    actionLabel: "See all 21",
                    rows: [
                        SlotRowContent(
                            id: "nextup-tue-2",
                            dayLabel: "Tue",
                            dateLabel: "2",
                            state: .covered,
                            author: SlotRowContent.SlotAuthor(
                                initials: "SK",
                                displayName: "Sam Kowalski",
                                tone: .warning
                            ),
                            title: "Lentil soup + cornbread",
                            subtitle: "tonight 5pm"
                        ),
                        SlotRowContent(
                            id: "nextup-wed-3",
                            dayLabel: "Wed",
                            dateLabel: "3",
                            state: .covered,
                            author: SlotRowContent.SlotAuthor(
                                initials: "TP",
                                displayName: "Tomás Pérez",
                                tone: .primary
                            ),
                            title: "Chicken & rice (mild)",
                            subtitle: nil
                        )
                    ]
                )
            ],
            hostedBy: HostedByFooter(
                organizerInitials: "DK",
                organizerDisplayName: "Diane K.",
                neighborHint: "neighbor at 422 Elm"
            ),
            dock: .sendCardAndBackup,
            celebrationBanner: SupportTrainDetailContent.CelebrationBanner(
                title: "Every slot is covered",
                body: "Elm Park showed up — all 21 dinners are spoken for. Sign up as backup in case someone can't make it."
            )
        )
    }()

    // MARK: - Building blocks shared across frames

    private static let reyesRecipient = RecipientCardContent(
        initials: "MR",
        householdName: "The Reyes household",
        identityTag: .home,
        verified: true,
        address: "418 Elm St",
        proximity: "2 blocks from you",
        quote: "Baby Mateo arrived Nov 18 — we're home and overwhelmed in the best way. " +
            "Soft foods, no peanuts, no fish. Thank you, Elm Park.",
        quoteAttribution: "Ana & Jordan"
    )

    private static let sampleContributors: [ContributorBubble] = [
        ContributorBubble(id: "sk", initials: "SK", tone: .warning),
        ContributorBubble(id: "tp", initials: "TP", tone: .primary),
        ContributorBubble(id: "mo", initials: "MO", tone: .business),
        ContributorBubble(id: "rj", initials: "RJ", tone: .success)
    ]

    // Cell-state vocabulary from `support-train-frames.jsx`:
    // 'past' (Nov week 1 + Dec 1), 'today' (Dec 2),
    // 'filled' / 'open' per day. The view layer downgrades `filled +
    // past` to a muted past tile inside `SlotCalendar`.
    //
    // States packed row-major (Mon…Sun × 4):
    //   R1: all filled (past)
    //   R2: filled / today / filled / open / filled / open / filled
    //   R3: open / filled / open / filled / open / open / filled
    //   R4: all open
    private static let populatedStates: [SlotCalendarState] = [
        .past, .past, .past, .past, .past, .past, .past,
        .past, .today, .filled, .open, .filled, .open, .filled,
        .open, .filled, .open, .filled, .open, .open, .filled,
        .open, .open, .open, .open, .open, .open, .open
    ]

    private static func populatedCalendar(base: Date, calendar: Calendar) -> [SlotCalendarDay] {
        zip(0..<28, populatedStates).map { idx, state in
            let date = calendar.date(byAdding: .day, value: idx, to: base) ?? base
            let day = calendar.dateComponents([.day], from: date).day ?? 1
            return SlotCalendarDay(
                id: "pop-\(idx)",
                date: date,
                dayNumber: day,
                state: state
            )
        }
    }

    /// Fully-covered grid: every `open` cell flips to `filled` (except
    /// today stays today), the viewer's slot at `myDayIdx` becomes
    /// `mine`. Mirrors the JSX's `if (fullCover && state === 'open') state = 'filled'`.
    private static func fullyCoveredCalendar(
        base: Date,
        calendar: Calendar,
        myDayIdx: Int
    ) -> [SlotCalendarDay] {
        zip(0..<28, populatedStates).map { idx, state in
            let date = calendar.date(byAdding: .day, value: idx, to: base) ?? base
            let day = calendar.dateComponents([.day], from: date).day ?? 1
            var resolved = state
            if state == .open {
                resolved = .filled
            }
            if idx == myDayIdx {
                resolved = .mine
            }
            return SlotCalendarDay(
                id: "full-\(idx)",
                date: date,
                dayNumber: day,
                state: resolved
            )
        }
    }

    private static func baseStartDate(year: Int, month: Int, day: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        let comps = DateComponents(
            calendar: calendar,
            timeZone: TimeZone(identifier: "UTC"),
            year: year,
            month: month,
            day: day
        )
        return calendar.date(from: comps) ?? Date()
    }
}
