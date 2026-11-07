//
//  PropertyDetailsDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/homes/:id/property-details` — route
//  `backend/routes/home.js:1949`. The `home` property fields and the
//  verified owner's `county_record` (the county record as labeled sections)
//  are modelled; the raw `attom_property_detail` payload + `source` /
//  `unavailable_reason` aren't surfaced by the A13.5 screen.
//  Field-for-field parity with the Android `PropertyDetailsDtos.kt`.
//

import Foundation

/// Parsed `{ latitude, longitude }` for the property hero map. This
/// endpoint returns `home.location` as an object; a raw/unparseable
/// value is tolerated (decodes to nil) so the rest of the home still maps.
public struct PropertyLocationDTO: Decodable, Sendable, Hashable {
    public let latitude: Double?
    public let longitude: Double?
}

/// The `home` object from the property-details envelope. Only the fields
/// the screen renders are modelled; `Decodable` ignores the rest.
public struct PropertyHomeDTO: Decodable, Sendable {
    public let address: String?
    public let address2: String?
    public let unitNumber: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let zipCode: String?
    public let location: PropertyLocationDTO?
    public let homeType: String?
    public let bedrooms: Int?
    public let bathrooms: Double?
    public let sqFt: Int?
    public let lotSqFt: Int?
    public let yearBuilt: Int?

    private enum CodingKeys: String, CodingKey {
        case address
        case address2
        case unitNumber = "unit_number"
        case city
        case state
        case zipcode
        case zipCode = "zip_code"
        case location
        case homeType = "home_type"
        case bedrooms
        case bathrooms
        case sqFt = "sq_ft"
        case lotSqFt = "lot_sq_ft"
        case yearBuilt = "year_built"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        address = try c.decodeIfPresent(String.self, forKey: .address)
        address2 = try c.decodeIfPresent(String.self, forKey: .address2)
        unitNumber = try c.decodeIfPresent(String.self, forKey: .unitNumber)
        city = try c.decodeIfPresent(String.self, forKey: .city)
        state = try c.decodeIfPresent(String.self, forKey: .state)
        zipcode = try c.decodeIfPresent(String.self, forKey: .zipcode)
        zipCode = try c.decodeIfPresent(String.self, forKey: .zipCode)
        // `location` is an object on this endpoint, but tolerate a raw or
        // unparseable value rather than failing the whole decode.
        location = try? c.decodeIfPresent(PropertyLocationDTO.self, forKey: .location)
        homeType = try c.decodeIfPresent(String.self, forKey: .homeType)
        bedrooms = try c.decodeIfPresent(Int.self, forKey: .bedrooms)
        bathrooms = try c.decodeIfPresent(Double.self, forKey: .bathrooms)
        sqFt = try c.decodeIfPresent(Int.self, forKey: .sqFt)
        lotSqFt = try c.decodeIfPresent(Int.self, forKey: .lotSqFt)
        yearBuilt = try c.decodeIfPresent(Int.self, forKey: .yearBuilt)
    }

    public init(
        address: String? = nil,
        address2: String? = nil,
        unitNumber: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zipcode: String? = nil,
        zipCode: String? = nil,
        location: PropertyLocationDTO? = nil,
        homeType: String? = nil,
        bedrooms: Int? = nil,
        bathrooms: Double? = nil,
        sqFt: Int? = nil,
        lotSqFt: Int? = nil,
        yearBuilt: Int? = nil
    ) {
        self.address = address
        self.address2 = address2
        self.unitNumber = unitNumber
        self.city = city
        self.state = state
        self.zipcode = zipcode
        self.zipCode = zipCode
        self.location = location
        self.homeType = homeType
        self.bedrooms = bedrooms
        self.bathrooms = bathrooms
        self.sqFt = sqFt
        self.lotSqFt = lotSqFt
        self.yearBuilt = yearBuilt
    }
}

/// `county_record`: the verified owner's county record as labeled sections,
/// worded and formatted by `backend/serializers/countyRecordSerializer.js`.
public struct PropertyCountyRecordDTO: Decodable, Sendable, Hashable {
    public let sections: [PropertyRecordSectionDTO]
    /// Names the source and date: "From Clark County Assessor's weekly file · updated Oct 31, 2026".
    public let footer: String?
}

/// One titled card of record rows (Building, Lot, Value…).
public struct PropertyRecordSectionDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let rows: [PropertyRecordRowDTO]
    /// Caption under the card, e.g. the value estimate's "isn't an appraisal".
    public let note: String?
}

/// One label / value row, shown as the server words it.
public struct PropertyRecordRowDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let value: String
    /// Numbers, measurements and codes render monospaced.
    public let mono: Bool?
    /// Where this row came from, when it isn't the footer's source ("From your household").
    public let tag: String?
    /// What stands beside it ("County record: 3").
    public let note: String?
}

/// The county's own property page, where a person can check a fact and come back to confirm it.
public struct HouseholdCountyPageDTO: Decodable, Sendable, Hashable {
    public let url: String
    public let label: String
}

/// One one-tap answer.
public struct HouseholdAnswerDTO: Decodable, Sendable, Hashable {
    public let label: String
    public let value: String
}

/// "Bedrooms? 1 2 3 4 Other": a tap answers it.
public struct HouseholdQuestionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let key: String
    public let prompt: String
    public let options: [HouseholdAnswerDTO]
    public let other: String

    public var id: String {
        key
    }
}

/// One fact in "Fix something" or "Add details", as the server words it.
public struct HouseholdFactDTO: Decodable, Sendable, Hashable, Identifiable {
    public let key: String
    public let label: String
    /// What the page shows now.
    public let value: String?
    /// What the field starts with.
    public let current: String
    /// "County record: 3", when the household's value differs from it.
    public let note: String?
    /// `number`, `decimal`, `year` or `text`.
    public let input: String
    public let unit: String?
    public let options: [HouseholdAnswerDTO]
    public let canUndo: Bool

    public var id: String {
        key
    }

    private enum CodingKeys: String, CodingKey {
        case key, label, value, current, note, input, unit, options
        case canUndo = "can_undo"
    }

    public init(
        key: String,
        label: String,
        value: String?,
        current: String,
        note: String?,
        input: String,
        unit: String?,
        options: [HouseholdAnswerDTO],
        canUndo: Bool
    ) {
        self.key = key
        self.label = label
        self.value = value
        self.current = current
        self.note = note
        self.input = input
        self.unit = unit
        self.options = options
        self.canUndo = canUndo
    }
}

/// What someone who can edit may do with one group of facts. `sectionId` is the card it sits
/// under; with none it is a card of its own.
public struct HouseholdGroupDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let sectionId: String?
    public let title: String
    public let lead: String?
    public let prompt: String?
    public let confirmed: String?
    public let fix: String?
    public let facts: [HouseholdFactDTO]
    public let report: String?
    public let reported: String?

    private enum CodingKeys: String, CodingKey {
        case id, title, lead, prompt, confirmed, fix, facts, report, reported
        case sectionId = "section_id"
    }

    public init(
        id: String,
        sectionId: String?,
        title: String,
        lead: String?,
        prompt: String?,
        confirmed: String?,
        fix: String?,
        facts: [HouseholdFactDTO],
        report: String?,
        reported: String?
    ) {
        self.id = id
        self.sectionId = sectionId
        self.title = title
        self.lead = lead
        self.prompt = prompt
        self.confirmed = confirmed
        self.fix = fix
        self.facts = facts
        self.report = report
        self.reported = reported
    }
}

/// What the household has said and can say (`backend/services/householdFacts.js`). Controls
/// appear only when the server sends what they need.
public struct HouseholdPartDTO: Decodable, Sendable, Hashable {
    public let canEdit: Bool
    public let sections: [PropertyRecordSectionDTO]
    public let groups: [HouseholdGroupDTO]
    public let questions: [HouseholdQuestionDTO]
    public let countyPage: HouseholdCountyPageDTO?

    private enum CodingKeys: String, CodingKey {
        case sections, groups, questions
        case canEdit = "can_edit"
        case countyPage = "county_page"
    }
}

/// One change to the household's facts: a fact by `key`, or every fact of a `group` that can take it.
public struct HouseholdFactChange: Encodable, Sendable, Hashable {
    public let key: String?
    public let group: String?
    public let action: String
    public let value: String?

    public static func correct(_ key: String, value: String) -> Self {
        Self(key: key, group: nil, action: "correct", value: value)
    }

    public static func undo(_ key: String) -> Self {
        Self(key: key, group: nil, action: "undo", value: nil)
    }

    public static func confirm(group: String) -> Self {
        Self(key: nil, group: group, action: "confirm", value: nil)
    }

    public static func undoConfirm(group: String) -> Self {
        Self(key: nil, group: group, action: "undo", value: nil)
    }
}

/// Body of `PATCH /api/homes/:id` for the household's facts.
public struct HouseholdFactsRequest: Encodable, Sendable {
    public let householdFacts: [HouseholdFactChange]

    private enum CodingKeys: String, CodingKey {
        case householdFacts = "household_facts"
    }
}

/// Body of `POST /api/homes/:id/record-problem`.
public struct RecordProblemRequest: Encodable, Sendable {
    public let section: String
    public let field: String?
    public let note: String?
}

/// What the household's writes answer: the screen reads again rather than use it.
public struct HouseholdWriteResponse: Decodable, Sendable {}

/// Envelope for `GET /api/homes/:id/property-details`.
public struct PropertyDetailsResponse: Decodable, Sendable {
    public let home: PropertyHomeDTO
    /// The county record; the server sends it to verified owners only.
    public let countyRecord: PropertyCountyRecordDTO?
    /// What the household has said and can say; only for those it's meant for.
    public let household: HouseholdPartDTO?

    private enum CodingKeys: String, CodingKey {
        case home, household
        case countyRecord = "county_record"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        home = try c.decode(PropertyHomeDTO.self, forKey: .home)
        // A record that doesn't decode leaves the home's own facts on screen.
        countyRecord = try? c.decodeIfPresent(PropertyCountyRecordDTO.self, forKey: .countyRecord)
        household = try? c.decodeIfPresent(HouseholdPartDTO.self, forKey: .household)
    }
}
