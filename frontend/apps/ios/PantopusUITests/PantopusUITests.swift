//
//  PantopusUITests.swift
//  PantopusUITests
//
//  Exercises the login surface. Backend is not stubbed here — these tests
//  only verify the unauthenticated UI: fields exist, are addressable by
//  accessibility identifier, and the submit button is correctly gated.
//
//  Signed out, the app opens on the Place launch funnel, not on the login
//  form: the wedge defers the wall and keeps Sign in one tap away
//  (`RootView`'s `.signedOut` case shows `PlaceLaunchHost`). Every test here
//  goes through `launchToLogin()`, which takes that tap.
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

    /// Launches signed out and opens the login cover from the Place launch
    /// screen, so the caller starts on the login form itself.
    @MainActor
    private func launchToLogin() -> XCUIApplication {
        let app = launchSignedOut()
        let signIn = element("placeLaunchSignIn", in: app)
        XCTAssertTrue(signIn.waitForExistence(timeout: 10), "Place launch did not appear")
        signIn.tap()
        return app
    }

    @MainActor
    func testLaunchLandsOnLogin() {
        let app = launchToLogin()

        // We should see the Pantopus brand headline.
        XCTAssertTrue(app.staticTexts["Pantopus"].waitForExistence(timeout: 5))
        XCTAssertTrue(element("loginEmailField", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(element("loginPasswordField", in: app).exists)
    }

    /// Email and password come first, the federated buttons sit under them,
    /// and the legal line follows those. Asserted by vertical position so a
    /// future reshuffle of the form cannot pass silently.
    @MainActor
    func testEmailFormSitsAboveTheFederatedButtons() {
        let app = launchToLogin()
        let email = element("loginEmailField", in: app)
        XCTAssertTrue(email.waitForExistence(timeout: 5))

        let submit = element("loginSubmitButton", in: app)
        let divider = element("loginOAuthDivider", in: app)
        XCTAssertTrue(submit.exists)
        XCTAssertTrue(divider.exists)

        XCTAssertLessThan(email.frame.minY, submit.frame.minY, "Email must sit above Log in")
        XCTAssertLessThan(submit.frame.minY, divider.frame.minY, "Log in must sit above the separator")
    }

    @MainActor
    func testSignInButtonDisabledWithEmptyFields() {
        let app = launchToLogin()
        let button = element("loginSubmitButton", in: app)
        XCTAssertTrue(button.waitForExistence(timeout: 5))
        XCTAssertFalse(button.isEnabled)
    }

    @MainActor
    func testSignInButtonEnablesOnceFormIsValid() {
        let app = launchToLogin()

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
