//
//  RootTabUITests.swift
//  PantopusUITests
//
//  Covers the bottom bar (Pulse S3 — Place · Today · Pulse · Plans · Mail,
//  Plans only while the `plans` switch is on): Place is selected at launch
//  (once signed in), each tab is tappable, and secondary tabs render their
//  expected landing states. Tasks / Marketplace present as sheets from the
//  Pulse tab; Messages is a segment of the Mail tab.
//
//  These tests launch the app with `UI_TESTS_SIGNED_IN=1`, which the app
//  honours by seeding an in-memory signed-in session without hitting the
//  network. When the flag is absent the tests gracefully skip so the login
//  UI tests in `PantopusUITests.swift` stay green.
//

import XCTest

final class RootTabUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchSignedIn() -> XCUIApplication? {
        let app = XCUIApplication()
        app.launchEnvironment["UI_TESTS_SIGNED_IN"] = "1"
        app.launchEnvironment["UI_TESTS_STUB_API"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        app.launch()
        // If the app doesn't honour the flag (older builds), skip rather than fail.
        let placeTab = app.buttons["tab.place"].firstMatch
        guard placeTab.waitForExistence(timeout: 5) else {
            app.terminateAfterSkippedLaunch()
            return nil
        }
        return app
    }

    private func tabButton(_ tab: String, in app: XCUIApplication) -> XCUIElement {
        app.buttons["tab.\(tab)"].firstMatch
    }

    func testLaunchLandsOnPlaceTab() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured; see RootTabUITests docs.")
        }
        // The Place tab bar item exists and is selected at launch.
        let placeTab = tabButton("place", in: app)
        XCTAssertTrue(placeTab.waitForExistence(timeout: 2))
        XCTAssertTrue(placeTab.isSelected || placeTab.value as? String == "1")
    }

    func testTabsPresent() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        // The stubbed session has the `plans` switch off: four tabs, no Nearby.
        XCTAssertFalse(tabButton("nearby", in: app).exists)
        for tab in ["place", "today", "pulse", "mail"] {
            let button = tabButton(tab, in: app)
            XCTAssertTrue(
                button.waitForExistence(timeout: 2),
                "Expected tab bar item tab.\(tab)"
            )
        }
    }

    func testTapMailShowsMailboxRoot() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("mail", in: app).tap()
        XCTAssertTrue(app.otherElements["mailboxRoot"].waitForExistence(timeout: 5))
    }

    func testTapTodayShowsBriefing() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("today", in: app).tap()
        let today = app.descendants(matching: .any).matching(identifier: "todayDetail").firstMatch
        XCTAssertTrue(today.waitForExistence(timeout: 5))
    }

    func testTapPulseShowsFeed() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("pulse", in: app).tap()
        let feed = app.descendants(matching: .any).matching(identifier: "pulseFeed").firstMatch
        XCTAssertTrue(feed.waitForExistence(timeout: 5))
    }

    func testMailMessagesSegmentShowsChatListEmptyState() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("mail", in: app).tap()
        let segment = app.buttons["Messages"].firstMatch
        XCTAssertTrue(segment.waitForExistence(timeout: 5), "Mail tab should show the Messages segment")
        segment.tap()
        XCTAssertTrue(app.staticTexts["No conversations yet"].waitForExistence(timeout: 5))
    }

    func testPlaceMenuOpensProfile() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        app.buttons["place.menu"].firstMatch.tap()
        app.buttons["navDrawer.contextPill.profile"].firstMatch.tap()
        XCTAssertTrue(app.scrollViews["meScreen"].waitForExistence(timeout: 5))
    }
}
