//
//  StatusPrimitivesSnapshotTests.swift
//  PantopusTests
//
//  Build-validity smoke for `HaloCircle` (4 tones + pulsing variant) and
//  `BeaconBanner` (3 identities + no-stripe variant) — the ceremonial
//  primitives that A18.1/.2/.3 status frames and A21.1/.2 public-profile
//  banners depend on. Hosts each frame in a UIHostingController and
//  asserts it builds. Reduce-motion trait override exercises the
//  pulsing-glow-disabled path.
//
//  Pixel-baseline tripwires for full screens that consume these
//  primitives live alongside `__Snapshots__/`; this file owns the
//  primitive-level contract.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class StatusPrimitivesSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        traitCollection: UITraitCollection? = nil,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 375, height: 220)
        if let traitCollection {
            host.setOverrideTraitCollection(traitCollection, forChild: host)
        }
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    // MARK: - HaloCircle

    func testHaloCircleRendersEachTone() {
        for tone in HaloCircleTone.allCases {
            assertRenders("HaloCircle \(tone.rawValue)") {
                HaloCircle(tone: tone)
            }
        }
    }

    func testHaloCirclePulsingRenders() {
        assertRenders("HaloCircle pulsing info") {
            HaloCircle(tone: .info, isPulsing: true)
        }
    }

    /// Reduce-motion contract — when the trait is on, the pulsing glow
    /// collapses to a static layer. We assert the view still builds with
    /// the override applied; visual verification lives in #Preview.
    func testHaloCirclePulsingRespectsReduceMotion() {
        assertRenders("HaloCircle pulsing + reduce-motion") {
            HaloCircle(tone: .info, isPulsing: true, reduceMotionOverride: true)
        }
    }

    func testHaloCircleAcceptsIconOverride() {
        assertRenders("HaloCircle success + userCheck override") {
            HaloCircle(tone: .success, icon: .badgeCheck)
        }
    }

    // MARK: - BeaconBanner

    func testBeaconBannerRendersEachIdentity() {
        for identity in BeaconIdentity.allCases {
            assertRenders("BeaconBanner \(identity.rawValue)") {
                BeaconBanner(identity: identity) { EmptyView() }
            }
        }
    }

    func testBeaconBannerHidesStripesWhenRequested() {
        assertRenders("BeaconBanner business no-stripes") {
            BeaconBanner(identity: .business, showStripes: false) { EmptyView() }
        }
    }

    func testBeaconBannerAcceptsTrailingSlot() {
        assertRenders("BeaconBanner personal + verified chip") {
            BeaconBanner(identity: .personal) {
                Icon(.shieldCheck, size: 14, color: Theme.Color.appTextInverse)
            }
        }
    }
}
