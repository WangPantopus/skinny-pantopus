//
//  HubRouteTests.swift
//  PantopusTests
//
//  Locks the `HubRoute.editProfile` case introduced in P1.4 so the
//  Settings → Edit profile push lands on the real `EditProfileView`
//  rather than the previous `NotYetAvailableView` placeholder.
//

import XCTest
@testable import Pantopus

@MainActor
final class HubRouteTests: XCTestCase {
    /// `Hashable` conformance is what keeps the route in
    /// `NavigationStack(path:)`. Without it the push compiles but
    /// silently no-ops.
    func testEditProfileRouteIsHashableAndDistinctFromPlaceholder() {
        let route: HubRoute = .editProfile
        let placeholder: HubRoute = .placeholder(label: "Edit profile")
        XCTAssertNotEqual(route, placeholder)
        // Equality is reflexive and stable across construction sites —
        // important for `NavigationStack` to track the entry.
        XCTAssertEqual(HubRoute.editProfile, HubRoute.editProfile)
        var set: Set<HubRoute> = []
        set.insert(.editProfile)
        XCTAssertTrue(set.contains(.editProfile))
    }

    /// Locks the drawer's "My Tasks" item onto the real `MyTasksView`
    /// (T5.3.2) rather than the `NotYetAvailableView` placeholder it
    /// regressed to. Mirrors the Android `routeForDrawer(MyTasks)` →
    /// `MY_TASKS` mapping so both platforms reach the poster-side list.
    func testMyTasksDrawerDestinationRoutesToRealScreen() {
        let route = HubTabRoot.route(forDrawer: .myTasks, context: .personal(name: ""))
        XCTAssertEqual(route, .myTasks)
        XCTAssertNotEqual(route, .placeholder(label: "My Tasks"))
    }

    /// The "Edit" footer action on a My tasks row opens the QuickPost
    /// composer in edit mode. The route must be `Hashable` + distinct so
    /// `NavigationStack` tracks it.
    func testEditGigRouteIsHashableAndDistinct() {
        let route: HubRoute = .editGig(gigId: "gig-123")
        XCTAssertEqual(route, .editGig(gigId: "gig-123"))
        XCTAssertNotEqual(route, .editGig(gigId: "gig-456"))
        XCTAssertNotEqual(route, .myTasks)
        var set: Set<HubRoute> = []
        set.insert(.editGig(gigId: "gig-123"))
        XCTAssertTrue(set.contains(.editGig(gigId: "gig-123")))
    }
}
