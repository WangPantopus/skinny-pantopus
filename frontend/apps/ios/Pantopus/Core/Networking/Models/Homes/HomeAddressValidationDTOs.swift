import Foundation

/// Canonical validation is separate from checking whether a Home already exists.
public struct HomeAddressValidationRequest: Encodable, Sendable {
    public let line1: String
    public let line2: String?
    public let city: String
    public let state: String
    public let zip: String
}

public struct HomeAddressValidationResponse: Decodable, Sendable {
    public let addressId: String?
    public let verdict: Verdict

    public struct Verdict: Decodable, Sendable {
        public let status: String
        public let normalized: Address?
    }

    public struct Address: Decodable, Sendable {
        public let line1: String
        public let line2: String?
        public let city: String
        public let state: String
        public let zip: String
        public let lat: Double
        public let lng: Double

        public var isValid: Bool {
            [line1, city, state, zip].allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                && lat.isFinite && lng.isFinite && (-90...90).contains(lat) && (-180...180).contains(lng)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case addressId = "address_id"
        case verdict
    }
}
