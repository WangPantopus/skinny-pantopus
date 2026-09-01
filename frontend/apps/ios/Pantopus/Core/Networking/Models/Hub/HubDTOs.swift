//
//  HubDTOs.swift
//  Pantopus
//
//  DTOs for the hub endpoints in `backend/routes/hub.js`. All field names
//  are preserved from the route responses (snake_case and camelCase both
//  appear verbatim; the decoder uses per-field coding keys, not
//  convertFromSnakeCase, so surprising case changes never happen).
//

import Foundation

// MARK: - Hub overview (GET /api/hub — backend/routes/hub.js:24)

/// `GET /api/hub` — the hub overview bundle.
public struct HubResponse: Decodable, Sendable, Hashable {
    public let user: HubUser
    public let context: HubContext
    public let availability: HubAvailability
    public let homes: [HubHomeSummary]
    public let businesses: [HubBusinessSummary]
    public let setup: HubSetup
    public let statusItems: [HubStatusItem]
    public let cards: HubCards
    public let jumpBackIn: [HubJumpBackItem]
    public let activity: [HubActivityItem]
    public let neighborDensity: HubNeighborDensity?

    public struct HubUser: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let name: String
        public let firstName: String?
        public let username: String
        public let avatarUrl: String?
        public let email: String
    }

    public struct HubContext: Decodable, Sendable, Hashable {
        public let activeHomeId: String?
        public let activePersona: ActivePersona

        public struct ActivePersona: Decodable, Sendable, Hashable {
            public let type: String
        }
    }

    public struct HubAvailability: Decodable, Sendable, Hashable {
        public let hasHome: Bool
        public let hasBusiness: Bool
        public let hasPayoutMethod: Bool
    }

    public struct HubHomeSummary: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let name: String
        public let addressShort: String
        public let city: String?
        public let state: String?
        public let latitude: Double?
        public let longitude: Double?
        public let isPrimary: Bool
        public let roleBase: String
    }

    public struct HubBusinessSummary: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let name: String
        public let username: String
        public let roleBase: String
    }

    public struct HubSetup: Decodable, Sendable, Hashable {
        public let steps: [HubSetupStep]
        public let allDone: Bool
        public let profileCompleteness: ProfileCompleteness

        public struct HubSetupStep: Decodable, Sendable, Hashable {
            public let key: String
            public let done: Bool
        }

        public struct ProfileCompleteness: Decodable, Sendable, Hashable {
            public let score: Double
            public let checks: Checks
            public let missingFields: [String]

            public struct Checks: Decodable, Sendable, Hashable {
                public let firstName: Bool
                public let lastName: Bool
                public let photo: Bool
                public let bio: Bool
                public let skills: Bool
            }
        }
    }

    public struct HubStatusItem: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let type: String
        public let pillar: String
        public let title: String
        public let subtitle: String?
        public let severity: String
        public let count: Int?
        public let dueAt: String?
        public let route: String
        public let entityRef: EntityRef?

        public struct EntityRef: Decodable, Sendable, Hashable {
            public let kind: String
            public let id: String
        }
    }

    public struct HubCards: Decodable, Sendable, Hashable {
        public let personal: HubPersonalCard
        public let home: HubHomeCard?
        public let business: HubBusinessCard?

        public struct HubPersonalCard: Decodable, Sendable, Hashable {
            public let unreadChats: Int
            public let earnings: Double
            public let gigsNearby: Int
            public let rating: Double
            public let reviewCount: Int
        }

        public struct HubHomeCard: Decodable, Sendable, Hashable {
            public let newMail: Int
            public let billsDue: [HubBill]
            public let tasksDue: [HubTask]
            public let memberCount: Int

            public struct HubBill: Decodable, Sendable, Hashable, Identifiable {
                public let id: String
                public let name: String
                public let amount: Double
                public let dueAt: String
            }

            public struct HubTask: Decodable, Sendable, Hashable, Identifiable {
                public let id: String
                public let title: String
                public let dueAt: String
            }
        }

        public struct HubBusinessCard: Decodable, Sendable, Hashable {
            public let newOrders: Int
            public let unreadThreads: Int
            public let pendingPayout: Double
        }
    }

    public struct HubJumpBackItem: Decodable, Sendable, Hashable {
        public let title: String
        public let route: String
        public let icon: String
    }

    public struct HubActivityItem: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let pillar: String
        public let title: String
        public let at: String
        public let read: Bool
        public let route: String
    }

    public struct HubNeighborDensity: Decodable, Sendable, Hashable {
        public let count: Int
        public let radiusMiles: Double
        public let milestone: String?
    }
}

// MARK: - Hub Today (GET /api/hub/today — backend/routes/hub.js:596)

/// `GET /api/hub/today` — provider-orchestrated response whose precise shape
/// varies by provider (weather, AQI, alerts, signals). We type only the
/// envelope and expose the inner payload as [`JSONValue`](x-source-tag://JSONValue).
public struct HubTodayResponse: Decodable, Sendable, Hashable {
    /// The untyped payload; `nil` when the service reports
    /// `error: CONTEXT_UNAVAILABLE`.
    public let today: JSONValue?
    /// Server-side error signal when context can't be assembled.
    public let error: String?
}

// MARK: - Hub Today (typed payload — P1-F)

/// Typed payload for `GET /api/hub/today`. The legacy `HubTodayResponse`
/// keeps the untyped `JSONValue` shape used by the Hub overview rail; this
/// typed variant backs the full-screen Today briefing.
///
/// IMPORTANT: the route serializes this object at the TOP LEVEL on success
/// (`res.json(result)` in `routes/hub.js`, where `result` is the
/// orchestrator payload — see `getHubToday` in `providerOrchestrator.js`).
/// There is no `today` wrapper key. The only wrapped shape is the failure
/// path `{ today: null, error: "CONTEXT_UNAVAILABLE" }`, and the no-location
/// path sets `display_mode: "hidden"` — both are surfaced here so the
/// view-model can show the error chrome.
public struct HubTodayPayload: Decodable, Sendable, Hashable {
    public let location: TodayLocation?
    public let summary: String?
    /// `hidden` when no usable location is configured; `standard` /
    /// `prominent` otherwise.
    public let displayMode: String?
    public let weather: TodayWeather?
    public let aqi: TodayAQI?
    public let alerts: [TodayAlert]?
    public let signals: [TodaySignalDTO]?
    public let seasonal: TodaySeasonal?
    /// Present only on the failure path (`CONTEXT_UNAVAILABLE`).
    public let error: String?

    /// True when the payload carries a renderable briefing (not the error
    /// or hidden-location path).
    public var isRenderable: Bool {
        error == nil && displayMode != "hidden"
    }

    private enum CodingKeys: String, CodingKey {
        case location, summary
        case displayMode = "display_mode"
        case weather, aqi, alerts, signals, seasonal, error
    }

    public struct TodayLocation: Decodable, Sendable, Hashable {
        public let label: String?
        public let timezone: String?
        public let latitude: Double?
        public let longitude: Double?
    }

    public struct TodayWeather: Decodable, Sendable, Hashable {
        public let currentTempF: Double?
        public let conditionCode: String?
        public let conditionLabel: String?
        public let highF: Double?
        public let lowF: Double?
        public let precipitationNext6h: Bool?

        private enum CodingKeys: String, CodingKey {
            case currentTempF = "current_temp_f"
            case conditionCode = "condition_code"
            case conditionLabel = "condition_label"
            case highF = "high_f"
            case lowF = "low_f"
            case precipitationNext6h = "precipitation_next_6h"
        }
    }

    public struct TodayAQI: Decodable, Sendable, Hashable {
        public let index: Int?
        public let category: String?
        public let isNoteworthy: Bool?

        private enum CodingKeys: String, CodingKey {
            case index, category
            case isNoteworthy = "is_noteworthy"
        }
    }

    public struct TodayAlert: Decodable, Sendable, Hashable {
        public let id: String?
        public let severity: String?
        public let title: String?
        public let startsAt: String?
        public let endsAt: String?

        private enum CodingKeys: String, CodingKey {
            case id, severity, title
            case startsAt = "starts_at"
            case endsAt = "ends_at"
        }
    }

    /// `data` is provider-specific (untyped on the wire) and unused by the
    /// briefing, so the decoder simply ignores it.
    public struct TodaySignalDTO: Decodable, Sendable, Hashable {
        public let kind: String?
        public let label: String?
        public let detail: String?
        public let urgency: String?
        public let action: String?
    }

    public struct TodaySeasonal: Decodable, Sendable, Hashable {
        public let season: String?
        public let tip: String?
    }
}

// MARK: - Briefing delivery (GET /api/hub/briefings/:id — backend/routes/hub.js:612)

/// `GET /api/hub/briefings/:id` envelope — `{ briefing: … }`.
public struct BriefingDeliveryResponse: Decodable, Sendable, Hashable {
    public let briefing: BriefingDeliveryDTO
}

/// One stored Morning/Evening Briefing delivery. Selected columns are listed
/// verbatim at `backend/routes/hub.js:622`; `signals_snapshot` is a jsonb
/// array whose element shape matches `HubTodayPayload.TodaySignalDTO`.
public struct BriefingDeliveryDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let briefingDateLocal: String?
    /// `morning` | `evening`.
    public let briefingKind: String?
    public let summaryText: String?
    public let signalsSnapshot: [HubTodayPayload.TodaySignalDTO]?
    public let locationGeohash: String?
    public let compositionMode: String?
    public let status: String?
    public let deliveredAt: String?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case briefingDateLocal = "briefing_date_local"
        case briefingKind = "briefing_kind"
        case summaryText = "summary_text"
        case signalsSnapshot = "signals_snapshot"
        case locationGeohash = "location_geohash"
        case compositionMode = "composition_mode"
        case status
        case deliveredAt = "delivered_at"
        case createdAt = "created_at"
    }

    /// `signals_snapshot` is untyped jsonb written by the briefing composer,
    /// so a shape drift there must not take the whole briefing down —
    /// it decodes leniently and degrades to `nil`.
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        briefingDateLocal = try container.decodeIfPresent(String.self, forKey: .briefingDateLocal)
        briefingKind = try container.decodeIfPresent(String.self, forKey: .briefingKind)
        summaryText = try container.decodeIfPresent(String.self, forKey: .summaryText)
        signalsSnapshot = try? container.decodeIfPresent(
            [HubTodayPayload.TodaySignalDTO].self,
            forKey: .signalsSnapshot
        )
        locationGeohash = try container.decodeIfPresent(String.self, forKey: .locationGeohash)
        compositionMode = try container.decodeIfPresent(String.self, forKey: .compositionMode)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        deliveredAt = try container.decodeIfPresent(String.self, forKey: .deliveredAt)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }
}

// MARK: - Hub Discovery (GET /api/hub/discovery — backend/routes/hub.js:757)

/// `GET /api/hub/discovery` response envelope.
///
/// T5.4.1 — extended additively for the Discover hub screen. The legacy
/// `meta` field stays intact (used by the Hub Discovery rail at
/// `Features/Hub/Sections/HubSections.swift:281`); new optional fields
/// (`subtitle`, `price`, `rating`, `verified`, `isFree`, `isWanted`,
/// `createdAt`) carry the structured payload the typed Discover hub
/// rows render. Backend default for filters and shape lives at
/// `backend/routes/hub.js:757`.
public struct HubDiscoveryResponse: Decodable, Sendable, Hashable {
    public let items: [Item]

    public struct Item: Decodable, Sendable, Hashable, Identifiable {
        public let id: String
        public let type: String
        public let title: String
        public let meta: String
        public let category: String?
        public let avatarUrl: String?
        public let route: String

        // MARK: T5.4.1 additive fields

        /// Pre-rendered single-line subtitle for the typed-row layout.
        /// Falls back to `meta` at the call site if absent.
        public let subtitle: String?
        /// Display string for the price column (e.g. `$45`, `Free`,
        /// `Wanted`). Listings + gigs only.
        public let price: String?
        /// Numeric rating for the per-row star render (people +
        /// businesses).
        public let rating: Double?
        /// True for the chip-strip "Verified" filter — the backend
        /// derives this per-type (people: rating present; businesses:
        /// published profile).
        public let verified: Bool?
        /// True for `price == 0` listings/gigs — chip-strip "Free /
        /// wanted" filter on the client side.
        public let isFree: Bool?
        /// True for `is_wanted` listings — same chip-strip filter.
        public let isWanted: Bool?
        /// ISO-8601 created timestamp; the chip-strip "New today"
        /// filter uses this to keep items within 24h.
        public let createdAt: String?
    }
}
