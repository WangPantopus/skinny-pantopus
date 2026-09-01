//
//  NavigationDrawerViewModelTests.swift
//  PantopusTests
//
//  §1C-b — Navigation drawer (LAUNCHER / Option A). Asserts the projection:
//  the kebab-cased slug contract (shared verbatim with Android), the section
//  structure per context, and the `BackToHub` visibility rule.
//

import XCTest
@testable import Pantopus

@MainActor
final class NavigationDrawerViewModelTests: XCTestCase {
    // MARK: Slug contract (drives `navDrawer.item.<slug>`)

    func testSlugKebabCasesLabels() {
        XCTAssertEqual(NavigationDrawerViewModel.slug("My Bids"), "my-bids")
        XCTAssertEqual(NavigationDrawerViewModel.slug("Profile & Privacy"), "profile-and-privacy")
        XCTAssertEqual(NavigationDrawerViewModel.slug("Offers & Bids"), "offers-and-bids")
        XCTAssertEqual(NavigationDrawerViewModel.slug("Wallet & Payments"), "wallet-and-payments")
        XCTAssertEqual(NavigationDrawerViewModel.slug("Help & Support"), "help-and-support")
        XCTAssertEqual(NavigationDrawerViewModel.slug("Locations & Hours"), "locations-and-hours")
        XCTAssertEqual(NavigationDrawerViewModel.slug("Property Details"), "property-details")
    }

    // MARK: Personal context

    func testPersonalSectionsMatchDesign() {
        let vm = NavigationDrawerViewModel(context: .personal(name: "Maria Lopez"))
        XCTAssertEqual(vm.pillar, .personal)
        XCTAssertFalse(vm.showsBackToHub)
        XCTAssertEqual(vm.headerTitle, "Personal")
        XCTAssertEqual(vm.headerSubtitle, "Maria Lopez · Your profile")
        XCTAssertEqual(vm.sections.map(\.overline), ["Manage", "Discover", "Your Stuff", "Settings"])

        let slugs = vm.sections.flatMap { $0.items.map(\.slug) }
        XCTAssertEqual(slugs, [
            "my-homes", "my-businesses", "connections", "mailbox", "profile-and-privacy",
            "beacon-updates", "search", "discover-neighbors",
            "my-beacon", "my-listings", "my-pulse", "my-tasks", "my-bids",
            "offers-and-bids", "post-task", "wallet-and-payments",
            "settings", "help-and-support"
        ])
    }

    // MARK: Home context

    func testHomeSectionsAndBackToHub() {
        let vm = NavigationDrawerViewModel(
            context: .home(id: "h1", title: "Maple Street", subtitle: "123 Maple St")
        )
        XCTAssertEqual(vm.pillar, .home)
        XCTAssertTrue(vm.showsBackToHub)
        XCTAssertEqual(vm.headerTitle, "Maple Street")
        XCTAssertEqual(vm.headerSubtitle, "123 Maple St")
        // The leading group has no overline (header-less), then More + Settings.
        XCTAssertEqual(vm.sections.map(\.overline), [nil, "More", "Settings"])
        XCTAssertEqual(vm.sections.first?.items.first { $0.isActive }?.slug, "overview")
    }

    // MARK: Business context

    func testBusinessSections() {
        let vm = NavigationDrawerViewModel(
            context: .business(id: "b1", title: "Cortado Coffee", subtitle: "Coffee shop · Downtown")
        )
        XCTAssertEqual(vm.pillar, .business)
        XCTAssertTrue(vm.showsBackToHub)
        XCTAssertEqual(vm.sections.map(\.overline), [nil, "Manage", "Settings"])
        let slugs = vm.sections.flatMap { $0.items.map(\.slug) }
        XCTAssertEqual(slugs, [
            "overview", "profile", "locations-and-hours", "catalog", "pages",
            "post-task", "business-chat",
            "team", "reviews", "payments",
            "settings"
        ])
    }
}
