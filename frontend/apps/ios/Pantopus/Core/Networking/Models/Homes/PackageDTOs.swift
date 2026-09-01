//
//  PackageDTOs.swift
//  Pantopus
//
//  DTOs for the Home Packages endpoints under `backend/routes/home.js`:
//   - GET  /api/homes/:id/packages                  (line 4673)
//   - POST /api/homes/:id/packages                  (line 4706)
//   - PUT  /api/homes/:id/packages/:packageId       (line 4746)
//
//  Backend table is `HomePackage` (schema.sql:6552). Status is enforced
//  by a CHECK constraint to one of six values — see `PackageStatus` on
//  the consumer side.
//

import Foundation

/// One row from `GET /api/homes/:id/packages`.
public struct PackageDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let carrier: String?
    public let trackingNumber: String?
    public let vendorName: String?
    public let description: String?
    public let deliveryInstructions: String?
    public let status: String
    public let expectedAt: String?
    public let deliveredAt: String?
    public let pickedUpBy: String?
    public let createdBy: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let visibility: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case carrier
        case trackingNumber = "tracking_number"
        case vendorName = "vendor_name"
        case description
        case deliveryInstructions = "delivery_instructions"
        case status
        case expectedAt = "expected_at"
        case deliveredAt = "delivered_at"
        case pickedUpBy = "picked_up_by"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case visibility
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        homeId = try c.decode(String.self, forKey: .homeId)
        carrier = try c.decodeIfPresent(String.self, forKey: .carrier)
        trackingNumber = try c.decodeIfPresent(String.self, forKey: .trackingNumber)
        vendorName = try c.decodeIfPresent(String.self, forKey: .vendorName)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        deliveryInstructions = try c.decodeIfPresent(String.self, forKey: .deliveryInstructions)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "expected"
        expectedAt = try c.decodeIfPresent(String.self, forKey: .expectedAt)
        deliveredAt = try c.decodeIfPresent(String.self, forKey: .deliveredAt)
        pickedUpBy = try c.decodeIfPresent(String.self, forKey: .pickedUpBy)
        createdBy = try c.decodeIfPresent(String.self, forKey: .createdBy)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        visibility = try c.decodeIfPresent(String.self, forKey: .visibility)
    }

    public init(
        id: String,
        homeId: String,
        carrier: String? = nil,
        trackingNumber: String? = nil,
        vendorName: String? = nil,
        description: String? = nil,
        deliveryInstructions: String? = nil,
        status: String,
        expectedAt: String? = nil,
        deliveredAt: String? = nil,
        pickedUpBy: String? = nil,
        createdBy: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        visibility: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.carrier = carrier
        self.trackingNumber = trackingNumber
        self.vendorName = vendorName
        self.description = description
        self.deliveryInstructions = deliveryInstructions
        self.status = status
        self.expectedAt = expectedAt
        self.deliveredAt = deliveredAt
        self.pickedUpBy = pickedUpBy
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.visibility = visibility
    }
}

/// Envelope for `GET /api/homes/:id/packages`.
public struct GetHomePackagesResponse: Decodable, Sendable {
    public let packages: [PackageDTO]
}

/// Envelope for `POST /api/homes/:id/packages` and
/// `PUT …/:packageId` — the backend wraps the inserted/updated row in
/// `{ "package": … }`.
public struct HomePackageResponse: Decodable, Sendable {
    public let package: PackageDTO
}

/// Body for `POST /api/homes/:id/packages`. All fields optional — the
/// server defaults `status` to `expected`.
public struct CreatePackageRequest: Encodable, Sendable {
    public let carrier: String?
    public let trackingNumber: String?
    public let vendorName: String?
    public let description: String?
    public let deliveryInstructions: String?
    public let expectedAt: String?

    private enum CodingKeys: String, CodingKey {
        case carrier
        case trackingNumber = "tracking_number"
        case vendorName = "vendor_name"
        case description
        case deliveryInstructions = "delivery_instructions"
        case expectedAt = "expected_at"
    }

    public init(
        carrier: String? = nil,
        trackingNumber: String? = nil,
        vendorName: String? = nil,
        description: String? = nil,
        deliveryInstructions: String? = nil,
        expectedAt: String? = nil
    ) {
        self.carrier = carrier
        self.trackingNumber = trackingNumber
        self.vendorName = vendorName
        self.description = description
        self.deliveryInstructions = deliveryInstructions
        self.expectedAt = expectedAt
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let carrier { try c.encode(carrier, forKey: .carrier) }
        if let trackingNumber { try c.encode(trackingNumber, forKey: .trackingNumber) }
        if let vendorName { try c.encode(vendorName, forKey: .vendorName) }
        if let description { try c.encode(description, forKey: .description) }
        if let deliveryInstructions {
            try c.encode(deliveryInstructions, forKey: .deliveryInstructions)
        }
        if let expectedAt { try c.encode(expectedAt, forKey: .expectedAt) }
    }
}

/// Body for `PUT /api/homes/:id/packages/:packageId`. All fields optional;
/// the server picks up whichever are sent. The handler also auto-fills
/// `delivered_at = now` when `status` flips to `delivered` and
/// `picked_up_by = me` when `status` flips to `picked_up`.
public struct UpdatePackageRequest: Encodable, Sendable {
    public let status: String?
    public let deliveredAt: String?
    public let pickedUpBy: String?
    public let carrier: String?
    public let trackingNumber: String?
    public let description: String?
    public let deliveryInstructions: String?
    public let expectedAt: String?

    private enum CodingKeys: String, CodingKey {
        case status
        case deliveredAt = "delivered_at"
        case pickedUpBy = "picked_up_by"
        case carrier
        case trackingNumber = "tracking_number"
        case description
        case deliveryInstructions = "delivery_instructions"
        case expectedAt = "expected_at"
    }

    public init(
        status: String? = nil,
        deliveredAt: String? = nil,
        pickedUpBy: String? = nil,
        carrier: String? = nil,
        trackingNumber: String? = nil,
        description: String? = nil,
        deliveryInstructions: String? = nil,
        expectedAt: String? = nil
    ) {
        self.status = status
        self.deliveredAt = deliveredAt
        self.pickedUpBy = pickedUpBy
        self.carrier = carrier
        self.trackingNumber = trackingNumber
        self.description = description
        self.deliveryInstructions = deliveryInstructions
        self.expectedAt = expectedAt
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let status { try c.encode(status, forKey: .status) }
        if let deliveredAt { try c.encode(deliveredAt, forKey: .deliveredAt) }
        if let pickedUpBy { try c.encode(pickedUpBy, forKey: .pickedUpBy) }
        if let carrier { try c.encode(carrier, forKey: .carrier) }
        if let trackingNumber { try c.encode(trackingNumber, forKey: .trackingNumber) }
        if let description { try c.encode(description, forKey: .description) }
        if let deliveryInstructions {
            try c.encode(deliveryInstructions, forKey: .deliveryInstructions)
        }
        if let expectedAt { try c.encode(expectedAt, forKey: .expectedAt) }
    }
}
