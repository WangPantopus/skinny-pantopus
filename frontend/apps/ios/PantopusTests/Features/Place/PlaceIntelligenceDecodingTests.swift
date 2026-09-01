//
//  PlaceIntelligenceDecodingTests.swift
//  PantopusTests
//
//  Contract tests for the Place Intelligence DTOs against REAL captured
//  backend responses (Fixtures/*.json, captured 2026-06-12 from the dev
//  backend — test home `4008 Northeast Tacoma Court, Camas` at T3).
//  These are the drift alarm for the section-envelope contract: if the
//  serializer changes shape, these fail loudly even though production
//  decoding degrades gracefully.
//

import XCTest
@testable import Pantopus

// swiftlint:disable line_length

@MainActor
final class PlaceIntelligenceDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    private func fixture(_ name: String) throws -> Data {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures/\(name)")
        return try Data(contentsOf: url)
    }

    // MARK: - Full dashboard payload (captured, T3)

    func testDecodesFullIntelligencePayload() throws {
        let intelligence = try decoder.decode(
            PlaceIntelligence.self,
            from: fixture("intelligence-full.json")
        )

        XCTAssertEqual(intelligence.tier, .t3)
        XCTAssertTrue(intelligence.regionSupported)
        XCTAssertEqual(intelligence.place.line1, "4008 Northeast Tacoma Court")
        XCTAssertEqual(intelligence.place.city, "Camas")
        XCTAssertEqual(intelligence.place.postalCode, "98607")

        // T3 payload carries 7 groups (identity is T4) and the full
        // 18-section launch set.
        XCTAssertEqual(intelligence.groups.count, 7)
        let sections = intelligence.groups.flatMap(\.sections)
        XCTAssertEqual(sections.count, 18)

        // Group labels are server-rendered.
        XCTAssertEqual(intelligence.groups.first?.group, .today)
        XCTAssertEqual(intelligence.groups.first?.label, "Today")
    }

    func testDecodesReadySectionPayloads() throws {
        let intelligence = try decoder.decode(
            PlaceIntelligence.self,
            from: fixture("intelligence-full.json")
        )
        let sections = intelligence.groups.flatMap(\.sections)

        // Weather — live NOAA data with hourly + daily arrays.
        let weather = try XCTUnwrap(sections.first { $0.id == .weather })
        XCTAssertEqual(weather.status, .ready)
        XCTAssertEqual(weather.access, .available)
        XCTAssertEqual(weather.band, .a)
        let weatherData = try XCTUnwrap(weather.weather)
        XCTAssertFalse(weatherData.conditionLabel.isEmpty)
        XCTAssertNotEqual(weatherData.conditionCode, .unknown)

        // Flood — FEMA zone with plain-language meaning.
        let flood = try XCTUnwrap(sections.first { $0.id == .flood })
        let floodData = try XCTUnwrap(flood.flood)
        XCTAssertEqual(floodData.zone, "X")
        XCTAssertEqual(floodData.riskLevel, .minimal)
        XCTAssertFalse(floodData.inSfha)

        // Your home — Band B property record.
        let yourHome = try XCTUnwrap(sections.first { $0.id == .yourHome })
        XCTAssertEqual(yourHome.band, .b)
        XCTAssertNotNil(yourHome.yourHome)

        // Block density — bucket + label only, never a count.
        let density = try XCTUnwrap(sections.first { $0.id == .blockDensity })
        let densityData = try XCTUnwrap(density.blockDensity)
        XCTAssertNotEqual(densityData.bucket, .unknown)
        XCTAssertFalse(densityData.label.isEmpty)

        // Civic districts — the elected ladder.
        let districts = try XCTUnwrap(sections.first { $0.id == .civicDistricts })
        let districtsData = try XCTUnwrap(districts.civicDistricts)
        XCTAssertFalse(districtsData.districts.isEmpty)
    }

    func testUnavailableSectionsCarryNilDataAndOptionalReason() throws {
        let intelligence = try decoder.decode(
            PlaceIntelligence.self,
            from: fixture("intelligence-full.json")
        )
        let sections = intelligence.groups.flatMap(\.sections)

        let unavailable = sections.filter { $0.status == .unavailable }
        XCTAssertFalse(unavailable.isEmpty)
        for section in unavailable {
            XCTAssertNil(section.data, "\(section.id) should carry nil data when unavailable")
        }

        // Coverage-gap copy survives the trip.
        let rentBand = try XCTUnwrap(sections.first { $0.id == .rentBand })
        XCTAssertEqual(rentBand.unavailableReason, "No HUD rent data for your county yet.")
    }

    // MARK: - ?sections= subset (captured)

    func testDecodesSectionsSubsetPayload() throws {
        let intelligence = try decoder.decode(
            PlaceIntelligence.self,
            from: fixture("intelligence-subset.json")
        )
        let ids = intelligence.groups.flatMap(\.sections).map(\.id)
        XCTAssertEqual(ids, [.weather, .flood, .civicDistricts])
    }

    // MARK: - Anonymous T0 preview (captured)

    func testDecodesPublicPreviewPayload() throws {
        let preview = try decoder.decode(
            PlacePreview.self,
            from: fixture("public-place-preview.json")
        )

        XCTAssertEqual(preview.status, .partial)
        XCTAssertEqual(preview.tier, "preview")
        XCTAssertEqual(preview.region, "US")
        XCTAssertEqual(preview.place?.city, "Camas")

        let free = try XCTUnwrap(preview.free)
        XCTAssertEqual(free.flood.status, .ready)
        XCTAssertEqual(free.flood.zone, "X")
        XCTAssertEqual(free.density.bucket, PlaceDensityBucket.none)
        XCTAssertEqual(free.area.status, .unavailable)

        // Locked descriptors drive the LockedCards + soft wall.
        let locked = try XCTUnwrap(preview.locked)
        XCTAssertFalse(locked.isEmpty)
        for section in locked {
            XCTAssertNotEqual(section.unlock, .unknown, "\(section.id) unlock should be account|claim")
            XCTAssertFalse(section.title.isEmpty)
        }
    }

    // MARK: - Neighbor message templates (captured)

    func testDecodesNeighborMessageTemplates() throws {
        let catalog = try decoder.decode(
            NeighborMessageTemplates.self,
            from: fixture("neighbor-templates.json")
        )
        XCTAssertFalse(catalog.templates.isEmpty)
        XCTAssertFalse(catalog.replies.isEmpty)
        let noise = try XCTUnwrap(catalog.templates.first { $0.id == "noise" })
        XCTAssertEqual(noise.category, "Late-night noise")
        XCTAssertFalse(noise.body.isEmpty)
    }

    // MARK: - Residency letter public verify (captured)

    func testDecodesUnknownResidencyVerification() throws {
        let verification = try decoder.decode(
            ResidencyLetterVerification.self,
            from: fixture("residency-verify-unknown.json")
        )
        XCTAssertFalse(verification.valid)
        XCTAssertNil(verification.status)
    }

    // MARK: - Geo autocomplete (captured — note the [lng, lat] center)

    func testDecodesGeoAutocompleteSuggestions() throws {
        let response = try decoder.decode(
            GeoAutocompleteResponse.self,
            from: fixture("geo-autocomplete.json")
        )
        let first = try XCTUnwrap(response.suggestions.first)
        XCTAssertEqual(first.primaryText, "4008 Northeast Tacoma Court")
        // GeoJSON order on the wire: [longitude, latitude].
        XCTAssertEqual(try XCTUnwrap(first.longitude), -122.388947, accuracy: 0.0001)
        XCTAssertEqual(try XCTUnwrap(first.latitude), 45.608302, accuracy: 0.0001)
    }

    // MARK: - Forward-compatibility (hand-authored)

    func testUnknownSectionIdSurvivesWithNilData() throws {
        let json = """
        {
          "place": { "label": "X", "line1": "X", "city": "C", "state": "WA", "postal_code": null },
          "tier": "T3",
          "region_supported": true,
          "generated_at": "2026-06-12T00:00:00Z",
          "groups": [
            {
              "group": "some_future_group",
              "label": "Future things",
              "sections": [
                {
                  "id": "quantum_risk",
                  "group": "some_future_group",
                  "band": "A",
                  "access": "available",
                  "status": "ready",
                  "as_of": null,
                  "source": "Future Provider",
                  "coverage": "full",
                  "unavailable_reason": null,
                  "data": { "anything": [1, 2, 3] }
                }
              ]
            }
          ]
        }
        """
        let intelligence = try decoder.decode(PlaceIntelligence.self, from: Data(json.utf8))
        let section = try XCTUnwrap(intelligence.groups.first?.sections.first)
        XCTAssertEqual(section.id, .unknown("quantum_risk"))
        XCTAssertEqual(section.group, .unknown("some_future_group"))
        XCTAssertNil(section.data)
        XCTAssertEqual(intelligence.groups.first?.label, "Future things")
    }

    func testUnknownEnumVocabularyDegradesGracefully() throws {
        let json = """
        {
          "id": "weather",
          "group": "today",
          "band": "A",
          "access": "available",
          "status": "hyperfresh",
          "as_of": "2026-06-12T00:00:00Z",
          "source": "NWS",
          "coverage": "galactic",
          "unavailable_reason": null,
          "data": {
            "current_temp_f": 62,
            "condition_code": "plasma_storm",
            "condition_label": "Plasma storm",
            "feels_like_f": null,
            "high_f": 70,
            "low_f": 50,
            "hourly": [],
            "daily": []
          }
        }
        """
        let envelope = try decoder.decode(PlaceSectionEnvelope.self, from: Data(json.utf8))
        // Unknown status → quiet degraded state, unknown coverage → partial.
        XCTAssertEqual(envelope.status, .unavailable)
        XCTAssertEqual(envelope.coverage, .partial)
        // Unknown condition vocabulary keeps the server label renderable.
        let weather = try XCTUnwrap(envelope.weather)
        XCTAssertEqual(weather.conditionCode, .unknown)
        XCTAssertEqual(weather.conditionLabel, "Plasma storm")
    }

    func testMalformedSectionPayloadDegradesThatSectionOnly() throws {
        let json = """
        {
          "id": "flood",
          "group": "risk_readiness",
          "band": "A",
          "access": "available",
          "status": "ready",
          "as_of": null,
          "source": "FEMA",
          "coverage": "full",
          "unavailable_reason": null,
          "data": { "zone": 12345 }
        }
        """
        let envelope = try decoder.decode(PlaceSectionEnvelope.self, from: Data(json.utf8))
        XCTAssertEqual(envelope.id, .flood)
        XCTAssertEqual(envelope.status, .ready)
        XCTAssertNil(envelope.data, "malformed payload should degrade to nil data, not throw")
    }

    func testLockedSectionDecodesWithNilData() throws {
        let json = """
        {
          "id": "your_home",
          "group": "your_home",
          "band": "B",
          "access": "locked",
          "status": "ready",
          "as_of": null,
          "source": null,
          "coverage": "full",
          "unavailable_reason": "Claim this home to unlock property facts.",
          "data": null
        }
        """
        let envelope = try decoder.decode(PlaceSectionEnvelope.self, from: Data(json.utf8))
        XCTAssertEqual(envelope.access, .locked)
        XCTAssertNil(envelope.data)
        XCTAssertEqual(envelope.unavailableReason, "Claim this home to unlock property facts.")
    }

    // MARK: - Residency letter issuer shape (hand-authored from

    // `backend/services/residencyLetterService.js:185` serializeLetter)

    func testDecodesResidencyLetterEnvelope() throws {
        let json = """
        {
          "letter": {
            "id": "ltr_1",
            "home_id": "home_1",
            "status": "issued",
            "purpose": "New library card application",
            "resident_name": "Alice Doe",
            "address": { "line1": "4008 Northeast Tacoma Court", "city": "Camas", "state": "WA", "zipcode": "98607" },
            "letter_code": "ABCD-EFGH-JKLM-NPQR",
            "verify_url": "https://pantopus.com/verify-residency/ABCD-EFGH-JKLM-NPQR",
            "issued_at": "2026-06-12T00:00:00Z",
            "revoked_at": null,
            "pdf_sha256": "deadbeef"
          }
        }
        """
        let response = try decoder.decode(ResidencyLetterResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.letter.status, .issued)
        XCTAssertEqual(response.letter.letterCode, "ABCD-EFGH-JKLM-NPQR")
        XCTAssertEqual(response.letter.address.line1, "4008 Northeast Tacoma Court")
    }

    // MARK: - Pulse envelope (hand-authored from

    // `frontend/packages/types/src/ai.ts` NeighborhoodPulse; live capture
    // pending a home with the `home.view` grant — see Phase 4)

    func testDecodesNeighborhoodPulse() throws {
        let json = """
        {
          "pulse": {
            "greeting": "Good morning",
            "summary": "All quiet on your block.",
            "overall_status": "quiet",
            "property": { "year_built": 1979, "sqft": 1840, "estimated_value": 612000, "zip_median_value": 498000, "property_type": "house" },
            "neighborhood": null,
            "signals": [
              {
                "signal_type": "air_quality",
                "priority": 80,
                "title": "Air quality is good",
                "detail": "AQI 38 — a great day to be outside.",
                "icon": "wind",
                "color": "green",
                "actions": [ { "type": "view", "label": "See details", "route": "/place/today" } ]
              }
            ],
            "seasonal_context": { "season": "summer", "tip": null, "first_action_nudge": null },
            "community_density": { "neighbor_count": 0, "density_message": "Be the first on your block", "invite_cta": true },
            "sources": [ { "provider": "AirNow", "updated_at": "2026-06-12T00:00:00Z" } ],
            "meta": { "community_signals_count": 0, "external_signals_count": 1, "partial_failures": [], "computed_at": "2026-06-12T00:00:00Z" }
          }
        }
        """
        let pulse = try decoder.decode(NeighborhoodPulse.self, from: Data(json.utf8))
        XCTAssertEqual(pulse.pulse.overallStatus, "quiet")
        XCTAssertEqual(pulse.pulse.signals.first?.signalType, "air_quality")
        XCTAssertEqual(pulse.pulse.signals.first?.actions?.first?.label, "See details")
    }
}
