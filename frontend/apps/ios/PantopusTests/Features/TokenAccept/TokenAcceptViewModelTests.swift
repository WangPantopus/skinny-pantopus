//
//  TokenAcceptViewModelTests.swift
//  PantopusTests
//
//  Covers the T3.5 Token / Accept VM resolver + accept/decline paths
//  for all three invite types (home invite, business seat, guest
//  pass), plus the expired and not-found branches.
//

import XCTest
@testable import Pantopus

@MainActor
final class TokenAcceptViewModelTests: XCTestCase {
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

    // The resolver hits 3 GETs in parallel. Path-keyed stubs keep the
    // tests deterministic regardless of request scheduling.

    private static let homeInviteJSON = """
    {
      "invitation": {
        "id": "inv1", "status": "pending",
        "proposed_role": "co_owner",
        "invitee_email": "alice@example.com",
        "expires_at": "2026-06-01T00:00:00Z"
      },
      "home": {"id": "h1", "name": "412 Elm St", "city": "Portland, OR", "home_type": "single_family"},
      "inviter": {"name": "Maya K.", "username": "mayak", "profilePicture": null}
    }
    """

    private static let businessSeatJSON = """
    {
      "seat_id": "s1",
      "business": {"id": "b1", "username": "bridge", "name": "Bridge Builders LLC"},
      "display_name": "Alice — Account Manager",
      "role_base": "manager",
      "invite_email": "alice@example.com",
      "created_at": "2026-05-14T08:00:00Z"
    }
    """

    private static let guestPassJSON = """
    {
      "pass": {
        "label": "Marie's place",
        "kind": "weekend_stay",
        "custom_title": null,
        "expires_at": "2026-05-22T18:00:00Z",
        "home_name": "Marie's place",
        "welcome_message": "Wifi is on the fridge — make yourself at home."
      },
      "sections": {}
    }
    """

    // MARK: - Home invite

    func testHomeInviteResolves() async {
        URLProtocolStub.stub(path: "/api/homes/invitations/token/demo", response: .json(Self.homeInviteJSON))
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case let .ready(offer) = vm.state else {
            XCTFail("Expected .ready, got \(vm.state)")
            return
        }
        XCTAssertEqual(offer.inviteType, .homeInvite)
        XCTAssertEqual(offer.invitationId, "inv1")
        XCTAssertEqual(offer.roleOffered, "Co owner")
        XCTAssertTrue(offer.sender.contains("Maya"))
        XCTAssertTrue(offer.primaryCtaLabel.contains("412 Elm St"))
        XCTAssertFalse(offer.benefits.isEmpty)
    }

    func testHomeInviteAcceptSucceeds() async {
        URLProtocolStub.stub(path: "/api/homes/invitations/token/demo", response: .json(Self.homeInviteJSON))
        URLProtocolStub.stub(
            path: "/api/homes/invitations/token/demo/accept",
            response: .json("""
            {"homeId":"h1","occupancy":{"id":"occ1","role":"co_owner"},"accepted_role_base":"co_owner"}
            """)
        )
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        await vm.accept()
        guard case let .accepted(offer, _) = vm.state else {
            XCTFail("Expected .accepted")
            return
        }
        XCTAssertEqual(offer.inviteType, .homeInvite)
    }

    func testHomeInviteExpired() async {
        URLProtocolStub.stub(
            path: "/api/homes/invitations/token/demo",
            response: .json("""
            {"invitation":{"id":"inv1","status":"expired"},"expired":true}
            """)
        )
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case .expired = vm.state else {
            XCTFail("Expected .expired")
            return
        }
    }

    func testHomeInviteAlreadyUsed() async {
        URLProtocolStub.stub(
            path: "/api/homes/invitations/token/demo",
            response: .json("""
            {"invitation":{"id":"inv1","status":"accepted"},"alreadyUsed":true}
            """)
        )
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case .expired = vm.state else {
            XCTFail("Expected .expired for already-used")
            return
        }
    }

    // MARK: - Business seat

    func testBusinessSeatResolves() async {
        URLProtocolStub.stub(path: "/api/businesses/seats/invite-details", response: .json(Self.businessSeatJSON))
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case let .ready(offer) = vm.state else {
            XCTFail("Expected .ready, got \(vm.state)")
            return
        }
        XCTAssertEqual(offer.inviteType, .businessSeat)
        XCTAssertEqual(offer.invitationId, "s1")
        XCTAssertEqual(offer.roleOffered, "Manager")
        XCTAssertTrue(offer.venue.contains("Bridge"))
        XCTAssertTrue(offer.primaryCtaLabel.contains("Bridge"))
    }

    func testBusinessSeatAcceptSucceeds() async {
        URLProtocolStub.stub(path: "/api/businesses/seats/invite-details", response: .json(Self.businessSeatJSON))
        URLProtocolStub.stub(
            path: "/api/businesses/seats/accept-invite",
            response: .json("""
            {"message":"Invite accepted","seat_id":"s1","business_user_id":"b1","role_base":"manager"}
            """)
        )
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        await vm.accept()
        guard case let .accepted(offer, _) = vm.state else {
            XCTFail("Expected .accepted")
            return
        }
        XCTAssertEqual(offer.inviteType, .businessSeat)
    }

    // MARK: - Guest pass

    func testGuestPassResolves() async {
        URLProtocolStub.stub(path: "/api/homes/guest/demo", response: .json(Self.guestPassJSON))
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case let .ready(offer) = vm.state else {
            XCTFail("Expected .ready, got \(vm.state)")
            return
        }
        XCTAssertEqual(offer.inviteType, .guestPass)
        XCTAssertNil(offer.invitationId) // guest passes don't expose an id here
        XCTAssertTrue(offer.venue.contains("Marie"))
        XCTAssertEqual(offer.primaryCtaLabel, "View guest pass")
        XCTAssertTrue(offer.benefits.contains { $0.contains("Wifi") })
    }

    func testGuestPassAcceptIsLocalNoPostNeeded() async {
        URLProtocolStub.stub(path: "/api/homes/guest/demo", response: .json(Self.guestPassJSON))
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        let postCountBeforeAccept = URLProtocolStub.capturedRequests.filter { $0.httpMethod == "POST" }.count
        await vm.accept()
        guard case .accepted = vm.state else {
            XCTFail("Expected .accepted (local-only)")
            return
        }
        XCTAssertEqual(URLProtocolStub.capturedRequests.filter { $0.httpMethod == "POST" }.count, postCountBeforeAccept)
    }

    // MARK: - Resolver edge cases

    func testAllNotFoundFallsToExpired() async {
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        guard case let .expired(message) = vm.state else {
            XCTFail("Expected .expired when all three resolvers 404")
            return
        }
        XCTAssertFalse(message.isEmpty)
    }

    func testDeclineTransitionsToDeclined() async {
        URLProtocolStub.stub(path: "/api/homes/invitations/token/demo", response: .json(Self.homeInviteJSON))
        URLProtocolStub.stub(path: "/api/homes/invitations/inv1/reject", response: .json("{}"))
        let vm = TokenAcceptViewModel(token: "demo", api: makeAPI())
        await vm.load()
        await vm.decline()
        guard case .declined = vm.state else {
            XCTFail("Expected .declined")
            return
        }
    }

    // MARK: - Projection helpers

    func testHumanRoleConvertsSnakeToTitleCase() {
        XCTAssertEqual(TokenAcceptViewModel.humanRole("co_owner"), "Co owner")
        XCTAssertEqual(TokenAcceptViewModel.humanRole("renter"), "Renter")
        XCTAssertEqual(TokenAcceptViewModel.humanRole("admin"), "Admin")
    }

    func testHomeBenefitsBranchOnRole() {
        let ownerBenefits = TokenAcceptViewModel.homeBenefits(role: "co_owner")
        let renterBenefits = TokenAcceptViewModel.homeBenefits(role: "renter")
        XCTAssertTrue(ownerBenefits.contains { $0.contains("Co-manage") })
        XCTAssertFalse(renterBenefits.contains { $0.contains("Co-manage") })
    }

    func testSeatBenefitsForAdminIncludeInviteCopy() {
        let adminBenefits = TokenAcceptViewModel.seatBenefits(role: "admin")
        XCTAssertTrue(adminBenefits.contains { $0.contains("Invite teammates") })
        let memberBenefits = TokenAcceptViewModel.seatBenefits(role: "member")
        XCTAssertFalse(memberBenefits.contains { $0.contains("Invite teammates") })
    }
}
