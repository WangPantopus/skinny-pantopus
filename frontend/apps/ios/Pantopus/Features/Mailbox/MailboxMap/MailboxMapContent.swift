//
//  MailboxMapContent.swift
//  Pantopus
//
//  A11.4 Mailbox map — content models the view consumes. Inherits the
//  A11 map+list hybrid archetype (`MapListHybridDetent` for the sheet
//  detents) but swaps gigs vocabulary for civic / postal venues: the
//  rail card surfaces hours + walk distance, and the pin-detail panel
//  carries a services grid + week-hour strip.
//
//  No backend — `MailboxMapViewModel` projects `MailboxMapSampleData`
//  into these shapes so previews and snapshot baselines stay
//  deterministic.
//

import CoreGraphics
import Foundation

/// A service offered at a mailbox spot. Drives the detail-panel grid.
/// A pure enum (no stored color/icon) so the model stays `Sendable`.
public enum MailboxServiceType: String, CaseIterable, Sendable, Hashable, Identifiable {
    case stamps
    case shipping
    case poBoxes
    case passport
    case pickup
    case printing
    case atm
    case dropOff

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .stamps: "Stamps & postage"
        case .shipping: "Package shipping"
        case .poBoxes: "PO boxes"
        case .passport: "Passport (appt)"
        case .pickup: "Package pickup"
        case .printing: "Print & copy"
        case .atm: "ATM"
        case .dropOff: "Mail drop-off"
        }
    }

    public var chipLabel: String {
        switch self {
        case .stamps: "Stamps"
        case .shipping: "Shipping"
        case .poBoxes: "PO box"
        case .passport: "Passport"
        case .pickup: "Pickup"
        case .printing: "Print"
        case .atm: "ATM"
        case .dropOff: "Drop-off"
        }
    }

    /// Lucide glyph. Where the exact icon isn't in the token set we fall
    /// back to the closest match.
    public var icon: PantopusIcon {
        switch self {
        case .stamps: .stamp
        case .shipping: .package // closest token to Lucide "package-2"
        case .poBoxes: .inbox
        case .passport: .idCard // closest token to Lucide "book-user"
        case .pickup: .archive
        case .printing: .printer
        case .atm: .dollarSign
        case .dropOff: .mailbox
        }
    }
}

/// One day in the week-hour strip. `weekday` uses the `Calendar`
/// convention (1 = Sunday … 7 = Saturday) so the view can highlight the
/// current day; the array itself is ordered Monday-first to match the
/// design.
public struct MailboxDayHours: Sendable, Hashable, Identifiable {
    public let weekday: Int
    public let label: String
    public let hours: String

    public var id: Int {
        weekday
    }

    public init(weekday: Int, label: String, hours: String) {
        self.weekday = weekday
        self.label = label
        self.hours = hours
    }
}

/// One mailbox spot — one pin, one rail card, one detail panel.
public struct MailboxSpot: Identifiable, Sendable, Hashable {
    public let id: String
    public let kind: MailboxSpotKind
    public let name: String
    /// Sub-line, e.g. "390 Hayes St · USPS".
    public let address: String
    public let isOpen: Bool
    /// Card hours summary, e.g. "Until 6 PM" / "Pickup 5 PM".
    public let hoursLabel: String
    /// Detail status chip, e.g. "Open · closes 6 PM".
    public let statusLabel: String
    /// Walk metric, e.g. "3 min · 0.2 mi".
    public let walkLabel: String
    /// Optional detail chip, e.g. "Last pickup 5 PM".
    public let lastPickupLabel: String?
    public let services: [MailboxServiceType]
    public let weekHours: [MailboxDayHours]
    /// Pin position as a 0…1 fraction of the map canvas.
    public let mapX: CGFloat
    public let mapY: CGFloat

    public init(
        id: String,
        kind: MailboxSpotKind,
        name: String,
        address: String,
        isOpen: Bool,
        hoursLabel: String,
        statusLabel: String,
        walkLabel: String,
        lastPickupLabel: String?,
        services: [MailboxServiceType],
        weekHours: [MailboxDayHours],
        mapX: CGFloat,
        mapY: CGFloat
    ) {
        self.id = id
        self.kind = kind
        self.name = name
        self.address = address
        self.isOpen = isOpen
        self.hoursLabel = hoursLabel
        self.statusLabel = statusLabel
        self.walkLabel = walkLabel
        self.lastPickupLabel = lastPickupLabel
        self.services = services
        self.weekHours = weekHours
        self.mapX = mapX
        self.mapY = mapY
    }
}

/// Render state for the Mailbox map. The screen has no designed empty
/// state — its complement is the pin-detail (`.selected`) state, per the
/// A11.4 spec — so an empty spot list renders an inline note inside the
/// populated sheet rather than a full empty screen.
public enum MailboxMapState: Sendable {
    case loading
    case populated([MailboxSpot])
    case selected(spot: MailboxSpot, spots: [MailboxSpot])
    case error(message: String)
}
