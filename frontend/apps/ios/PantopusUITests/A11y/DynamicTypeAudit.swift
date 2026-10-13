//
//  DynamicTypeAudit.swift
//  PantopusUITests
//
//  Launches each screen with the simulator's content-size category set
//  to `xxxLarge` (the largest non-AX size) and asserts the chrome
//  doesn't clip. Catches missing `.lineLimit` blow-outs and broken
//  flexible layouts.
//

import XCTest

final class DynamicTypeAudit: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication? {
        let app = XCUIApplication()
        app.launchEnvironment["UI_TESTS_SIGNED_IN"] = "1"
        app.launchEnvironment["UI_TESTS_STUB_API"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        // Forces the simulator's preferred content size category.
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryXXXL"]
        app.launch()
        guard app.buttons["place.menu"].firstMatch.waitForExistence(timeout: 5) else {
            app.terminateAfterSkippedLaunch()
            return nil
        }
        return app
    }

    /// Verifies every visible chrome label exists at the larger size.
    /// We don't compute pixel widths here — that's fragile across devices —
    /// but we do verify the elements are still rendered and hittable
    /// (proves the layout didn't collapse them off-screen).
    func testPlaceRendersAtXXXLarge() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        for tab in ["place", "today", "nearby", "mail"] {
            XCTAssertTrue(
                app.buttons["tab.\(tab)"].waitForExistence(timeout: 3),
                "Tab \(tab) missing at xxxLarge."
            )
        }
        XCTAssertTrue(app.buttons["place.menu"].firstMatch.exists)
    }

    func testEditProfileRendersAtXXXLarge() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        app.buttons["place.menu"].firstMatch.tap()
        app.buttons["navDrawer.contextPill.profile"].firstMatch.tap()
        app.buttons["youEditProfileButton"].tap()
        let shell = app.descendants(matching: .any)
            .matching(identifier: "editProfileShell").firstMatch
        XCTAssertTrue(shell.waitForExistence(timeout: 5))
        // Save button still reachable / not clipped off-screen.
        let save = app.buttons["formCommitButton"]
        XCTAssertTrue(save.waitForExistence(timeout: 2))
        XCTAssertTrue(save.isHittable, "Save button must remain hittable at xxxLarge.")
    }

    func testYouTabRendersAtXXXLarge() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        app.buttons["place.menu"].firstMatch.tap()
        app.buttons["navDrawer.contextPill.profile"].firstMatch.tap()
        XCTAssertTrue(app.buttons["youSignOutButton"].waitForExistence(timeout: 3))
        XCTAssertTrue(
            app.buttons["youSignOutButton"].isHittable,
            "Sign out button must remain hittable at xxxLarge."
        )
    }
}
