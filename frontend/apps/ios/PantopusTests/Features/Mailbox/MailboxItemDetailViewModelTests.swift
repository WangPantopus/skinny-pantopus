//
//  MailboxItemDetailViewModelTests.swift
//  PantopusTests
//
//  Covers Mailbox Item Detail state transitions: happy path for a
//  package, optimistic `logAsReceived` with success and with rollback,
//  and the `.not_mine` ghost CTA.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailboxItemDetailViewModelTests: XCTestCase {
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

    private static let packageItemJSON = """
    {"mail":{
      "id":"m1","type":"package","mail_type":"package","created_at":"2026-04-19T10:00:00Z",
      "sender_display":"Acme Labs","sender_trust":"verified_business","display_title":"Parcel",
      "tags":[]
    }}
    """
    private static let packageDetailJSON = """
    {"package":{
      "tracking_number":"1Z999","carrier":"UPS","status":"in_transit",
      "suggested_order_match":"Amazon"
    },"timeline":[],"sender":{"display":"Acme Labs","trust":"verified_business"}}
    """

    func testPackageHappyPath() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.packageItemJSON),
            .status(200, body: Self.packageDetailJSON)
        ]
        let vm = MailboxItemDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .package)
        XCTAssertEqual(content.trust, .verified)
        XCTAssertNil(content.aiElf)
        XCTAssertEqual(content.packageInfo?.carrier, "UPS")
        XCTAssertEqual(content.packageInfo?.status, .inTransit)
        XCTAssertFalse(content.packageInfo?.handoffSteps.isEmpty ?? true)
        XCTAssertEqual(content.timeline.count, 4)
        XCTAssertFalse(content.ctaEnabled)
    }

    func testNonPackageFallsBackToBase() async throws {
        let json = """
        {"mail":{
          "id":"m2","type":"bill","mail_type":"bill","created_at":"2026-04-10T00:00:00Z",
          "sender_display":"City Water","sender_trust":"verified_utility","subject":"Water bill",
          "tags":[]
        }}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = MailboxItemDetailViewModel(mailId: "m2", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .bill)
        XCTAssertNil(content.packageInfo)
        // Every non-bespoke category projects a generic body so the screen
        // renders real content instead of a NotYetAvailable placeholder.
        let body = try XCTUnwrap(content.genericBody)
        XCTAssertEqual(body.category, .bill)
        // No `content` / `preview_text` shipped → the view renders the
        // category explainer rather than going blank.
        XCTAssertTrue(body.paragraphs.isEmpty)
        XCTAssertNil(body.actionLabel)
    }

    func testGenericCategoryProjectsReadableBody() async throws {
        let json = """
        {"mail":{
          "id":"m3","type":"notice","mail_type":"notice","created_at":"2026-04-12T00:00:00Z",
          "sender_display":"City of Cambridge","sender_trust":"verified_gov",
          "subject":"Street sweeping notice",
          "content":"Street sweeping resumes April 15.\\n\\nMove your car by 8 AM to avoid a ticket.",
          "tags":["parking","reminder"],"attachments":["notice.pdf"],"ack_required":true
        }}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = MailboxItemDetailViewModel(mailId: "m3", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .notice)
        let body = try XCTUnwrap(content.genericBody)
        XCTAssertEqual(body.category, .notice)
        XCTAssertEqual(
            body.paragraphs,
            ["Street sweeping resumes April 15.", "Move your car by 8 AM to avoid a ticket."]
        )
        XCTAssertEqual(body.tags, ["parking", "reminder"])
        XCTAssertEqual(body.attachments, ["notice.pdf"])
        XCTAssertEqual(body.actionLabel, "Acknowledge")
    }

    func testLogAsReceivedSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.packageItemJSON),
            .status(200, body: Self.packageDetailJSON),
            .status(200, body: """
            {"message":"ok","status":"delivered","previousStatus":"in_transit"}
            """)
        ]
        let vm = MailboxItemDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        await vm.logAsReceived()
        XCTAssertTrue(vm.ctaFlags.primaryCompleted)
        XCTAssertFalse(vm.ctaFlags.primaryLoading)
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertFalse(content.ctaEnabled)
    }

    func testLogAsReceivedRollsBackOnError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.packageItemJSON),
            .status(200, body: Self.packageDetailJSON),
            .status(500, body: "{}")
        ]
        let vm = MailboxItemDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(originalContent) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        let originalStates = originalContent.timeline.map(\.state)
        await vm.logAsReceived()
        XCTAssertFalse(vm.ctaFlags.primaryCompleted)
        XCTAssertNotNil(vm.ctaFlags.errorToast)
        guard case let .loaded(rolled) = vm.state else {
            XCTFail("Expected loaded after rollback")
            return
        }
        XCTAssertEqual(rolled.timeline.map(\.state), originalStates)
        XCTAssertFalse(rolled.ctaEnabled)
    }

    func testMarkNotMineDisablesCTAs() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.packageItemJSON),
            .status(200, body: Self.packageDetailJSON),
            .status(200, body: """
            {"message":"flagged","action":"not_mine"}
            """)
        ]
        let vm = MailboxItemDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        await vm.markNotMine()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertFalse(content.ctaEnabled)
        XCTAssertNil(vm.ctaFlags.errorToast)
    }

    func testAccentColorsCoverAllCategories() {
        XCTAssertEqual(MailItemCategory.allCases.count, 21)
        // Each accent must resolve (doesn't trap) — smoke coverage.
        for category in MailItemCategory.allCases {
            _ = category.accent
        }
    }

    func testTrustFromRawCoversAllBranches() {
        XCTAssertEqual(MailTrust.fromRaw("verified_gov"), .verified)
        XCTAssertEqual(MailTrust.fromRaw("verified_utility"), .verified)
        XCTAssertEqual(MailTrust.fromRaw("verified_business"), .verified)
        XCTAssertEqual(MailTrust.fromRaw("pantopus_user"), .chain)
        XCTAssertEqual(MailTrust.fromRaw("partial"), .partial)
        XCTAssertEqual(MailTrust.fromRaw(nil), .unverified)
        XCTAssertEqual(MailTrust.fromRaw("anything_else"), .unverified)
    }

    func testCategoryFromRawDefaultsToGeneral() {
        XCTAssertEqual(MailItemCategory.fromRaw("PACKAGE"), .package)
        XCTAssertEqual(MailItemCategory.fromRaw("unknown"), .general)
        XCTAssertEqual(MailItemCategory.fromRaw(nil), .general)
    }
}
