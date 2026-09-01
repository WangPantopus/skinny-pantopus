//
//  MembershipDetailViewModelTests.swift
//  PantopusTests
//
//  A10.8 — Covers the fan-side Membership VM: load() projects the
//  membership read onto MembershipDetailContent, a null membership maps to
//  .error, a seeded fixture short-circuits the network, and the single-tap
//  cancel round-trips (success → true, failure → inline actionError).
//

import XCTest
@testable import Pantopus

@MainActor
final class MembershipDetailViewModelTests: XCTestCase {
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

    func testLoadProjectsMembership() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.membershipJSON)]
        let vm = MembershipDetailViewModel(personaId: "p1", api: makeAPI())
        await vm.load()
        guard case let .populated(content) = vm.state else {
            XCTFail("Expected .populated, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.persona.name, "Lara Chen")
        XCTAssertEqual(content.persona.initials, "LC")
        XCTAssertTrue(content.persona.verified)
        XCTAssertEqual(content.tier, .silver)
        XCTAssertEqual(content.priceLabel, "$8")
        XCTAssertEqual(content.periodLabel, "month")
        // Benefits are derived from the tier perk fields.
        XCTAssertFalse(content.benefits.isEmpty)
    }

    func testLoadMissingMembershipShowsError() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"membership": null}"#)]
        let vm = MembershipDetailViewModel(personaId: "p1", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error when membership is null")
            return
        }
    }

    func testSeededContentSkipsNetwork() async {
        let vm = MembershipDetailViewModel(
            personaId: "p1",
            api: makeAPI(),
            content: MembershipSampleData.populated
        )
        await vm.load()
        guard case .populated = vm.state else {
            XCTFail("Expected .populated from the seeded fixture")
            return
        }
    }

    func testCancelSuccessReturnsTrue() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.membershipJSON)]
        let vm = MembershipDetailViewModel(personaId: "p1", api: makeAPI())
        let ok = await vm.cancel()
        XCTAssertTrue(ok)
        XCTAssertNil(vm.actionError)
        XCTAssertFalse(vm.isCancelling)
    }

    func testCancelFailureSetsActionError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = MembershipDetailViewModel(personaId: "p1", api: makeAPI())
        let ok = await vm.cancel()
        XCTAssertFalse(ok)
        XCTAssertNotNil(vm.actionError)
    }
}

private extension MembershipDetailViewModelTests {
    static let membershipJSON = """
    {
      "membership": {
        "membershipId": "m1",
        "persona": {
          "id": "p1", "handle": "lara", "displayName": "Lara Chen",
          "category": "food critic", "audienceLabel": "members",
          "followerCount": 1240, "credential": {"status": "verified"}
        },
        "tier": {
          "id": "t2", "rank": 2, "name": "Silver", "priceCents": 800,
          "currency": "usd", "billingInterval": "month",
          "msgThreadsPerPeriod": 4, "creatorCanInitiateDm": true,
          "replyPolicy": "within_48h"
        },
        "status": "active", "cancelAtPeriodEnd": false,
        "currentPeriodEnd": "2026-11-12T00:00:00.000Z"
      }
    }
    """
}
