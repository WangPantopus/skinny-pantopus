//
//  UITestAppCleanup.swift
//  PantopusUITests
//
//  Small lifecycle helpers for UI tests that may skip after launch.
//

import XCTest

extension XCUIApplication {
    func terminateAfterSkippedLaunch() {
        guard state != .notRunning else { return }
        terminate()
        _ = wait(for: .notRunning, timeout: 5)
    }
}
