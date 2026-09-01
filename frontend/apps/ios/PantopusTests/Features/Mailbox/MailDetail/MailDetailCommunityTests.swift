//
//  MailDetailCommunityTests.swift
//  PantopusTests
//
//  T6.5d (P22) — Tests for the Community (A17.4) variant projection
//  + the RSVP mutation. The variant view shares the generic VM
//  (`MailDetailViewModel`); the variant-specific work happens inside
//  `project()` when it decodes `mail.object` into `CommunityDetailDTO`
//  and inside `setRsvp()` when the user taps Going / Maybe / etc.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailDetailCommunityTests: XCTestCase {
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

    private static let communityBody = """
    {
      "mail": {
        "id": "m1",
        "type": "community",
        "mail_type": "community",
        "display_title": "Saturday playground cleanup — 9 to 11 AM",
        "preview_text": "Posted by Aliyah W. · 4 days before event",
        "subject": null,
        "sender_business_name": "Elm Park HOA",
        "sender_address": null,
        "content": "Hi neighbors — quick reminder about Saturday cleanup.\\n\\nIf you have gardening gloves please bring them.",
        "viewed": false,
        "archived": false,
        "starred": false,
        "tags": [],
        "priority": "normal",
        "attachments": null,
        "ack_required": false,
        "created_at": "2026-05-16T10:00:00Z",
        "object": {
          "community_item_id": "ci-elm-cleanup",
          "group": {
            "name": "Elm Park HOA",
            "tagline": "40 households on Elm, Maple & 14th",
            "founded": "Est. 2014",
            "role": "Resident",
            "membership_since": "Mar 2024",
            "member_count": 87,
            "verified": true
          },
          "event": {
            "when": {"day": "Sat", "date": "May 24", "range": "9:00 – 11:00 AM"},
            "where": "Elm Park playground",
            "where_note": "Gather at the gazebo · 8:55 AM",
            "distance_label": "0.3 mi · 6 min walk",
            "bring": ["Work gloves", "A reusable mug"],
            "weather": {"summary": "Partly sunny · gentle breeze", "temperature_f": 64}
          },
          "attendee_count": 12,
          "attendees_from_block": 3,
          "attendees": [
            {"id": "u1", "display_name": "Jamal T.", "block_label": "Your block", "verified": true},
            {"id": "u2", "display_name": "Maria K.", "block_label": "Your block", "verified": true}
          ],
          "pulse_thread": {
            "thread_id": "pt-elm",
            "title": "Talk about Saturday cleanup",
            "reply_count": 12,
            "last_reply": {"author": "Jamal T.", "when": "12m", "preview": "I can bring the leaf blower."}
          },
          "rsvp_status": "undecided"
        }
      }
    }
    """

    // MARK: - Projection

    func testCommunityProjectionDecodesGroupEventAttendees() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: Self.communityBody)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertEqual(content.category, .community)
        let community = try XCTUnwrap(content.communityDetail)
        XCTAssertEqual(community.communityItemId, "ci-elm-cleanup")
        XCTAssertEqual(community.group.name, "Elm Park HOA")
        XCTAssertEqual(community.group.role, "Resident")
        XCTAssertEqual(community.group.memberCount, 87)
        XCTAssertTrue(community.group.isVerified)
        XCTAssertEqual(community.event?.dayLabel, "Sat")
        XCTAssertEqual(community.event?.dateLabel, "May 24")
        XCTAssertEqual(community.event?.bringItems.count, 2)
        XCTAssertEqual(community.event?.weatherTemperatureF, 64)
        XCTAssertEqual(community.attendeeCount, 12)
        XCTAssertEqual(community.attendeesFromBlock, 3)
        XCTAssertEqual(community.attendees.count, 2)
        XCTAssertEqual(community.pulseThread?.title, "Talk about Saturday cleanup")
        XCTAssertEqual(community.rsvp, .undecided)
    }

    func testCommunityPayloadAbsentLeavesNil() async {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "community",
            "mail_type": "community",
            "display_title": "Untyped community item",
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
            "created_at": "2026-05-16T10:00:00Z"
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
        XCTAssertEqual(content.category, .community)
        XCTAssertNil(content.communityDetail)
    }

    func testNonCommunityCategoryNeverDecodesCommunity() async {
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
            "created_at": "2026-05-16T10:00:00Z",
            "object": {"community_item_id": "ci-x"}
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
        XCTAssertNil(content.communityDetail)
    }

    // MARK: - RSVP mutation

    func testRsvpGoingPostsAndUpdatesAttendeeCount() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.communityBody),
            .status(200, body: "{\"message\":\"RSVP confirmed\",\"rsvpCount\":13}")
        ]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        await vm.setRsvp(.going)
        guard case let .loaded(content) = vm.state,
              let community = content.communityDetail else {
            XCTFail("Expected community payload")
            return
        }
        XCTAssertEqual(community.rsvp, .going)
        XCTAssertEqual(community.attendeeCount, 13)
        XCTAssertEqual(vm.toast, "You're going")
        XCTAssertFalse(vm.rsvpInFlight)
    }

    func testRsvpGoingRollsBackOnTransportFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.communityBody),
            .status(500, body: "{\"error\":\"oops\"}")
        ]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        await vm.setRsvp(.going)
        guard case let .loaded(content) = vm.state,
              let community = content.communityDetail else {
            XCTFail("Expected community payload after rollback")
            return
        }
        XCTAssertEqual(community.rsvp, .undecided)
        XCTAssertEqual(community.attendeeCount, 12)
        XCTAssertNotNil(vm.toast)
    }

    func testRsvpMaybeIsLocalOnlyAndStillCallsToast() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.communityBody)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        await vm.setRsvp(.maybe)
        guard case let .loaded(content) = vm.state,
              let community = content.communityDetail else {
            XCTFail("Expected community payload")
            return
        }
        XCTAssertEqual(community.rsvp, .maybe)
        // Attendee count unchanged because maybe doesn't bump going.
        XCTAssertEqual(community.attendeeCount, 12)
        XCTAssertEqual(vm.toast, "Saved as maybe")
    }

    // MARK: - Category dispatch

    func testMailItemCategoryCommunityHasExpectedTokens() {
        XCTAssertEqual(MailItemCategory.community.label, "Community")
        XCTAssertEqual(MailItemCategory.community.accent, Theme.Color.cleaning)
        XCTAssertEqual(MailItemCategory.community.detailTrust, .verified)
    }

    func testRsvpWireDecoding() {
        XCTAssertEqual(CommunityRsvpStatus(wire: "going"), .going)
        XCTAssertEqual(CommunityRsvpStatus(wire: "will_attend"), .going)
        XCTAssertEqual(CommunityRsvpStatus(wire: "maybe"), .maybe)
        XCTAssertEqual(CommunityRsvpStatus(wire: "not_going"), .notGoing)
        XCTAssertEqual(CommunityRsvpStatus(wire: "declined"), .notGoing)
        XCTAssertEqual(CommunityRsvpStatus(wire: nil), .undecided)
        XCTAssertEqual(CommunityRsvpStatus(wire: "something_else"), .undecided)
    }
}
