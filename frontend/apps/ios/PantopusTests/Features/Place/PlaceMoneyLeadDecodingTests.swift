//
//  PlaceMoneyLeadDecodingTests.swift
//  PantopusTests
//
//  `money_lead` on `GET /api/public/place` (Wave 4) — the anonymous
//  preview's lead figure.
//
//  A dollar figure is the most believable thing on a page and the
//  easiest to overclaim, so the decoding contract carries two rules the
//  rest of the preview does not:
//
//  * the SCOPE travels with the number. "census tract" or "county" is
//    what makes an honest benchmark honest; without it a county-wide
//    HUD rent reads as this home's rent.
//  * `null` means no figure was available, and the tiles carry the page
//    exactly as before. There is no client-side fallback figure, and
//    there must never be one — the whole point is that this one is real.
//

import XCTest
@testable import Pantopus

@MainActor
final class PlaceMoneyLeadDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    /// A real band from FEMA or HUD, carrying the scope it is true at.
    /// The scope is not decoration: without it a county-wide rent
    /// estimate reads as this home's rent.
    func testDecodesMoneyLeadWithItsScope() throws {
        let json = """
        {"status":"ready","tier":"preview","region":"US",
         "place":{"address":"1 Main St","city":"Camas","state":"WA","zipcode":"98607"},
         "money_lead":{"kind":"flood_premium",
           "headline":"Flood policies near here run $1,240–$2,890 a year",
           "detail":"Across 418 real NFIP policies in this census tract. A benchmark, not a quote.",
           "low":1240,"high":2890,"scope":"census tract",
           "source":"FEMA · OpenFEMA NFIP policies"},
         "disclaimer":"A free, one-time look."}
        """
        let preview = try decoder.decode(PlacePreview.self, from: Data(json.utf8))
        let lead = try XCTUnwrap(preview.moneyLead)

        XCTAssertEqual(lead.kind, .floodPremium)
        XCTAssertEqual(lead.low, 1240)
        XCTAssertEqual(lead.high, 2890)
        XCTAssertEqual(lead.scope, "census tract")
        // The server's own hedge must survive to the screen.
        XCTAssertTrue(lead.detail.contains("not a quote"))
        XCTAssertTrue(lead.isRenderable)
    }

    /// `null` means no figure was available. The tiles carry the page —
    /// the client must never invent one to fill the slot.
    func testNullMoneyLeadLeavesNothingToRender() throws {
        let json = """
        {"status":"partial","tier":"preview","region":"US","money_lead":null,
         "disclaimer":"A free, one-time look."}
        """
        let preview = try decoder.decode(PlacePreview.self, from: Data(json.utf8))
        XCTAssertNil(preview.moneyLead)
    }

    /// A kind this build has not seen degrades the badge, never the card.
    func testUnknownMoneyLeadKindStillRenders() throws {
        let json = """
        {"status":"ready","tier":"preview","region":"US",
         "money_lead":{"kind":"property_tax_band","headline":"Taxes here run $3,000–$4,000",
           "detail":"County assessor.","low":3000,"high":4000,"scope":"county","source":"County"},
         "disclaimer":"x"}
        """
        let lead = try XCTUnwrap(decoder.decode(PlacePreview.self, from: Data(json.utf8)).moneyLead)
        XCTAssertEqual(lead.kind, .unknown)
        XCTAssertTrue(lead.isRenderable)
    }

    // MARK: - Wedge v2 D1: the aha card and the Band-A sections

    /// The preview now leads with an aha card and carries the full
    /// Band-A section list in the dashboard's envelope. Both are optional
    /// (older backends), and an unknown tone renders as info rather than
    /// dropping the card.
    func testDecodesAhaCardAndSections() throws {
        let json = """
        {"status":"ready","tier":"preview","region":"US",
         "place":{"address":"2518 NW Lacamas Dr","city":"Camas","state":"WA","zipcode":"98607"},
         "aha":{"section_id":"lead_radon","tone":"alert","grade":"Radon zone 1",
           "headline":"This county is in the EPA's highest radon band",
           "detail":"Zone 1 means the predicted average indoor level is above the EPA action level.",
           "follow_up":"Claim it and we'll remind you when a test kit is due."},
         "sections":[{"id":"flood","group":"risk_readiness","band":"A","access":"available","status":"ready",
           "as_of":"2026-09-01T14:00:00.000Z","source":"FEMA","coverage":"full","unavailable_reason":null,
           "data":{"zone":"X","zone_label":"Zone X","risk_level":"minimal","in_sfha":false,
                   "insurance_required":false,"plain_meaning":"Minimal flood risk"}}],
         "money_lead":null,"disclaimer":"A free, one-time look."}
        """
        let preview = try decoder.decode(PlacePreview.self, from: Data(json.utf8))
        let aha = try XCTUnwrap(preview.aha)
        XCTAssertTrue(aha.isRenderable)
        XCTAssertEqual(aha.tone, .alert)
        XCTAssertEqual(aha.sectionId, "lead_radon")
        XCTAssertEqual(aha.grade, "Radon zone 1")
        XCTAssertEqual(aha.followUp, "Claim it and we'll remind you when a test kit is due.")
        XCTAssertEqual(preview.sections?.count, 1)
        XCTAssertEqual(preview.sections?.first?.group, .riskReadiness)
        XCTAssertEqual(preview.sections?.first?.status, .ready)
    }

    func testUnknownAhaToneRendersAsInfoAndOlderBackendsCarryNoAha() throws {
        let json = """
        {"status":"ready","tier":"preview","region":"US","aha":{"tone":"purple","headline":"Something new"}}
        """
        let preview = try decoder.decode(PlacePreview.self, from: Data(json.utf8))
        XCTAssertEqual(preview.aha?.tone, .info)
        XCTAssertEqual(preview.aha?.isRenderable, true)
        XCTAssertEqual(preview.aha?.grade, "")
        let older = try decoder.decode(PlacePreview.self, from: Data(#"{"status":"ready","tier":"preview"}"#.utf8))
        XCTAssertNil(older.aha)
        XCTAssertNil(older.sections)
    }
}
