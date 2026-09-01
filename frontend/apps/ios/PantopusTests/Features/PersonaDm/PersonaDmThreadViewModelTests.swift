//
//  PersonaDmThreadViewModelTests.swift
//  PantopusTests
//
//  C5 — persona DM threads. Covers the thread projection (viewer-relative
//  bubble sides, fan-only reply-policy banner), the empty-thread state, and
//  the fan-inbox gate mapping for the backend's first-class rejections
//  (402 quota_exhausted / 403 blocked / no_membership / tier_does_not_allow).
//

import XCTest
@testable import Pantopus

@MainActor
final class PersonaDmThreadViewModelTests: XCTestCase {
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

    // MARK: - Thread projection

    func testLoadProjectsFanThreadWithPolicyBanner() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fanThreadJSON)]
        let vm = PersonaDmThreadViewModel(personaId: "p1", threadId: "t1", api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.viewerRole, .fan)
        XCTAssertEqual(loaded.title, "@sourdough")
        XCTAssertEqual(loaded.subtitle, "The Sourdough Diary")
        XCTAssertEqual(loaded.messages.count, 2)
        // Fan viewer: the fan's own message sits on the right.
        XCTAssertTrue(loaded.messages[0].fromViewer)
        XCTAssertFalse(loaded.messages[1].fromViewer)
        XCTAssertEqual(loaded.policyBanner?.kind, .onTrack)
        XCTAssertEqual(loaded.policyBanner?.text, "Reply within 3 days.")
    }

    func testSlaMissedBannerNamesTheWindowAndTheRefund() {
        let banner = PersonaDmThreadViewModel.policyBanner(
            PersonaDmReplyPolicyStatusDTO(
                status: "sla_missed", policy: "within_7_days", slaDays: 7, daysRemaining: nil
            )
        )
        XCTAssertEqual(banner?.kind, .missed)
        XCTAssertTrue(banner?.text.contains("7-day reply window") == true)
        XCTAssertTrue(banner?.text.contains("refund") == true)
    }

    func testCreatorViewerGetsNoPolicyBanner() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.creatorThreadJSON)]
        let vm = PersonaDmThreadViewModel(personaId: "p1", threadId: "t1", api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(loaded.viewerRole, .creator)
        XCTAssertNil(loaded.policyBanner)
        // Creator viewer: the creator's own message sits on the right.
        XCTAssertTrue(loaded.messages.last?.fromViewer == true)
        XCTAssertEqual(loaded.title, "@derek_tan")
    }

    func testEmptyMessageListTransitionsToEmptyWithHeaderIntact() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyThreadJSON)]
        let vm = PersonaDmThreadViewModel(personaId: "p1", threadId: "t1", api: makeAPI())
        await vm.load()
        guard case let .empty(loaded) = vm.state else {
            XCTFail("Expected .empty")
            return
        }
        XCTAssertEqual(loaded.title, "@sourdough")
        XCTAssertTrue(loaded.messages.isEmpty)
    }

    func testLoadFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = PersonaDmThreadViewModel(personaId: "p1", threadId: "t1", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error on 500")
            return
        }
    }

    /// A 403 on the append route means the fan is blocked — first-class copy,
    /// not "request failed".
    func testBlockedSendGetsItsOwnCopy() {
        XCTAssertEqual(
            PersonaDmThreadViewModel.sendErrorMessage(APIError.forbidden),
            "This profile can't accept new messages from your account."
        )
    }

    // MARK: - Fan inbox gates

    func testGateDerivedFromMembershipState() {
        XCTAssertEqual(
            FanInboxViewModel.gate(membershipMissing: true, perPeriod: 5, remaining: 5),
            .noMembership
        )
        XCTAssertEqual(
            FanInboxViewModel.gate(membershipMissing: false, perPeriod: 0, remaining: nil),
            .tierDoesNotAllow
        )
        XCTAssertEqual(
            FanInboxViewModel.gate(membershipMissing: false, perPeriod: nil, remaining: nil),
            .tierDoesNotAllow
        )
        XCTAssertEqual(
            FanInboxViewModel.gate(membershipMissing: false, perPeriod: 5, remaining: 0),
            .quotaExhausted
        )
        XCTAssertNil(FanInboxViewModel.gate(membershipMissing: false, perPeriod: 5, remaining: 3))
        // Negative allowance means unlimited — never gated.
        XCTAssertNil(FanInboxViewModel.gate(membershipMissing: false, perPeriod: -1, remaining: nil))
    }

    func testOpenThreadRejectionsMapToGates() {
        XCTAssertEqual(
            FanInboxViewModel.gate(for: APIError.clientError(status: 402, message: #"{"error":"quota_exhausted"}"#)),
            .quotaExhausted
        )
        XCTAssertEqual(FanInboxViewModel.gate(for: APIError.forbidden), .blocked)
        XCTAssertEqual(FanInboxViewModel.gate(for: APIError.notFound), .noMembership)
    }

    func testOpenConfirmationStatesTheRemainingQuota() {
        XCTAssertEqual(
            FanInboxViewModel.openConfirmation(quotaRemaining: 2),
            "Sent. 2 threads left this period."
        )
        XCTAssertEqual(
            FanInboxViewModel.openConfirmation(quotaRemaining: 1),
            "Sent. 1 thread left this period."
        )
        XCTAssertEqual(FanInboxViewModel.openConfirmation(quotaRemaining: nil), "Sent.")
    }

    func testQuotaChipLabel() {
        XCTAssertEqual(FanInboxQuota(remaining: 3, limit: 5).chipLabel, "3 of 5 left")
        XCTAssertEqual(FanInboxQuota(remaining: nil, limit: nil).chipLabel, "No message threads on this tier")
        XCTAssertEqual(FanInboxQuota(remaining: nil, limit: -1).chipLabel, "Unlimited message threads")
    }
}

private extension PersonaDmThreadViewModelTests {
    static let fanThreadJSON = """
    {
      "thread": {"id": "t1", "membershipId": "m1", "status": "open",
                 "createdAt": "2026-05-10T10:00:00.000Z",
                 "lastMessageAt": "2026-05-10T12:00:00.000Z"},
      "fan": {"handle": "maria_b", "displayName": "Maria B.", "avatarUrl": null},
      "persona": {"handle": "sourdough", "displayName": "The Sourdough Diary"},
      "viewerRole": "fan",
      "messages": [
        {"id": "m_1", "threadId": "t1", "senderRole": "fan",
         "body": "Can I sub bread flour for AP?", "media": [],
         "createdAt": "2026-05-10T10:00:00.000Z", "readAt": "2026-05-10T11:00:00.000Z"},
        {"id": "m_2", "threadId": "t1", "senderRole": "creator",
         "body": "Yes — drop hydration by 5g per 100g.", "media": [],
         "createdAt": "2026-05-10T12:00:00.000Z", "readAt": null}
      ],
      "replyPolicyStatus": {"status": "on_track", "policy": "within_3_days",
                            "slaDays": 3, "daysRemaining": 2}
    }
    """

    static let creatorThreadJSON = """
    {
      "thread": {"id": "t1", "membershipId": "m1", "status": "open",
                 "createdAt": "2026-05-10T10:00:00.000Z", "lastMessageAt": null},
      "fan": {"handle": "derek_tan", "displayName": "Derek Tan", "avatarUrl": null},
      "persona": {"handle": "sourdough", "displayName": "The Sourdough Diary"},
      "viewerRole": "creator",
      "messages": [
        {"id": "m_1", "threadId": "t1", "senderRole": "fan", "body": "Hi!", "media": [],
         "createdAt": "2026-05-10T10:00:00.000Z", "readAt": null},
        {"id": "m_2", "threadId": "t1", "senderRole": "creator", "body": "Hey!", "media": [],
         "createdAt": "2026-05-10T10:05:00.000Z", "readAt": null}
      ],
      "replyPolicyStatus": null
    }
    """

    static let emptyThreadJSON = """
    {
      "thread": {"id": "t1", "membershipId": "m1", "status": "open",
                 "createdAt": "2026-05-10T10:00:00.000Z", "lastMessageAt": null},
      "fan": {"handle": "maria_b", "displayName": "Maria B.", "avatarUrl": null},
      "persona": {"handle": "sourdough", "displayName": "The Sourdough Diary"},
      "viewerRole": "fan",
      "messages": [],
      "replyPolicyStatus": null
    }
    """
}
