//
//  PartyMailItemSampleData.swift
//  Pantopus
//
//  A17.9 party invite fixtures split from MailItemSampleData.swift so the
//  core mailbox sample catalog stays below the SwiftLint file-length cap.
//

public extension MailItemSampleData {
    /// A17.9 personal-invite fixture for Priya's backyard housewarming.
    static let partyInvite = PartyDetailDTO(
        partyItemId: "party-housewarming",
        host: PartyHostInfo(
            name: "Priya Ramanathan",
            initials: "PR",
            blurb: "Maple St · moved in last month",
            relationLabel: "Friend · neighbor",
            isVerified: true
        ),
        event: PartyEventInfo(
            what: "Backyard housewarming",
            date: PartyEventDate(
                weekday: "Saturday",
                dayLabel: "SAT",
                monthLabel: "MAY",
                dayNumber: "24",
                timeRange: "6:00 PM – late"
            ),
            location: "1631 Maple St",
            locationNote: "Side gate is open · look for the string lights",
            walkLabel: "0.2 mi · 4 min walk",
            dressCode: "Casual · bring a layer (it gets cool)",
            kids: "Kids welcome until 9",
            weatherSummary: "Clear · light breeze",
            weatherTemperatureF: 71
        ),
        attendees: [
            PartyAttendee(id: "jamal", name: "Jamal", initials: "JT", accent: .home, plusCount: 1, status: .going),
            PartyAttendee(id: "maria", name: "Maria", initials: "MK", accent: .personal, plusCount: 1, status: .going),
            PartyAttendee(id: "lin", name: "Lin", initials: "LS", accent: .business, plusCount: 0, status: .going),
            PartyAttendee(id: "derek", name: "Derek", initials: "DR", accent: .warning, plusCount: 0, status: .going),
            PartyAttendee(id: "sara", name: "Sara", initials: "SN", accent: .error, plusCount: 0, status: .going),
            PartyAttendee(id: "paul", name: "Paul", initials: "PC", accent: .primary, plusCount: 0, status: .maybe)
        ],
        bringList: [
            PartyBringItem(id: "bottle", item: "A bottle of something", emoji: "🍷", claimedBy: nil),
            PartyBringItem(id: "side", item: "Side or salad", emoji: "🥗", claimedBy: "Jamal"),
            PartyBringItem(id: "dessert", item: "Dessert", emoji: "🍰", claimedBy: "Maria + Lin"),
            PartyBringItem(id: "speaker", item: "Outdoor speaker", emoji: "🔊", claimedBy: "Derek")
        ],
        note: PartyNoteContent(
            eyebrow: "A note from Priya",
            paragraphs: [
                "Finally unpacked enough to have people over! It'd mean a lot if you came.",
                "Backyard, string lights, my brother is bringing his pizza oven. No need to bring " +
                    "anything but yourself — but if you want to claim a dish below, even better."
            ],
            signature: "Priya x"
        ),
        elfOpen: PartyElfContent(
            headline: "Pantopus mapped this out",
            summary: "5 of your friends are going already, Priya lives 3 doors down, and your " +
                "Saturday evening is clear. Weather looks great.",
            bullets: [
                PartyElfBullet(glyph: .users, label: "5 friends going", text: "including Jamal, Maria, Lin"),
                PartyElfBullet(glyph: .cloudSun, label: "71° clear evening", text: "no rain · sunset 8:14 PM"),
                PartyElfBullet(glyph: .calendar, label: "Saturday is clear", text: "no conflicts after 4 PM")
            ]
        ),
        elfGoing: PartyElfContent(
            headline: "You're in · here's what's set",
            summary: "Priya was notified you're coming with a +1. Saturday 6 PM is on your " +
                "calendar and you're bringing a bottle. We'll remind you Saturday at 4.",
            bullets: [
                PartyElfBullet(glyph: .calendarCheck, label: "Calendar saved", text: "Sat May 24 · 6:00 PM · reminder Sat 4 PM"),
                PartyElfBullet(glyph: .userPlus, label: "Bringing a +1", text: "Priya can see your headcount"),
                PartyElfBullet(glyph: .gift, label: "You claimed: bottle", text: "Priya marked off the dish list")
            ]
        ),
        timeAgoLabel: "3h ago",
        invitedCount: 12,
        rsvp: .undecided,
        plusOneCount: 0,
        rsvpConfirmedAtLabel: nil
    )

    /// A17.9 secondary state after the user RSVPs Going with a +1.
    static let partyInviteGoing: PartyDetailDTO = partyInvite
        .withRsvp(.going, confirmedAtLabel: "Today 2:14 PM")
        .withPlusOneCount(1)
        .withBringClaim(at: 0, by: "You")
}
