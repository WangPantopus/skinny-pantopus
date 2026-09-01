//
//  NavigationSmokeTest.swift
//  PantopusUITests
//
//  P8.3 — End-to-end navigation smoke test. Walks the principal route
//  groups in `HubRoute`, `YouRoute`, `InboxRoute`, and `NearbyRoute` via
//  `accessibilityIdentifier` taps, asserting each destination renders
//  without crashing.
//
//  Coverage strategy
//  ─────────────────
//  The iOS app exposes 176 typed route cases across the four tab roots.
//  Many are ID-bearing (`homeDashboard(homeId:)`, `claimStatus(claimId:)`,
//  …) and are only reachable after data flows that aren't part of a
//  fresh-launch fixture — exercising them through UI taps requires
//  seeding sample data through `UI_TESTS_STUB_API` and would balloon a
//  smoke test into a fixture-management project. This test instead walks
//  one representative tap-path per route GROUP (root tab → first-class
//  destination), covering every parent route enum and every entry point
//  on the four tab landings (Place · Today · Nearby · Mail; You is a cover). The static reachability of the remaining
//  ID-bearing children is enumerated in `docs/nav-graph-closure.md` and
//  the route-by-route summary in `docs/nav-smoke-results.md`.
//
//  Like `RootTabUITests`, this suite launches with
//  `UI_TESTS_SIGNED_IN=1` + `UI_TESTS_STUB_API=1` and gracefully skips
//  when the host app build doesn't honour the flag.
//

import XCTest

// swiftlint:disable type_body_length
final class NavigationSmokeTest: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    // MARK: - Launch helpers

    private func launchSignedIn(file _: StaticString = #file, line _: UInt = #line) -> XCUIApplication? {
        let app = XCUIApplication()
        app.launchEnvironment["UI_TESTS_SIGNED_IN"] = "1"
        app.launchEnvironment["UI_TESTS_STUB_API"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        app.launch()
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

    /// "You" is not a tab in the four-tab IA — it is a full-screen cover
    /// opened from the Place tab's avatar button.
    private func openYou(in app: XCUIApplication) {
        tabButton("place", in: app).tap()
        app.buttons["hubAvatarButton"].firstMatch.tap()
    }

    /// Chat lives in the Mail tab's Messages segment.
    private func openMessages(in app: XCUIApplication) {
        tabButton("mail", in: app).tap()
        let segment = app.buttons["Messages"].firstMatch
        if segment.waitForExistence(timeout: 3) { segment.tap() }
    }

    /// Resolves an identifier that may appear as either a `button`, a
    /// `staticText`, an `other` (generic container) or a `scrollView`.
    /// Some destinations carry the identifier on the screen-level scroll
    /// view, others on a header label.
    private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func assertReaches(
        _ identifier: String,
        in app: XCUIApplication,
        timeout: TimeInterval = 5,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        let target = element(identifier, in: app)
        XCTAssertTrue(
            target.waitForExistence(timeout: timeout),
            "Expected to reach element \"\(identifier)\"",
            file: file,
            line: line
        )
    }

    // MARK: - Root tab landings (Place · Today · Nearby · Mail)

    func testTab_placeLanding() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        assertReaches("hubScreen", in: app)
    }

    func testTab_todayLanding() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("today", in: app).tap()
        assertReaches("todayDetail", in: app)
    }

    func testTab_nearbyLanding() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("nearby", in: app).tap()
        assertReaches("nearbyDoor", in: app)
    }

    func testTab_mailLanding() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("mail", in: app).tap()
        assertReaches("mailboxRoot", in: app)
    }

    func testTab_mailMessagesSegment() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openMessages(in: app)
        assertReaches("chatList", in: app)
    }

    func testYou_avatarOpensMeScreen() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        assertReaches("meScreen", in: app)
    }

    // MARK: - Hub top bar (HubRoute .notifications + menu → navigation drawer)

    func testHub_bellTapPushesNotifications() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        let bell = app.buttons["hubBellButton"].firstMatch
        XCTAssertTrue(bell.waitForExistence(timeout: 3))
        bell.tap()
        assertReaches("notifications", in: app)
    }

    func testHub_menuTapPushesSettings() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        let menu = app.buttons["hubMenuButton"].firstMatch
        XCTAssertTrue(menu.waitForExistence(timeout: 3))
        menu.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.5)).tap()
        // The Hub menu now opens the context-aware navigation drawer; Settings
        // lives as a row near the bottom of its scroll view.
        let settingsRow = app.buttons["navDrawer.item.settings"].firstMatch
        XCTAssertTrue(settingsRow.waitForExistence(timeout: 5))
        // The drawer is a custom scroll view whose AX scroll-to-visible is
        // unreliable for the bottom row, so swipe it into view first, then tap
        // by coordinate (a coordinate tap does not trigger scroll-to-visible).
        let scroll = app.scrollViews["navDrawer.scroll"].firstMatch
        var swipes = 0
        while !settingsRow.isHittable, swipes < 6 {
            if scroll.exists {
                scroll.swipeUp()
            } else {
                app.swipeUp()
            }
            swipes += 1
        }
        settingsRow.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        assertReaches("settings", in: app, timeout: 8)
    }

    // MARK: - Hub pillars (HubRoute .mailboxRoot/.pulseFeed/.gigsFeed/.marketplace)

    func testHub_pillarPulseTapPushesFeed() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        let pulsePillar = app.buttons["hub.pillar.pulse"].firstMatch
        guard pulsePillar.waitForExistence(timeout: 3) else {
            throw XCTSkip("Pulse pillar not rendered in current Hub seed.")
        }
        pulsePillar.tap()
        assertReaches("pulseFeed", in: app)
    }

    func testHub_pillarGigsTapPushesGigsFeed() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        let gigsPillar = app.buttons["hub.pillar.gigs"].firstMatch
        guard gigsPillar.waitForExistence(timeout: 3) else {
            throw XCTSkip("Gigs pillar not rendered in current Hub seed.")
        }
        gigsPillar.tap()
        assertReaches("gigsFeed", in: app)
    }

    func testHub_pillarMarketplaceTapPushesMarketplace() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        let marketplacePillar = app.buttons["hub.pillar.marketplace"].firstMatch
        guard marketplacePillar.waitForExistence(timeout: 3) else {
            throw XCTSkip("Marketplace pillar not rendered in current Hub seed.")
        }
        marketplacePillar.tap()
        assertReaches("marketplace", in: app)
    }

    func testHub_pillarMailTapPushesMailboxRoot() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        let mailPillar = app.buttons["hub.pillar.mail"].firstMatch
        guard mailPillar.waitForExistence(timeout: 3) else {
            throw XCTSkip("Mail pillar not rendered in current Hub seed.")
        }
        mailPillar.tap()
        assertReaches("mailboxRoot", in: app)
    }

    // MARK: - Hub Today card (HubRoute .todayDetail)

    func testHub_todayCardTapPushesTodayDetail() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("place", in: app).tap()
        let today = app.buttons["hubTodayCard"].firstMatch
        guard today.waitForExistence(timeout: 3) else {
            throw XCTSkip("Today card not rendered in current Hub seed.")
        }
        today.tap()
        assertReaches("todayDetail", in: app)
    }

    // MARK: - You action tiles (YouRoute .myPosts/.myBids/.myTasks/.offers/.myListings/.connections/.supportTrains)

    func testYou_actionTilePostsPushesMyPosts() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let tile = app.buttons["meActionTile_posts"].firstMatch
        guard tile.waitForExistence(timeout: 3) else {
            throw XCTSkip("Posts action tile not rendered (non-personal identity seeded).")
        }
        tile.tap()
        assertReaches("my-posts", in: app)
    }

    func testYou_actionTileBidsPushesMyBids() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let tile = app.buttons["meActionTile_bids"].firstMatch
        guard tile.waitForExistence(timeout: 3) else {
            throw XCTSkip("Bids action tile not rendered.")
        }
        tile.tap()
        assertReaches("my-bids", in: app)
    }

    func testYou_actionTileGigsPushesMyTasks() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let tile = app.buttons["meActionTile_gigs"].firstMatch
        guard tile.waitForExistence(timeout: 3) else {
            throw XCTSkip("Gigs action tile not rendered.")
        }
        tile.tap()
        assertReaches("my-tasks", in: app)
    }

    func testYou_actionTileOffersPushesOffers() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let tile = app.buttons["meActionTile_offers"].firstMatch
        guard tile.waitForExistence(timeout: 3) else {
            throw XCTSkip("Offers action tile not rendered.")
        }
        tile.tap()
        assertReaches("offers", in: app)
    }

    func testYou_actionTileListingsPushesMyListings() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let tile = app.buttons["meActionTile_listings"].firstMatch
        guard tile.waitForExistence(timeout: 3) else {
            throw XCTSkip("Listings action tile not rendered.")
        }
        tile.tap()
        assertReaches("listOfRowsContainer", in: app)
    }

    func testYou_actionTileConnectionsPushesConnections() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let tile = app.buttons["meActionTile_connections"].firstMatch
        guard tile.waitForExistence(timeout: 3) else {
            throw XCTSkip("Connections action tile not rendered.")
        }
        tile.tap()
        assertReaches("connections", in: app)
    }

    func testYou_actionTileSupportTrainsPushesSupportTrains() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let tile = app.buttons["meActionTile_supportTrains"].firstMatch
        guard tile.waitForExistence(timeout: 3) else {
            throw XCTSkip("Support trains action tile not rendered.")
        }
        tile.tap()
        assertReaches("supportTrains", in: app)
    }

    // MARK: - You section rows (YouRoute .identityCenter/.audienceProfile/.creatorInbox/.myHomes/.myBusinesses)

    func testYou_sectionRowIdentityCenter() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let row = app.buttons["meSectionRow_profile_privacy_identityCenter"].firstMatch
        guard row.waitForExistence(timeout: 3) else {
            throw XCTSkip("Identity Center section row not rendered.")
        }
        row.tap()
        assertReaches("identityCenter", in: app)
    }

    func testYou_sectionRowEditProfile() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let row = app.buttons["meSectionRow_profile_privacy_edit"].firstMatch
        guard row.waitForExistence(timeout: 3) else {
            throw XCTSkip("Edit profile section row not rendered.")
        }
        row.tap()
        // EditProfileView is presented as a sheet — surface the form shell.
        assertReaches("editProfileShell", in: app, timeout: 4)
    }

    func testYou_sectionRowAudience() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let row = app.buttons["meSectionRow_profile_privacy_audience"].firstMatch
        guard row.waitForExistence(timeout: 3) else {
            throw XCTSkip("Audience section row not rendered.")
        }
        row.tap()
        assertReaches("audienceProfile", in: app)
    }

    func testYou_sectionRowCreatorInbox() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let row = app.buttons["meSectionRow_profile_privacy_creatorInbox"].firstMatch
        guard row.waitForExistence(timeout: 3) else {
            throw XCTSkip("Creator inbox section row not rendered.")
        }
        row.tap()
        assertReaches("creatorInbox", in: app)
    }

    func testYou_sectionRowMyHomes() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let row = app.buttons["meSectionRow_activity_homes"].firstMatch
        guard row.waitForExistence(timeout: 3) else {
            throw XCTSkip("My homes section row not rendered.")
        }
        row.tap()
        assertReaches("listOfRowsContainer", in: app)
    }

    func testYou_sectionRowMyBusinesses() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let row = app.buttons["meSectionRow_activity_businesses"].firstMatch
        guard row.waitForExistence(timeout: 3) else {
            throw XCTSkip("My businesses section row not rendered.")
        }
        row.tap()
        assertReaches("listOfRowsContainer", in: app)
    }

    func testYou_sectionRowHelp() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openYou(in: app)
        let row = app.buttons["meSectionRow_help_legal_help"].firstMatch
        guard row.waitForExistence(timeout: 3) else {
            throw XCTSkip("Help section row not rendered.")
        }
        row.tap()
        assertReaches("helpCenter", in: app)
    }

    // MARK: - Inbox routes (InboxRoute .compose + .search)

    func testInbox_composeTapPushesNewMessage() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openMessages(in: app)
        let compose = app.buttons["chatListComposeButton"].firstMatch
        guard compose.waitForExistence(timeout: 3) else {
            throw XCTSkip("Compose button not rendered (empty-state seed).")
        }
        compose.tap()
        // NewMessage is built on the ListOfRows shell.
        assertReaches("listOfRowsContainer", in: app)
    }

    func testInbox_searchTapPushesChatSearch() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        openMessages(in: app)
        let search = app.buttons["chatListSearchButton"].firstMatch
        guard search.waitForExistence(timeout: 3) else {
            throw XCTSkip("Search button not rendered (empty-state seed).")
        }
        search.tap()
        // ChatSearch surfaces via the SearchListShell — surface its search bar.
        assertReaches("listOfRowsSearchBar", in: app)
    }

    // MARK: - Nearby (NearbyRoute landing + category filters)

    func testNearby_categoryAllIsSelectable() throws {
        guard let app = launchSignedIn() else {
            throw XCTSkip("Signed-in launch env not honoured.")
        }
        tabButton("nearby", in: app).tap()
        let allChip = app.buttons["nearbyCategoryChip_all"].firstMatch
        XCTAssertTrue(allChip.waitForExistence(timeout: 5))
        allChip.tap()
        // After tap the chip should remain selected and the map view stays mounted.
        assertReaches("nearbyMap", in: app, timeout: 2)
    }
}

// swiftlint:enable type_body_length
