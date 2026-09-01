//
//  MailboxCategoryPayloadTests.swift
//  PantopusTests
//
//  Round-trip the discriminated-union resolver through realistic
//  `mail.object_payload` shapes for each P18 category.
//

import XCTest
@testable import Pantopus

final class MailboxCategoryPayloadTests: XCTestCase {
    private func decode(_ json: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
    }

    func testCouponPayloadDecodes() throws {
        let payload = try decode("""
        {
          "headline": "30% OFF",
          "subcopy": "at any participating Whole Foods",
          "code": "PANTO30",
          "expires_at": "2026-05-31",
          "merchant": "Whole Foods Market",
          "min_spend": "$25",
          "fine_print": "One per customer."
        }
        """)
        let resolved = MailboxCategoryPayload.resolve(category: .coupon, objectPayload: payload)
        guard case let .coupon(coupon) = resolved else {
            XCTFail("Expected .coupon, got \(resolved)")
            return
        }
        XCTAssertEqual(coupon.headline, "30% OFF")
        XCTAssertEqual(coupon.code, "PANTO30")
        XCTAssertEqual(coupon.merchant, "Whole Foods Market")
        XCTAssertEqual(coupon.minimumSpend, "$25")
        XCTAssertEqual(coupon.finePrint, "One per customer.")
    }

    func testCouponMissingHeadlineFallsBackToOther() throws {
        let payload = try decode("""
        {"code": "X"}
        """)
        let resolved = MailboxCategoryPayload.resolve(category: .coupon, objectPayload: payload)
        XCTAssertEqual(resolved, .other)
    }

    func testBookletPayloadDecodes() throws {
        let payload = try decode("""
        {
          "pages": [
            "https://example.com/p1.png",
            "https://example.com/p2.png"
          ],
          "summary": "Spring catalog",
          "page_count": 24
        }
        """)
        let resolved = MailboxCategoryPayload.resolve(category: .booklet, objectPayload: payload)
        guard case let .booklet(booklet) = resolved else {
            XCTFail("Expected .booklet, got \(resolved)")
            return
        }
        XCTAssertEqual(booklet.pages.count, 2)
        XCTAssertEqual(booklet.pageCount, 24)
        XCTAssertEqual(booklet.summary, "Spring catalog")
    }

    func testBookletNoPagesFallsBack() throws {
        let payload = try decode("""
        {"summary": "no pages"}
        """)
        XCTAssertEqual(
            MailboxCategoryPayload.resolve(category: .booklet, objectPayload: payload),
            .other
        )
    }

    func testCertifiedPayloadDecodes() throws {
        let payload = try decode("""
        {
          "reference_number": "CRT-2026-0091",
          "document_type": "Court summons",
          "acknowledge_by": "2026-05-25",
          "chain": [
            {"id": "sent", "label": "Sent", "occurred_at": "2026-05-08"},
            {"id": "delivered", "label": "Delivered", "occurred_at": "2026-05-10"},
            {"id": "ack", "label": "Acknowledged"}
          ],
          "notice_body": "You are summoned to appear...",
          "terms_url": "https://example.com/terms",
          "is_acknowledged": false
        }
        """)
        let resolved = MailboxCategoryPayload.resolve(category: .certified, objectPayload: payload)
        guard case let .certified(certified) = resolved else {
            XCTFail("Expected .certified, got \(resolved)")
            return
        }
        XCTAssertEqual(certified.referenceNumber, "CRT-2026-0091")
        XCTAssertEqual(certified.chain.count, 3)
        XCTAssertTrue(certified.chain[0].isComplete)
        XCTAssertTrue(certified.chain[1].isComplete)
        XCTAssertFalse(certified.chain[2].isComplete) // no occurred_at
        XCTAssertEqual(certified.documentType, "Court summons")
    }

    func testCertifiedMissingReferenceFallsBack() throws {
        let payload = try decode("""
        {"chain": []}
        """)
        XCTAssertEqual(
            MailboxCategoryPayload.resolve(category: .certified, objectPayload: payload),
            .other
        )
    }

    func testNonP18CategoryReturnsOther() throws {
        let payload = try decode("""
        {"anything": "goes"}
        """)
        XCTAssertEqual(
            MailboxCategoryPayload.resolve(category: .bill, objectPayload: payload),
            .other
        )
    }
}
