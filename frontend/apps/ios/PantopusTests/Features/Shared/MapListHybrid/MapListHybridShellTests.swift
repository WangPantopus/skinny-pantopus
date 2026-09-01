//
//  MapListHybridShellTests.swift
//  PantopusTests
//
//  T6.6a (P24) — pure detent-resolver tests. The shell's drag-release
//  math is extracted into `MapListHybridDetentResolver.resolve(...)` so
//  these tests verify snap-to-nearest, velocity-nudge, and edge clamps
//  without spinning up SwiftUI. Detents are screen-relative fractions
//  (0.20 / 0.40 / 0.90) per the A11.1 revision of the Q9 contract.
//

import CoreLocation
import XCTest
@testable import Pantopus

final class MapListHybridShellTests: XCTestCase {
    // MARK: - Snap-to-nearest

    func testResolveSnapsToCollapsedWhenSheetReleasedNearCollapsedHeight() {
        let target = MapListHybridDetentResolver.resolve(
            from: .standard,
            velocity: 0,
            displacedFraction: 0.22 // near 0.20
        )
        XCTAssertEqual(target, .collapsed)
    }

    func testResolveSnapsToStandardWhenSheetReleasedNearStandardHeight() {
        let target = MapListHybridDetentResolver.resolve(
            from: .collapsed,
            velocity: 0,
            displacedFraction: 0.38 // near 0.40
        )
        XCTAssertEqual(target, .standard)
    }

    func testResolveSnapsToExpandedWhenSheetReleasedNearExpandedHeight() {
        let target = MapListHybridDetentResolver.resolve(
            from: .standard,
            velocity: 0,
            displacedFraction: 0.85 // near 0.90
        )
        XCTAssertEqual(target, .expanded)
    }

    func testResolveSnapsToMidpointPreferringStandard() {
        // 0.33 sits between collapsed (0.20) and standard (0.40); snap to
        // whichever is closer.
        let target = MapListHybridDetentResolver.resolve(
            from: .collapsed,
            velocity: 0,
            displacedFraction: 0.33
        )
        XCTAssertEqual(target, .standard)
    }

    // MARK: - Velocity nudge

    //
    // Sign convention: positive velocity = downward flick (shrinks the
    // sheet); negative = upward (grows). Matches Compose's `draggable`
    // and the browser's `clientY` delta — see the resolver docstring.

    func testFlickUpFromCollapsedAdvancesToStandard() {
        let target = MapListHybridDetentResolver.resolve(
            from: .collapsed,
            velocity: -800, // upward → grow
            displacedFraction: 0.22
        )
        XCTAssertEqual(target, .standard)
    }

    func testFlickUpFromStandardAdvancesToExpanded() {
        let target = MapListHybridDetentResolver.resolve(
            from: .standard,
            velocity: -1000,
            displacedFraction: 0.43
        )
        XCTAssertEqual(target, .expanded)
    }

    func testFlickUpFromExpandedStaysExpanded() {
        let target = MapListHybridDetentResolver.resolve(
            from: .expanded,
            velocity: -1200,
            displacedFraction: 0.88
        )
        XCTAssertEqual(target, .expanded)
    }

    func testFlickDownFromExpandedRetreatsToStandard() {
        let target = MapListHybridDetentResolver.resolve(
            from: .expanded,
            velocity: 800, // downward → shrink
            displacedFraction: 0.85
        )
        XCTAssertEqual(target, .standard)
    }

    func testFlickDownFromStandardRetreatsToCollapsed() {
        let target = MapListHybridDetentResolver.resolve(
            from: .standard,
            velocity: 1000,
            displacedFraction: 0.38
        )
        XCTAssertEqual(target, .collapsed)
    }

    func testFlickDownFromCollapsedStaysCollapsed() {
        let target = MapListHybridDetentResolver.resolve(
            from: .collapsed,
            velocity: 1200,
            displacedFraction: 0.19
        )
        XCTAssertEqual(target, .collapsed)
    }

    // MARK: - Threshold boundary

    func testVelocityAtThresholdDoesNotNudge() {
        // At the threshold exactly, snap-to-nearest should win
        // (resolver uses strict `>` so equal-to-threshold defers).
        let target = MapListHybridDetentResolver.resolve(
            from: .collapsed,
            velocity: MapListHybridDetentResolver.velocityThreshold,
            displacedFraction: 0.22
        )
        XCTAssertEqual(target, .collapsed)
    }

    // MARK: - Detent fractions

    func testDetentFractionsMatchContract() {
        XCTAssertEqual(MapListHybridDetent.collapsed.heightFraction, 0.20, accuracy: 0.0001)
        XCTAssertEqual(MapListHybridDetent.standard.heightFraction, 0.40, accuracy: 0.0001)
        XCTAssertEqual(MapListHybridDetent.expanded.heightFraction, 0.90, accuracy: 0.0001)
    }

    func testDetentResolvesAbsoluteHeightFromContainer() {
        XCTAssertEqual(MapListHybridDetent.collapsed.height(in: 800), 160, accuracy: 0.0001)
        XCTAssertEqual(MapListHybridDetent.standard.height(in: 800), 320, accuracy: 0.0001)
        XCTAssertEqual(MapListHybridDetent.expanded.height(in: 800), 720, accuracy: 0.0001)
    }

    func testDetentAllCasesOrdered() {
        XCTAssertEqual(
            MapListHybridDetent.allCases,
            [.collapsed, .standard, .expanded]
        )
    }

    // MARK: - Pin model

    func testMapPinExposesCoordinate() {
        let pin = MapPin(id: "p1", latitude: 40.75, longitude: -73.98, color: .red)
        XCTAssertEqual(pin.coordinate.latitude, 40.75)
        XCTAssertEqual(pin.coordinate.longitude, -73.98)
        XCTAssertEqual(pin.state, .confirmed)
    }

    func testMapPinPendingStateOverride() {
        let pin = MapPin(id: "p2", latitude: 0, longitude: 0, color: .blue, state: .pending)
        XCTAssertEqual(pin.state, .pending)
    }
}
