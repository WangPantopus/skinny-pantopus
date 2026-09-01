//
//  PartyDetailDTO.swift
//  Pantopus
//
//  Party-mail sub-payload decoded from `mail.object_payload` when
//  `mail_type == "party"`. A personal-celebration invite from a friend
//  or neighbor (housewarming, birthday, dinner) — warmer + more festive
//  than the Community HOA mail. Drives the A17.9 detail variant on top
//  of the shared `MailItemDetailShell`.
//
//  The backend ingestion path for personal invites is not yet wired; the
//  view-model seeds the deterministic `MailItemSampleData.partyInvite`
//  fixture until the route lands, and `decode(from:)` is defensive so
//  the variant lights up the moment the payload starts arriving.
//

import Foundation

/// Three-way RSVP for the A17.9 invite — distinct from the community
/// HOA RSVP so the party variant can hold the +1 stepper and friend-pile
/// state separately from neighborhood event RSVPs.
public enum PartyRsvpStatus: String, Sendable, Equatable, CaseIterable {
    /// User has not RSVPed yet — open invite state.
    case undecided
    case going
    case maybe
    case notGoing
}

/// Host card on the invite — the friend / neighbor who sent it.
public struct PartyHostInfo: Sendable, Hashable {
    public let name: String
    public let initials: String
    public let blurb: String
    public let relationLabel: String
    public let isVerified: Bool

    public init(
        name: String,
        initials: String,
        blurb: String,
        relationLabel: String,
        isVerified: Bool
    ) {
        self.name = name
        self.initials = initials
        self.blurb = blurb
        self.relationLabel = relationLabel
        self.isVerified = isVerified
    }
}

/// Date tile content — Saturday / MAY / 24 stacked rose tile plus the
/// human time range surfaced in the hero panel.
public struct PartyEventDate: Sendable, Hashable {
    public let weekday: String
    public let dayLabel: String
    public let monthLabel: String
    public let dayNumber: String
    public let timeRange: String

    public init(
        weekday: String,
        dayLabel: String,
        monthLabel: String,
        dayNumber: String,
        timeRange: String
    ) {
        self.weekday = weekday
        self.dayLabel = dayLabel
        self.monthLabel = monthLabel
        self.dayNumber = dayNumber
        self.timeRange = timeRange
    }
}

/// Event details panel — where + vibe + forecast strip.
public struct PartyEventInfo: Sendable, Hashable {
    public let what: String
    public let date: PartyEventDate
    public let location: String
    public let locationNote: String
    public let walkLabel: String
    public let dressCode: String
    public let kids: String
    public let weatherSummary: String
    public let weatherTemperatureF: Int

    public init(
        what: String,
        date: PartyEventDate,
        location: String,
        locationNote: String,
        walkLabel: String,
        dressCode: String,
        kids: String,
        weatherSummary: String,
        weatherTemperatureF: Int
    ) {
        self.what = what
        self.date = date
        self.location = location
        self.locationNote = locationNote
        self.walkLabel = walkLabel
        self.dressCode = dressCode
        self.kids = kids
        self.weatherSummary = weatherSummary
        self.weatherTemperatureF = weatherTemperatureF
    }
}

/// Friend in the +N going pile. Status drives whether the avatar lands
/// in the going strip or the maybe count.
public struct PartyAttendee: Sendable, Hashable, Identifiable {
    public enum Status: String, Sendable, Equatable {
        case going
        case maybe
    }

    public enum AccentTint: String, Sendable, Equatable {
        case home, personal, business, warning, error, primary, party
    }

    public let id: String
    public let name: String
    public let initials: String
    public let accent: AccentTint
    public let plusCount: Int
    public let status: Status

    public init(
        id: String,
        name: String,
        initials: String,
        accent: AccentTint,
        plusCount: Int,
        status: Status
    ) {
        self.id = id
        self.name = name
        self.initials = initials
        self.accent = accent
        self.plusCount = plusCount
        self.status = status
    }
}

/// One "If you'd like to bring something" row. `claimedBy` is `nil`
/// when the item is unclaimed, the name of another friend when claimed,
/// and the literal "You" once the user claims it from the going state.
public struct PartyBringItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let item: String
    public let emoji: String
    public let claimedBy: String?

    public init(id: String, item: String, emoji: String, claimedBy: String?) {
        self.id = id
        self.item = item
        self.emoji = emoji
        self.claimedBy = claimedBy
    }

    public func withClaimedBy(_ name: String?) -> PartyBringItem {
        PartyBringItem(id: id, item: item, emoji: emoji, claimedBy: name)
    }
}

/// Handwritten-feel note from the host. Paragraphs + a signature.
public struct PartyNoteContent: Sendable, Hashable {
    public let eyebrow: String
    public let paragraphs: [String]
    public let signature: String

    public init(eyebrow: String, paragraphs: [String], signature: String) {
        self.eyebrow = eyebrow
        self.paragraphs = paragraphs
        self.signature = signature
    }
}

/// One bullet in the party elf strip ("5 friends going", "71° clear
/// evening", "Saturday is clear").
public struct PartyElfBullet: Sendable, Hashable, Identifiable {
    public enum Glyph: String, Sendable, Hashable {
        case users
        case cloudSun
        case calendar
        case calendarCheck
        case userPlus
        case gift
    }

    public let glyph: Glyph
    public let label: String
    public let text: String

    public var id: String {
        label
    }

    public init(glyph: Glyph, label: String, text: String) {
        self.glyph = glyph
        self.label = label
        self.text = text
    }
}

/// Elf strip content — fresh-invite copy vs you're-in copy.
public struct PartyElfContent: Sendable, Hashable {
    public let headline: String
    public let summary: String
    public let bullets: [PartyElfBullet]

    public init(headline: String, summary: String, bullets: [PartyElfBullet]) {
        self.headline = headline
        self.summary = summary
        self.bullets = bullets
    }
}

/// Full A17.9 payload. Drives the hero / elf / host / details / going /
/// note / potluck / RSVP slots on the shell.
public struct PartyDetailDTO: Sendable, Hashable {
    public let partyItemId: String
    public let host: PartyHostInfo
    public let event: PartyEventInfo
    public let attendees: [PartyAttendee]
    public let bringList: [PartyBringItem]
    public let note: PartyNoteContent
    public let elfOpen: PartyElfContent
    public let elfGoing: PartyElfContent
    public let timeAgoLabel: String
    public let invitedCount: Int
    /// Current user's RSVP. `going` flips the variant into the
    /// "You're in" state (saved-banner hero, calendar pill, claim affordances).
    public let rsvp: PartyRsvpStatus
    /// Plus-one count selected by the user. Only meaningful in `going` state.
    public let plusOneCount: Int
    /// Sticky local-time confirmation shown in the green check banner when
    /// the user is going (e.g. "Today 2:14 PM").
    public let rsvpConfirmedAtLabel: String?

    public init(
        partyItemId: String,
        host: PartyHostInfo,
        event: PartyEventInfo,
        attendees: [PartyAttendee],
        bringList: [PartyBringItem],
        note: PartyNoteContent,
        elfOpen: PartyElfContent,
        elfGoing: PartyElfContent,
        timeAgoLabel: String,
        invitedCount: Int,
        rsvp: PartyRsvpStatus,
        plusOneCount: Int,
        rsvpConfirmedAtLabel: String?
    ) {
        self.partyItemId = partyItemId
        self.host = host
        self.event = event
        self.attendees = attendees
        self.bringList = bringList
        self.note = note
        self.elfOpen = elfOpen
        self.elfGoing = elfGoing
        self.timeAgoLabel = timeAgoLabel
        self.invitedCount = invitedCount
        self.rsvp = rsvp
        self.plusOneCount = plusOneCount
        self.rsvpConfirmedAtLabel = rsvpConfirmedAtLabel
    }

    /// Going friends, in the order the host's invite supplied them.
    public var goingAttendees: [PartyAttendee] {
        attendees.filter { $0.status == .going }
    }

    /// Maybe count drives the "+N maybe" line above the going strip.
    public var maybeCount: Int {
        attendees.filter { $0.status == .maybe }.count
    }

    /// Total headcount including the user + their plus-ones once they've
    /// RSVPed going. Friends' explicit plus-ones are summed in.
    public var headcount: Int {
        let friendHeads = goingAttendees.reduce(0) { $0 + 1 + $1.plusCount }
        let youHeads = rsvp == .going ? 1 + plusOneCount : 0
        return friendHeads + youHeads
    }

    /// Returns a copy with the RSVP status flipped and (when entering
    /// `going`) the supplied confirmation timestamp captured.
    public func withRsvp(_ status: PartyRsvpStatus, confirmedAtLabel: String? = nil) -> PartyDetailDTO {
        PartyDetailDTO(
            partyItemId: partyItemId,
            host: host,
            event: event,
            attendees: attendees,
            bringList: bringList,
            note: note,
            elfOpen: elfOpen,
            elfGoing: elfGoing,
            timeAgoLabel: timeAgoLabel,
            invitedCount: invitedCount,
            rsvp: status,
            plusOneCount: status == .going ? plusOneCount : 0,
            rsvpConfirmedAtLabel: status == .going ? (confirmedAtLabel ?? rsvpConfirmedAtLabel) : nil
        )
    }

    /// Returns a copy with the plus-one count bumped to the supplied value.
    public func withPlusOneCount(_ count: Int) -> PartyDetailDTO {
        PartyDetailDTO(
            partyItemId: partyItemId,
            host: host,
            event: event,
            attendees: attendees,
            bringList: bringList,
            note: note,
            elfOpen: elfOpen,
            elfGoing: elfGoing,
            timeAgoLabel: timeAgoLabel,
            invitedCount: invitedCount,
            rsvp: rsvp,
            plusOneCount: max(0, count),
            rsvpConfirmedAtLabel: rsvpConfirmedAtLabel
        )
    }

    /// Best-effort decode. Returns nil today — the backend ingestion path
    /// for personal invites isn't shipped yet, so the projection falls back
    /// to the deterministic `MailItemSampleData.partyInvite` fixture while
    /// the wire schema for party invites is still pending. When the route
    /// lands, fill this in to mirror `MemoryDetailDTO.decode(from:)`.
    public static func decode(from _: JSONValue?) -> PartyDetailDTO? {
        nil
    }

    /// Returns a copy with the bring-list item at `index` claimed/unclaimed.
    public func withBringClaim(at index: Int, by name: String?) -> PartyDetailDTO {
        guard bringList.indices.contains(index) else { return self }
        var updated = bringList
        updated[index] = updated[index].withClaimedBy(name)
        return PartyDetailDTO(
            partyItemId: partyItemId,
            host: host,
            event: event,
            attendees: attendees,
            bringList: updated,
            note: note,
            elfOpen: elfOpen,
            elfGoing: elfGoing,
            timeAgoLabel: timeAgoLabel,
            invitedCount: invitedCount,
            rsvp: rsvp,
            plusOneCount: plusOneCount,
            rsvpConfirmedAtLabel: rsvpConfirmedAtLabel
        )
    }
}
