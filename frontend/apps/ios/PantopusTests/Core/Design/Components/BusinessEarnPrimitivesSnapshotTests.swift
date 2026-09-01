//
//  BusinessEarnPrimitivesSnapshotTests.swift
//  PantopusTests
//
//  B1.5 — Render-smoke snapshots for the business-profile + earn primitives
//  that unblock A10.6 / A10.7 / A10.11:
//
//    - BizBannerHeader — open / closed status + personal-identity reuse.
//    - GalleryStrip — populated rail (incl. "+N" tile) + dashed empty.
//    - RatingDistribution — high / mixed / no-reviews.
//    - MapPreview — pin only / service-area ring / personal identity.
//    - ProgressRing — 0 / partial / full.
//
//  Mirrors `HeroPrimitivesSnapshotTests.swift`: host each view, size it to the
//  component's natural frame, assert it builds. Visual baseline PNGs ship as a
//  follow-up tripwire under `__Snapshots__/new-designs/` (B7).
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class BusinessEarnPrimitivesSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        size: CGSize,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(origin: .zero, size: size)
        host.loadViewIfNeeded()
        host.view.layoutIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
        XCTAssertGreaterThan(
            host.view.bounds.width,
            0,
            "\(label) collapsed to zero width",
            file: file,
            line: line
        )
    }

    private static let headerSize = CGSize(width: 360, height: 260)
    private static let stripSize = CGSize(width: 360, height: 120)
    private static let ratingSize = CGSize(width: 360, height: 130)
    private static let mapSize = CGSize(width: 360, height: 140)
    private static let ringSize = CGSize(width: 120, height: 120)

    // MARK: - BizBannerHeader

    func testBizBannerHeader_open() {
        assertRenders("BizBannerHeader open", size: Self.headerSize) {
            BizBannerHeader(
                identity: .business,
                name: "Marlow & Co. Cleaning",
                handle: "@marlowco",
                locality: "Elm Park",
                logoIcon: .sparkles,
                status: .open("Open now")
            )
        }
    }

    func testBizBannerHeader_closed() {
        assertRenders("BizBannerHeader closed", size: Self.headerSize) {
            BizBannerHeader(
                identity: .business,
                name: "Tide Pool Pet Care",
                handle: "@tidepoolpets",
                locality: "Cedar Heights",
                logoIcon: .pawPrint,
                status: .closed("Closed · opens 8 AM")
            )
        }
    }

    func testBizBannerHeader_personalIdentity() {
        assertRenders("BizBannerHeader personal", size: Self.headerSize) {
            BizBannerHeader(
                identity: .personal,
                name: "Jamie Rivera",
                handle: "@jamier",
                locality: "Riverside",
                logoInitials: "JR",
                verified: false
            )
        }
    }

    // MARK: - GalleryStrip

    func testGalleryStrip_populated() {
        assertRenders("GalleryStrip populated", size: Self.stripSize) {
            GalleryStrip(tiles: [
                GalleryTile(id: "kitchen", label: "Kitchen", tint: Theme.Color.primary600),
                GalleryTile(id: "bath", label: "Bathroom", tint: Theme.Color.success),
                GalleryTile(id: "living", label: "Living room", tint: Theme.Color.slate),
                GalleryTile(id: "more", tint: Theme.Color.primary800, icon: nil, moreCount: 9)
            ])
        }
    }

    func testGalleryStrip_empty() {
        assertRenders("GalleryStrip empty", size: Self.stripSize) {
            GalleryStrip(tiles: [])
        }
    }

    // MARK: - RatingDistribution

    func testRatingDistribution_high() {
        assertRenders("RatingDistribution high", size: Self.ratingSize) {
            RatingDistribution(average: 4.9, count: 128, distribution: [0.92, 0.06, 0.02, 0, 0])
        }
    }

    func testRatingDistribution_mixed() {
        assertRenders("RatingDistribution mixed", size: Self.ratingSize) {
            RatingDistribution(average: 4.2, count: 36, distribution: [0.52, 0.28, 0.12, 0.05, 0.03])
        }
    }

    func testRatingDistribution_noReviews() {
        assertRenders("RatingDistribution none", size: Self.ratingSize) {
            RatingDistribution(average: 0, count: 0, distribution: [])
        }
    }

    // MARK: - MapPreview

    func testMapPreview_pinOnly() {
        assertRenders("MapPreview pin", size: Self.mapSize) {
            MapPreview(identity: .business)
        }
    }

    func testMapPreview_serviceArea() {
        assertRenders("MapPreview service area", size: Self.mapSize) {
            MapPreview(identity: .business, serviceAreaRadius: 56)
        }
    }

    func testMapPreview_personalIdentity() {
        assertRenders("MapPreview personal", size: Self.mapSize) {
            MapPreview(identity: .personal, serviceAreaRadius: 40)
        }
    }

    // MARK: - ProgressRing

    func testProgressRing_zero() {
        assertRenders("ProgressRing 0", size: Self.ringSize) {
            ProgressRing(progress: 0, label: "0%", sublabel: "to goal")
        }
    }

    func testProgressRing_partial() {
        assertRenders("ProgressRing partial", size: Self.ringSize) {
            ProgressRing(progress: 0.66, tint: Theme.Color.success, label: "66%", sublabel: "to goal")
        }
    }

    func testProgressRing_full() {
        assertRenders("ProgressRing full", size: Self.ringSize) {
            ProgressRing(progress: 1, tint: Theme.Color.success, label: "Done", sublabel: "this week")
        }
    }
}
