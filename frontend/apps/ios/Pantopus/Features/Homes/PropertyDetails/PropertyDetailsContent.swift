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
    public let latitude: Double?
    public let longitude: Double?

    public var hasMapLocation: Bool {
        guard let latitude, let longitude, latitude.isFinite, longitude.isFinite else { return false }
        return (-90...90).contains(latitude) && (-180...180).contains(longitude)
    }

    public init(line1: String, line2: String, latitude: Double?, longitude: Double?) {
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

/// One titled card of read-only record rows: the county record's Building,
/// Lot, Parcel & records… sections.
public struct PropertyRecordSection: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let rows: [PropertyFactRow]
    /// Caption under the card (the value estimate's "isn't an appraisal").
    public let note: String?

    public init(id: String, title: String, rows: [PropertyFactRow], note: String? = nil) {
        self.id = id
        self.title = title
        self.rows = rows
        self.note = note
    }
}

/// What the household has said and can say, as the server sends it. Empty parts draw nothing.
public struct PropertyHouseholdContent: Sendable, Hashable {
    /// "From your household", where there's no record to set it beside.
    public let sections: [PropertyRecordSection]
    public let groups: [HouseholdGroupDTO]
    public let questions: [HouseholdQuestionDTO]
    public let countyPage: HouseholdCountyPageDTO?
    /// Link and confirm: "Is this right?" once someone is back from the county's page.
    public let countyCheck: HouseholdCountyCheckDTO?
    /// "Is this your layout?", for a unit its building's sheet names.
    public let floorPlan: FloorPlanLayoutDTO?
    /// "From your papers": a PDF of the home's own report, read for facts the household checks.
    public let documents: HouseholdDocumentsOfferDTO?

    public init(
        sections: [PropertyRecordSection],
        groups: [HouseholdGroupDTO],
        questions: [HouseholdQuestionDTO],
        countyPage: HouseholdCountyPageDTO?,
        countyCheck: HouseholdCountyCheckDTO? = nil,
        floorPlan: FloorPlanLayoutDTO? = nil,
        documents: HouseholdDocumentsOfferDTO? = nil
    ) {
        self.sections = sections
        self.groups = groups
        self.questions = questions
        self.countyPage = countyPage
        self.countyCheck = countyCheck
        self.floorPlan = floorPlan
        self.documents = documents
    }

    /// The layout question, if it sits at the foot of this card.
    public func layout(forSection id: String) -> FloorPlanLayoutDTO? {
        guard let floorPlan, floorPlan.sectionId == id, floorPlan.prompt != nil || floorPlan.answered != nil else { return nil }
        return floorPlan
    }

    public func group(forSection id: String) -> HouseholdGroupDTO? {
        groups.first { $0.sectionId == id }
    }

    /// A card of its own: nothing in the record to sit under.
    public var addDetails: [HouseholdGroupDTO] {
        groups.filter { $0.sectionId == nil }
    }

    public func fact(_ key: String) -> HouseholdFactDTO? {
        groups.lazy.flatMap(\.facts).first { $0.key == key }
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
    /// The county record's sections; empty for anyone but a verified owner.
    public let recordSections: [PropertyRecordSection]
    /// Where the record came from and when, under its last section.
    public let recordFooter: String?
    public let verification: [VerificationSource]
    /// Non-nil when external sources disagree — drives the mismatch banner
    /// and the sticky "Request correction" CTA. `nil` for the clean state.
    public let banner: MismatchBannerData?
    /// `nil` for anyone the household's facts aren't for, and from a server that doesn't send them.
    public let household: PropertyHouseholdContent?

    public init(
        address: PropertyAddress,
        propertyFacts: [PropertyFactRow],
        recordSections: [PropertyRecordSection],
        recordFooter: String? = nil,
        verification: [VerificationSource],
        banner: MismatchBannerData? = nil,
        household: PropertyHouseholdContent? = nil
    ) {
        self.address = address
        self.propertyFacts = propertyFacts
        self.recordSections = recordSections
        self.recordFooter = recordFooter
        self.verification = verification
        self.banner = banner
        self.household = household
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
