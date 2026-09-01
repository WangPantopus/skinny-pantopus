//
//  PropertyDetailsContent.swift
//  Pantopus
//
//  Projection models for A.4 — Property details (A13.5). The screen is a
//  read-mostly variant of the Form archetype: property facts come from
//  external sources (county records, mail verification), so the "fields"
//  are read-only `DataRow`s. When sources disagree, `banner` is non-nil
//  and the conflicting row carries `mismatch = true`.
//

import SwiftUI

/// Address + map coordinate for the property hero.
public struct PropertyAddress: Sendable, Hashable {
    public let line1: String
    public let line2: String
    public let latitude: Double
    public let longitude: Double

    public init(line1: String, line2: String, latitude: Double, longitude: Double) {
        self.line1 = line1
        self.line2 = line2
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// A single read-only fact row (Property + Records sections).
public struct PropertyFactRow: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let value: String
    public let sub: String?
    /// Renders the value in a monospaced face (IDs, counts, measurements).
    public let mono: Bool
    /// Applies the amber mismatch treatment (tint + rule + alert icon).
    public let mismatch: Bool

    public init(
        id: String,
        label: String,
        value: String,
        sub: String? = nil,
        mono: Bool = false,
        mismatch: Bool = false
    ) {
        self.id = id
        self.label = label
        self.value = value
        self.sub = sub
        self.mono = mono
        self.mismatch = mismatch
    }
}

/// Status pill spec attached to a verification source row.
public struct SourcePillSpec: Sendable, Hashable {
    public let label: String
    public let tone: SourcePillTone
    public let icon: PantopusIcon?

    public init(label: String, tone: SourcePillTone, icon: PantopusIcon? = nil) {
        self.label = label
        self.tone = tone
        self.icon = icon
    }
}

/// A single row in the Verification section: title + status pill + detail.
public struct VerificationSource: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let detail: String
    public let pill: SourcePillSpec

    public init(id: String, title: String, detail: String, pill: SourcePillSpec) {
        self.id = id
        self.title = title
        self.detail = detail
        self.pill = pill
    }
}

/// Banner copy shown above the sections when sources disagree.
public struct MismatchBannerData: Sendable, Hashable {
    public let summary: String
    public let detail: String

    public init(summary: String, detail: String) {
        self.summary = summary
        self.detail = detail
    }
}

/// Full projection backing `PropertyDetailsView`.
public struct PropertyDetailsContent: Sendable, Hashable {
    public let address: PropertyAddress
    public let propertyFacts: [PropertyFactRow]
    public let records: [PropertyFactRow]
    public let verification: [VerificationSource]
    /// Non-nil when external sources disagree — drives the mismatch banner
    /// and the sticky "Request correction" CTA. `nil` for the clean state.
    public let banner: MismatchBannerData?

    public init(
        address: PropertyAddress,
        propertyFacts: [PropertyFactRow],
        records: [PropertyFactRow],
        verification: [VerificationSource],
        banner: MismatchBannerData? = nil
    ) {
        self.address = address
        self.propertyFacts = propertyFacts
        self.records = records
        self.verification = verification
        self.banner = banner
    }
}

/// Observed state for the Property details screen.
public enum PropertyDetailsState: Sendable {
    case loading
    /// All sources agree — no banner, no sticky CTA.
    case clean(PropertyDetailsContent)
    /// At least one field differs — banner + flagged row + sticky CTA.
    case mismatch(PropertyDetailsContent)
    case error(message: String)
}
