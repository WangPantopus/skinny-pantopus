//
//  SpacingRadiiTests.swift
//  PantopusTests
//

import XCTest
@testable import Pantopus

final class SpacingRadiiTests: XCTestCase {
    func testSpacingRamp() {
        XCTAssertEqual(Spacing.s0, 0)
        XCTAssertEqual(Spacing.s1, 4)
        XCTAssertEqual(Spacing.s2, 8)
        XCTAssertEqual(Spacing.s3, 12)
        XCTAssertEqual(Spacing.s4, 16)
        XCTAssertEqual(Spacing.s5, 20)
        XCTAssertEqual(Spacing.s6, 24)
        XCTAssertEqual(Spacing.s8, 32)
        XCTAssertEqual(Spacing.s10, 40)
        XCTAssertEqual(Spacing.s12, 48)
        XCTAssertEqual(Spacing.s16, 64)
    }

    func testRadii() {
        XCTAssertEqual(Radii.xs, 4)
        XCTAssertEqual(Radii.sm, 6)
        XCTAssertEqual(Radii.md, 8)
        XCTAssertEqual(Radii.lg, 12)
        XCTAssertEqual(Radii.xl, 16)
        XCTAssertEqual(Radii.xl2, 20)
        XCTAssertEqual(Radii.xl3, 24)
        XCTAssertEqual(Radii.pill, 9999)
    }

    func testShadowTokens() {
        XCTAssertEqual(PantopusShadow.sm.opacity, 0.04, accuracy: 0.001)
        XCTAssertEqual(PantopusShadow.sm.radius, 3)
        XCTAssertEqual(PantopusShadow.sm.y, 1)

        XCTAssertEqual(PantopusShadow.md.opacity, 0.06, accuracy: 0.001)
        XCTAssertEqual(PantopusShadow.md.radius, 6)
        XCTAssertEqual(PantopusShadow.md.y, 2)

        XCTAssertEqual(PantopusShadow.lg.opacity, 0.08, accuracy: 0.001)
        XCTAssertEqual(PantopusShadow.lg.radius, 12)
        XCTAssertEqual(PantopusShadow.lg.y, 4)

        XCTAssertEqual(PantopusShadow.xl.opacity, 0.10, accuracy: 0.001)
        XCTAssertEqual(PantopusShadow.xl.radius, 24)
        XCTAssertEqual(PantopusShadow.xl.y, 8)

        XCTAssertEqual(PantopusShadow.primary.opacity, 0.18, accuracy: 0.001)
        XCTAssertEqual(PantopusShadow.primary.radius, 16)
        XCTAssertEqual(PantopusShadow.primary.y, 6)
    }
}
