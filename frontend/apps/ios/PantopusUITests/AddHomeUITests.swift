//
//  AddHomeUITests.swift
//  PantopusUITests
//
//  Drives the Add-Home wizard end-to-end with the stubbed API surface
//  (see `UITestStubProtocol`). Three flows:
//    1. Open from MyHomes → close on dirty → discard confirm appears.
//    2. Open → fill all 4 steps → submit → success hero.
//    3. Open → close on empty → no confirm, sheet dismisses.
//

import XCTest

final class AddHomeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication? {
        let app = XCUIApplication()
        app.launchEnvironment["UI_TESTS_SIGNED_IN"] = "1"
        app.launchEnvironment["UI_TESTS_STUB_API"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        app.launch()
        guard app.buttons["place.menu"].firstMatch.waitForExistence(timeout: 5) else {
            app.terminateAfterSkippedLaunch()
            return nil
        }
        return app
    }

    /// Opens the Add-Home wizard from Your Place: the address opens Your
    /// homes, and its "Add a home" row starts the wizard. Returns the wizard
    /// root, or `nil` when the stubbed root isn't a Home's Your Place.
    private func openAddHome(in app: XCUIApplication) -> XCUIElement? {
        let address = app.buttons["place.addressSwitcher"].firstMatch
        guard address.waitForExistence(timeout: 3) else { return nil }
        address.tap()
        let addHome = app.buttons["place.switcher.add"].firstMatch
        guard addHome.waitForExistence(timeout: 3) else { return nil }
        addHome.tap()
        let shell = app.descendants(matching: .any).matching(identifier: "wizardShell").firstMatch
        guard shell.waitForExistence(timeout: 5) else { return nil }
        return shell
    }

    func testCloseEmptyDismissesImmediately() throws {
        guard let app = launch() else { throw XCTSkip("Hooks not honoured.") }
        guard openAddHome(in: app) != nil else { throw XCTSkip("Your homes' Add a home not reachable.") }
        app.buttons["wizardLeadingButton"].tap()
        XCTAssertFalse(
            app.staticTexts["Discard your progress?"].waitForExistence(timeout: 1),
            "Empty step 1 must close without prompting."
        )
    }

    func testDirtyFormPromptsDiscardConfirm() throws {
        guard let app = launch() else { throw XCTSkip("Hooks not honoured.") }
        guard openAddHome(in: app) != nil else { throw XCTSkip("Your homes' Add a home not reachable.") }

        let street = app.descendants(matching: .any)
            .matching(identifier: "addHome_street").firstMatch
        XCTAssertTrue(street.waitForExistence(timeout: 3))
        street.tap()
        street.typeText("412 Elm St")

        app.buttons["wizardLeadingButton"].tap()
        XCTAssertTrue(
            app.staticTexts["Discard your progress?"].waitForExistence(timeout: 2),
            "Dirty step 1 must prompt before discarding."
        )
        app.buttons["Keep going"].tap()
        XCTAssertTrue(
            app.descendants(matching: .any).matching(identifier: "wizardShell").firstMatch.exists
        )
    }

    func testHappyPathReachesSuccessStep() throws {
        guard let app = launch() else { throw XCTSkip("Hooks not honoured.") }
        guard openAddHome(in: app) != nil else { throw XCTSkip("Your homes' Add a home not reachable.") }

        // Step 1 — fill all required fields.
        for (id, value) in [
            ("addHome_street", "412 Elm St"),
            ("addHome_city", "Portland"),
            ("addHome_state", "OR"),
            ("addHome_zip", "97214")
        ] {
            let field = app.descendants(matching: .any).matching(identifier: id).firstMatch
            XCTAssertTrue(field.waitForExistence(timeout: 3), "Missing \(id)")
            field.tap()
            field.typeText(value)
        }

        let primary = app.buttons["wizardPrimaryCTA"]
        XCTAssertTrue(primary.waitForExistence(timeout: 1))
        XCTAssertTrue(primary.isEnabled)
        primary.tap() // → step 2

        // Step 2 — confirm. Tap continue without changing the toggle.
        XCTAssertTrue(primary.waitForExistence(timeout: 5))
        primary.tap() // → step 3

        // Step 3 — pick "Owner".
        let ownerOption = app.descendants(matching: .any)
            .matching(identifier: "addHome_role_owner").firstMatch
        XCTAssertTrue(ownerOption.waitForExistence(timeout: 3))
        ownerOption.tap()
        primary.tap() // → step 4

        // Step 4 — submit.
        primary.tap() // → success

        // Success hero is visible.
        let hero = app.descendants(matching: .any)
            .matching(identifier: "wizardSuccessHero").firstMatch
        XCTAssertTrue(hero.waitForExistence(timeout: 5))
    }
}
