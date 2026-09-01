//
//  PackageGigOption.swift
//  Pantopus
//
//  A17.8 → "Ask a Neighbor" package gig. The five help types the backend
//  accepts (`packageGigSchema`, `backend/routes/mailboxV2Phase2.js:83`)
//  and the copy RN renders for each (`src/app/mailbox/gig.tsx:15-21`).
//
//  Mirrors `PackageGigOption.kt` on Android.
//

import Foundation

/// Wire value for `gigType` on
/// `POST /api/mailbox/v2/p2/package/:mailId/gig`. Joi rejects anything
/// outside this set, so the raw values are load-bearing.
public enum PackageGigType: String, Sendable, Hashable, CaseIterable {
    case hold
    case inside
    case sign
    case assembly
    case custom
}

/// One row in the "WHAT DO YOU NEED?" selector.
public struct PackageGigOption: Sendable, Hashable, Identifiable {
    public let type: PackageGigType
    public let icon: PantopusIcon
    public let title: String
    public let subtitle: String
    /// RN hides the post-delivery-only options while the package is still
    /// in transit (`gig.tsx:38-40` filters on `preDelivery`).
    public let availablePreDelivery: Bool

    public var id: String {
        type.rawValue
    }

    /// Declaration order matches RN's `GIG_OPTIONS`.
    public static let all: [PackageGigOption] = [
        PackageGigOption(
            type: .hold,
            icon: .mailbox,
            title: "Hold Package",
            subtitle: "Neighbor holds it until you return",
            availablePreDelivery: true
        ),
        PackageGigOption(
            type: .inside,
            icon: .home,
            title: "Put Inside",
            subtitle: "Neighbor moves it inside your porch/garage",
            availablePreDelivery: true
        ),
        PackageGigOption(
            type: .sign,
            icon: .fileSignature,
            title: "Sign for Me",
            subtitle: "Neighbor signs on your behalf",
            availablePreDelivery: true
        ),
        PackageGigOption(
            type: .assembly,
            icon: .wrench,
            title: "Help Assemble",
            subtitle: "Neighbor helps with assembly after delivery",
            availablePreDelivery: false
        ),
        PackageGigOption(
            type: .custom,
            icon: .messageSquare,
            title: "Custom Request",
            subtitle: "Describe what you need",
            availablePreDelivery: false
        )
    ]

    /// Pre-delivery keeps only the options that make sense before the
    /// carrier drops the box; post-delivery offers everything.
    public static func options(isPreDelivery: Bool) -> [PackageGigOption] {
        isPreDelivery ? all.filter(\.availablePreDelivery) : all
    }
}
