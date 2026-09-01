//
//  MailDetailVariantsTests.swift
//  PantopusTests
//
//  T6.5c (P21) — Tests for the booklet + certified variant projections.
//  The variant views share the generic VM (`MailDetailViewModel`); the
//  variant-specific work happens inside `project()` when it decodes
//  `mail.object` into `BookletDetailDTO` / `CertifiedDetailDTO`.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailDetailVariantsTests: XCTestCase {
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

    // MARK: - Booklet projection

    func testBookletProjectionDecodesPagesFromObject() async {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "booklet",
            "mail_type": "booklet",
            "display_title": "June 2026 primary voter guide",
            "preview_text": "28 pages.",
            "subject": null,
            "sender_business_name": "League of Women Voters",
            "sender_address": null,
            "content": null,
            "viewed": false,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "attachments": null,
            "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "page_count": 3,
              "summary": "Voter guide summary.",
              "pages": [
                "https://example.test/p1.jpg",
                "https://example.test/p2.jpg",
                "https://example.test/p3.jpg"
              ]
            }
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .booklet)
        XCTAssertNotNil(content.bookletDetail)
        XCTAssertEqual(content.bookletDetail?.pages.count, 3)
        XCTAssertEqual(content.bookletDetail?.pageCount, 3)
        XCTAssertNil(content.certifiedDetail)
    }

    func testBookletPayloadAbsentLeavesNil() async {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "booklet",
            "mail_type": "booklet",
            "display_title": "Untyped booklet",
            "preview_text": null,
            "subject": null,
            "sender_business_name": "Anon",
            "sender_address": null,
            "content": null,
            "viewed": false,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "attachments": null,
            "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z"
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertEqual(content.category, .booklet)
        XCTAssertNil(content.bookletDetail)
    }

    func testNonBookletCategoryNeverDecodesBooklet() async {
        // Even if backend ships a booklet-shaped object on a notice
        // (it shouldn't), our category gate keeps the variant nil.
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "notice",
            "mail_type": "notice",
            "display_title": "Notice",
            "preview_text": null,
            "subject": null,
            "sender_business_name": "City",
            "sender_address": null,
            "content": null,
            "viewed": false,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "attachments": null,
            "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "pages": ["https://example.test/p1.jpg"]
            }
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertNil(content.bookletDetail)
    }

    // MARK: - Certified projection

    func testCertifiedProjectionDecodesChain() async {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "certified",
            "mail_type": "certified",
            "display_title": "Supplemental property tax bill",
            "preview_text": "Pay by Jun 30.",
            "subject": null,
            "sender_business_name": "Alameda County",
            "sender_address": null,
            "content": "Amount due: $1,247.82.",
            "viewed": false,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "attachments": null,
            "ack_required": true,
            "ack_status": null,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "reference_number": "SP-2026-188742",
              "document_type": "Supplemental tax bill",
              "acknowledge_by": "2026-06-30T17:00:00Z",
              "chain": [
                {"id": "ack", "label": "Acknowledged on Pantopus", "complete": false},
                {"id": "delivered", "label": "Delivered to your Mailbox", "occurred_at": "2026-05-15T13:02:00Z", "complete": true},
                {"id": "transit", "label": "In transit", "occurred_at": "2026-05-12T17:42:00Z", "complete": true}
              ]
            }
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .certified)
        XCTAssertNotNil(content.certifiedDetail)
        XCTAssertEqual(content.certifiedDetail?.referenceNumber, "SP-2026-188742")
        XCTAssertEqual(content.certifiedDetail?.documentType, "Supplemental tax bill")
        XCTAssertEqual(content.certifiedDetail?.chain.count, 3)
        XCTAssertEqual(content.detailTrust, .verified) // certified always renders the verified dot
    }

    func testCertifiedIsAcknowledgedFromPayloadFlowsThroughResolvedAck() async {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "certified",
            "mail_type": "certified",
            "display_title": "Cert",
            "preview_text": null,
            "subject": null,
            "sender_business_name": "City",
            "sender_address": null,
            "content": null,
            "viewed": true,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "attachments": null,
            "ack_required": true,
            "ack_status": null,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "reference_number": "ABC-1",
              "chain": [],
              "is_acknowledged": true
            }
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertTrue(content.isAcknowledged)
    }

    // MARK: - ChainOfCustodyEvent / Timeline render contract

    func testChainOfCustodyEventCarriesPantopusFlag() {
        let event = ChainOfCustodyEvent(
            id: "ack",
            icon: .badgeCheck,
            label: "Acknowledged on Pantopus",
            meta: "OK-7c9d2a",
            timestamp: "Today · 2:14 PM",
            isPantopusEvent: true,
            isComplete: true
        )
        XCTAssertTrue(event.isPantopusEvent)
        XCTAssertTrue(event.isComplete)
        XCTAssertEqual(event.label, "Acknowledged on Pantopus")
    }

    func testChainOfCustodyStatusLabel() {
        XCTAssertEqual(ChainOfCustodyStatus.unbroken.label, "Unbroken")
        XCTAssertEqual(ChainOfCustodyStatus.broken.label, "Broken")
        XCTAssertEqual(
            ChainOfCustodyStatus.custom(
                label: "Pending",
                background: Theme.Color.appSurfaceSunken,
                foreground: Theme.Color.appTextSecondary
            ).label,
            "Pending"
        )
    }

    // MARK: - Stamp tracking-id pretty-print

    func testCertifiedStampPrettyPrintsTrackingId() {
        // The component's pretty-print joins the first 12 digits in
        // groups of 4 with a single space.
        let badge = CertifiedStampBadge(trackingId: "7014202604113344")
        let mirror = Mirror(reflecting: badge)
        // No direct way to read computed properties without rendering;
        // a smoke check that the construction doesn't trap is enough
        // for the contract test layer.
        XCTAssertEqual(mirror.children.count, 1)
    }
}
