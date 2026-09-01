//
//  StoreScreenshots.swift
//  PantopusUITests
//
//  Drives the App Store screenshot generation (P16). Captures the six
//  hero screens with `UI_TESTS_STUB_API=1` so the simulator doesn't
//  need a live backend.
//
//  Run via `fastlane screenshots` — fastlane orchestrates the matrix
//  over the three device sizes from `fastlane/Snapfile`. Each screen
//  PNG lands at
//  `fastlane/screenshots/<lang>/<device>/<NN_Name>_<lang>.png`.
//

// swiftlint:disable cyclomatic_complexity function_body_length

import XCTest

final class StoreScreenshots: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication? {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launchEnvironment["UI_TESTS_SIGNED_IN"] = "1"
        app.launchEnvironment["UI_TESTS_STUB_API"] = "1"
        app.launchEnvironment["UI_TESTS_DISABLE_NOTIFICATIONS"] = "1"
        app.launch()
        // Match the pattern in A11yLabelAudit / TapTargetAudit / etc. —
        // when the signed-in launch hook isn't honoured (CI runner with
        // limited network for the stub API, simulator boot timing, etc.)
        // skip the screenshot capture instead of failing the suite. The
        // production beta-lane invocation (`fastlane snapshot`) gets a
        // fully-stubbed simulator and lands on Hub reliably.
        guard app.staticTexts["Hub"].waitForExistence(timeout: 5) else {
            app.terminateAfterSkippedLaunch()
            return nil
        }
        return app
    }

    /// Grouped into one test method so the matrix only spins each
    /// simulator up once. snapshot() calls dump PNGs in order.
    func testCaptureStoreScreenshots() throws {
        guard let app = launch() else {
            throw XCTSkip("UI test launch hooks not honoured.")
        }

        // 1. Hub populated
        snapshot("01_Hub_populated")

        // Hub → menu → Settings (T3.1 GroupedList).
        let menuButton = app.descendants(matching: .any)
            .matching(identifier: "hubMenuButton").firstMatch
        if menuButton.waitForExistence(timeout: 3) {
            menuButton.tap()
            if app.descendants(matching: .any)
                .matching(identifier: "groupedList").firstMatch
                .waitForExistence(timeout: 5) {
                snapshot("13_Settings")
                // Settings → Profiles & Privacy row → Identity Center
                // (T3.2). The "visibility" row in the Privacy group
                // routes to the new unified destination.
                let visibilityRow = app.descendants(matching: .any)
                    .matching(identifier: "groupedListRow_visibility").firstMatch
                if visibilityRow.waitForExistence(timeout: 3) {
                    visibilityRow.tap()
                    if app.descendants(matching: .any)
                        .matching(identifier: "identityCenterContent").firstMatch
                        .waitForExistence(timeout: 5) {
                        snapshot("14_IdentityCenter")
                        // Identity Center → Public profile card (T3.3
                        // Public Profile management dashboard).
                        let publicCard = app.descendants(matching: .any)
                            .matching(identifier: "identityCard_publicProfile").firstMatch
                        if publicCard.waitForExistence(timeout: 3) {
                            publicCard.tap()
                            if app.descendants(matching: .any)
                                .matching(identifier: "audienceProfileContent").firstMatch
                                .waitForExistence(timeout: 5) {
                                snapshot("15_PublicProfile")
                            }
                            app.buttons["audienceProfileBackButton"].firstMatch.tap()
                        }
                    }
                    app.buttons["identityCenterBackButton"].firstMatch.tap()
                }
            }
            app.buttons["groupedListBackButton"].firstMatch.tap()
        }

        // 2. MyHomes — open via the You tab → Edit profile is on the
        //    same surface; MyHomes lives off the Hub via the addHome /
        //    pillar paths. Use the You tab → Edit Profile button only
        //    after capturing the Hub-rooted screens.
        // For reliability we drive each screen via its accessibility
        // identifier, falling back to the tab bar where needed.

        // Hub → Pulse pillar → Nearby door presents the Pulse sheet
        // (four-tab IA: Pulse lives behind the density-gated door).
        let pulsePillar = app.descendants(matching: .any)
            .matching(identifier: "hub.pillar.pulse").firstMatch
        if pulsePillar.waitForExistence(timeout: 3) {
            pulsePillar.tap()
            _ = app.descendants(matching: .any)
                .matching(identifier: "pulseFeed").firstMatch
                .waitForExistence(timeout: 5)
            snapshot("02_PulseFeed")
            app.swipeDown(velocity: .fast)
            app.buttons["tab.place"].firstMatch.tap()
        }

        // Hub → Mail pillar → MailboxList
        let mailPillar = app.descendants(matching: .any)
            .matching(identifier: "hub.pillar.mail").firstMatch
        if mailPillar.waitForExistence(timeout: 3) {
            mailPillar.tap()
            _ = app.descendants(matching: .any)
                .matching(identifier: "listOfRowsContainer").firstMatch
                .waitForExistence(timeout: 5)
            snapshot("04_MailboxList")

            // MailboxList → first row → MailboxItemDetail
            let firstRow = app.cells.firstMatch
            if firstRow.waitForExistence(timeout: 3) {
                firstRow.tap()
                _ = app.descendants(matching: .any)
                    .matching(identifier: "mailboxItemDetailShell").firstMatch
                    .waitForExistence(timeout: 5)
                snapshot("05_MailboxItemDetail_package")
            }
        }

        // Back to the Place tab.
        app.buttons["tab.place"].firstMatch.tap()

        // Hub → Marketplace pillar → Nearby door presents the sheet.
        let marketplacePillar = app.descendants(matching: .any)
            .matching(identifier: "hub.pillar.marketplace").firstMatch
        if marketplacePillar.waitForExistence(timeout: 3) {
            marketplacePillar.tap()
            _ = app.descendants(matching: .any)
                .matching(identifier: "marketplace").firstMatch
                .waitForExistence(timeout: 5)
            snapshot("11_Marketplace")
            app.swipeDown(velocity: .fast)
            app.buttons["tab.place"].firstMatch.tap()
        }

        // Nearby tab → the density-gated door.
        app.buttons["tab.nearby"].firstMatch.tap()
        if app.descendants(matching: .any)
            .matching(identifier: "nearbyDoor").firstMatch
            .waitForExistence(timeout: 5) {
            snapshot("10_NearbyDoor")
        }
        app.buttons["tab.place"].firstMatch.tap()

        // Hub → Gigs pillar → Nearby door presents the Tasks sheet.
        let gigsPillar = app.descendants(matching: .any)
            .matching(identifier: "hub.pillar.gigs").firstMatch
        if gigsPillar.waitForExistence(timeout: 3) {
            gigsPillar.tap()
            _ = app.descendants(matching: .any)
                .matching(identifier: "gigsFeed").firstMatch
                .waitForExistence(timeout: 5)
            snapshot("09_GigsFeed")

            // Drill into the first gig row → T2.6 TransactionalDetailShell.
            let firstGigRow = app.descendants(matching: .any)
                .matching(identifier: "gigsRow_g_demo").firstMatch
            if firstGigRow.waitForExistence(timeout: 3) {
                firstGigRow.tap()
                if app.descendants(matching: .any)
                    .matching(identifier: "contentDetailShell").firstMatch
                    .waitForExistence(timeout: 5) {
                    snapshot("12_GigDetail")
                }
                app.buttons["contentDetailBackButton"].firstMatch.tap()
            }
            app.swipeDown(velocity: .fast)
            app.buttons["tab.place"].firstMatch.tap()
        }

        // Mail tab → Messages segment → Chat list.
        app.buttons["tab.mail"].firstMatch.tap()
        let messagesSegment = app.buttons["Messages"].firstMatch
        if messagesSegment.waitForExistence(timeout: 3) {
            messagesSegment.tap()
        }
        if app.descendants(matching: .any)
            .matching(identifier: "chatList").firstMatch
            .waitForExistence(timeout: 5) {
            snapshot("03_ChatList")
        }
        app.buttons["tab.place"].firstMatch.tap()

        // You tab → Me view (Personal identity by default).
        app.buttons["hubAvatarButton"].firstMatch.tap()
        _ = app.descendants(matching: .any)
            .matching(identifier: "meHeader_personal").firstMatch
            .waitForExistence(timeout: 5)
        snapshot("06_Me_Personal")

        // Rebind to Home identity — chrome stays, content swaps.
        let homePill = app.descendants(matching: .any)
            .matching(identifier: "meIdentityPill_home").firstMatch
        if homePill.waitForExistence(timeout: 3) {
            homePill.tap()
            _ = app.descendants(matching: .any)
                .matching(identifier: "meHeader_home").firstMatch
                .waitForExistence(timeout: 5)
            snapshot("07_Me_Home")
            // Restore Personal before continuing.
            app.descendants(matching: .any)
                .matching(identifier: "meIdentityPill_personal")
                .firstMatch
                .tap()
        }

        // You tab → debug menu → Ceremonial Mail Compose (T3.7).
        let ceremonialRow = app.descendants(matching: .any)
            .matching(identifier: "meSectionRow_debug_openCeremonialMail").firstMatch
        if ceremonialRow.waitForExistence(timeout: 3) {
            ceremonialRow.tap()
            if app.descendants(matching: .any)
                .matching(identifier: "ceremonialMail").firstMatch
                .waitForExistence(timeout: 5) {
                snapshot("19_CeremonialMail")
            }
            app.buttons["wizardLeadingButton"].firstMatch.tap()
        }

        // You tab → debug menu → Ceremonial Mail Open (T3.8).
        let ceremonialOpenRow = app.descendants(matching: .any)
            .matching(identifier: "meSectionRow_debug_openCeremonialMailOpen").firstMatch
        if ceremonialOpenRow.waitForExistence(timeout: 3) {
            ceremonialOpenRow.tap()
            let alert = app.alerts.firstMatch
            if alert.waitForExistence(timeout: 3) {
                let field = alert.textFields.firstMatch
                if field.waitForExistence(timeout: 1) {
                    field.tap()
                    field.typeText("mail_demo")
                }
                alert.buttons["Open"].firstMatch.tap()
            }
            if app.descendants(matching: .any)
                .matching(identifier: "ceremonialMailOpen").firstMatch
                .waitForExistence(timeout: 5) {
                snapshot("20_CeremonialMailOpen")
            }
            app.buttons["ceremonialMailOpenBackButton"].firstMatch.tap()
        }

        // You tab → debug menu → Status / Waiting (T3.6) so the
        // marketing matrix has a visual of the claim-submitted frame.
        let statusRow = app.descendants(matching: .any)
            .matching(identifier: "meSectionRow_debug_openStatusWaiting").firstMatch
        if statusRow.waitForExistence(timeout: 3) {
            statusRow.tap()
            if app.descendants(matching: .any)
                .matching(identifier: "statusWaiting").firstMatch
                .waitForExistence(timeout: 5) {
                snapshot("18_StatusWaiting")
            }
            app.buttons["statusPrimaryCta"].firstMatch.tap()
        }

        // You tab → debug menu → Privacy Handshake (T3.4) so the
        // marketing matrix has a visual of the wizard archetype +
        // persona preview card.
        let handshakeRow = app.descendants(matching: .any)
            .matching(identifier: "meSectionRow_debug_openHandshake").firstMatch
        if handshakeRow.waitForExistence(timeout: 3) {
            handshakeRow.tap()
            let alert = app.alerts.firstMatch
            if alert.waitForExistence(timeout: 3) {
                let field = alert.textFields.firstMatch
                if field.waitForExistence(timeout: 1) {
                    field.tap()
                    field.typeText("mayabuilds")
                }
                alert.buttons["Open"].firstMatch.tap()
            }
            if app.descendants(matching: .any)
                .matching(identifier: "privacyHandshakePersona").firstMatch
                .waitForExistence(timeout: 5) {
                snapshot("16_PrivacyHandshake")
            }
            app.buttons["wizardLeadingButton"].firstMatch.tap()
        }

        // You tab → debug menu → Token Accept (T3.5) so the marketing
        // matrix has a visual of the single-decision invite screen.
        let tokenRow = app.descendants(matching: .any)
            .matching(identifier: "meSectionRow_debug_openInviteToken").firstMatch
        if tokenRow.waitForExistence(timeout: 3) {
            tokenRow.tap()
            let alert = app.alerts.firstMatch
            if alert.waitForExistence(timeout: 3) {
                let field = alert.textFields.firstMatch
                if field.waitForExistence(timeout: 1) {
                    field.tap()
                    field.typeText("demo-home-token")
                }
                alert.buttons["Open"].firstMatch.tap()
            }
            if app.descendants(matching: .any)
                .matching(identifier: "tokenAcceptOffer").firstMatch
                .waitForExistence(timeout: 5) {
                snapshot("17_TokenAccept")
            }
            app.buttons["tokenAcceptDecline"].firstMatch.tap()
        }

        // Hub bell → Notifications center (T5.1 Notifications V2).
        app.buttons["tab.place"].firstMatch.tap()
        let hubBell = app.descendants(matching: .any)
            .matching(identifier: "hubBellButton").firstMatch
        if hubBell.waitForExistence(timeout: 3) {
            hubBell.tap()
            if app.descendants(matching: .any)
                .matching(identifier: "notifications").firstMatch
                .waitForExistence(timeout: 5) {
                snapshot("21_Notifications")
            }
            // T5.1 replaced the custom top-bar with the shared shell's
            // built-in NavigationStack chrome. Use the system back button.
            app.navigationBars.buttons.firstMatch.tap()
        }

        // You tab → Edit Profile sheet.
        app.buttons["hubAvatarButton"].firstMatch.tap()
        let editProfile = app.buttons["youEditProfileButton"]
        if editProfile.waitForExistence(timeout: 3) {
            editProfile.tap()
            _ = app.descendants(matching: .any)
                .matching(identifier: "editProfileShell").firstMatch
                .waitForExistence(timeout: 5)
            snapshot("08_EditProfile")
            app.buttons["formCloseButton"].tap()
        }

        // MyHomes + HomeDashboard are reached by the AddHome flow's
        // success path; for the screenshot pass they're driven via the
        // debug entry-point. Capturing them here is best-effort and
        // depends on the live wiring landing in a follow-up.
        // TODO(release): reach MyHomesList + HomeDashboard once the
        // production navigation surfaces a stable entry from a
        // signed-in launch.
    }
}
