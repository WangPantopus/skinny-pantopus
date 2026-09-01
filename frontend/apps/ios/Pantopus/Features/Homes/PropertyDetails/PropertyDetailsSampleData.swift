//
//  PropertyDetailsSampleData.swift
//  Pantopus
//
//  Deterministic stub content for A.4 — Property details. The backend has
//  been removed from the repo, so the screen reads from these fixtures
//  instead of the network. Mirrors the two design frames: `clean` (all
//  sources agree) and `mismatch` (county vs owner-confirmed disagree on
//  bedrooms). Used by the screen, previews, and snapshot/unit tests.
//

import Foundation

public enum PropertyDetailsSampleData {
    public static let address = PropertyAddress(
        line1: "412 Elm St · Apt 3B",
        line2: "Elm Park, NY 10013",
        latitude: 40.7128,
        longitude: -74.0058
    )

    /// Records section is identical across both frames.
    private static let records: [PropertyFactRow] = [
        PropertyFactRow(id: "parcel", label: "Parcel ID", value: "NY-013-0042-019", mono: true),
        PropertyFactRow(id: "class", label: "Property class", value: "Residential", sub: "Multi-family · 4–6 unit"),
        PropertyFactRow(id: "zoning", label: "Zoning", value: "R5", mono: true),
        PropertyFactRow(id: "assessed", label: "Last assessed", value: "$1.24M", sub: "2025 county roll", mono: true)
    ]

    /// FRAME 1 — all sources agree.
    public static let clean = PropertyDetailsContent(
        address: address,
        propertyFacts: [
            PropertyFactRow(id: "type", label: "Type", value: "Apartment"),
            PropertyFactRow(id: "year", label: "Year built", value: "1924", mono: true),
            PropertyFactRow(id: "beds", label: "Bedrooms", value: "2", mono: true),
            PropertyFactRow(id: "baths", label: "Bathrooms", value: "1", mono: true),
            PropertyFactRow(id: "interior", label: "Interior", value: "845 sq ft", mono: true),
            PropertyFactRow(id: "lot", label: "Lot share", value: "1/6", sub: "6-unit building", mono: true)
        ],
        records: records,
        verification: [
            VerificationSource(
                id: "county",
                title: "County records",
                detail: "Last synced Apr 4, 2026 · auto-refresh quarterly",
                pill: SourcePillSpec(label: "Verified", tone: .success, icon: .check)
            ),
            VerificationSource(
                id: "mls",
                title: "MLS",
                detail: "Listing data refreshed Apr 2, 2026",
                pill: SourcePillSpec(label: "Verified", tone: .success, icon: .checkCircle)
            ),
            VerificationSource(
                id: "owner",
                title: "Owner confirmation",
                detail: "You confirmed every field Apr 4, 2026",
                pill: SourcePillSpec(label: "You", tone: .success, icon: .userRound)
            )
        ],
        banner: nil
    )

    /// FRAME 2 — county vs owner-confirmed disagree on bedrooms.
    public static let mismatch = PropertyDetailsContent(
        address: address,
        propertyFacts: [
            PropertyFactRow(id: "type", label: "Type", value: "Apartment"),
            PropertyFactRow(id: "year", label: "Year built", value: "1924", mono: true),
            PropertyFactRow(
                id: "beds",
                label: "Bedrooms",
                value: "2 · county says 3",
                sub: "Edited Apr 4, 2026",
                mono: true,
                mismatch: true
            ),
            PropertyFactRow(id: "baths", label: "Bathrooms", value: "1", mono: true),
            PropertyFactRow(id: "interior", label: "Interior", value: "845 sq ft", mono: true),
            PropertyFactRow(id: "lot", label: "Lot share", value: "1/6", sub: "6-unit building", mono: true)
        ],
        records: records,
        verification: [
            VerificationSource(
                id: "county",
                title: "County records",
                detail: "Last synced Apr 4, 2026 · county lists 3 bedrooms",
                pill: SourcePillSpec(label: "Verified", tone: .success, icon: .check)
            ),
            VerificationSource(
                id: "mls",
                title: "MLS",
                detail: "Listing data refreshed Apr 2, 2026",
                pill: SourcePillSpec(label: "Verified", tone: .success, icon: .checkCircle)
            ),
            VerificationSource(
                id: "owner",
                title: "Owner confirmation",
                detail: "You confirmed 2 bedrooms Apr 4, 2026",
                pill: SourcePillSpec(label: "Needs review", tone: .warning, icon: .alertTriangle)
            )
        ],
        banner: MismatchBannerData(
            summary: "County and owner-confirmed records disagree on bedrooms.",
            detail: "County records list 3 bedrooms. Owner confirmation says 2 after the 2022 renovation."
        )
    )

    /// Stub loader the view-model uses in place of a network call. Returns
    /// the mismatch narrative (the design's hero story) so the wired screen
    /// exercises the banner, flagged row, and sticky CTA. The clean variant
    /// is exercised by previews, the `clean` snapshot baseline, and
    /// `PropertyDetailsViewModelTests`.
    public static func content(for homeId: String) -> PropertyDetailsContent {
        _ = homeId
        return mismatch
    }
}
