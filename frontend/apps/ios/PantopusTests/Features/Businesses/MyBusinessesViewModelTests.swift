//
//  MyBusinessesViewModelTests.swift
//  PantopusTests
//
//  A08 — covers `MyBusinessesViewModel`. Validates:
//    - load → loaded / empty / error transitions
//    - card projection (name, category + locality, role chip, team
//      count/initials, stats, ★rating text)
//    - verification drives the stats-band-vs-pending-strip split
//      (`identity_verification_tier` > bi0_unverified ⇒ verified)
//    - the Hub nav-drawer now routes "My Businesses" to the real screen
//      instead of the NotYetAvailable placeholder.
//

import XCTest
@testable import Pantopus

@MainActor
final class MyBusinessesViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"businesses\":[]}")]
        let vm = MyBusinessesViewModel(api: makeAPI())
        await vm.load()
        guard case .empty = vm.state else {
            return XCTFail("Expected .empty, got \(vm.state)")
        }
        XCTAssertNil(vm.introCount)
    }

    func testLoadPopulatedProjectsCards() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"businesses":[
              {"id":"seat-1","role_base":"owner","title":"Founder","joined_at":null,
               "business_user_id":"b1",
               "business":{"id":"b1","username":"bigtreehandyman","name":"Big Tree Handyman",
                            "email":"hello@x","profile_picture_url":null,"account_type":"business",
                            "city":"Elm Park","state":"NY","average_rating":4.9,"review_count":218},
               "profile":{"business_user_id":"b1","business_type":"home_services",
                          "categories":["handyman"],"is_published":true,
                          "logo_file_id":null,"banner_file_id":null,"description":"Local fix-it crew",
                          "identity_verification_tier":"bi3_documented"},
               "stats":{"open_chats":12,"bookings_this_week":7},
               "team":{"count":4,"members":[
                  {"initials":"MJ","name":"Mary Jones","avatar_file_id":null},
                  {"initials":"AK","name":"Alex Kim","avatar_file_id":null},
                  {"initials":"PA","name":"Pat","avatar_file_id":null}]}},
              {"id":"seat-2","role_base":"manager","title":null,"joined_at":null,
               "business_user_id":"b2",
               "business":{"id":"b2","username":"baysidetutoring","name":"Bayside Tutoring",
                            "email":null,"profile_picture_url":null,"account_type":"business",
                            "city":null,"state":null,"average_rating":null,"review_count":0},
               "profile":{"business_user_id":"b2","business_type":"education",
                          "categories":["tutoring"],"is_published":false,
                          "logo_file_id":null,"banner_file_id":null,"description":null,
                          "identity_verification_tier":"bi0_unverified"},
               "stats":{"open_chats":1,"bookings_this_week":0},
               "team":{"count":0,"members":[]}}
            ]}
            """)
        ]
        let vm = MyBusinessesViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(cards) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(cards.count, 2)
        XCTAssertEqual(vm.introCount, 2)

        // Verified owner → stats band populated.
        let big = cards[0]
        XCTAssertEqual(big.id, "b1")
        XCTAssertEqual(big.name, "Big Tree Handyman")
        XCTAssertEqual(big.categoryLabel, "Handyman")
        XCTAssertEqual(big.locality, "Elm Park, NY")
        XCTAssertFalse(big.localityIsPlaceholder)
        XCTAssertEqual(big.role?.label, "Owner")
        XCTAssertTrue(big.verified)
        XCTAssertFalse(big.pending)
        XCTAssertEqual(big.openChats, 12)
        XCTAssertEqual(big.bookingsThisWeek, 7)
        XCTAssertEqual(big.ratingText, "4.9")
        XCTAssertEqual(big.reviewCount, 218)
        XCTAssertEqual(big.teamCount, 4)
        XCTAssertEqual(big.teamInitials, ["MJ", "AK", "PA"])

        // Unverified + locationless → pending strip, "Online only", "New" rating.
        let bayside = cards[1]
        XCTAssertEqual(bayside.name, "Bayside Tutoring")
        XCTAssertEqual(bayside.categoryLabel, "Tutoring")
        XCTAssertEqual(bayside.locality, "Online only")
        XCTAssertTrue(bayside.localityIsPlaceholder)
        XCTAssertEqual(bayside.role?.label, "Manager")
        XCTAssertFalse(bayside.verified)
        XCTAssertTrue(bayside.pending)
        XCTAssertEqual(bayside.ratingText, "New")
    }

    func testLoadFailureTransitionsToErrorWhenCold() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MyBusinessesViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    func testMissingStatsAndTeamDefaultToZero() async {
        // A business row from a not-yet-migrated backend (no stats/team
        // blocks) must still project, defaulting the new signals to zero.
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"businesses":[
              {"id":"seat-1","role_base":"owner","title":null,"joined_at":null,
               "business_user_id":"b1",
               "business":{"id":"b1","username":"x","name":"Solo Shop",
                            "email":null,"profile_picture_url":null,"account_type":"business",
                            "city":"Reno","state":"NV"},
               "profile":null}
            ]}
            """)
        ]
        let vm = MyBusinessesViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(cards) = vm.state, let card = cards.first else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(card.openChats, 0)
        XCTAssertEqual(card.bookingsThisWeek, 0)
        XCTAssertEqual(card.teamCount, 0)
        XCTAssertTrue(card.pending, "No verification tier ⇒ pending")
        XCTAssertEqual(card.ratingText, "New")
    }

    func testIsVerifiedMapsTierAboveBi0() {
        XCTAssertFalse(BusinessCardModel.isVerified(tier: nil))
        XCTAssertFalse(BusinessCardModel.isVerified(tier: ""))
        XCTAssertFalse(BusinessCardModel.isVerified(tier: "bi0_unverified"))
        XCTAssertTrue(BusinessCardModel.isVerified(tier: "bi2_domain_social"))
        XCTAssertTrue(BusinessCardModel.isVerified(tier: "bi4_authority"))
    }

    /// Regression: the Hub nav-drawer's "My Businesses" row must resolve to
    /// the real `.myBusinesses` route, not the NotYetAvailable placeholder.
    func testHubDrawerMapsMyBusinessesToRealRoute() {
        let route = HubTabRoot.route(forDrawer: .myBusinesses, context: .personal(name: ""))
        XCTAssertEqual(route, .myBusinesses)
    }
}
