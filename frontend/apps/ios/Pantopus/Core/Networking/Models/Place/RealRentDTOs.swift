//
//  RealRentDTOs.swift
//  Pantopus
//
//  The resident's own contribution to the Real Rent benchmark (Wave 3).
//  The block AGGREGATE never rides these routes — it arrives on the
//  intelligence contract's `real_rent` section, behind the k>=10 floor
//  (see `PlaceRealRentData`). This is only the caller's own figure:
//  what they pay, which only a VERIFIED occupant may report, because
//  "ten neighbors who proved they live here" is the entire difference
//  between this and a listings-site estimate.
//

import Foundation

/// One resident's own rent report for one home.
public struct RentReport: Decodable, Sendable, Hashable {
    /// Whole dollars per month, as the resident entered it.
    public let monthlyRent: Double
    /// The bedroom count the report is FOR — the caller's value, else
    /// the home's. Nil when neither is known.
    public let bedrooms: Int?
    public let reportedAt: String
    public let updatedAt: String

    private enum CodingKeys: String, CodingKey {
        case monthlyRent = "monthly_rent"
        case bedrooms
        case reportedAt = "reported_at"
        case updatedAt = "updated_at"
    }
}

/// `PUT` body. `bedrooms` is omitted when the resident leaves it blank,
/// so the server falls back to the home's own bedroom count.
public struct SetRentReportRequest: Encodable, Sendable {
    public let monthlyRent: Double
    public let bedrooms: Int?

    public init(monthlyRent: Double, bedrooms: Int? = nil) {
        self.monthlyRent = monthlyRent
        self.bedrooms = bedrooms
    }

    private enum CodingKeys: String, CodingKey {
        case monthlyRent = "monthly_rent"
        case bedrooms
    }
}

/// `{"report": …}` — null on GET when the caller has not reported.
public struct RentReportResponse: Decodable, Sendable {
    public let report: RentReport?
}

/// `{"removed": true}` from the DELETE.
public struct RemoveRentReportResponse: Decodable, Sendable {
    public let removed: Bool
}
