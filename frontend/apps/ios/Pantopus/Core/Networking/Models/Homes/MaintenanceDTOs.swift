//
//  MaintenanceDTOs.swift
//  Pantopus
//
//  DTOs for the Home Maintenance endpoints under `backend/routes/home.js`
//  (added in T6.3b / P10):
//   - GET    /api/homes/:id/maintenance          (backend/routes/home.js)
//   - POST   /api/homes/:id/maintenance
//   - PUT    /api/homes/:id/maintenance/:taskId
//   - DELETE /api/homes/:id/maintenance/:taskId
//
//  `cost` is a NUMERIC column on the backend (mirrors `HomeBill.amount`),
//  so it can arrive as either a JSON number or a JSON string. The DTO
//  normalises both into `Decimal` the same way `BillDTO` does — a
//  shared helper would be nice; deferred to a future refactor when a
//  third pillar feature needs it.
//

import Foundation

/// One row from `GET /api/homes/:id/maintenance`.
public struct MaintenanceTaskDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let task: String
    public let vendor: String?
    public let cost: Decimal?
    public let recurrence: String
    public let dueDate: String?
    public let status: String
    public let createdAt: String?
    public let updatedAt: String?
    public let createdBy: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case task
        case vendor
        case cost
        case recurrence
        case dueDate = "due_date"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case createdBy = "created_by"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        homeId = try container.decode(String.self, forKey: .homeId)
        task = try container.decodeIfPresent(String.self, forKey: .task) ?? ""
        vendor = try container.decodeIfPresent(String.self, forKey: .vendor)
        cost = try MaintenanceTaskDTO.decodeOptionalDecimal(in: container, key: .cost)
        recurrence = try container.decodeIfPresent(String.self, forKey: .recurrence) ?? "one_time"
        dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "scheduled"
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        createdBy = try container.decodeIfPresent(String.self, forKey: .createdBy)
    }

    public init(
        id: String,
        homeId: String,
        task: String,
        vendor: String? = nil,
        cost: Decimal? = nil,
        recurrence: String = "one_time",
        dueDate: String? = nil,
        status: String = "scheduled",
        createdAt: String? = nil,
        updatedAt: String? = nil,
        createdBy: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.task = task
        self.vendor = vendor
        self.cost = cost
        self.recurrence = recurrence
        self.dueDate = dueDate
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.createdBy = createdBy
    }

    private static func decodeOptionalDecimal<K: CodingKey>(
        in container: KeyedDecodingContainer<K>,
        key: K
    ) throws -> Decimal? {
        if let asString = try? container.decodeIfPresent(String.self, forKey: key) {
            return Decimal(string: asString)
        }
        if let asDouble = try? container.decodeIfPresent(Double.self, forKey: key) {
            return Decimal(string: String(asDouble)) ?? Decimal(asDouble)
        }
        if let asInt = try? container.decodeIfPresent(Int.self, forKey: key) {
            return Decimal(asInt)
        }
        return nil
    }
}

/// Envelope for `GET /api/homes/:id/maintenance`.
public struct GetHomeMaintenanceResponse: Decodable, Sendable {
    public let tasks: [MaintenanceTaskDTO]
}

/// Envelope for `POST /api/homes/:id/maintenance` and
/// `PUT …/:taskId`.
public struct HomeMaintenanceResponse: Decodable, Sendable {
    public let task: MaintenanceTaskDTO
}

/// Body for `POST /api/homes/:id/maintenance`. Server requires
/// `task` (non-empty string); everything else optional.
public struct CreateMaintenanceRequest: Encodable, Sendable {
    public let task: String
    public let vendor: String?
    public let cost: Decimal?
    public let recurrence: String?
    public let dueDate: String?
    public let status: String?

    private enum CodingKeys: String, CodingKey {
        case task
        case vendor
        case cost
        case recurrence
        case dueDate = "due_date"
        case status
    }

    public init(
        task: String,
        vendor: String? = nil,
        cost: Decimal? = nil,
        recurrence: String? = nil,
        dueDate: String? = nil,
        status: String? = nil
    ) {
        self.task = task
        self.vendor = vendor
        self.cost = cost
        self.recurrence = recurrence
        self.dueDate = dueDate
        self.status = status
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(task, forKey: .task)
        if let vendor { try c.encode(vendor, forKey: .vendor) }
        if let cost {
            try c.encode(NSDecimalNumber(decimal: cost).doubleValue, forKey: .cost)
        }
        if let recurrence { try c.encode(recurrence, forKey: .recurrence) }
        if let dueDate { try c.encode(dueDate, forKey: .dueDate) }
        if let status { try c.encode(status, forKey: .status) }
    }
}

/// Body for `PUT /api/homes/:id/maintenance/:taskId`. All fields
/// optional — the server picks up whichever are sent.
public struct UpdateMaintenanceRequest: Encodable, Sendable {
    public let task: String?
    public let vendor: String?
    public let cost: Decimal?
    public let recurrence: String?
    public let dueDate: String?
    public let status: String?

    private enum CodingKeys: String, CodingKey {
        case task
        case vendor
        case cost
        case recurrence
        case dueDate = "due_date"
        case status
    }

    public init(
        task: String? = nil,
        vendor: String? = nil,
        cost: Decimal? = nil,
        recurrence: String? = nil,
        dueDate: String? = nil,
        status: String? = nil
    ) {
        self.task = task
        self.vendor = vendor
        self.cost = cost
        self.recurrence = recurrence
        self.dueDate = dueDate
        self.status = status
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let task { try c.encode(task, forKey: .task) }
        if let vendor { try c.encode(vendor, forKey: .vendor) }
        if let cost {
            try c.encode(NSDecimalNumber(decimal: cost).doubleValue, forKey: .cost)
        }
        if let recurrence { try c.encode(recurrence, forKey: .recurrence) }
        if let dueDate { try c.encode(dueDate, forKey: .dueDate) }
        if let status { try c.encode(status, forKey: .status) }
    }
}
