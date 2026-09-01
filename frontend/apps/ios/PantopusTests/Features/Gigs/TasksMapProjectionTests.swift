//
//  TasksMapProjectionTests.swift
//  PantopusTests
//
//  A11.1 Tasks map — pure projection / geometry functions kept free of
//  MapKit and network state: the "Search this area" significance check,
//  the grid-bucket clustering pass, the fit-to-pins camera region, the
//  detent → sheet-body projection, the verified-poster → pin-style
//  projection, and the full-list `GigRow` card projection.
//

import SwiftUI
import XCTest
@testable import Pantopus

// swiftlint:disable force_unwrapping

@MainActor
final class TasksMapProjectionTests: XCTestCase {
    // MARK: - Helpers

    private func region(
        lat: Double = 40.7484,
        lon: Double = -73.9857,
        latSpan: Double = 0.024,
        lonSpan: Double = 0.032
    ) -> MapListHybridRegion {
        MapListHybridRegion(
            centerLatitude: lat,
            centerLongitude: lon,
            latitudeSpan: latSpan,
            longitudeSpan: lonSpan
        )
    }

    private func pin(_ id: String, _ lat: Double, _ lon: Double) -> MapPin {
        MapPin(id: id, latitude: lat, longitude: lon, color: .red)
    }

    private func decodeGig(_ json: String) throws -> GigDTO {
        try JSONDecoder().decode(GigDTO.self, from: Data(json.utf8))
    }

    private let anchor = MapAnchor(latitude: 40.7484, longitude: -73.9857)

    // MARK: - regionChangedSignificantly

    func testIdenticalRegionIsNotSignificant() {
        XCTAssertFalse(TasksMapGeometry.regionChangedSignificantly(from: region(), to: region()))
    }

    func testSmallPanIsNotSignificant() {
        // 10% of the lat span — under the 25% threshold.
        let to = region(lat: 40.7484 + 0.0024)
        XCTAssertFalse(TasksMapGeometry.regionChangedSignificantly(from: region(), to: to))
    }

    func testLatitudePanBeyondQuarterSpanIsSignificant() {
        let to = region(lat: 40.7484 + 0.024 * 0.3)
        XCTAssertTrue(TasksMapGeometry.regionChangedSignificantly(from: region(), to: to))
    }

    func testLongitudePanBeyondQuarterSpanIsSignificant() {
        let to = region(lon: -73.9857 + 0.032 * 0.3)
        XCTAssertTrue(TasksMapGeometry.regionChangedSignificantly(from: region(), to: to))
    }

    func testMildZoomIsNotSignificant() {
        let to = region(latSpan: 0.024 * 1.2, lonSpan: 0.032 * 1.2)
        XCTAssertFalse(TasksMapGeometry.regionChangedSignificantly(from: region(), to: to))
    }

    func testZoomOutBeyondHalfIsSignificant() {
        let to = region(latSpan: 0.024 * 2, lonSpan: 0.032 * 2)
        XCTAssertTrue(TasksMapGeometry.regionChangedSignificantly(from: region(), to: to))
    }

    func testZoomInBeyondHalfIsSignificant() {
        let to = region(latSpan: 0.024 * 0.5, lonSpan: 0.032 * 0.5)
        XCTAssertTrue(TasksMapGeometry.regionChangedSignificantly(from: region(), to: to))
    }

    // MARK: - buildClusteredPins

    func testClosePinsClusterAtWideSpan() {
        // ~0.001° apart at a 0.5° span → far under the 44pt bucket.
        let pins = [pin("a", 40.7501, -73.9881), pin("b", 40.7508, -73.9874)]
        let result = TasksMapGeometry.buildClusteredPins(pins: pins, span: 0.5)
        XCTAssertTrue(result.singles.isEmpty)
        XCTAssertEqual(result.clusters.count, 1)
        XCTAssertEqual(result.clusters.first?.count, 2)
    }

    func testFarPinsStaySinglesAtTightSpan() {
        let pins = [pin("a", 40.7501, -73.9881), pin("b", 40.7508, -73.9874)]
        // 0.002° span → cell ≈ 0.00023°, smaller than the pin spacing.
        let result = TasksMapGeometry.buildClusteredPins(pins: pins, span: 0.002)
        XCTAssertEqual(result.singles.map(\.id), ["a", "b"])
        XCTAssertTrue(result.clusters.isEmpty)
    }

    func testMixedSinglesAndClustersPreserveInputOrder() {
        let pins = [
            pin("solo1", 40.80, -73.90),
            pin("pair1", 40.7501, -73.9881),
            pin("pair2", 40.7502, -73.9882),
            pin("solo2", 40.70, -74.05)
        ]
        let result = TasksMapGeometry.buildClusteredPins(pins: pins, span: 0.1)
        XCTAssertEqual(result.singles.map(\.id), ["solo1", "solo2"])
        XCTAssertEqual(result.clusters.count, 1)
        XCTAssertEqual(result.clusters.first?.count, 2)
    }

    func testClusterCentroidIsMeanOfMembers() {
        let pins = [pin("a", 40.0, -73.0), pin("b", 40.002, -73.002)]
        let result = TasksMapGeometry.buildClusteredPins(pins: pins, span: 1.0)
        XCTAssertEqual(result.clusters.first?.latitude ?? 0, 40.001, accuracy: 1e-9)
        XCTAssertEqual(result.clusters.first?.longitude ?? 0, -73.001, accuracy: 1e-9)
    }

    func testClusteringIsStableAcrossCalls() {
        let pins = TasksMapSampleData.items.map(\.pin)
        let first = TasksMapGeometry.buildClusteredPins(pins: pins, span: 0.05)
        let second = TasksMapGeometry.buildClusteredPins(pins: pins, span: 0.05)
        XCTAssertEqual(first.singles.map(\.id), second.singles.map(\.id))
        XCTAssertEqual(first.clusters, second.clusters)
    }

    func testSinglePinNeverClusters() {
        let result = TasksMapGeometry.buildClusteredPins(pins: [pin("a", 40, -73)], span: 10)
        XCTAssertEqual(result.singles.map(\.id), ["a"])
        XCTAssertTrue(result.clusters.isEmpty)
    }

    func testZeroSpanReturnsAllSingles() {
        let pins = [pin("a", 40, -73), pin("b", 40, -73)]
        let result = TasksMapGeometry.buildClusteredPins(pins: pins, span: 0)
        XCTAssertEqual(result.singles.count, 2)
        XCTAssertTrue(result.clusters.isEmpty)
    }

    // MARK: - fittingRegion (focus-on-pins)

    func testFittingRegionCoversAllPinsWithPadding() throws {
        let pins = TasksMapSampleData.items.map(\.pin)
        let region = TasksMapGeometry.fittingRegion(pins: pins)
        XCTAssertNotNil(region)
        for p in pins {
            XCTAssertGreaterThanOrEqual(p.latitude, region?.minLatitude ?? .infinity)
            XCTAssertLessThanOrEqual(p.latitude, region?.maxLatitude ?? -.infinity)
            XCTAssertGreaterThanOrEqual(p.longitude, region?.minLongitude ?? .infinity)
            XCTAssertLessThanOrEqual(p.longitude, region?.maxLongitude ?? -.infinity)
        }
        // Padding factor 1.4 over the raw bounding box.
        let latExtent = try XCTUnwrap(pins.map(\.latitude).max()) - pins.map(\.latitude).min()!
        XCTAssertEqual(region?.latitudeSpan ?? 0, latExtent * 1.4, accuracy: 1e-9)
    }

    func testFittingRegionEnforcesMinimumSpan() {
        let region = TasksMapGeometry.fittingRegion(pins: [pin("a", 40, -73)])
        XCTAssertEqual(region?.latitudeSpan, 0.005)
        XCTAssertEqual(region?.longitudeSpan, 0.005)
    }

    func testFittingRegionNilWithoutPins() {
        XCTAssertNil(TasksMapGeometry.fittingRegion(pins: []))
    }

    // MARK: - Detent → sheet-body projection

    func testSheetModeProjectionPerDetent() {
        XCTAssertEqual(TasksMapSheetMode.mode(for: .collapsed), .headerOnly)
        XCTAssertEqual(TasksMapSheetMode.mode(for: .standard), .rail)
        XCTAssertEqual(TasksMapSheetMode.mode(for: .expanded), .fullList)
    }

    // MARK: - Verified poster → pin style

    func testVerifiedCreatorProjectsConfirmedPin() throws {
        let gig = try decodeGig("""
        {"id":"g1","title":"T","latitude":40.75,"longitude":-73.98,
         "creator":{"id":"u1","verified":true}}
        """)
        XCTAssertEqual(TasksMapViewModel.project(gig, anchor: anchor)?.state, .confirmed)
    }

    func testVerifiedResidentBadgeProjectsConfirmedPin() throws {
        let gig = try decodeGig("""
        {"id":"g1","title":"T","latitude":40.75,"longitude":-73.98,
         "creator":{"id":"u1","badges":["verified_resident"]}}
        """)
        XCTAssertEqual(TasksMapViewModel.project(gig, anchor: anchor)?.state, .confirmed)
    }

    func testUnverifiedCreatorProjectsPendingPin() throws {
        let gig = try decodeGig("""
        {"id":"g1","title":"T","latitude":40.75,"longitude":-73.98,
         "creator":{"id":"u1","verified":false,"badges":["helper"]}}
        """)
        XCTAssertEqual(TasksMapViewModel.project(gig, anchor: anchor)?.state, .pending)
    }

    func testMissingCreatorProjectsPendingPin() throws {
        let gig = try decodeGig("""
        {"id":"g1","title":"T","latitude":40.75,"longitude":-73.98}
        """)
        XCTAssertEqual(TasksMapViewModel.project(gig, anchor: anchor)?.state, .pending)
    }

    func testProjectionWithoutCoordinatesDrops() throws {
        let gig = try decodeGig("{\"id\":\"g1\",\"title\":\"T\"}")
        XCTAssertNil(TasksMapViewModel.project(gig, anchor: anchor))
    }

    // MARK: - Full-list card projection

    func testCardContentCarriesRowFields() {
        let item = TaskMapItem(
            id: "x1",
            category: .cleaning,
            latitude: 40.75,
            longitude: -73.98,
            title: "Deep clean",
            body: "Two bedrooms before move-out.",
            price: "$180",
            distanceLabel: "0.5 mi",
            bidCount: 7
        )
        let card = item.cardContent
        XCTAssertEqual(card.id, "x1")
        XCTAssertEqual(card.category, .cleaning)
        XCTAssertEqual(card.title, "Deep clean")
        XCTAssertEqual(card.body, "Two bedrooms before move-out.")
        XCTAssertEqual(card.price, "$180")
        XCTAssertEqual(card.bidCount, 7)
        XCTAssertEqual(card.distanceLabel, "0.5 mi")
        XCTAssertFalse(card.isUrgent)
    }
}
