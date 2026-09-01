//
//  ManageTrainSampleData.swift
//  Pantopus
//
//  A13.13 — Manage train. Deterministic fixtures the view-model loads
//  on `load()` and previews/snapshot tests render directly. The
//  backend has been removed from the repo, so this surface is fed
//  entirely from the two design-source frames:
//
//    • ACTIVE   — day 12/21 of a Murphy-family meal train (18/21 slots
//                 filled, 1 dropout, draft update typed and ready to
//                 send to the 12 active helpers).
//    • CLOSING  — same train mid-`Close train` confirmation (3-cell
//                 summary stats + italic recipient testimonial + empty
//                 thank-you textarea).
//

import Foundation

public enum ManageTrainSampleData {
    /// Stable train id used by previews + the debug entry point.
    public static let trainId = "train_murphy_meal"

    /// The ACTIVE-state fixture. 12/21 days elapsed, 18 slots covered,
    /// 1 dropout, draft update typed and `Send update` enabled.
    public static let active = ManageTrainContent(
        trainId: trainId,
        title: "Meals for the Murphy family",
        dateRangeLabel: "May 18 → Jun 7 · 21 days",
        isActive: true,
        slotFillValue: "18/21",
        helpersValue: "12",
        daysLeftValue: "9d",
        dropoutValue: "1",
        slotsFilled: 18,
        slotsOpen: 2,
        slotsDropout: 1,
        slotsTotal: 21,
        slotFillCaption: "18 / 21 · 86%",
        draftMessage:
        "Quick note from Daniel — Theo had a rough night so we'll push Tuesday's drop to 6:30pm. "
            + "Anything cold-friendly is perfect. Thank you all, truly.",
        audienceChips: [
            AudienceChipContent(id: "all", label: "All helpers", count: "12"),
            AudienceChipContent(id: "upcoming", label: "Upcoming only", count: "6"),
            AudienceChipContent(id: "family", label: "Family", count: "3")
        ],
        selectedAudienceId: "all",
        pushToPhones: true,
        organizeRows: [
            OrganizeRowContent(
                id: "edit-dates",
                icon: .calendarCog,
                tone: .amber,
                label: "Edit dates & slots",
                meta: "21",
                sub: "Add, swap, or remove cooking days. Helpers see live changes.",
                isDestructive: false
            ),
            OrganizeRowContent(
                id: "invite",
                icon: .userPlus,
                tone: .sky,
                label: "Invite more helpers",
                meta: nil,
                sub: "Share a link or pick from neighbors who follow this train.",
                isDestructive: false
            ),
            OrganizeRowContent(
                id: "analytics",
                icon: .barChart3,
                tone: .green,
                label: "Analytics",
                meta: nil,
                sub: "Fill rate, response time, top contributors — last 21 days.",
                isDestructive: false
            )
        ],
        closeRow: OrganizeRowContent(
            id: "close",
            icon: .archive,
            tone: .red,
            label: "Close train",
            meta: nil,
            sub: "Lock new signups and send a thank-you to everyone.",
            isDestructive: true
        ),
        close: CloseTrainSheetContent(
            daysEarlyLabel: "Locks new signups · 9 days early",
            mealsDelivered: "18",
            neighborsHelped: "12",
            coverageDays: "12d",
            recipientQuote:
            "\"Theo's eating, sleeping, and chubbing up. We can take it from here. "
                + "From the bottom of our spoon drawer — thank you.\" — Daniel"
        )
    )
}
