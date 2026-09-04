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

@MainActor
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
        XCTAssertTrue(PantopusTextStyle.overline.isUppercased)
        XCTAssertFalse(PantopusTextStyle.body.isUppercased)
    }

    /// The casing is the part that used to be dead: the ramp declared
    /// `.overline` UPPERCASE but reached for the string through a `Mirror`
    /// probe that never matched, so the modifier rebuilt every overline as
    /// `Text(verbatim: "")` and the labels rendered as nothing at all.
    /// `cased(_:)` is what `Text(_:style:)` runs the source string through,
    /// so assert it actually transforms.
    func testCasedAppliesOverlineUppercasing() {
        XCTAssertEqual(PantopusTextStyle.overline.cased("Welcome back"), "WELCOME BACK")
        XCTAssertEqual(PantopusTextStyle.overline.cased("USPS tracking"), "USPS TRACKING")
    }

    func testCasedLeavesNonUppercasedRolesAlone() {
        for role: PantopusTextStyle in [.h1, .h2, .h3, .body, .small, .caption] {
            XCTAssertEqual(role.cased("Welcome back"), "Welcome back")
        }
    }


    // MARK: - Render-level contract
    //
    // The blank-overline bug shipped because nothing in the suite compares
    // rendered output: the snapshot tests assert a view builds with non-zero
    // width and that a baseline PNG exists, both of which an empty label
    // satisfies. These two tests read the pixels instead.

    /// Would have caught the shipped bug directly: an overline with copy must
    /// put ink on screen.
    func testOverlineRendersVisibleInk() {
        XCTAssertEqual(ink(Text("", style: .overline)), 0, "empty copy should draw nothing")
        XCTAssertGreaterThan(
            ink(Text("Reason", style: .overline)), 0,
            "an overline with copy rendered blank — the role is dropping its string"
        )
    }

    /// Proves the upper-casing reaches the screen rather than just the helper:
    /// natural-case copy must render identically to copy already typed in caps.
    /// If the transform were dropped, the two would differ.
    func testOverlineUppercasingReachesTheScreen() {
        let natural = ink(Text("reason", style: .overline))
        let shouted = ink(Text("REASON", style: .overline))
        XCTAssertGreaterThan(natural, 0)
        XCTAssertEqual(natural, shouted, "overline did not upper-case its source string")

        // Sanity that the comparison can tell the two apart at all: a role
        // without casing must render them differently.
        XCTAssertNotEqual(
            ink(Text("reason", style: .caption)),
            ink(Text("REASON", style: .caption)),
            "ink comparison cannot distinguish casing — the test proves nothing"
        )
    }

    /// Non-white pixel count of a view rendered at 1x on a white ground.
    private func ink(_ view: some View, width: CGFloat = 260, height: CGFloat = 40) -> Int {
        let renderer = ImageRenderer(
            content: view
                .foregroundStyle(.black)
                .frame(width: width, height: height, alignment: .leading)
                .background(Color.white)
        )
        renderer.scale = 1
        guard let cgImage = renderer.cgImage else {
            XCTFail("ImageRenderer produced no image")
            return -1
        }
        let w = cgImage.width, h = cgImage.height
        var bytes = [UInt8](repeating: 0, count: w * h * 4)
        guard let ctx = CGContext(
            data: &bytes,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            XCTFail("could not build a bitmap context")
            return -1
        }
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))
        return stride(from: 0, to: bytes.count, by: 4).reduce(into: 0) { total, i in
            if bytes[i] < 200 { total += 1 }
        }
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
