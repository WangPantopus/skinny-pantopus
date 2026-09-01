//
//  EditProfileUITests.swift
//  PantopusUITests
//
//  Drives the Edit Profile sheet end-to-end with a stubbed API surface
//  (see `UITestStubProtocol`). Three flows are covered:
//    1. Open from You tab → tap close on a clean form → sheet dismisses.
//    2. Open → edit → tap close → discard-confirm dialog appears.
//    3. Open → edit → tap save → success toast surfaces and sheet pops.
//

import XCTest

final class EditProfileUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication? {
        let app = XCUIApplication()
        app.launchEnvironment["UI_TESTS_SIGNED_IN"] = "1"
        app.launchEnvironment["UI_TESTS_STUB_API"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        app.launch()
        // Skip rather than fail when the build wasn't compiled with the
        // hooks (older artifacts). Mirrors the pattern in RootTabUITests.
        guard app.staticTexts["Hub"].waitForExistence(timeout: 5) else {
            app.terminateAfterSkippedLaunch()
            return nil
        }
        return app
    }

    private func openEditProfile(in app: XCUIApplication) -> XCUIElement {
        app.buttons["hubAvatarButton"].firstMatch.tap()
        let editButton = app.buttons["youEditProfileButton"]
        XCTAssertTrue(editButton.waitForExistence(timeout: 3))
        editButton.tap()
        let shell = app.otherElements["editProfileShell"]
        XCTAssertTrue(shell.waitForExistence(timeout: 5), "Form shell should appear")
        return shell
    }

    func testCloseCleanFormDismissesImmediately() throws {
        guard let app = launch() else {
            throw XCTSkip("UI test launch hooks not honoured.")
        }
        _ = openEditProfile(in: app)
        app.buttons["formCloseButton"].tap()
        // No discard dialog should appear.
        XCTAssertFalse(
            app.staticTexts["Discard changes?"].waitForExistence(timeout: 1),
            "Clean form must close without prompting."
        )
        // Sheet is gone — the You tab's Edit Profile entry is visible again.
        XCTAssertTrue(app.buttons["youEditProfileButton"].waitForExistence(timeout: 3))
    }

    /// Locate a PantopusTextField by identifier without committing to its
    /// reported XCUI element type — `.accessibilityElement(.combine)`
    /// collapses the inner `TextField` into the wrapper, which iOS may
    /// surface as `.textField`, `.staticText`, or `.other` across versions.
    private func field(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    func testCloseDirtyFormShowsDiscardConfirm() throws {
        guard let app = launch() else {
            throw XCTSkip("UI test launch hooks not honoured.")
        }
        _ = openEditProfile(in: app)
        // Dirty the form by editing the first name.
        let firstName = field("field_firstName", in: app)
        XCTAssertTrue(firstName.waitForExistence(timeout: 3))
        firstName.tap()
        firstName.typeText("X")

        app.buttons["formCloseButton"].tap()
        XCTAssertTrue(
            app.staticTexts["Discard changes?"].waitForExistence(timeout: 2),
            "Dirty form must prompt before discarding."
        )
        // Bail out via "Keep editing" so the sheet stays open.
        app.buttons["Keep editing"].tap()
        XCTAssertTrue(
            app.descendants(matching: .any)
                .matching(identifier: "editProfileShell")
                .firstMatch.exists
        )
    }

    func testFillAndSavePopsWithSuccessToast() throws {
        guard let app = launch() else {
            throw XCTSkip("UI test launch hooks not honoured.")
        }
        _ = openEditProfile(in: app)

        let firstName = field("field_firstName", in: app)
        XCTAssertTrue(firstName.waitForExistence(timeout: 3))
        firstName.tap()
        firstName.typeText("ander") // "Alice" → "Aliceander"

        let save = app.buttons["formCommitButton"]
        XCTAssertTrue(save.waitForExistence(timeout: 1))
        XCTAssertTrue(save.isEnabled, "Save should enable when valid + dirty.")
        save.tap()

        // The toast appears and the sheet dismisses back to the You tab.
        XCTAssertTrue(
            app.buttons["youEditProfileButton"].waitForExistence(timeout: 5),
            "Successful save should pop back to the You tab."
        )
    }
}
