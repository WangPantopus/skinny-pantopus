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
        assertColor(Theme.Color.success, hex: "#047857")
        assertColor(Theme.Color.successLight, hex: "#D1FAE5")
        assertColor(Theme.Color.successBg, hex: "#F0FDF4")
        assertColor(Theme.Color.warning, hex: "#9A4A08")
        assertColor(Theme.Color.warningLight, hex: "#FDE68A")
        assertColor(Theme.Color.warningBg, hex: "#FFFBEB")
        assertColor(Theme.Color.error, hex: "#A81A1A")
        assertColor(Theme.Color.errorLight, hex: "#FECACA")
        assertColor(Theme.Color.errorBg, hex: "#FEF2F2")
        assertColor(Theme.Color.info, hex: "#075985")
        assertColor(Theme.Color.infoLight, hex: "#BAE6FD")
        assertColor(Theme.Color.infoBg, hex: "#F0F9FF")
    }

    func testIdentity() {
        assertColor(Theme.Color.personal, hex: "#0369A1")
        assertColor(Theme.Color.personalBg, hex: "#DBEAFE")
        assertColor(Theme.Color.home, hex: "#15803D")
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
        assertColor(Theme.Color.appTextSecondary, hex: "#4E5563")
        assertColor(Theme.Color.appTextMuted, hex: "#5F6775")
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

    /// Exercise the production checkbox, including its theme-dependent fill.
    /// A palette-only test cannot catch accidentally using the lightened label
    /// token behind the white checkmark in dark mode.
    @MainActor
    func testSelectedCheckHasVisibleContrastInBothThemes() throws {
        for scheme in [ColorScheme.light, .dark] {
            let renderer = ImageRenderer(content: SelectionCheck(isOn: true)
                .padding(4)
                .environment(\.colorScheme, scheme))
            renderer.scale = 3
            let image = try XCTUnwrap(renderer.cgImage)
            var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
            let context = try XCTUnwrap(CGContext(
                data: &pixels,
                width: image.width,
                height: image.height,
                bitsPerComponent: 8,
                bytesPerRow: image.width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ))
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
            var fills: [Int: Int] = [:]
            var whitePixels = 0
            for offset in stride(from: 0, to: pixels.count, by: 4) where pixels[offset + 3] == 255 {
                let red = Int(pixels[offset]), green = Int(pixels[offset + 1]), blue = Int(pixels[offset + 2])
                if min(red, green, blue) > 240 {
                    whitePixels += 1
                } else {
                    fills[(red << 16) | (green << 8) | blue, default: 0] += 1
                }
            }
            XCTAssertGreaterThan(whitePixels, 0, "The selected checkmark must be visible")
            let fill = try XCTUnwrap(fills.max { $0.value < $1.value }?.key)
            let linear = [16, 8, 0].map { shift -> Double in
                let channel = Double((fill >> shift) & 255) / 255
                return channel <= 0.04045 ? channel / 12.92 : pow((channel + 0.055) / 1.055, 2.4)
            }
            let luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
            XCTAssertGreaterThanOrEqual(1.05 / (luminance + 0.05), 3, "Checkmark contrast in \(scheme)")
        }
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
