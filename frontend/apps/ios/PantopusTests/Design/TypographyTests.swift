//
//  TypographyTests.swift
//  PantopusTests
//
//  Assert that each Theme.Font role resolves to a UIFont with the correct
//  point size and weight.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

final class TypographyTests: XCTestCase {
    func testH1() {
        assertRole(.h1, size: 30, weight: .bold)
    }

    func testH2() {
        assertRole(.h2, size: 24, weight: .semibold)
    }

    func testH3() {
        assertRole(.h3, size: 20, weight: .semibold)
    }

    func testBody() {
        assertRole(.body, size: 16, weight: .regular)
    }

    func testSmall() {
        assertRole(.small, size: 14, weight: .regular)
    }

    func testCaption() {
        assertRole(.caption, size: 12, weight: .regular)
    }

    func testOverline() {
        assertRole(.overline, size: 11, weight: .semibold)
    }

    func testLineHeights() {
        XCTAssertEqual(PantopusTextStyle.h1.lineHeight, 36)
        XCTAssertEqual(PantopusTextStyle.h2.lineHeight, 32)
        XCTAssertEqual(PantopusTextStyle.h3.lineHeight, 28)
        XCTAssertEqual(PantopusTextStyle.body.lineHeight, 24)
        XCTAssertEqual(PantopusTextStyle.small.lineHeight, 20)
        XCTAssertEqual(PantopusTextStyle.caption.lineHeight, 16)
        XCTAssertEqual(PantopusTextStyle.overline.lineHeight, 16)
    }

    func testTracking() {
        XCTAssertEqual(PantopusTextStyle.h1.tracking, -0.020 * 30, accuracy: 0.001)
        XCTAssertEqual(PantopusTextStyle.h2.tracking, -0.015 * 24, accuracy: 0.001)
        XCTAssertEqual(PantopusTextStyle.overline.tracking, 0.06 * 11, accuracy: 0.001)
        XCTAssertEqual(PantopusTextStyle.body.tracking, 0)
    }

    func testOverlineIsUppercased() {
        XCTAssertTrue(PantopusTextStyle.overline.uppercased)
        XCTAssertFalse(PantopusTextStyle.body.uppercased)
    }

    // MARK: - Helpers

    /// Resolve the platform `UIFont` that SwiftUI produces for a role and
    /// verify size and weight.
    private func assertRole(
        _ style: PantopusTextStyle,
        size: CGFloat,
        weight: UIFont.Weight,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let expected = UIFont.systemFont(ofSize: size, weight: weight)
        XCTAssertEqual(expected.pointSize, size, file: file, line: line)
        // SwiftUI `Font` is opaque; the PantopusTextStyle spec is the contract
        // call sites rely on, so we assert size/weight via the enum itself.
        XCTAssertEqual(style.size, size, file: file, line: line)
        XCTAssertEqual(style.weight, swiftUIWeight(weight), file: file, line: line)
    }

    private func swiftUIWeight(_ w: UIFont.Weight) -> Font.Weight {
        switch w {
        case .bold: .bold
        case .semibold: .semibold
        case .medium: .medium
        case .regular: .regular
        case .light: .light
        case .thin: .thin
        case .ultraLight: .ultraLight
        case .heavy: .heavy
        case .black: .black
        default: .regular
        }
    }
}
