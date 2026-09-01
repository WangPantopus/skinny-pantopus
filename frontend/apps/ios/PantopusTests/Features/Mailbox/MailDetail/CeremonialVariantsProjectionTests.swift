//
//  CeremonialVariantsProjectionTests.swift
//  PantopusTests
//
//  A17.5–A17.8 — Projection tests for the four new ceremonial variant
//  payloads (Coupon / Gig / Memory / Package). Mirrors
//  `MailDetailVariantsTests` for the booklet/certified families: drives
//  the static `project(detail:now:)` projection with hand-rolled
//  `mail.object` payloads and asserts the per-variant DTO is decoded.
//

import XCTest
@testable import Pantopus

@MainActor
final class CeremonialVariantsProjectionTests: XCTestCase {
    private func projectContent(from body: String) throws -> MailDetailContent {
        let response = try JSONDecoder().decode(MailDetailResponse.self, from: Data(body.utf8))
        return MailDetailViewModel.project(detail: response.mail)
    }

    // MARK: - Coupon

    func testCouponProjectionDecodesHeadline() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "coupon",
            "mail_type": "coupon",
            "display_title": "25% OFF",
            "preview_text": null,
            "subject": null,
            "sender_business_name": "Brass Owl Bakery",
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
              "headline": "25% OFF",
              "subcopy": "Next purchase",
              "code": "BRASS25",
              "expires_at": "2026-06-30",
              "merchant": "Brass Owl Bakery",
              "minimum_spend": "$8 minimum"
            }
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertEqual(content.category, .coupon)
        XCTAssertNotNil(content.couponDetail)
        XCTAssertEqual(content.couponDetail?.headline, "25% OFF")
        XCTAssertEqual(content.couponDetail?.code, "BRASS25")
        XCTAssertNil(content.gigDetail)
        XCTAssertNil(content.memoryDetail)
        XCTAssertNil(content.packageDetail)
    }

    func testCouponPayloadMissingHeadlineLeavesNil() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "coupon",
            "mail_type": "coupon",
            "display_title": "Untitled",
            "sender_business_name": "Sender",
            "viewed": false, "archived": false, "starred": false,
            "tags": [], "priority": "normal", "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {"merchant": "Brass Owl"}
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertNil(content.couponDetail)
    }

    // MARK: - Gig

    func testGigProjectionDecodesBidPostBidder() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "gig",
            "mail_type": "gig",
            "display_title": "New bid",
            "sender_business_name": "Marcus T.",
            "viewed": false, "archived": false, "starred": false,
            "tags": [], "priority": "normal", "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "is_accepted": false,
              "bidder": {"name": "Marcus T.", "rating": 4.9, "jobs": 47},
              "bid": {"amount": 65, "unit": "flat", "eta": "Saturday", "expires": "in 22h"},
              "post": {"title": "Sofa move", "category": "Moving", "budget": "$40-80"},
              "other_bids": [
                {"who": "Devon R.", "amount": 55, "rating": 4.7, "jobs": 18}
              ]
            }
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertEqual(content.category, .gig)
        XCTAssertNotNil(content.gigDetail)
        XCTAssertEqual(content.gigDetail?.bid.amount, 65)
        XCTAssertEqual(content.gigDetail?.otherBids.count, 1)
        XCTAssertFalse(content.gigDetail?.isAccepted ?? true)
    }

    // MARK: - Memory

    func testMemoryProjectionDecodesKeepsake() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "memory",
            "mail_type": "memory",
            "display_title": "A year ago",
            "sender_business_name": "Mei L.",
            "viewed": false, "archived": false, "starred": false,
            "tags": [], "priority": "normal", "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "title": "One year ago, you found Pepper.",
              "reference": "MEM-0518",
              "is_saved": false,
              "elf_fresh": {"headline": "Pantopus surfaced this", "summary": "Anniversary release."},
              "elf_saved": {"headline": "Kept in your Vault", "summary": "Filed in Memories."},
              "vault": {
                "trail": [{"glyph": "inbox", "label": "Mailbox"}, {"glyph": "heart", "label": "Memories"}],
                "stats": [{"value": "12", "label": "Items"}]
              }
            }
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertEqual(content.category, .memory)
        XCTAssertNotNil(content.memoryDetail)
        XCTAssertEqual(content.memoryDetail?.title, "One year ago, you found Pepper.")
        XCTAssertFalse(content.memoryDetail?.isSaved ?? true)
    }

    func testMemoryMissingPresentationBlocksLeavesNil() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "memory",
            "mail_type": "memory",
            "display_title": "Bare memory",
            "sender_business_name": "Sender",
            "viewed": false, "archived": false, "starred": false,
            "tags": [], "priority": "normal", "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {"title": "no elf/vault"}
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertNil(content.memoryDetail)
    }

    // MARK: - Package

    func testPackageProjectionDecodesCarrierAndTracking() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "package",
            "mail_type": "package",
            "display_title": "Package en route",
            "sender_business_name": "Lerina Books",
            "viewed": false, "archived": false, "starred": false,
            "tags": [], "priority": "normal", "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "carrier": "USPS Priority Mail",
              "tracking_number": "9505 5125",
              "status": "out_for_delivery",
              "eta_line": "ETA 1-3 PM"
            }
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertEqual(content.category, .package)
        XCTAssertNotNil(content.packageDetail)
        XCTAssertEqual(content.packageDetail?.carrier, "USPS Priority Mail")
        XCTAssertEqual(content.packageDetail?.status, .outForDelivery)
        XCTAssertEqual(content.packageDetail?.trackingNumber, "9505 5125")
        // Tracking timeline is derived when the backend omits it.
        XCTAssertFalse(content.packageDetail?.trackingSteps.isEmpty ?? true)
    }

    func testPackagePayloadWithoutCarrierLeavesNil() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "package",
            "mail_type": "package",
            "display_title": "Bare package",
            "sender_business_name": "Sender",
            "viewed": false, "archived": false, "starred": false,
            "tags": [], "priority": "normal", "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {"status": "in_transit"}
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertNil(content.packageDetail)
    }

    // MARK: - Cross-category guards

    func testNonGigCategoryNeverDecodesGig() throws {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "notice",
            "mail_type": "notice",
            "display_title": "Notice",
            "sender_business_name": "City",
            "viewed": false, "archived": false, "starred": false,
            "tags": [], "priority": "normal", "ack_required": false,
            "created_at": "2026-05-15T12:00:00Z",
            "object": {
              "bidder": {"name": "Marcus"},
              "bid": {"amount": 65},
              "post": {"title": "Sofa"}
            }
          }
        }
        """
        let content = try projectContent(from: body)
        XCTAssertNil(content.gigDetail)
    }
}
