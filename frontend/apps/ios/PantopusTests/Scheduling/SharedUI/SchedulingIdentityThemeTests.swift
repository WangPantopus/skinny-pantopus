//
//  SchedulingIdentityThemeTests.swift
//  PantopusTests
//
//  Verifies the SchedulingOwner → identity-pillar mapping (WizardIdentity,
//  title, glyph) that every Calendarly surface accents off.
//

import XCTest
@testable import Pantopus

final class SchedulingIdentityThemeTests: XCTestCase {
    func testPersonalMapsToPersonalPillar() {
        let theme = SchedulingIdentityTheme(.personal)
        XCTAssertEqual(theme.identity, .personal)
        XCTAssertEqual(theme.title, "Personal")
        XCTAssertEqual(theme.icon, .user)
    }

    func testHomeMapsToHomePillar() {
        let theme = SchedulingIdentityTheme(.home(homeId: "h1"))
        XCTAssertEqual(theme.identity, .home)
        XCTAssertEqual(theme.title, "Home")
        XCTAssertEqual(theme.icon, .house)
    }

    func testBusinessMapsToBusinessPillar() {
        let theme = SchedulingIdentityTheme(.business(id: "b1"))
        XCTAssertEqual(theme.identity, .business)
        XCTAssertEqual(theme.title, "Business")
        XCTAssertEqual(theme.icon, .briefcase)
    }

    func testOwnerConvenienceAccessor() {
        XCTAssertEqual(SchedulingOwner.personal.theme.identity, .personal)
        XCTAssertEqual(SchedulingOwner.home(homeId: "h").theme.identity, .home)
        XCTAssertEqual(SchedulingOwner.business(id: "b").theme.identity, .business)
    }

    func testAccentMatchesWizardIdentity() {
        XCTAssertEqual(SchedulingIdentityTheme(.personal).accent, WizardIdentity.personal.accent)
        XCTAssertEqual(SchedulingIdentityTheme(.home(homeId: "h")).accentBg, WizardIdentity.home.accentBg)
    }
}
