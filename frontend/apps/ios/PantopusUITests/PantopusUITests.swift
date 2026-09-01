//
//  PantopusUITests.swift
//  PantopusUITests
//
//  Exercises the login surface. Backend is not stubbed here — these tests
//  only verify the unauthenticated UI: fields exist, are addressable by
//  accessibility identifier, and the submit button is correctly gated.
//

import XCTest

final class PantopusUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    private func launchSignedOut() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["UI_TESTS_SIGNED_OUT"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        app.launch()
        return app
    }

    @MainActor
    private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    @MainActor
    func testLaunchLandsOnLogin() {
        let app = launchSignedOut()
        XCTAssertTrue(app.waitForExistence(timeout: 10))

        // We should see the Pantopus brand headline.
        XCTAssertTrue(app.staticTexts["Pantopus"].waitForExistence(timeout: 5))
        XCTAssertTrue(element("loginEmailField", in: app).waitForExistence(timeout: 2))
        XCTAssertTrue(element("loginPasswordField", in: app).exists)
    }

    @MainActor
    func testSignInButtonDisabledWithEmptyFields() {
        let app = launchSignedOut()
        let button = element("loginSubmitButton", in: app)
        XCTAssertTrue(button.waitForExistence(timeout: 5))
        XCTAssertFalse(button.isEnabled)
    }

    @MainActor
    func testSignInButtonEnablesOnceFormIsValid() {
        let app = launchSignedOut()

        let email = element("loginEmailField", in: app)
        let password = app.secureTextFields["loginPasswordField"]
        let button = element("loginSubmitButton", in: app)

        XCTAssertTrue(email.waitForExistence(timeout: 5))
        email.tap()
        email.typeText("alice@example.com")

        password.tap()
        password.typeText("hunter22")

        XCTAssertTrue(button.isEnabled)
    }
}
