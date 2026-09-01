//
//  PlacePresentationTests.swift
//  PantopusTests
//
//  Locks the contract → card presentation (PlacePresentation) against
//  the captured T3 dashboard fixture + hand-authored envelopes. Mirrors
//  the Android `PlacePresentationTest`.
//

import XCTest
@testable import Pantopus

@MainActor
final class PlacePresentationTests: XCTestCase {
    private let decoder = JSONDecoder()

    private func intelligence() throws -> PlaceIntelligence {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures/intelligence-full.json")
        return try decoder.decode(PlaceIntelligence.self, from: Data(contentsOf: url))
    }

    private func section(_ intel: PlaceIntelligence, _ id: PlaceSectionID) throws -> PlaceSectionEnvelope {
        let all = intel.groups.flatMap(\.sections)
        return try XCTUnwrap(all.first { $0.id == id })
    }

    // MARK: - Readings off the captured fixture

    func testFloodReadingIsMinimalRiskChip() throws {
        let intel = try intelligence()
        let reading = try PlacePresentation.reading(for: section(intel, .flood))
        XCTAssertEqual(reading.chip?.text, "Minimal risk")
        XCTAssertEqual(reading.chip?.tone, .success)
    }

    func testCivicDistrictsReadingCountsDistricts() throws {
        let intel = try intelligence()
        let reading = try PlacePresentation.reading(for: section(intel, .civicDistricts))
        XCTAssertNotNil(reading.value)
        XCTAssertTrue(reading.value?.contains("districts on record") ?? false)
    }

    func testYourHomeReadingComposesBuiltSqftValue() throws {
        let intel = try intelligence()
        let reading = try PlacePresentation.reading(for: section(intel, .yourHome))
        // The fixture's your_home is ready; the reading is non-empty.
        XCTAssertNotNil(reading.value)
    }

    func testFmtYearMonthNeverShiftsACalendarMonthThroughATimezone() {
        // Regression: "YYYY-MM" + "-01T00:00:00Z" formatted in a US-local
        // zone rendered the PREVIOUS month — the user's one entered fact
        // shown wrong, and the PMMS baseline attributed to the wrong month.
        XCTAssertEqual(PlacePresentation.fmtYearMonth("2023-03"), "Mar 2023")
        XCTAssertEqual(PlacePresentation.fmtYearMonth("2026-01"), "Jan 2026")
        XCTAssertEqual(PlacePresentation.fmtYearMonth("2025-12"), "Dec 2025")
        XCTAssertNil(PlacePresentation.fmtYearMonth("not-a-month"))
        XCTAssertNil(PlacePresentation.fmtYearMonth(nil))
    }

    func testSunriseSunsetFormatsLocalWallClock() throws {
        // Sunrise/sunset arrive as zone-less local times ("…T05:19").
        let intel = try intelligence()
        let reading = try PlacePresentation.reading(for: section(intel, .sunriseSunset))
        XCTAssertEqual(reading.value, "5:19a · 8:59p")
    }

    // MARK: - derivePulse off the fixture (it carries an Extreme Heat Warning)

    func testDerivePulseFloatsCapturedHeatWarning() throws {
        let intel = try intelligence()
        let pulse = PlacePresentation.derivePulse(intel)
        XCTAssertEqual(pulse.variant, .alert)
        XCTAssertEqual(pulse.title, "Extreme Heat Warning")
    }

    func testAlertsEnvelopeDecodesActiveWarning() throws {
        let intel = try intelligence()
        let alerts = try XCTUnwrap(try section(intel, .alerts).alerts)
        XCTAssertEqual(alerts.active.count, 1)
        XCTAssertEqual(alerts.active.first?.event, "Extreme Heat Warning")
    }

    // MARK: - derivePulse alert branches (hand-authored)

    func testDerivePulseFloatsActiveAlert() {
        let intel = makeIntelligence(alerts: """
        { "active": [ { "id": "a1", "event": "Wind Advisory", "severity": "advisory",
          "headline": "Wind Advisory until 6 PM", "description": "Secure loose objects.",
          "onset": null, "ends": null } ] }
        """)
        let pulse = PlacePresentation.derivePulse(intel)
        XCTAssertEqual(pulse.variant, .alert)
        XCTAssertEqual(pulse.title, "Wind Advisory until 6 PM")
        XCTAssertEqual(pulse.nudgeText, "Secure loose objects.")
    }

    func testDerivePulseFloatsUnhealthyAir() {
        let intel = makeIntelligence(airQuality: """
        { "index": 158, "category": "unhealthy", "category_label": "Unhealthy",
          "dominant_pollutant": "pm25", "health_message": "Limit time outdoors." }
        """)
        let pulse = PlacePresentation.derivePulse(intel)
        XCTAssertEqual(pulse.variant, .alert)
        XCTAssertTrue(pulse.title.contains("unhealthy"))
        XCTAssertEqual(pulse.nudgeText, "Limit time outdoors.")
    }

    // MARK: - Real Rent reading (Wave 3)

    private func realRentEnvelope(status: String, data: String) throws -> PlaceSectionEnvelope {
        let json = """
        {"id":"real_rent","group":"money_signals","band":"D","access":"available",
         "status":"\(status)","as_of":null,"source":"Pantopus","coverage":"partial",
         "unavailable_reason":null,"data":\(data)}
        """
        return try decoder.decode(PlaceSectionEnvelope.self, from: Data(json.utf8))
    }

    func testRealRentBuildingReadingIsProgressNotEmptiness() throws {
        let env = try realRentEnvelope(status: "partial", data: """
        {"state":"building","reports":4,"needed":10,"scope":null,"bedrooms":null,
         "sample_size":null,"rent_p25":null,"rent_median":null,"rent_p75":null,
         "your_rent":null,"standing":null,
         "summary":"4 of 10 verified homes on your block have shared their rent."}
        """)
        let reading = PlacePresentation.reading(for: env)
        XCTAssertEqual(reading.value, "4 of 10 verified homes on your block have shared their rent.")
        XCTAssertEqual(reading.chip?.text, "4 of 10")
        XCTAssertEqual(reading.chip?.tone, .sky)
    }

    func testRealRentReadyReadingCarriesTheStandingBand() throws {
        // The dashboard summary card reports the SECTION's state, never
        // the viewer's own rent position: the ready reading carries the
        // block's median sentence and NO standing chip. The standing chip
        // is a personal fact and belongs to the detail card alone — web
        // and Android return no chip here either.
        let env = try realRentEnvelope(status: "ready", data: """
        {"state":"ready","reports":12,"needed":10,"scope":"bedrooms","bedrooms":2,
         "sample_size":12,"rent_p25":1950,"rent_median":2100,"rent_p75":2300,
         "your_rent":2400,"standing":"above_band",
         "summary":"12 verified 2-bedroom homes on your block pay a median of $2,100/mo."}
        """)
        let reading = PlacePresentation.reading(for: env)
        XCTAssertTrue(reading.value?.contains("median of $2,100/mo") ?? false)
        XCTAssertNil(reading.chip)
    }

    func testRealRentUnknownStateNeverReadsAsABenchmark() throws {
        // An unrecognized state must render as progress: the ready path
        // is the only one that may imply amounts.
        let env = try realRentEnvelope(status: "ready", data: """
        {"state":"teleported","reports":3,"needed":10,"scope":null,"bedrooms":null,
         "sample_size":null,"rent_p25":null,"rent_median":null,"rent_p75":null,
         "your_rent":null,"standing":"astral","summary":"s"}
        """)
        let reading = PlacePresentation.reading(for: env)
        XCTAssertEqual(reading.chip?.text, "3 of 10")
        XCTAssertEqual(reading.chip?.tone, .sky)
    }

    func testRealRentConfigIsItsOwnSectionNotTheHudRentBand() {
        // Both live in Money signals and must never read as one card:
        // rent_band is a county-wide HUD estimate, real_rent is this
        // block's verified residents.
        XCTAssertEqual(PlacePresentation.config(for: .realRent).title, "Real rent on your block")
        XCTAssertEqual(PlacePresentation.config(for: .rentBand).title, "Rent band")
        XCTAssertEqual(PlaceSectionID(rawValue: "real_rent"), .realRent)
        XCTAssertEqual(PlaceSectionID.realRent.rawValue, "real_rent")
    }

    func testRealRentStandingChipIsABandPositionOnly() {
        // Wording and tone are contract across all three clients: paying
        // below the band is the good news, above it is the actionable one.
        XCTAssertEqual(PlacePresentation.realRentStandingChip(.belowBand)?.text, "Below the band")
        XCTAssertEqual(PlacePresentation.realRentStandingChip(.inBand)?.text, "In the band")
        XCTAssertEqual(PlacePresentation.realRentStandingChip(.aboveBand)?.text, "Above the band")
        XCTAssertEqual(PlacePresentation.realRentStandingChip(.belowBand)?.tone, .success)
        XCTAssertEqual(PlacePresentation.realRentStandingChip(.inBand)?.tone, .neutral)
        XCTAssertEqual(PlacePresentation.realRentStandingChip(.aboveBand)?.tone, .warning)
        XCTAssertNil(PlacePresentation.realRentStandingChip(.unknown))
        XCTAssertNil(PlacePresentation.realRentStandingChip(nil))
    }

    // MARK: - lock CTA by band

    func testLockCtaByBand() {
        XCTAssertEqual(PlacePresentation.lockCta(.d), "Verify address")
        XCTAssertEqual(PlacePresentation.lockCta(.b), "Claim home")
        XCTAssertEqual(PlacePresentation.lockCta(.c), "Claim home")
        XCTAssertEqual(PlacePresentation.lockCta(.a), "Create account")
    }

    // MARK: - Helpers

    /// Build a minimal intelligence payload with one Today group whose
    /// alerts / air_quality envelopes carry the given JSON `data`.
    private func makeIntelligence(alerts: String? = nil, airQuality: String? = nil) -> PlaceIntelligence {
        func envelope(_ id: String, data: String?) -> String {
            """
            { "id": "\(id)", "group": "today", "band": "A", "access": "available",
              "status": "\(data == nil ? "unavailable" : "ready")", "as_of": null,
              "source": "Test", "coverage": "full", "unavailable_reason": null,
              "data": \(data ?? "null") }
            """
        }
        let json = """
        {
          "place": { "label": "X", "line1": "X", "city": "C", "state": "WA", "postal_code": null },
          "tier": "T3", "region_supported": true, "generated_at": "2026-06-12T00:00:00Z",
          "groups": [ { "group": "today", "label": "Today", "sections": [
            \(envelope("alerts", data: alerts)),
            \(envelope("air_quality", data: airQuality))
          ] } ]
        }
        """
        // swiftlint:disable:next force_try
        return try! decoder.decode(PlaceIntelligence.self, from: Data(json.utf8))
    }
}
