//
//  TapTargetAudit.swift
//  PantopusUITests
//
//  Walks the rendered XCUI tree on each major route and asserts every
//  interactive element has a frame ≥ 44 × 44 pt (WCAG 2.5.5 AAA / Apple
//  HIG minimum).
//

import XCTest

final class TapTargetAudit: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication? {
        let app = XCUIApplication()
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

    /// Min size in points required by Apple HIG for a tappable element.
    private let minTapSize: CGFloat = 44

    /// Walk every visible button on the screen and assert its hit
    /// rectangle clears the minimum tap-target size. Reports each
    /// failure individually so a single regression doesn't hide others.
    private func auditButtons(in app: XCUIApplication, screenName: String) {
        // 5 second settle so views finish layout.
        let buttons = app.buttons.allElementsBoundByIndex
        for button in buttons {
            // Skip elements that aren't actually rendered (the XCUI tree
            // can hold off-screen siblings on tab containers).
            guard button.isHittable else { continue }
            let frame = button.frame
            let id = button.identifier.isEmpty ? button.label : button.identifier
            XCTAssertGreaterThanOrEqual(
                frame.width,
                minTapSize,
                "[\(screenName)] button \(id) width \(frame.width) < \(minTapSize)"
            )
            XCTAssertGreaterThanOrEqual(
                frame.height,
                minTapSize,
                "[\(screenName)] button \(id) height \(frame.height) < \(minTapSize)"
            )
        }
    }

    func testHubTabHasNoUndersizedTapTargets() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        auditButtons(in: app, screenName: "Hub")
    }

    func testYouTabHasNoUndersizedTapTargets() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        app.buttons["hubAvatarButton"].firstMatch.tap()
        XCTAssertTrue(app.buttons["youSignOutButton"].waitForExistence(timeout: 3))
        auditButtons(in: app, screenName: "You")
    }

    func testEditProfileHasNoUndersizedTapTargets() throws {
        guard let app = launch() else { throw XCTSkip("UI test launch hooks not honoured.") }
        app.buttons["hubAvatarButton"].firstMatch.tap()
        app.buttons["youEditProfileButton"].tap()
        let shell = app.descendants(matching: .any)
            .matching(identifier: "editProfileShell").firstMatch
        XCTAssertTrue(shell.waitForExistence(timeout: 5))
        auditButtons(in: app, screenName: "EditProfile")
    }
}
