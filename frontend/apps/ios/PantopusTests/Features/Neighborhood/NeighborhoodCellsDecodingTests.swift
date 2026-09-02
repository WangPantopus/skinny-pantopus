//
//  NeighborhoodCellsDecodingTests.swift
//  PantopusTests
//
//  The Nearby window: cells carry a box and a bucket, never a count or a
//  point; unknown buckets shade as nothing; the legend comes from the server.
//

import XCTest
@testable import Pantopus

@MainActor
final class NeighborhoodCellsDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testDecodesCellsWithBoundsBucketsAndTheHomeFlag() throws {
        let json = """
        {"state":"ready","home_cell":"c22zqm","center":{"lat":45.587,"lng":-122.403},"k_anon_min":10,
         "buckets":{"none":"No verified homes yet","forming":"Forming (under 10)","few":"A few (10–24)","growing":"Growing (25+)"},
         "cells":[{"geohash":"c22zqm","bounds":[[45.5845,-122.4085],[45.5900,-122.3975]],"bucket":"growing","is_home":true},
                  {"geohash":"c22zqj","bounds":[[45.5790,-122.4085],[45.5845,-122.3975]],"bucket":"none","is_home":false}]}
        """
        let cells = try decoder.decode(NeighborhoodCellsDTO.self, from: Data(json.utf8))
        XCTAssertTrue(cells.isReady)
        XCTAssertEqual(cells.cells.count, 2)
        let home = try XCTUnwrap(cells.cells.first { $0.isHome })
        XCTAssertEqual(home.bucket, "growing")
        XCTAssertEqual(home.bounds[0], [45.5845, -122.4085])
        XCTAssertEqual(cells.buckets["growing"], "Growing (25+)")
        XCTAssertFalse(json.contains("verified_users_count"))
    }

    func testNoPlaceIsNotReadyAndFillsShadeByBucket() throws {
        let raw = #"{"state":"no_place","home_cell":null,"center":null,"cells":[],"buckets":{},"k_anon_min":10}"#
        let none = try decoder.decode(NeighborhoodCellsDTO.self, from: Data(raw.utf8))
        XCTAssertFalse(none.isReady)
        XCTAssertEqual(neighborhoodCellFillAlpha("none"), 0)
        XCTAssertLessThan(neighborhoodCellFillAlpha("forming"), neighborhoodCellFillAlpha("few"))
        XCTAssertLessThan(neighborhoodCellFillAlpha("few"), neighborhoodCellFillAlpha("growing"))
        XCTAssertEqual(neighborhoodCellFillAlpha("purple"), 0)
        XCTAssertEqual(neighborhoodCellLegendOrder, ["none", "forming", "few", "growing"])
    }
}
