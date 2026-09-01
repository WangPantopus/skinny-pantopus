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
