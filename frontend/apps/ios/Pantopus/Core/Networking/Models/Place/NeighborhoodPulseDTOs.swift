//
//  NeighborhoodPulseDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/ai/pulse` — the Neighborhood Pulse, the
//  priority-ranked signal stream behind the Place "Today's Pulse"
//  surface. Route: `backend/routes/ai.js:332`. Mirrors the
//  `NeighborhoodPulse` shape in `frontend/packages/types/src/ai.ts`.
//

import Foundation

public struct PulseSignalAction: Decodable, Sendable, Hashable {
    /// "create_gig" | "view" | "invite" (open vocabulary — render-only).
    public let type: String
    public let label: String
    public let route: String
}

public struct PulseSignal: Decodable, Sendable, Hashable {
    /// "air_quality" | "weather" | "seasonal_suggestion" | "community" |
    /// "local_services" (open vocabulary — render-only).
    public let signalType: String
    public let priority: Int
    public let title: String
    public let detail: String
    public let icon: String
    public let color: String
    public let actions: [PulseSignalAction]?

    private enum CodingKeys: String, CodingKey {
        case priority, title, detail, icon, color, actions
        case signalType = "signal_type"
    }
}

public struct PulseProperty: Decodable, Sendable, Hashable {
    public let yearBuilt: Int?
    public let sqft: Int?
    public let estimatedValue: Double?
    public let zipMedianValue: Double?
    public let propertyType: String?

    private enum CodingKeys: String, CodingKey {
        case sqft
        case yearBuilt = "year_built"
        case estimatedValue = "estimated_value"
        case zipMedianValue = "zip_median_value"
        case propertyType = "property_type"
    }
}

public struct PulseNeighborhood: Decodable, Sendable, Hashable {
    public let medianHomeValue: Double?
    public let medianHouseholdIncome: Double?
    public let medianYearBuilt: Int?
    public let walkScore: Int?
    public let walkDescription: String?
    public let transitScore: Int?
    public let bikeScore: Int?
    public let floodZone: String?
    public let floodZoneDescription: String?

    private enum CodingKeys: String, CodingKey {
        case medianHomeValue = "median_home_value"
        case medianHouseholdIncome = "median_household_income"
        case medianYearBuilt = "median_year_built"
        case walkScore = "walk_score"
        case walkDescription = "walk_description"
        case transitScore = "transit_score"
        case bikeScore = "bike_score"
        case floodZone = "flood_zone"
        case floodZoneDescription = "flood_zone_description"
    }
}

public struct PulseFirstActionNudge: Decodable, Sendable, Hashable {
    public let prompt: String
    public let route: String
    public let gigCategory: String?
    public let gigTitle: String?

    private enum CodingKeys: String, CodingKey {
        case prompt, route
        case gigCategory = "gig_category"
        case gigTitle = "gig_title"
    }
}

public struct PulseSeasonalContext: Decodable, Sendable, Hashable {
    public let season: String
    public let tip: String?
    public let firstActionNudge: PulseFirstActionNudge?

    private enum CodingKeys: String, CodingKey {
        case season, tip
        case firstActionNudge = "first_action_nudge"
    }
}

public struct PulseCommunityDensity: Decodable, Sendable, Hashable {
    public let neighborCount: Int
    public let densityMessage: String
    public let inviteCta: Bool

    private enum CodingKeys: String, CodingKey {
        case neighborCount = "neighbor_count"
        case densityMessage = "density_message"
        case inviteCta = "invite_cta"
    }
}

public struct PulseSource: Decodable, Sendable, Hashable {
    public let provider: String
    public let updatedAt: String

    private enum CodingKeys: String, CodingKey {
        case provider
        case updatedAt = "updated_at"
    }
}

public struct PulseMeta: Decodable, Sendable, Hashable {
    public let communitySignalsCount: Int
    public let externalSignalsCount: Int
    public let partialFailures: [String]
    public let computedAt: String

    private enum CodingKeys: String, CodingKey {
        case communitySignalsCount = "community_signals_count"
        case externalSignalsCount = "external_signals_count"
        case partialFailures = "partial_failures"
        case computedAt = "computed_at"
    }
}

public struct PulsePayload: Decodable, Sendable, Hashable {
    public let greeting: String
    public let summary: String
    /// "active" | "quiet" | "advisory" | "alert" (open vocabulary).
    public let overallStatus: String
    public let property: PulseProperty?
    public let neighborhood: PulseNeighborhood?
    public let signals: [PulseSignal]
    public let seasonalContext: PulseSeasonalContext
    public let communityDensity: PulseCommunityDensity
    public let sources: [PulseSource]
    public let meta: PulseMeta

    private enum CodingKeys: String, CodingKey {
        case greeting, summary, property, neighborhood, signals, sources, meta
        case overallStatus = "overall_status"
        case seasonalContext = "seasonal_context"
        case communityDensity = "community_density"
    }
}

/// `GET /api/ai/pulse?homeId=` envelope.
public struct NeighborhoodPulse: Decodable, Sendable, Hashable {
    public let pulse: PulsePayload
}
