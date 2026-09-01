//
//  PlaceIntelligenceDTOs.swift
//  Pantopus
//
//  The Place Intelligence section-envelope contract. Mirrors the web
//  source of truth `frontend/packages/types/src/placeIntelligence.ts`
//  and the backend serializer
//  `backend/serializers/placeIntelligenceSerializer.js` — keep the
//  three in lockstep.
//
//  Decoding stance: the section list is an OPEN set (new sections land
//  server-side first), so `PlaceSectionID` / `PlaceGroup` carry an
//  `.unknown` case instead of failing the whole dashboard, and a
//  malformed section payload degrades that one section to `data: nil`
//  rather than throwing away the response. Closed display enums
//  (condition codes, buckets, …) also decode unrecognized raw values
//  to `.unknown` so a server vocabulary addition can't break older
//  clients. Contract drift is caught by the fixture tests in
//  `PantopusTests/Features/Place/PlaceIntelligenceDecodingTests.swift`.
//
// swiftlint:disable file_length

import Foundation

// swiftlint:disable cyclomatic_complexity

// MARK: - Trust ladder / gating axes

/// Trust ladder T0–T4 (product design doc §3).
public enum PlaceTier: String, Decodable, Sendable, Hashable {
    case t0 = "T0"
    case t1 = "T1"
    case t2 = "T2"
    case t3 = "T3"
    case t4 = "T4"
}

/// Sensitivity band (§9.1): A public place · B public property record ·
/// C private inputs · D trust/identity tools.
public enum PlaceBand: String, Decodable, Sendable, Hashable {
    case a = "A"
    case b = "B"
    case c = "C"
    case d = "D"
}

/// Per-section access for the viewer's tier. Unrecognized values decode
/// to `.locked` — never show data the client doesn't understand the
/// gating of.
public enum PlaceSectionAccess: String, Sendable, Hashable {
    case available
    case preview
    case locked
}

extension PlaceSectionAccess: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlaceSectionAccess(rawValue: raw) ?? .locked
    }
}

/// Data freshness/availability. Unrecognized values decode to
/// `.unavailable` (the quiet degraded state, not the noisy error one).
public enum PlaceSectionStatus: String, Sendable, Hashable {
    case ready
    case partial
    case unavailable
    case stale
    case error
}

extension PlaceSectionStatus: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlaceSectionStatus(rawValue: raw) ?? .unavailable
    }
}

/// Source coverage for the address. Unrecognized values decode to `.partial`.
public enum PlaceCoverage: String, Sendable, Hashable {
    case full
    case partial
    case none
}

extension PlaceCoverage: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlaceCoverage(rawValue: raw) ?? .partial
    }
}

// MARK: - Groups (open set)

/// The eight curated presentation groups (§8.2), plus `.unknown` for
/// groups added server-side after this build shipped (the group block's
/// server-rendered `label` keeps those renderable).
public enum PlaceGroup: Sendable, Hashable {
    case today
    case yourHome
    case riskReadiness
    case healthEnvironment
    case yourBlock
    case moneySignals
    case civic
    case identity
    case unknown(String)

    public init(rawValue: String) {
        switch rawValue {
        case "today": self = .today
        case "your_home": self = .yourHome
        case "risk_readiness": self = .riskReadiness
        case "health_environment": self = .healthEnvironment
        case "your_block": self = .yourBlock
        case "money_signals": self = .moneySignals
        case "civic": self = .civic
        case "identity": self = .identity
        default: self = .unknown(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .today: "today"
        case .yourHome: "your_home"
        case .riskReadiness: "risk_readiness"
        case .healthEnvironment: "health_environment"
        case .yourBlock: "your_block"
        case .moneySignals: "money_signals"
        case .civic: "civic"
        case .identity: "identity"
        case let .unknown(raw): raw
        }
    }
}

extension PlaceGroup: Decodable {
    public init(from decoder: Decoder) throws {
        try self.init(rawValue: decoder.singleValueContainer().decode(String.self))
    }
}

// MARK: - Section ids (open set)

/// The 18 launch-set section ids, plus `.unknown` for sections added
/// server-side after this build shipped (rendered envelope-only).
public enum PlaceSectionID: Sendable, Hashable {
    case weather
    case airQuality
    case alerts
    case sunriseSunset
    case yourHome
    case flood
    case seismic
    case wildfire
    case leadRadon
    case drinkingWater
    case environmentalHazards
    case blockDensity
    case censusContext
    case billBenchmark
    case incentives
    case rentBand
    case civicDistricts
    case civicElection
    case unknown(String)

    public init(rawValue: String) {
        switch rawValue {
        case "weather": self = .weather
        case "air_quality": self = .airQuality
        case "alerts": self = .alerts
        case "sunrise_sunset": self = .sunriseSunset
        case "your_home": self = .yourHome
        case "flood": self = .flood
        case "seismic": self = .seismic
        case "wildfire": self = .wildfire
        case "lead_radon": self = .leadRadon
        case "drinking_water": self = .drinkingWater
        case "environmental_hazards": self = .environmentalHazards
        case "block_density": self = .blockDensity
        case "census_context": self = .censusContext
        case "bill_benchmark": self = .billBenchmark
        case "incentives": self = .incentives
        case "rent_band": self = .rentBand
        case "civic_districts": self = .civicDistricts
        case "civic_election": self = .civicElection
        default: self = .unknown(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .weather: "weather"
        case .airQuality: "air_quality"
        case .alerts: "alerts"
        case .sunriseSunset: "sunrise_sunset"
        case .yourHome: "your_home"
        case .flood: "flood"
        case .seismic: "seismic"
        case .wildfire: "wildfire"
        case .leadRadon: "lead_radon"
        case .drinkingWater: "drinking_water"
        case .environmentalHazards: "environmental_hazards"
        case .blockDensity: "block_density"
        case .censusContext: "census_context"
        case .billBenchmark: "bill_benchmark"
        case .incentives: "incentives"
        case .rentBand: "rent_band"
        case .civicDistricts: "civic_districts"
        case .civicElection: "civic_election"
        case let .unknown(raw): raw
        }
    }
}

extension PlaceSectionID: Decodable {
    public init(from decoder: Decoder) throws {
        try self.init(rawValue: decoder.singleValueContainer().decode(String.self))
    }
}

// MARK: - Today section payloads

/// Weather condition vocabulary. The server always ships a human
/// `condition_label`, so `.unknown` still renders — it only loses the
/// specific glyph.
public enum WeatherConditionCode: String, Sendable, Hashable {
    case clear
    case partlyCloudy = "partly_cloudy"
    case cloudy
    case fog
    case rain
    case snow
    case sleet
    case thunderstorm
    case wind
    case unknown
}

extension WeatherConditionCode: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = WeatherConditionCode(rawValue: raw) ?? .unknown
    }
}

public struct PlaceWeatherHour: Decodable, Sendable, Hashable {
    /// ISO 8601 timestamp for the hour.
    public let time: String
    public let tempF: Double
    public let conditionCode: WeatherConditionCode
    /// 0–100.
    public let precipChance: Double

    private enum CodingKeys: String, CodingKey {
        case time
        case tempF = "temp_f"
        case conditionCode = "condition_code"
        case precipChance = "precip_chance"
    }
}

public struct PlaceWeatherDay: Decodable, Sendable, Hashable {
    /// ISO 8601 date.
    public let date: String
    public let conditionCode: WeatherConditionCode
    public let highF: Double
    public let lowF: Double
    /// 0–100.
    public let precipChance: Double

    private enum CodingKeys: String, CodingKey {
        case date
        case conditionCode = "condition_code"
        case highF = "high_f"
        case lowF = "low_f"
        case precipChance = "precip_chance"
    }
}

/// Launch layer #1 — Weather (NOAA / NWS).
public struct PlaceWeatherData: Decodable, Sendable, Hashable {
    public let currentTempF: Double
    public let conditionCode: WeatherConditionCode
    /// Human label, e.g. "Clear".
    public let conditionLabel: String
    public let feelsLikeF: Double?
    public let highF: Double?
    public let lowF: Double?
    /// Hourly strip; may be empty on the dashboard summary.
    public let hourly: [PlaceWeatherHour]
    /// 5-day forecast; may be empty on the dashboard summary.
    public let daily: [PlaceWeatherDay]

    private enum CodingKeys: String, CodingKey {
        case hourly, daily
        case currentTempF = "current_temp_f"
        case conditionCode = "condition_code"
        case conditionLabel = "condition_label"
        case feelsLikeF = "feels_like_f"
        case highF = "high_f"
        case lowF = "low_f"
    }
}

public enum AirQualityCategory: String, Sendable, Hashable {
    case good
    case moderate
    case unhealthySensitive = "unhealthy_sensitive"
    case unhealthy
    case veryUnhealthy = "very_unhealthy"
    case hazardous
    case unknown
}

extension AirQualityCategory: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = AirQualityCategory(rawValue: raw) ?? .unknown
    }
}

/// Launch layer #2 — Air quality (AirNow / EPA).
public struct PlaceAirQualityData: Decodable, Sendable, Hashable {
    /// US Air Quality Index, e.g. 38.
    public let index: Int
    public let category: AirQualityCategory
    /// Human label, e.g. "Good".
    public let categoryLabel: String
    /// e.g. "pm25" | "ozone"; nil when unknown.
    public let dominantPollutant: String?
    /// Plain "what it means" copy.
    public let healthMessage: String

    private enum CodingKeys: String, CodingKey {
        case index, category
        case categoryLabel = "category_label"
        case dominantPollutant = "dominant_pollutant"
        case healthMessage = "health_message"
    }
}

public enum WeatherAlertSeverity: String, Sendable, Hashable {
    case advisory
    case watch
    case warning
    case unknown
}

extension WeatherAlertSeverity: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = WeatherAlertSeverity(rawValue: raw) ?? .unknown
    }
}

public struct PlaceWeatherAlert: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// e.g. "Wind Advisory".
    public let event: String
    public let severity: WeatherAlertSeverity
    /// Short timing line, e.g. "In effect until 6:00 PM today".
    public let headline: String
    /// Body copy / instruction.
    public let description: String
    /// ISO 8601.
    public let onset: String?
    /// ISO 8601.
    public let ends: String?
}

/// NWS active alerts — an empty `active` list renders "No active alerts".
public struct PlaceAlertsData: Decodable, Sendable, Hashable {
    public let active: [PlaceWeatherAlert]
}

/// Sunrise / sunset — rides the NOAA / Open-Meteo feed.
public struct PlaceSunriseSunsetData: Decodable, Sendable, Hashable {
    /// ISO 8601.
    public let sunrise: String
    /// ISO 8601.
    public let sunset: String
    public let daylightMinutes: Int

    private enum CodingKeys: String, CodingKey {
        case sunrise, sunset
        case daylightMinutes = "daylight_minutes"
    }
}

// MARK: - Risk & readiness payloads

public enum FloodRiskLevel: String, Sendable, Hashable {
    case minimal
    case moderate
    case high
    case unknown
}

extension FloodRiskLevel: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = FloodRiskLevel(rawValue: raw) ?? .unknown
    }
}

/// Launch layer #3 — Flood (FEMA National Flood Hazard Layer).
public struct PlaceFloodData: Decodable, Sendable, Hashable {
    /// FEMA zone code, e.g. "X".
    public let zone: String
    /// Human label, e.g. "Zone X".
    public let zoneLabel: String
    public let riskLevel: FloodRiskLevel
    /// Special Flood Hazard Area.
    public let inSfha: Bool
    /// Federally-required flood insurance.
    public let insuranceRequired: Bool
    /// Plain "what this means" copy.
    public let plainMeaning: String

    private enum CodingKeys: String, CodingKey {
        case zone
        case zoneLabel = "zone_label"
        case riskLevel = "risk_level"
        case inSfha = "in_sfha"
        case insuranceRequired = "insurance_required"
        case plainMeaning = "plain_meaning"
    }
}

/// ASCE 7 seismic design categories (A lowest demand → E highest).
public enum SeismicDesignCategory: String, Sendable, Hashable {
    case a = "A"
    case b = "B"
    case c = "C"
    case d = "D"
    case e = "E"
    case unknown
}

extension SeismicDesignCategory: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = SeismicDesignCategory(rawValue: raw) ?? .unknown
    }
}

/// Phase-4 layer — Earthquake (USGS seismic design values, ASCE 7-22).
/// Engineering demand at this point, not a prediction. Informational.
public struct PlaceSeismicData: Decodable, Sendable, Hashable {
    public let designCategory: SeismicDesignCategory
    /// Design spectral acceleration, short period (g).
    public let sds: Double?
    public let summary: String
    public let disclaimer: String

    private enum CodingKeys: String, CodingKey {
        case sds, summary, disclaimer
        case designCategory = "design_category"
    }
}

/// Phase-4 layer — Wildfire (USFS Wildfire Hazard Potential, 2023).
/// `hazardClass` is 1 (very low) → 5 (very high); nil for non-burnable /
/// water pixels — `burnable: false` carries that meaning.
public struct PlaceWildfireData: Decodable, Sendable, Hashable {
    public let hazardClass: Int?
    public let hazardLabel: String
    public let burnable: Bool
    public let summary: String
    public let disclaimer: String

    private enum CodingKeys: String, CodingKey {
        case burnable, summary, disclaimer
        case hazardClass = "hazard_class"
        case hazardLabel = "hazard_label"
    }
}

// MARK: - Health & environment payloads

public enum LeadPaintRisk: String, Sendable, Hashable {
    case unlikely
    case possible
    case likely
    case unknown
}

extension LeadPaintRisk: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = LeadPaintRisk(rawValue: raw) ?? .unknown
    }
}

/// Launch layer #6 — Lead / radon screening. "Screening, not a diagnosis."
public struct PlaceLeadRadonData: Decodable, Sendable, Hashable {
    public let yearBuilt: Int?
    public let leadPaintRisk: LeadPaintRisk
    /// EPA radon zone (1 = highest potential), 1–3.
    public let radonZone: Int?
    public let summary: String
    public let disclaimer: String

    private enum CodingKeys: String, CodingKey {
        case summary, disclaimer
        case yearBuilt = "year_built"
        case leadPaintRisk = "lead_paint_risk"
        case radonZone = "radon_zone"
    }
}

/// Launch layer #7 — Drinking-water system (EPA SDWIS; coverage ~80%).
public struct PlaceDrinkingWaterData: Decodable, Sendable, Hashable {
    /// e.g. "Portland Water Bureau".
    public let utilityName: String
    /// Public Water System id.
    public let pwsId: String?
    public let recentHealthViolations: Bool
    public let violationCount: Int
    public let summary: String

    private enum CodingKeys: String, CodingKey {
        case summary
        case utilityName = "utility_name"
        case pwsId = "pws_id"
        case recentHealthViolations = "recent_health_violations"
        case violationCount = "violation_count"
    }
}

public struct PlaceEpaFacility: Decodable, Sendable, Hashable {
    public let name: String
    /// Regulating program, e.g. "Clean Water Act".
    public let program: String
    public let distanceMi: Double

    private enum CodingKeys: String, CodingKey {
        case name, program
        case distanceMi = "distance_mi"
    }
}

/// Launch layer #5 — EPA environmental context (ECHO).
/// "Regulated activity nearby, not unsafe exposure." No toxic score.
public struct PlaceEnvironmentalHazardsData: Decodable, Sendable, Hashable {
    public let facilitiesWithinMile: Int
    public let radiusMi: Double
    /// Facility list; may be empty on the dashboard summary.
    public let facilities: [PlaceEpaFacility]
    public let summary: String
    public let disclaimer: String

    private enum CodingKeys: String, CodingKey {
        case facilities, summary, disclaimer
        case facilitiesWithinMile = "facilities_within_mile"
        case radiusMi = "radius_mi"
    }
}

// MARK: - Your block payloads

/// k-anonymity bucket ONLY — never a count (floored server-side, §4.1).
/// The server-rendered `label` keeps `.unknown` renderable.
public enum PlaceDensityBucket: String, Sendable, Hashable {
    case none
    case forming
    case few
    case growing
    case unknown
}

extension PlaceDensityBucket: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlaceDensityBucket(rawValue: raw) ?? .unknown
    }
}

/// Launch layer #11 — Block density. Bucket + label only; intentionally
/// carries NO neighbor count.
public struct PlaceBlockDensityData: Decodable, Sendable, Hashable {
    public let bucket: PlaceDensityBucket
    /// Server-rendered bucket label.
    public let label: String
}

/// Launch layer #4 — Census tract context (ACS; area-level, not your home).
public struct PlaceCensusContextData: Decodable, Sendable, Hashable {
    public let medianYearBuilt: Int?
    public let medianHomeValue: Double?
    public let tractName: String?
    public let summary: String

    private enum CodingKeys: String, CodingKey {
        case summary
        case medianYearBuilt = "median_year_built"
        case medianHomeValue = "median_home_value"
        case tractName = "tract_name"
    }
}

// MARK: - Money signals payloads

public enum BillUtilityKind: String, Sendable, Hashable {
    case electric
    case gas
    case water
    case unknown
}

extension BillUtilityKind: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BillUtilityKind(rawValue: raw) ?? .unknown
    }
}

public enum BenchmarkComparison: String, Sendable, Hashable {
    case lower
    case typical
    case higher
    case unknown
}

extension BenchmarkComparison: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BenchmarkComparison(rawValue: raw) ?? .unknown
    }
}

/// Launch layer #12 — Bill benchmark (peer-relative; informational).
public struct PlaceBillBenchmarkData: Decodable, Sendable, Hashable {
    public let utility: BillUtilityKind
    /// Resident's own amount (Band C); nil until they provide it.
    public let yourAmount: Double?
    /// Typical-for-area band.
    public let bandLow: Double
    public let bandHigh: Double
    public let comparison: BenchmarkComparison
    /// Signed percent vs neighbors: +12 = 12% above, -10 = 10% below.
    public let comparisonPct: Double
    /// e.g. "12-month average".
    public let period: String
    public let summary: String

    private enum CodingKeys: String, CodingKey {
        case utility, comparison, period, summary
        case yourAmount = "your_amount"
        case bandLow = "band_low"
        case bandHigh = "band_high"
        case comparisonPct = "comparison_pct"
    }
}

public enum IncentiveLevel: String, Sendable, Hashable {
    case federal
    case state
    case utility
    case local
    case unknown
}

extension IncentiveLevel: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = IncentiveLevel(rawValue: raw) ?? .unknown
    }
}

public enum IncentiveType: String, Sendable, Hashable {
    case taxCredit = "tax_credit"
    case rebate
    case discount
    case loan
    case unknown
}

extension IncentiveType: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = IncentiveType(rawValue: raw) ?? .unknown
    }
}

public struct PlaceIncentive: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let level: IncentiveLevel
    public let incentiveType: IncentiveType
    public let summary: String

    private enum CodingKeys: String, CodingKey {
        case id, name, level, summary
        case incentiveType = "incentive_type"
    }
}

/// Launch layer #10 — Incentives (DSIRE; "you may be eligible — verify").
public struct PlaceIncentivesData: Decodable, Sendable, Hashable {
    public let programs: [PlaceIncentive]
    public let summary: String
}

/// Launch layer #9 — Rent band (HUD Fair Market Rents; informational).
public struct PlaceRentBandData: Decodable, Sendable, Hashable {
    public let bedrooms: Int
    /// Market band low/high.
    public let bandLow: Double
    public let bandHigh: Double
    /// Full track min/max for the comparison bar.
    public let marketLow: Double
    public let marketHigh: Double
    /// e.g. "FY 2026".
    public let period: String
    public let summary: String

    private enum CodingKeys: String, CodingKey {
        case bedrooms, period, summary
        case bandLow = "band_low"
        case bandHigh = "band_high"
        case marketLow = "market_low"
        case marketHigh = "market_high"
    }
}

// MARK: - Civic payloads

public enum CivicLevel: String, Sendable, Hashable {
    case federal
    case state
    case county
    case city
    case school
    case unknown
}

extension CivicLevel: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CivicLevel(rawValue: raw) ?? .unknown
    }
}

public struct PlaceCivicDistrict: Decodable, Sendable, Hashable {
    public let level: CivicLevel
    /// e.g. "U.S. House".
    public let officeLabel: String
    /// e.g. "Oregon's 3rd District".
    public let name: String

    private enum CodingKeys: String, CodingKey {
        case level, name
        case officeLabel = "office_label"
    }
}

public struct PlaceCivicRepresentative: Decodable, Sendable, Hashable {
    public let name: String
    public let office: String
    public let level: CivicLevel
    public let party: String?
    public let phone: String?
    public let email: String?
    public let website: String?
}

/// Launch layer #8 (evergreen half) — Civic districts. Districts are
/// always present; representatives may be empty until their companion
/// source ships.
public struct PlaceCivicDistrictsData: Decodable, Sendable, Hashable {
    public let districts: [PlaceCivicDistrict]
    public let representatives: [PlaceCivicRepresentative]
}

public enum BallotRaceType: String, Sendable, Hashable {
    case office
    case measure
    case unknown
}

extension BallotRaceType: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BallotRaceType(rawValue: raw) ?? .unknown
    }
}

public struct PlaceBallotRace: Decodable, Sendable, Hashable {
    public let type: BallotRaceType
    public let title: String
    /// Offices: candidate names (order randomized, as on the ballot).
    public let candidates: [String]
    /// Measures: plain-language summary.
    public let summary: String?
}

public struct PlacePollingPlace: Decodable, Sendable, Hashable {
    /// e.g. "Vote by mail · Oregon".
    public let name: String
    public let detail: String
    public let voteByMail: Bool

    private enum CodingKeys: String, CodingKey {
        case name, detail
        case voteByMail = "vote_by_mail"
    }
}

/// Launch layer #8 (seasonal half) — Civic election. Off-season this
/// section is `unavailable` while districts stay ready.
public struct PlaceCivicElectionData: Decodable, Sendable, Hashable {
    public let name: String
    /// ISO 8601.
    public let date: String
    public let daysUntil: Int
    public let pollingPlace: PlacePollingPlace?
    /// Ballot races; may be empty (summary only) on the dashboard.
    public let ballot: [PlaceBallotRace]

    private enum CodingKeys: String, CodingKey {
        case name, date, ballot
        case daysUntil = "days_until"
        case pollingPlace = "polling_place"
    }
}

// MARK: - Band-B payload (Your Home)

/// Your Home — property facts + value estimate + assessment (Band B,
/// ATTOM-paid record). Gated to T3+ and only populated when the ATTOM
/// key is configured; otherwise the section renders `unavailable`.
public struct PlaceYourHomeData: Decodable, Sendable, Hashable {
    public let yearBuilt: Int?
    public let sqft: Int?
    public let bedrooms: Int?
    public let bathrooms: Double?
    public let lotSqft: Int?
    public let homeType: String?
    public let estimatedValue: Double?
    public let valueLow: Double?
    public let valueHigh: Double?
    public let assessedValue: Double?

    private enum CodingKeys: String, CodingKey {
        case sqft, bedrooms, bathrooms
        case yearBuilt = "year_built"
        case lotSqft = "lot_sqft"
        case homeType = "home_type"
        case estimatedValue = "estimated_value"
        case valueLow = "value_low"
        case valueHigh = "value_high"
        case assessedValue = "assessed_value"
    }
}

// MARK: - Section payload union

/// Typed payload for a section envelope — one case per launch-set id.
public enum PlaceSectionData: Sendable, Hashable {
    case weather(PlaceWeatherData)
    case airQuality(PlaceAirQualityData)
    case alerts(PlaceAlertsData)
    case sunriseSunset(PlaceSunriseSunsetData)
    case yourHome(PlaceYourHomeData)
    case flood(PlaceFloodData)
    case seismic(PlaceSeismicData)
    case wildfire(PlaceWildfireData)
    case leadRadon(PlaceLeadRadonData)
    case drinkingWater(PlaceDrinkingWaterData)
    case environmentalHazards(PlaceEnvironmentalHazardsData)
    case blockDensity(PlaceBlockDensityData)
    case censusContext(PlaceCensusContextData)
    case billBenchmark(PlaceBillBenchmarkData)
    case incentives(PlaceIncentivesData)
    case rentBand(PlaceRentBandData)
    case civicDistricts(PlaceCivicDistrictsData)
    case civicElection(PlaceCivicElectionData)
}

// MARK: - The envelope

/// The section envelope — the contract atom. One per section.
///
/// `data` is non-nil only when `access` allows it AND `status` is one of
/// ready/partial/stale; it is nil for unavailable/error, for locked
/// sections, for `.unknown` section ids, and when the payload itself
/// fails to decode (that one section degrades; the response survives).
public struct PlaceSectionEnvelope: Decodable, Sendable, Hashable {
    public let id: PlaceSectionID
    public let group: PlaceGroup
    public let band: PlaceBand
    public let access: PlaceSectionAccess
    public let status: PlaceSectionStatus
    /// ISO 8601 timestamp of the underlying data.
    public let asOf: String?
    /// Provider label, e.g. "FEMA National Flood Hazard Layer".
    public let source: String?
    public let coverage: PlaceCoverage
    /// Why there is no data — a coverage gap or a lock reason.
    public let unavailableReason: String?
    public let data: PlaceSectionData?

    private enum CodingKeys: String, CodingKey {
        case id, group, band, access, status, source, coverage, data
        case asOf = "as_of"
        case unavailableReason = "unavailable_reason"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(PlaceSectionID.self, forKey: .id)
        group = try container.decode(PlaceGroup.self, forKey: .group)
        band = try container.decode(PlaceBand.self, forKey: .band)
        access = try container.decode(PlaceSectionAccess.self, forKey: .access)
        status = try container.decode(PlaceSectionStatus.self, forKey: .status)
        asOf = try container.decodeIfPresent(String.self, forKey: .asOf)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        coverage = try container.decode(PlaceCoverage.self, forKey: .coverage)
        unavailableReason = try container.decodeIfPresent(String.self, forKey: .unavailableReason)
        data = Self.decodePayload(id: id, from: container)
    }

    /// Decode the id-specific payload; a malformed payload degrades this
    /// one section to nil instead of failing the whole response (the
    /// fixture tests are the drift alarm, not production decoding).
    private static func decodePayload(
        id: PlaceSectionID,
        from container: KeyedDecodingContainer<CodingKeys>
    ) -> PlaceSectionData? {
        func payload<T: Decodable>(_: T.Type) -> T? {
            (try? container.decodeIfPresent(T.self, forKey: .data))
        }
        switch id {
        case .weather: return payload(PlaceWeatherData.self).map(PlaceSectionData.weather)
        case .airQuality: return payload(PlaceAirQualityData.self).map(PlaceSectionData.airQuality)
        case .alerts: return payload(PlaceAlertsData.self).map(PlaceSectionData.alerts)
        case .sunriseSunset: return payload(PlaceSunriseSunsetData.self).map(PlaceSectionData.sunriseSunset)
        case .yourHome: return payload(PlaceYourHomeData.self).map(PlaceSectionData.yourHome)
        case .flood: return payload(PlaceFloodData.self).map(PlaceSectionData.flood)
        case .seismic: return payload(PlaceSeismicData.self).map(PlaceSectionData.seismic)
        case .wildfire: return payload(PlaceWildfireData.self).map(PlaceSectionData.wildfire)
        case .leadRadon: return payload(PlaceLeadRadonData.self).map(PlaceSectionData.leadRadon)
        case .drinkingWater: return payload(PlaceDrinkingWaterData.self).map(PlaceSectionData.drinkingWater)
        case .environmentalHazards:
            return payload(PlaceEnvironmentalHazardsData.self).map(PlaceSectionData.environmentalHazards)
        case .blockDensity: return payload(PlaceBlockDensityData.self).map(PlaceSectionData.blockDensity)
        case .censusContext: return payload(PlaceCensusContextData.self).map(PlaceSectionData.censusContext)
        case .billBenchmark: return payload(PlaceBillBenchmarkData.self).map(PlaceSectionData.billBenchmark)
        case .incentives: return payload(PlaceIncentivesData.self).map(PlaceSectionData.incentives)
        case .rentBand: return payload(PlaceRentBandData.self).map(PlaceSectionData.rentBand)
        case .civicDistricts: return payload(PlaceCivicDistrictsData.self).map(PlaceSectionData.civicDistricts)
        case .civicElection: return payload(PlaceCivicElectionData.self).map(PlaceSectionData.civicElection)
        case .unknown: return nil
        }
    }
}

// MARK: - Typed payload accessors

public extension PlaceSectionEnvelope {
    var weather: PlaceWeatherData? {
        if case let .weather(d) = data { return d }
        return nil
    }

    var airQuality: PlaceAirQualityData? {
        if case let .airQuality(d) = data { return d }
        return nil
    }

    var alerts: PlaceAlertsData? {
        if case let .alerts(d) = data { return d }
        return nil
    }

    var sunriseSunset: PlaceSunriseSunsetData? {
        if case let .sunriseSunset(d) = data { return d }
        return nil
    }

    var yourHome: PlaceYourHomeData? {
        if case let .yourHome(d) = data { return d }
        return nil
    }

    var flood: PlaceFloodData? {
        if case let .flood(d) = data { return d }
        return nil
    }

    var seismic: PlaceSeismicData? {
        if case let .seismic(d) = data { return d }
        return nil
    }

    var wildfire: PlaceWildfireData? {
        if case let .wildfire(d) = data { return d }
        return nil
    }

    var leadRadon: PlaceLeadRadonData? {
        if case let .leadRadon(d) = data { return d }
        return nil
    }

    var drinkingWater: PlaceDrinkingWaterData? {
        if case let .drinkingWater(d) = data { return d }
        return nil
    }

    var environmentalHazards: PlaceEnvironmentalHazardsData? {
        if case let .environmentalHazards(d) = data { return d }
        return nil
    }

    var blockDensity: PlaceBlockDensityData? {
        if case let .blockDensity(d) = data { return d }
        return nil
    }

    var censusContext: PlaceCensusContextData? {
        if case let .censusContext(d) = data { return d }
        return nil
    }

    var billBenchmark: PlaceBillBenchmarkData? {
        if case let .billBenchmark(d) = data { return d }
        return nil
    }

    var incentives: PlaceIncentivesData? {
        if case let .incentives(d) = data { return d }
        return nil
    }

    var rentBand: PlaceRentBandData? {
        if case let .rentBand(d) = data { return d }
        return nil
    }

    var civicDistricts: PlaceCivicDistrictsData? {
        if case let .civicDistricts(d) = data { return d }
        return nil
    }

    var civicElection: PlaceCivicElectionData? {
        if case let .civicElection(d) = data { return d }
        return nil
    }
}

// MARK: - Response root

public struct PlaceAddressRef: Decodable, Sendable, Hashable {
    /// Display label, e.g. "1421 SE Oak St, Portland".
    public let label: String
    public let line1: String
    public let city: String
    public let state: String
    public let postalCode: String?

    private enum CodingKeys: String, CodingKey {
        case label, line1, city, state
        case postalCode = "postal_code"
    }
}

public struct PlaceGroupBlock: Decodable, Sendable, Hashable {
    public let group: PlaceGroup
    /// Server-rendered group label, e.g. "Risk & readiness".
    public let label: String
    public let sections: [PlaceSectionEnvelope]
}

/// `GET /api/homes/:id/intelligence` — grouped section envelopes for an
/// address. `regionSupported: false` drives the "coming to your region"
/// state for non-US addresses.
public struct PlaceIntelligence: Decodable, Sendable, Hashable {
    public let place: PlaceAddressRef
    public let tier: PlaceTier
    public let regionSupported: Bool
    /// ISO 8601.
    public let generatedAt: String
    public let groups: [PlaceGroupBlock]

    private enum CodingKeys: String, CodingKey {
        case place, tier, groups
        case regionSupported = "region_supported"
        case generatedAt = "generated_at"
    }
}

// MARK: - Anonymous T0 preview (`GET /api/public/place`)

/// The preview endpoint does NOT return the full envelope. It returns a
/// deliberately small, sanitized shape (the §4 anti-leak rule): only the
/// free Band-A subset live (flood, density bucket, area teaser) plus
/// locked descriptors for everything recurring/exact, so the client can
/// render the locked cards + the soft wall.
public enum PlacePreviewStatus: String, Sendable, Hashable {
    case ready
    case partial
    case unsupportedRegion = "unsupported_region"
    case unknown
}

extension PlacePreviewStatus: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlacePreviewStatus(rawValue: raw) ?? .unknown
    }
}

/// ready / unavailable for the free preview mini-sections.
public enum PlacePreviewSectionStatus: String, Sendable, Hashable {
    case ready
    case unavailable
}

extension PlacePreviewSectionStatus: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlacePreviewSectionStatus(rawValue: raw) ?? .unavailable
    }
}

public struct PlacePreviewFlood: Decodable, Sendable, Hashable {
    public let status: PlacePreviewSectionStatus
    public let zone: String?
    public let description: String?
    public let source: String
}

public struct PlacePreviewDensity: Decodable, Sendable, Hashable {
    public let status: PlacePreviewSectionStatus
    /// k-anon bucket only — never a count (§4.1).
    public let bucket: PlaceDensityBucket
    public let label: String
    public let source: String
}

public struct PlacePreviewArea: Decodable, Sendable, Hashable {
    public let status: PlacePreviewSectionStatus
    public let medianYearBuilt: Int?
    public let medianHomeValue: Double?
    public let note: String
    public let source: String

    private enum CodingKeys: String, CodingKey {
        case status, note, source
        case medianYearBuilt = "median_year_built"
        case medianHomeValue = "median_home_value"
    }
}

/// What tier opens a locked preview section: account = T1, claim = T3.
public enum PlacePreviewUnlock: String, Sendable, Hashable {
    case account
    case claim
    case unknown
}

extension PlacePreviewUnlock: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlacePreviewUnlock(rawValue: raw) ?? .unknown
    }
}

/// A gated section descriptor — drives a LockedCard + the soft wall.
public struct PlacePreviewLockedSection: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let group: PlaceGroup
    public let title: String
    public let band: PlaceBand
    public let unlock: PlacePreviewUnlock
    public let reason: String
}

/// Sanitized area-level place identity (no exact coords).
public struct PlacePreviewPlaceRef: Decodable, Sendable, Hashable {
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
}

/// The free demonstration subset (present on ready/partial).
public struct PlacePreviewFree: Decodable, Sendable, Hashable {
    public let flood: PlacePreviewFlood
    public let density: PlacePreviewDensity
    public let area: PlacePreviewArea
}

/// `GET /api/public/place?address=` — the anonymous, address-only
/// preview. Non-persistent (no DB writes): close and reopen still hits
/// the wall.
public struct PlacePreview: Decodable, Sendable, Hashable {
    public let status: PlacePreviewStatus
    /// Always "preview".
    public let tier: String
    /// "US" or nil (nil on unsupported region).
    public let region: String?
    /// Present on `unsupportedRegion`.
    public let message: String?
    public let place: PlacePreviewPlaceRef?
    public let free: PlacePreviewFree?
    public let locked: [PlacePreviewLockedSection]?
    public let disclaimer: String?
}
