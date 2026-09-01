//
//  GigFulfillmentDTOs.swift
//  Pantopus
//
//  Shapes for the urgent-task live fulfillment stepper
//  (`GET /api/gigs/:gigId/active-status`, `POST /api/gigs/:gigId/status`)
//  and for the poster's "Close task" delete.
//

import Foundation

/// The fulfillment states the backend's `urgentStatusSchema` accepts
/// (`backend/routes/gigs.js:8675`). `picked_up` / `dropped_off` are the
/// delivery-flavoured aliases of `arrived` / `in_progress` and share
/// their rung on the stepper.
public enum GigFulfillmentStatus: String, Sendable, Hashable, CaseIterable {
    case onTheWay = "on_the_way"
    case arrived
    case pickedUp = "picked_up"
    case droppedOff = "dropped_off"
    case inProgress = "in_progress"

    /// Rung on the four-step stepper (On the way → Arrived → In progress
    /// → Completed). Mirrors RN's `STATUS_ORDER`
    /// (`ActiveTaskPanel.tsx:37`).
    public var stepIndex: Int {
        switch self {
        case .onTheWay: 0
        case .arrived, .pickedUp: 1
        case .droppedOff, .inProgress: 2
        }
    }

    /// Badge copy — RN `getStatusBadge` (`ActiveTaskPanel.tsx:46`).
    public var badgeLabel: String {
        switch self {
        case .onTheWay: "On the way"
        case .arrived: "Arrived"
        case .pickedUp: "Picked up"
        case .droppedOff: "Dropped off"
        case .inProgress: "In progress"
        }
    }
}

/// One rung of the live stepper.
public enum GigFulfillmentStep: Int, Sendable, Hashable, CaseIterable {
    case onTheWay = 0
    case arrived = 1
    case inProgress = 2
    case completed = 3

    /// RN `STATUS_STEPS` (`ActiveTaskPanel.tsx:30`).
    public var label: String {
        switch self {
        case .onTheWay: "On the way"
        case .arrived: "Arrived"
        case .inProgress: "In progress"
        case .completed: "Completed"
        }
    }
}

/// Body for `POST /api/gigs/:gigId/status`.
public struct GigFulfillmentStatusBody: Encodable, Sendable, Equatable {
    public let status: String
    public let helperEtaMinutes: Int?

    public init(status: GigFulfillmentStatus, helperEtaMinutes: Int? = nil) {
        self.status = status.rawValue
        self.helperEtaMinutes = helperEtaMinutes
    }

    enum CodingKeys: String, CodingKey {
        case status
        case helperEtaMinutes = "helper_eta_minutes"
    }
}

/// Helper coordinates riding `active-status` when the poster enabled
/// location sharing (`urgent_details.shareLocationDuringTask`).
public struct GigHelperLocationDTO: Decodable, Sendable, Hashable {
    public let latitude: Double?
    public let longitude: Double?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case latitude, longitude
        case updatedAt = "updated_at"
    }
}

/// Response from `GET /api/gigs/:gigId/active-status`
/// (`backend/routes/gigs.js:8834`).
public struct GigActiveStatusResponse: Decodable, Sendable, Hashable {
    public let gigId: String?
    public let gigStatus: String?
    public let fulfillmentStatus: String?
    public let fulfillmentStatusUpdatedAt: String?
    public let helperEtaMinutes: Int?
    public let helperLocation: GigHelperLocationDTO?

    enum CodingKeys: String, CodingKey {
        case gigId
        case gigStatus = "gig_status"
        case fulfillmentStatus = "fulfillment_status"
        case fulfillmentStatusUpdatedAt = "fulfillment_status_updated_at"
        case helperEtaMinutes = "helper_eta_minutes"
        case helperLocation = "helper_location"
    }

    public init(
        gigId: String? = nil,
        gigStatus: String? = nil,
        fulfillmentStatus: String? = nil,
        fulfillmentStatusUpdatedAt: String? = nil,
        helperEtaMinutes: Int? = nil,
        helperLocation: GigHelperLocationDTO? = nil
    ) {
        self.gigId = gigId
        self.gigStatus = gigStatus
        self.fulfillmentStatus = fulfillmentStatus
        self.fulfillmentStatusUpdatedAt = fulfillmentStatusUpdatedAt
        self.helperEtaMinutes = helperEtaMinutes
        self.helperLocation = helperLocation
    }

    public var status: GigFulfillmentStatus? {
        fulfillmentStatus.flatMap(GigFulfillmentStatus.init(rawValue:))
    }
}

/// Response from `POST /api/gigs/:gigId/status`
/// (`backend/routes/gigs.js:8789`).
public struct GigFulfillmentStatusResponse: Decodable, Sendable, Hashable {
    public let fulfillmentStatus: String?

    enum CodingKeys: String, CodingKey {
        case fulfillmentStatus = "fulfillment_status"
    }
}

/// Response from `DELETE /api/gigs/:id` (`backend/routes/gigs.js:3766`).
public struct GigDeleteResponse: Decodable, Sendable, Hashable {
    public let message: String?
}

/// One shopping / errand line item on a gig (`Gig.items` jsonb, migration
/// `030_context_convert_system.sql:38`). Shared by the composer's edit
/// prefill and the create / update bodies.
public struct GigItemDTO: Codable, Sendable, Hashable {
    public let name: String?
    public let notes: String?
    public let budgetCap: String?
    public let preferredStore: String?

    public init(name: String?, notes: String?, budgetCap: String?, preferredStore: String?) {
        self.name = name
        self.notes = notes
        self.budgetCap = budgetCap
        self.preferredStore = preferredStore
    }

    enum CodingKeys: String, CodingKey {
        case name, notes, budgetCap, preferredStore
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        // The backend stores whatever the client sent — older rows carry a
        // number here, newer ones a string.
        if let text = try? c.decodeIfPresent(String.self, forKey: .budgetCap) {
            budgetCap = text
        } else if let number = try? c.decodeIfPresent(Double.self, forKey: .budgetCap) {
            budgetCap = number.truncatingRemainder(dividingBy: 1) == 0
                ? String(Int(number))
                : String(number)
        } else {
            budgetCap = nil
        }
        preferredStore = try c.decodeIfPresent(String.self, forKey: .preferredStore)
    }
}
