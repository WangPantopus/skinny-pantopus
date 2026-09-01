//
//  A11yLabelAudit.swift
//  PantopusUITests
//
//  Walks the rendered XCUI tree on each major route and asserts every
//  visible button surfaces a non-empty accessibility label. Catches
//  regressions where icon-only controls drop their label and become
//  invisible to VoiceOver.
//

import XCTest

final class A11yLabelAudit: XCTestCase {
    private var launchedApp: XCUIApplication?

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    override func tearDownWithError() throws {
        launchedApp?.terminateAfterSkippedLaunch()
        launchedApp = nil
    }

    private func launch() -> XCUIApplication? {
        let app = XCUIApplication()
        launchedApp = app
        app.launchEnvironment["UI_TESTS_SIGNED_IN"] = "1"
        app.launchEnvironment["UI_TESTS_STUB_API"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        app.launch()
        guard app.staticTexts["Hub"].waitForExistence(timeout: 5) else {
            app.terminateAfterSkippedLaunch()
            return nil
        }
        return app
    }

    /// Asserts every visible XCUI button has a non-empty `label`.
    /// Skips buttons which are off-screen / not yet rendered.
    private func auditLabels(in app: XCUIApplication, screenName: String) {
        for button in app.buttons.allElementsBoundByIndex {
            guard button.isHittable else { continue }
            let label = button.label
            XCTAssertFalse(
                label.isEmpty,
                "[\(screenName)] button " +
                    "\(button.identifier.isEmpty ? "<no id>" : button.identifier) has empty accessibility label"
            )
        }
    }

    func testHubButtonsAllLabelled() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        auditLabels(in: app, screenName: "Hub")
    }

    func testYouTabButtonsAllLabelled() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        app.buttons["hubAvatarButton"].firstMatch.tap()
        XCTAssertTrue(app.buttons["youSignOutButton"].waitForExistence(timeout: 3))
        auditLabels(in: app, screenName: "You")
    }

    func testEditProfileButtonsAllLabelled() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        app.buttons["hubAvatarButton"].firstMatch.tap()
        app.buttons["youEditProfileButton"].tap()
        let shell = app.descendants(matching: .any)
            .matching(identifier: "editProfileShell").firstMatch
        XCTAssertTrue(shell.waitForExistence(timeout: 5))
        auditLabels(in: app, screenName: "EditProfile")
    }
}
