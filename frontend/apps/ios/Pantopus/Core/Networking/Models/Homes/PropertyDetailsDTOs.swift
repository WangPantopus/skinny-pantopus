//
//  PropertyDetailsDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/homes/:id/property-details` — route
//  `backend/routes/home.js:1949`. The `home` property fields and the
//  verified owner's `county_record` (the ATTOM record as labeled sections)
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

/// `county_record`: the verified owner's ATTOM record as labeled sections,
/// worded and formatted by `backend/serializers/countyRecordSerializer.js`.
public struct PropertyCountyRecordDTO: Decodable, Sendable, Hashable {
    public let sections: [PropertyRecordSectionDTO]
    /// "From county records via ATTOM · updated Sep 28, 2026".
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
}

/// Envelope for `GET /api/homes/:id/property-details`.
public struct PropertyDetailsResponse: Decodable, Sendable {
    public let home: PropertyHomeDTO
    /// The county record; the server sends it to verified owners only.
    public let countyRecord: PropertyCountyRecordDTO?

    private enum CodingKeys: String, CodingKey {
        case home
        case countyRecord = "county_record"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        home = try c.decode(PropertyHomeDTO.self, forKey: .home)
        // A record that doesn't decode leaves the home's own facts on screen.
        countyRecord = try? c.decodeIfPresent(PropertyCountyRecordDTO.self, forKey: .countyRecord)
    }
}
