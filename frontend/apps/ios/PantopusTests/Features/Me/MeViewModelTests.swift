//
//  MeViewModelTests.swift
//  PantopusTests
//
//  Covers the Me tab VM: load (with + without home), identity switching
//  rebinds in place (no refetch), and the build* projections produce
//  the right stat / action / section keys.
//

import XCTest
@testable import Pantopus

@MainActor
final class MeViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: TestSession.make(),
            retryPolicy: .none
        )
    }

    private static let profileJSON = """
    {
      "user": {
        "id": "u1",
        "email": "alice@example.com",
        "username": "alice",
        "firstName": "Alice",
        "middleName": null,
        "lastName": "Doe",
        "name": "Alice Doe",
        "phoneNumber": null,
        "dateOfBirth": null,
        "address": null,
        "city": "Cambridge",
        "state": "MA",
        "zipcode": null,
        "accountType": "personal",
        "role": "member",
        "verified": true,
        "residency": null,
        "avatar_url": null,
        "profile_picture_url": null,
        "profilePicture": null,
        "bio": "Gardener, baker.",
        "tagline": null,
        "socialLinks": null,
        "skills": [],
        "followers_count": 0,
        "average_rating": 4.9,
        "gigs_posted": 12,
        "gigs_completed": 8,
        "profileVisibility": "registered",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      },
      "inviteProgress": null
    }
    """

    private static let homesJSON = """
    {
      "homes": [
        {
          "id": "h1",
          "name": "412 Birch Ln",
          "address": "412 Birch Ln",
          "city": "Cambridge",
          "state": "MA",
          "zipcode": "02139",
          "is_primary_owner": true,
          "ownership_status": "verified"
        }
      ]
    }
    """

    private static let emptyHomesJSON = """
    {"homes": []}
    """

    private static let statsJSON = """
    {
      "total_gigs_posted": 12,
      "total_gigs_completed": 8,
      "total_earnings": 240.0,
      "average_rating": 4.9,
      "total_ratings": 5
    }
    """

    private func stubSuccessfulLoad(homesJSON: String = MeViewModelTests.homesJSON) {
        URLProtocolStub.stub(path: "/api/users/profile", response: .json(Self.profileJSON))
        URLProtocolStub.stub(path: "/api/homes/my-homes", response: .json(homesJSON))
        URLProtocolStub.stub(path: "/api/users/u1/stats", response: .json(Self.statsJSON))
    }

    func testLoadProducesAllThreeIdentitiesWhenHomeExists() async {
        stubSuccessfulLoad()
        let vm = MeViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(personal, home, business) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(personal.identity, .personal)
        XCTAssertEqual(personal.displayName, "Alice Doe")
        XCTAssertTrue(personal.verified)
        // T6.2b — 3-tile stats row (Activity / Trust / Reputation).
        XCTAssertEqual(personal.stats.count, 3)
        XCTAssertEqual(personal.stats.first { $0.id == "trust" }?.value, "Verified")
        XCTAssertEqual(personal.stats.first { $0.id == "reputation" }?.value, "4.9")
        XCTAssertEqual(personal.actionTiles.count, 8)
        // T6.2b action grid is { posts, bids, gigs, offers, listings, connections,
        // support trains }; Calendarly appended a scheduling tile.
        XCTAssertEqual(
            personal.actionTiles.map(\.routeKey),
            ["me.posts", "me.bids", "me.gigs", "me.offers", "me.listings", "me.connections", "me.supportTrains", "me.scheduling"]
        )
        // T6.2b — sections grouped as Profile & Privacy, Activity, Help & Legal
        // (+ Debug appended in DEBUG builds; assert by header prefix).
        XCTAssertEqual(personal.sections.first?.header, "Profile & Privacy")
        XCTAssertTrue(personal.sections.contains { $0.header == "Activity" })
        XCTAssertTrue(personal.sections.contains { $0.header == "Help & Legal" })
        XCTAssertEqual(
            personal.sections.first { $0.header == "Profile & Privacy" }?.rows.map(\.routeKey),
            ["me.editProfile", "me.identityCenter", "me.audience", "me.creatorInbox"]
        )

        XCTAssertEqual(home.identity, .home)
        XCTAssertEqual(home.displayName, "412 Birch Ln")
        XCTAssertFalse(home.isUnbound)
        // T6.2b/T6.3b home action grid adds maintenance after bills;
        // Calendarly appended a scheduling tile.
        XCTAssertEqual(home.actionTiles.count, 8)
        XCTAssertEqual(
            home.actionTiles.map(\.routeKey),
            ["me.bills", "me.maintenance", "me.pets", "me.members", "me.polls", "me.calendar", "me.docs", "me.home.scheduling"]
        )
        // Home tiles carry the primary home id so the host can build
        // BillsListView / PetsListView without re-introspecting the VM.
        XCTAssertEqual(home.actionTiles.first?.routeArgs["homeId"], "h1")
        // Stats reflect home context.
        XCTAssertEqual(home.stats.map(\.id), ["bills", "tasks", "members"])

        XCTAssertEqual(business.identity, .business)
        XCTAssertTrue(business.isUnbound, "business stays unbound until mobile business read APIs land")
    }

    func testLoadProducesUnboundHomeWhenNoHomeClaimed() async {
        stubSuccessfulLoad(homesJSON: Self.emptyHomesJSON)
        let vm = MeViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(_, home, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertTrue(home.isUnbound)
        XCTAssertEqual(home.displayName, "Claim a home")
    }

    func testSelectIdentityFlipsActiveWithoutRefetch() async {
        stubSuccessfulLoad()
        let vm = MeViewModel(api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.activeIdentity, .personal)
        vm.selectIdentity(.home)
        XCTAssertEqual(vm.activeIdentity, .home)
        vm.selectIdentity(.business)
        XCTAssertEqual(vm.activeIdentity, .business)
        vm.selectIdentity(.personal)
        XCTAssertEqual(vm.activeIdentity, .personal)
    }

    func testLoadFailureWhenProfileFailsTransitionsError() async {
        URLProtocolStub.stub(path: "/api/users/profile", response: .json("{}", status: 500))
        let vm = MeViewModel(api: makeAPI())
        await vm.load()
        if case .error = vm.state { /* ok */ } else {
            XCTFail("Expected .error, got \(vm.state)")
        }
    }
}
