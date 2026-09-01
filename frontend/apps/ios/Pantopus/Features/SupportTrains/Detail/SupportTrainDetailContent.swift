//
//  SupportTrainDetailContent.swift
//  Pantopus
//
//  A10.9 — Render payloads for the participant-facing Support Train
//  detail screen. Pure value types so the view-model can be fed
//  deterministic stub data (`SupportTrainDetailSampleData`) and every
//  state snapshots reproducibly. Colour is expressed as a semantic
//  `SupportTrainDetailKind`; the view layer maps it onto `Theme.Color` so
//  the model stays free of SwiftUI types.
//
//  Two designed variants share this model:
//   - `populated`     12 / 21 slots covered · 9 open · `PrimaryCTA` dock.
//   - `fullyCovered`  21 / 21 covered · `CelebrationBanner` at top · split
//                     `Send a card` + `Join as backup` dock.
//

import Foundation

/// Per-archetype palette. Currently drives the `TypeDatesCard` icon
/// tile + the `RecipientCard` avatar gradient. Mirrors the
/// `SupportTrainType` enum that the list feeds project so a future
/// backend round-trip lights up the same accent without re-mapping.
public enum SupportTrainDetailKind: String, Sendable, Hashable {
    case meals
    case rides
    case childcare
    case petcare
    case errands
    case visits
    case generic
}

/// Sticky bottom dock variant. `signUp` is the populated default;
/// `sendCardAndBackup` is the fully-covered split dock.
public enum SupportTrainDock: Sendable, Hashable {
    case signUp(label: String)
    case sendCardAndBackup
}

/// The recipient block at the top of the screen. The household line is
/// foregrounded with a quote from the recipient so the request reads
/// human, not as a request for charity.
public struct RecipientCardContent: Equatable, Sendable {
    public let initials: String
    public let householdName: String
    /// `home` / `personal` / `business` — drives the identity chip tint
    /// + verified disc colour.
    public let identityTag: IdentityTag
    public let verified: Bool
    public let address: String
    /// "2 blocks from you" — locality hint, optional.
    public let proximity: String?
    public let quote: String
    public let quoteAttribution: String?

    public enum IdentityTag: String, Sendable, Hashable {
        case home
        case personal
        case business
    }

    public init(
        initials: String,
        householdName: String,
        identityTag: IdentityTag,
        verified: Bool,
        address: String,
        proximity: String? = nil,
        quote: String,
        quoteAttribution: String? = nil
    ) {
        self.initials = initials
        self.householdName = householdName
        self.identityTag = identityTag
        self.verified = verified
        self.address = address
        self.proximity = proximity
        self.quote = quote
        self.quoteAttribution = quoteAttribution
    }
}

/// One participant slot in the contributor strip (4 avatars + +N
/// overflow). Tracked separately from the slot rows because the strip
/// shows *unique helpers*, while a row is *per slot*.
public struct ContributorBubble: Equatable, Sendable, Identifiable {
    public let id: String
    public let initials: String
    /// Semantic palette swatch. Mirrors the dish-author tint in
    /// `SlotRowContent.author`. The view layer maps it onto a
    /// `Theme.Color`.
    public let tone: ContributorTone

    public enum ContributorTone: String, Sendable, Hashable {
        case warning
        case primary
        case business
        case success
        case error
        case personal
    }

    public init(id: String, initials: String, tone: ContributorTone) {
        self.id = id
        self.initials = initials
        self.tone = tone
    }
}

/// The big "type + dates + progress" card. Carries everything needed
/// to render the icon tile, title + dates strip, status pill, the
/// progress bar with sky gradient, and the contributor strip.
public struct TypeDatesCardContent: Equatable, Sendable {
    public let kind: SupportTrainDetailKind
    public let title: String
    public let dateRange: String
    public let daysLeft: Int
    public let slotsFilled: Int
    public let slotsTotal: Int
    /// Up to four bubble previews + an `extraCount` for the trailing
    /// "+N" disc. The view truncates / pads as needed.
    public let contributors: [ContributorBubble]
    public let extraCount: Int

    public var isFullyCovered: Bool {
        slotsFilled >= slotsTotal && slotsTotal > 0
    }

    /// 0…100, rounded. `0` when total is zero (defensive).
    public var percentCovered: Int {
        guard slotsTotal > 0 else { return 0 }
        return Int((Double(slotsFilled) / Double(slotsTotal) * 100).rounded())
    }

    public init(
        kind: SupportTrainDetailKind,
        title: String,
        dateRange: String,
        daysLeft: Int,
        slotsFilled: Int,
        slotsTotal: Int,
        contributors: [ContributorBubble],
        extraCount: Int
    ) {
        self.kind = kind
        self.title = title
        self.dateRange = dateRange
        self.daysLeft = daysLeft
        self.slotsFilled = slotsFilled
        self.slotsTotal = slotsTotal
        self.contributors = contributors
        self.extraCount = extraCount
    }
}

/// A single row in the `Open slots near you` / `Already on the train`
/// / `Your commitment` sections. The same row recipe carries every
/// state — the view layer flips the trailing affordance (`Sign up`
/// pill / check disc / `Edit` ghost) off `state`.
public struct SlotRowContent: Equatable, Sendable, Identifiable {
    public let id: String
    public let dayLabel: String
    public let dateLabel: String
    public let state: SlotRowState
    /// Helper attribution — populated for covered slots only.
    public let author: SlotAuthor?
    /// Title text. For open slots: "Open · dinner for 4". For covered:
    /// the dish / contribution line ("Lentil soup + cornbread").
    public let title: String
    /// Sub-meta — drop window, viewer hint, etc. Optional.
    public let subtitle: String?
    /// `true` when the viewer's own commitment. Renders the sky outline
    /// + "Your slot" chip + Edit affordance.
    public let mine: Bool

    public enum SlotRowState: String, Sendable, Hashable {
        case open
        case covered
    }

    public struct SlotAuthor: Equatable, Sendable {
        public let initials: String
        public let displayName: String
        public let tone: ContributorBubble.ContributorTone

        public init(
            initials: String,
            displayName: String,
            tone: ContributorBubble.ContributorTone
        ) {
            self.initials = initials
            self.displayName = displayName
            self.tone = tone
        }
    }

    /// Backing slot id for `open` rows — the reserve sheet posts to
    /// `POST /:id/slots/:slotId/reserve` with it.
    public let slotId: String?
    /// Backing reservation id for `mine` rows — drives leave / mark
    /// delivered.
    public let reservationId: String?
    /// `reserved` / `delivered` / `confirmed` for `mine` rows.
    public let reservationStatus: String?

    public init(
        id: String,
        dayLabel: String,
        dateLabel: String,
        state: SlotRowState,
        author: SlotAuthor? = nil,
        title: String,
        subtitle: String? = nil,
        mine: Bool = false,
        slotId: String? = nil,
        reservationId: String? = nil,
        reservationStatus: String? = nil
    ) {
        self.id = id
        self.dayLabel = dayLabel
        self.dateLabel = dateLabel
        self.state = state
        self.author = author
        self.title = title
        self.subtitle = subtitle
        self.mine = mine
        self.slotId = slotId
        self.reservationId = reservationId
        self.reservationStatus = reservationStatus
    }

    /// The helper can only leave / mark delivered while the reservation
    /// is still `reserved` (`backend/routes/supportTrains.js:3013` +
    /// l.3180 both 409 otherwise).
    public var canLeaveSlot: Bool {
        mine && reservationId != nil && (reservationStatus ?? "reserved") == "reserved"
    }

    public var canMarkDelivered: Bool {
        canLeaveSlot
    }
}

/// One pickable open slot inside the reserve sheet.
public struct ReserveSlotOption: Equatable, Sendable, Identifiable, Hashable {
    public let id: String
    /// "Tuesday, June 3"
    public let dateLabel: String
    /// "Dinner" / "Groceries" …
    public let slotLabel: String
    /// Time window caption ("5:00 pm – 7:00 pm"), when the slot carries one.
    public let windowLabel: String?

    public init(id: String, dateLabel: String, slotLabel: String, windowLabel: String?) {
        self.id = id
        self.dateLabel = dateLabel
        self.slotLabel = slotLabel
        self.windowLabel = windowLabel
    }
}

/// Everything the reserve sheet needs that isn't per-slot: which
/// contribution lanes the train accepts plus the recipient's reminders.
public struct ReserveSheetContext: Equatable, Sendable, Hashable {
    public let enabledModes: [SupportTrainContributionMode]
    public let restrictionChips: [String]
    public let contactlessPreferred: Bool

    public init(
        enabledModes: [SupportTrainContributionMode],
        restrictionChips: [String],
        contactlessPreferred: Bool
    ) {
        self.enabledModes = enabledModes
        self.restrictionChips = restrictionChips
        self.contactlessPreferred = contactlessPreferred
    }
}

/// The viewer's relationship to the train, straight off
/// `viewer_level` + `viewer_support_train_role`
/// (`backend/routes/supportTrains.js:3693`). Every affordance is gated
/// on this so no one sees a button the server will reject.
public enum SupportTrainViewerRole: String, Sendable, Hashable {
    case primaryOrganizer
    case coOrganizer
    case recipient
    case helper
    case viewer

    public var isOrganizer: Bool {
        self == .primaryOrganizer || self == .coOrganizer
    }
}

/// The organizer footer pinned at the bottom of the body.
public struct HostedByFooter: Equatable, Sendable {
    public let organizerInitials: String
    public let organizerDisplayName: String
    public let neighborHint: String?

    public init(organizerInitials: String, organizerDisplayName: String, neighborHint: String?) {
        self.organizerInitials = organizerInitials
        self.organizerDisplayName = organizerDisplayName
        self.neighborHint = neighborHint
    }
}

/// One stack of slot rows ("Open slots near you" · "Already on the
/// train" · "Your commitment" · "Next up"). Carries an optional action
/// label that surfaces as a trailing `See all N` button.
public struct SlotSection: Equatable, Sendable, Identifiable {
    public let id: String
    public let overline: String
    public let actionLabel: String?
    public let rows: [SlotRowContent]

    public init(id: String, overline: String, actionLabel: String? = nil, rows: [SlotRowContent]) {
        self.id = id
        self.overline = overline
        self.actionLabel = actionLabel
        self.rows = rows
    }
}

/// Full render payload for the participant-facing Support Train detail
/// screen. The two designed variants are both expressible as this
/// payload; the VM picks `populated` vs `fullyCovered` off
/// `typeDates.isFullyCovered`.
public struct SupportTrainDetailContent: Equatable, Sendable {
    public let trainId: String
    public let recipient: RecipientCardContent
    public let typeDates: TypeDatesCardContent
    /// 28 days in row-major order (week 0 Mon…Sun … week 3 Mon…Sun).
    /// The view passes these straight into `SlotCalendar`.
    public let calendarDays: [SlotCalendarDay]
    /// One or more row stacks. The first is conventionally the open
    /// slots (in the populated variant) or the viewer's own commitment
    /// (in the fully-covered variant); the second is "Already on the
    /// train" / "Next up".
    public let sections: [SlotSection]
    public let hostedBy: HostedByFooter
    public let dock: SupportTrainDock
    /// Optional celebration banner — shown at the top of the body in
    /// the fully-covered variant.
    public let celebrationBanner: CelebrationBanner?
    /// Open slots the viewer can still claim, in date order.
    public let reserveOptions: [ReserveSlotOption]
    /// Contribution lanes + recipient reminders for the reserve sheet.
    public let reserveContext: ReserveSheetContext
    /// Gate for every action affordance on this screen.
    public let viewerRole: SupportTrainViewerRole
    /// Exact address — present only when the server chose to send it
    /// (organizer / recipient / a helper the organizer granted). Rendered
    /// verbatim, never persisted.
    public let exactAddress: String?
    public let deliveryInstructions: String?

    public struct CelebrationBanner: Equatable, Sendable {
        public let title: String
        public let body: String

        public init(title: String, body: String) {
            self.title = title
            self.body = body
        }
    }

    public var isFullyCovered: Bool {
        typeDates.isFullyCovered
    }

    public init(
        trainId: String,
        recipient: RecipientCardContent,
        typeDates: TypeDatesCardContent,
        calendarDays: [SlotCalendarDay],
        sections: [SlotSection],
        hostedBy: HostedByFooter,
        dock: SupportTrainDock,
        celebrationBanner: CelebrationBanner? = nil,
        reserveOptions: [ReserveSlotOption] = [],
        reserveContext: ReserveSheetContext = ReserveSheetContext(
            enabledModes: SupportTrainContributionMode.allCases,
            restrictionChips: [],
            contactlessPreferred: false
        ),
        viewerRole: SupportTrainViewerRole = .viewer,
        exactAddress: String? = nil,
        deliveryInstructions: String? = nil
    ) {
        self.trainId = trainId
        self.recipient = recipient
        self.typeDates = typeDates
        self.calendarDays = calendarDays
        self.sections = sections
        self.hostedBy = hostedBy
        self.dock = dock
        self.celebrationBanner = celebrationBanner
        self.reserveOptions = reserveOptions
        self.reserveContext = reserveContext
        self.viewerRole = viewerRole
        self.exactAddress = exactAddress
        self.deliveryInstructions = deliveryInstructions
    }
}
