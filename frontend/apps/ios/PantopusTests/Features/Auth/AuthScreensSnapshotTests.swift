//
//  AuthScreensSnapshotTests.swift
//  PantopusTests
//
//  T6.1b — design-reference baseline tripwire for the three auth screens.
//  Mirrors the T5 pattern in `T5ScreensSnapshotTests.swift`: asserts the
//  baseline PNG file exists at
//  `PantopusTests/__Snapshots__/auth/<screen>-ios.png` and is a non-trivial
//  PNG. Catches accidental deletion of the visual contract until full
//  SwiftUI `assertSnapshot` lands in a T6 follow-up.
//
//  HOW BASELINES ARE RECORDED — there is no `record = true` mode here, and
//  nothing in this file renders a view: the assertions below are a file
//  tripwire (exists / >8KB / PNG magic), never a pixel diff. A baseline is
//  therefore recorded BY HAND and checked in:
//
//      xcrun simctl ui <udid> appearance light
//      xcrun simctl launch <udid> app.pantopus.ios
//      # …navigate to the screen…
//      xcrun simctl io <udid> screenshot \
//        PantopusTests/__Snapshots__/auth/<screen>-ios.png
//
//  Launch the signed-out stack with `SIMCTL_CHILD_UI_TESTS_SIGNED_OUT=1` so
//  the app boots to the Place launch screen; "Sign in" opens the auth stack.
//
//  `login-ios.png`, `setpassword-ios.png`, `signup-ios.png` and
//  `error-ios.png` are simulator captures of the shipped screens (iPhone 17,
//  light, 1206×2622). The two still on the original designer frames —
//  forgot / verify — carry a device bezel and a 9:41 status bar, and need
//  re-recording once those screens are next touched.
//
//  `error-ios.png` is the one baseline with no tap path to it: nothing in
//  the app pushes `AuthRoute.error`, so it was recorded by temporarily
//  seeding `LoginView`'s `path` with `[.error(.networkError)]` and passing a
//  non-nil `onRetry` — i.e. the composition `AuthErrorView`'s own
//  `#Preview("Network error")` documents, with both CTAs visible. Reverted
//  after the capture. Re-record it the same way, or capture it for real once
//  a caller starts pushing the route.
//

import XCTest

final class AuthScreensSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Auth
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("auth")
    }

    func test_login_ios_baseline_is_present() throws {
        try assertBaseline("login")
    }

    func test_signup_ios_baseline_is_present() throws {
        try assertBaseline("signup")
    }

    func test_error_ios_baseline_is_present() throws {
        try assertBaseline("error")
    }

    // T6.1c P5 — Forgot / Reset / Verify baselines.

    func test_forgot_ios_baseline_is_present() throws {
        try assertBaseline("forgot")
    }

    func test_setpassword_ios_baseline_is_present() throws {
        try assertBaseline("setpassword")
    }

    func test_verify_ios_baseline_is_present() throws {
        try assertBaseline("verify")
    }

    private func assertBaseline(_ screen: String) throws {
        let url = baselineURL.appendingPathComponent("\(screen)-ios.png")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Missing baseline: \(url.path)"
        )
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes): \(url.path)")
        XCTAssertTrue(
            data.count > 4 &&
                data[0] == 0x89 &&
                data[1] == 0x50 &&
                data[2] == 0x4E &&
                data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }
}
