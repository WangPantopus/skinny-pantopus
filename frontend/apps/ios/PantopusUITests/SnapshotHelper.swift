//
//  SnapshotHelper.swift
//  PantopusUITests
//
//  Minimal stub for fastlane snapshot's `setupSnapshot()` / `snapshot()`
//  helpers so `StoreScreenshots.swift` compiles when running the regular
//  test suite (which does not invoke the fastlane snapshot tool).
//
//  When you actually want to capture screenshots, run
//  `fastlane snapshot init` from `frontend/apps/ios/`. That copies the
//  real ~250-line `SnapshotHelper.swift` from the fastlane gem and
//  overwrites this file. The real helper writes per-language /
//  per-device PNGs to fastlane's screenshots directory; this stub only
//  has to satisfy the call sites at compile + run time.
//

import Foundation
import XCTest

func setupSnapshot(_ app: XCUIApplication, waitForAnimations: Bool = true) {
    Snapshot.setupSnapshot(app, waitForAnimations: waitForAnimations)
}

func snapshot(_ name: String, timeWaitingForIdle timeout: TimeInterval = 20) {
    Snapshot.snapshot(name, timeWaitingForIdle: timeout)
}

/// Stand-in for fastlane's Snapshot class. All entry points are no-ops
/// outside of a fastlane snapshot run — they keep references to the
/// app for parity with the real API but do not write any image.
enum Snapshot {
    nonisolated(unsafe) static var app: XCUIApplication?

    static func setupSnapshot(_ app: XCUIApplication, waitForAnimations: Bool = true) {
        _ = waitForAnimations
        Snapshot.app = app
    }

    static func snapshot(_ name: String, timeWaitingForIdle timeout: TimeInterval = 20) {
        _ = timeout
        // The real fastlane helper writes a PNG here. The stub just logs
        // so a developer running the suite locally can see the
        // intended capture points.
        NSLog("[snapshot stub] would capture \(name)")
    }
}
