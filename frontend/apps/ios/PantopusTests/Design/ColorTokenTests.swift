//
//  ColorTokenTests.swift
//  PantopusTests
//
//  For every color in the design-system inventory, resolve the asset-catalog
//  entry in a light trait collection, extract its sRGB components, and
//  assert that they match the expected hex to 3 decimals of precision.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

final class ColorTokenTests: XCTestCase {
    private let lightTraits = UITraitCollection(userInterfaceStyle: .light)

    // MARK: - Primary

    func testPrimaryScale() {
        assertColor(Theme.Color.primary50, hex: "#f0f9ff")
        assertColor(Theme.Color.primary100, hex: "#e0f2fe")
        assertColor(Theme.Color.primary200, hex: "#bae6fd")
        assertColor(Theme.Color.primary300, hex: "#7dd3fc")
        assertColor(Theme.Color.primary400, hex: "#38bdf8")
        assertColor(Theme.Color.primary500, hex: "#0ea5e9")
        assertColor(Theme.Color.primary600, hex: "#0284c7")
        assertColor(Theme.Color.primary700, hex: "#0369a1")
        assertColor(Theme.Color.primary800, hex: "#075985")
        assertColor(Theme.Color.primary900, hex: "#0c4a6e")
    }

    func testSemantic() {
        assertColor(Theme.Color.success, hex: "#059669")
        assertColor(Theme.Color.successLight, hex: "#D1FAE5")
        assertColor(Theme.Color.successBg, hex: "#F0FDF4")
        assertColor(Theme.Color.warning, hex: "#D97706")
        assertColor(Theme.Color.warningLight, hex: "#FDE68A")
        assertColor(Theme.Color.warningBg, hex: "#FFFBEB")
        assertColor(Theme.Color.error, hex: "#DC2626")
        assertColor(Theme.Color.errorLight, hex: "#FECACA")
        assertColor(Theme.Color.errorBg, hex: "#FEF2F2")
        assertColor(Theme.Color.info, hex: "#0284c7")
        assertColor(Theme.Color.infoLight, hex: "#BAE6FD")
        assertColor(Theme.Color.infoBg, hex: "#F0F9FF")
    }

    func testIdentity() {
        assertColor(Theme.Color.personal, hex: "#0284C7")
        assertColor(Theme.Color.personalBg, hex: "#DBEAFE")
        assertColor(Theme.Color.home, hex: "#16A34A")
        assertColor(Theme.Color.homeBg, hex: "#DCFCE7")
        assertColor(Theme.Color.business, hex: "#7C3AED")
        assertColor(Theme.Color.businessBg, hex: "#F3E8FF")
    }

    func testPulseIntentAccents() {
        assertColor(Theme.Color.rose, hex: "#BE123C")
        assertColor(Theme.Color.roseBg, hex: "#FFE4E6")
        assertColor(Theme.Color.slate, hex: "#475569")
        assertColor(Theme.Color.slateBg, hex: "#E2E8F0")
    }

    func testNeutrals() {
        assertColor(Theme.Color.appBg, hex: "#f6f7f9")
        assertColor(Theme.Color.appSurface, hex: "#ffffff")
        assertColor(Theme.Color.appSurfaceRaised, hex: "#f9fafb")
        assertColor(Theme.Color.appSurfaceSunken, hex: "#f3f4f6")
        assertColor(Theme.Color.appSurfaceMuted, hex: "#f8fafc")
        assertColor(Theme.Color.appBorder, hex: "#e5e7eb")
        assertColor(Theme.Color.appBorderStrong, hex: "#d1d5db")
        assertColor(Theme.Color.appBorderSubtle, hex: "#f3f4f6")
        assertColor(Theme.Color.appText, hex: "#111827")
        assertColor(Theme.Color.appTextStrong, hex: "#374151")
        assertColor(Theme.Color.appTextSecondary, hex: "#6b7280")
        assertColor(Theme.Color.appTextMuted, hex: "#9ca3af")
        assertColor(Theme.Color.appTextInverse, hex: "#ffffff")
        assertColor(Theme.Color.appHover, hex: "#f3f4f6")
    }

    func testCategories() {
        assertColor(Theme.Color.handyman, hex: "#f97316")
        assertColor(Theme.Color.cleaning, hex: "#27ae60")
        assertColor(Theme.Color.moving, hex: "#8e44ad")
        assertColor(Theme.Color.petCare, hex: "#e74c3c")
        assertColor(Theme.Color.childCare, hex: "#f39c12")
        assertColor(Theme.Color.tutoring, hex: "#2980b9")
        assertColor(Theme.Color.delivery, hex: "#374151")
        assertColor(Theme.Color.tech, hex: "#3498db")
        assertColor(Theme.Color.goods, hex: "#7c3aed")
        assertColor(Theme.Color.gigs, hex: "#f97316")
        assertColor(Theme.Color.rentals, hex: "#16a34a")
        assertColor(Theme.Color.vehicles, hex: "#dc2626")
        // A17.12 — Mail-task indigo accent (mirrors Android categoryTask).
        assertColor(Theme.Color.categoryTask, hex: "#4f46e5")
    }

    func testRating() {
        assertColor(Theme.Color.star, hex: "#f59e0b")
    }

    // MARK: - Helpers

    private func assertColor(
        _ color: Color,
        hex: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let ui = UIColor(color).resolvedColor(with: lightTraits)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard ui.getRed(&r, green: &g, blue: &b, alpha: &a) else {
            XCTFail("Could not extract RGBA for \(hex)", file: file, line: line)
            return
        }
        let expected = Self.hexToComponents(hex)
        XCTAssertEqual(Double(r), expected.r, accuracy: 0.001, "red mismatch for \(hex)", file: file, line: line)
        XCTAssertEqual(Double(g), expected.g, accuracy: 0.001, "green mismatch for \(hex)", file: file, line: line)
        XCTAssertEqual(Double(b), expected.b, accuracy: 0.001, "blue mismatch for \(hex)", file: file, line: line)
        XCTAssertEqual(Double(a), 1.0, accuracy: 0.001, "alpha mismatch for \(hex)", file: file, line: line)
    }

    private static func hexToComponents(_ hex: String) -> RGBComponents {
        var s = hex
        if s.hasPrefix("#") { s.removeFirst() }
        let value = UInt64(s, radix: 16) ?? 0
        let r = Double((value >> 16) & 0xFF) / 255.0
        let g = Double((value >> 8) & 0xFF) / 255.0
        let b = Double(value & 0xFF) / 255.0
        // Round to 3 decimals to mirror the asset-catalog precision.
        return RGBComponents(
            r: (r * 1000).rounded() / 1000,
            g: (g * 1000).rounded() / 1000,
            b: (b * 1000).rounded() / 1000
        )
    }

    private struct RGBComponents {
        let r: Double
        let g: Double
        let b: Double
    }
}
