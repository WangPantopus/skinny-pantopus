//
//  NormalizedAddressDTO.swift
//  Pantopus
//

import Foundation

/// Canonical address returned by validation/geocode routes when a
/// provider normalized the user's raw input.
public struct NormalizedAddressDTO: Decodable, Sendable, Hashable {
    public let street: String?
    public let unit: String?
    public let city: String?
    public let state: String?
    public let zipCode: String?
    public let latitude: Double?
    public let longitude: Double?
    public let isMultiUnit: Bool?

    public init(
        street: String? = nil,
        unit: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zipCode: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        isMultiUnit: Bool? = nil
    ) {
        self.street = street
        self.unit = unit
        self.city = city
        self.state = state
        self.zipCode = zipCode
        self.latitude = latitude
        self.longitude = longitude
        self.isMultiUnit = isMultiUnit
    }

    private enum CodingKeys: String, CodingKey {
        case address
        case street
        case addressLine1
        case addressLine1Snake = "address_line1"
        case unit
        case unitNumber = "unit_number"
        case city
        case state
        case zipCode
        case zipCodeSnake = "zip_code"
        case zipcode
        case postalCode
        case postalCodeSnake = "postal_code"
        case latitude
        case longitude
        case lat
        case lng
        case isMultiUnit = "is_multi_unit"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        street = try Self.decodeFirstString(
            in: container,
            keys: [.street, .address, .addressLine1, .addressLine1Snake]
        )
        unit = try Self.decodeFirstString(in: container, keys: [.unit, .unitNumber])
        city = try container.decodeIfPresent(String.self, forKey: .city)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        zipCode = try Self.decodeFirstString(
            in: container,
            keys: [.zipCode, .zipCodeSnake, .zipcode, .postalCode, .postalCodeSnake]
        )
        latitude = try Self.decodeFirstDouble(in: container, keys: [.latitude, .lat])
        longitude = try Self.decodeFirstDouble(in: container, keys: [.longitude, .lng])
        isMultiUnit = try container.decodeIfPresent(Bool.self, forKey: .isMultiUnit)
    }

    private static func decodeFirstString(
        in container: KeyedDecodingContainer<CodingKeys>,
        keys: [CodingKeys]
    ) throws -> String? {
        for key in keys {
            if let value = try container.decodeIfPresent(String.self, forKey: key),
               !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return value
            }
        }
        return nil
    }

    private static func decodeFirstDouble(
        in container: KeyedDecodingContainer<CodingKeys>,
        keys: [CodingKeys]
    ) throws -> Double? {
        for key in keys {
            if let value = try container.decodeIfPresent(Double.self, forKey: key) {
                return value
            }
        }
        return nil
    }
}
