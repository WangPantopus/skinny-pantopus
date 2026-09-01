//
//  PackageStatusPalette.swift
//  Pantopus
//
//  T6.3d (P14) — Packages status taxonomy + chip mapping.
//
//  The backend (`HomePackage.status`, schema.sql:6552) enforces the
//  6-value CHECK constraint:
//      expected · out_for_delivery · delivered · picked_up · lost · returned
//
//  The design (`packages-frames.jsx:66-74`) speaks a richer
//  display vocabulary (with `held` and `exception` as extra display
//  buckets). For T6.3d we collapse to the backend's 6, mapping
//  `lost → exception` (alert-circle, error tint) so the visual reads as
//  "needs attention".
//
//  Tab buckets — match the design's Expected / Delivered / Archived:
//      Expected  = expected, out_for_delivery
//      Delivered = delivered, picked_up
//      Archived  = lost, returned
//

import Foundation

/// Canonical chip status for a package. Mapped 1:1 from
/// `PackageDTO.status` via `from(raw:)`. Unknown / future statuses
/// fall through to `.expected` so the chip still renders.
public enum PackageChipStatus: String, Sendable, Hashable, CaseIterable {
    case expected
    case outForDelivery
    case delivered
    case pickedUp
    case lost
    case returned

    /// Map from the backend's raw string. Unknown values land on
    /// `.expected` (the schema default).
    public static func from(raw: String?) -> PackageChipStatus {
        switch raw {
        case "expected": .expected
        case "out_for_delivery": .outForDelivery
        case "delivered": .delivered
        case "picked_up": .pickedUp
        case "lost": .lost
        case "returned": .returned
        default: .expected
        }
    }

    /// Display label for the chip.
    public var label: String {
        switch self {
        case .expected: "In transit"
        case .outForDelivery: "Out for delivery"
        case .delivered: "Delivered"
        case .pickedUp: "Picked up"
        case .lost: "Exception"
        case .returned: "Returned"
        }
    }

    /// Status-chip variant for the trailing chip.
    public var chipVariant: StatusChipVariant {
        switch self {
        case .expected: .info
        case .outForDelivery: .info
        case .delivered: .success
        case .pickedUp: .success
        case .lost: .error
        case .returned: .neutral
        }
    }

    /// Leading-glyph for the chip.
    public var chipIcon: PantopusIcon {
        switch self {
        case .expected: .package
        case .outForDelivery: .send
        case .delivered: .checkCircle
        case .pickedUp: .check
        case .lost: .alertCircle
        case .returned: .arrowsRepeat
        }
    }

    /// Bucket → tab id (see `PackagesTab`).
    public var tab: PackagesTab {
        switch self {
        case .expected, .outForDelivery: .expected
        case .delivered, .pickedUp: .delivered
        case .lost, .returned: .archived
        }
    }

    /// True when the status is in flight (still expected to be
    /// delivered). Drives banner counts + drop-location visibility.
    public var isInFlight: Bool {
        self == .expected || self == .outForDelivery
    }

    /// True when the package's lifecycle is closed (delivered, picked
    /// up, lost, or returned). Drives row dimming on `returned`.
    public var isTerminal: Bool {
        switch self {
        case .delivered, .pickedUp, .lost, .returned: true
        case .expected, .outForDelivery: false
        }
    }
}

/// Tab identifiers for the Packages shell — kept as raw strings so they
/// survive the `ListOfRowsDataSource.selectedTab: String` contract.
public enum PackagesTab: String, CaseIterable, Sendable {
    case expected
    case delivered
    case archived

    public var label: String {
        switch self {
        case .expected: "Expected"
        case .delivered: "Delivered"
        case .archived: "Archived"
        }
    }
}
