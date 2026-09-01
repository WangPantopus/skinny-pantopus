//
//  VerifyLandlordSampleData.swift
//  Pantopus
//
//  Deterministic fixtures for the verify-landlord wizard. The
//  `startContent(for:)` switch keys off the `homeId` so previews and
//  snapshot tests can drive a specific Start variant by passing a
//  matching id (e.g. "home-fast-track").
//

import Foundation

/// Identity chip shown at the top of A12.5.
public struct VerifyLandlordHomeChip: Equatable, Sendable {
    public let label: String
}

/// One row inside the `Why we verify your landlord?` explainer block.
public struct VerifyLandlordExistingLandlord: Equatable, Sendable {
    public let name: String
    public let verifiedAt: String
    public let contactName: String
    public let otherTenantsCount: Int
}

/// Aggregate payload powering A12.5.
public struct VerifyLandlordStartContent: Equatable, Sendable {
    public let variant: VerifyLandlordVariant
    public let homeChip: VerifyLandlordHomeChip
    public let existingLandlord: VerifyLandlordExistingLandlord?

    public var isFastTrack: Bool {
        variant == .fastTrack
    }
}

enum VerifyLandlordSampleData {
    static func startContent(for homeId: String) -> VerifyLandlordStartContent {
        if homeId.localizedCaseInsensitiveContains("fast-track")
            || homeId.localizedCaseInsensitiveContains("fasttrack") {
            return fastTrack
        }
        return canonical
    }

    /// Default form seed: registered unit drives the lease-unit-match
    /// validation. Populated frame fills everything; the error frame is
    /// derived via `populatedFormWithErrors` for snapshot tests.
    static func formSeed(for homeId: String) -> VerifyLandlordForm {
        let unit = "Apt 3B"
        if homeId.localizedCaseInsensitiveContains("fast-track")
            || homeId.localizedCaseInsensitiveContains("fasttrack") {
            return VerifyLandlordForm(registeredUnit: unit)
        }
        return VerifyLandlordForm(registeredUnit: unit)
    }

    static let canonical = VerifyLandlordStartContent(
        variant: .canonical,
        homeChip: VerifyLandlordHomeChip(label: "Renting · 412 Elm St, Apt 3B"),
        existingLandlord: nil
    )

    static let fastTrack = VerifyLandlordStartContent(
        variant: .fastTrack,
        homeChip: VerifyLandlordHomeChip(label: "Renting · 412 Elm St, Apt 3B"),
        existingLandlord: VerifyLandlordExistingLandlord(
            name: "Elm Street Holdings LLC",
            verifiedAt: "Verified May 2025",
            contactName: "M. Patel, owner",
            otherTenantsCount: 2
        )
    )

    /// Sample populated Details form — what we drive into the
    /// "populated" snapshot frame and the canonical preview.
    static let populatedForm = VerifyLandlordForm(
        ownerName: "Elm Street Holdings LLC",
        contactName: "Mira Patel",
        email: "mira@elmstholdings.com",
        phone: "(415) 555-0148",
        lease: VerifyLandlordLeaseFile(
            filename: "lease_apt3b_2025.pdf",
            sizeLabel: "1.2 MB",
            pageCount: 6,
            detectedOwner: "M. Patel",
            detectedUnit: "Apt 3B"
        ),
        pmEnabled: true,
        pmName: "Daniel Ortega",
        pmEmail: "dortega@anchorpm.co",
        pmPhone: "(415) 555-0922",
        registeredUnit: "Apt 3B"
    )

    /// Sample errored Details form — bad email TLD + lease unit
    /// mismatch + PM off so the populated PM fields stay hidden.
    static let errorForm = VerifyLandlordForm(
        ownerName: "Elm Street Holdings LLC",
        contactName: "Mira Patel",
        email: "mira@elmstholdings",
        phone: "",
        lease: VerifyLandlordLeaseFile(
            filename: "old_lease_2023_apt2a.pdf",
            sizeLabel: "980 KB",
            pageCount: 4,
            detectedOwner: "M. Patel",
            detectedUnit: "Apt 2A"
        ),
        pmEnabled: false,
        pmName: "",
        pmEmail: "",
        pmPhone: "",
        registeredUnit: "Apt 3B"
    )
}
