//
//  MailboxItemDetailCategoryDispatchTests.swift
//  PantopusTests
//
//  Asserts that the P18 category-aware projection wires up the right
//  payload, trust pill, sender flags, and CTA gate state for each of
//  Coupon / Booklet / Certified.
//

// swiftlint:disable type_body_length

import XCTest
@testable import Pantopus

private extension ISO8601DateFormatter {
    /// Build a `yyyy-MM-dd` string a fixed number of days from now,
    /// at UTC midnight, so `daysUntil` returns the exact integer.
    static func dateOnly(daysFromNow days: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        // Round "now" up to the next UTC midnight so the day-count is
        // stable regardless of the test's wall-clock time-of-day.
        let calendar = Calendar(identifier: .gregorian)
        var calUTC = calendar
        if let utc = TimeZone(identifier: "UTC") {
            calUTC.timeZone = utc
        }
        let now = Date()
        let startOfTodayUTC = calUTC.startOfDay(for: now)
        let target = startOfTodayUTC.addingTimeInterval(Double(days) * 86400)
        return formatter.string(from: target)
    }
}

@MainActor
final class MailboxItemDetailCategoryDispatchTests: XCTestCase {
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

    // MARK: - Coupon

    private static let couponJSON = """
    {"mail":{
      "id":"m-coupon","type":"coupon","mail_type":"coupon",
      "created_at":"2026-04-30T10:00:00Z",
      "sender_display":"Whole Foods","sender_trust":"unverified",
      "display_title":"30% off this week","tags":[],
      "object_payload":{
        "headline":"30% OFF",
        "subcopy":"at any participating Whole Foods",
        "code":"PANTO30",
        "expires_at":"2026-05-31",
        "merchant":"Whole Foods Market",
        "fine_print":"One per customer."
      }
    }}
    """

    func testCouponDispatchProjectsCouponPayload() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.couponJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-coupon", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .coupon)
        guard case let .coupon(coupon) = content.payload else {
            XCTFail("Expected .coupon payload, got \(content.payload)")
            return
        }
        XCTAssertEqual(coupon.headline, "30% OFF")
        XCTAssertFalse(content.sender.showStamp)
        // Code and merchant should land in keyFacts.
        XCTAssertTrue(content.keyFacts.contains { $0.label == "Code" })
        XCTAssertTrue(content.keyFacts.contains { $0.label == "Merchant" })
    }

    // MARK: - Booklet

    private static let bookletJSON = """
    {"mail":{
      "id":"m-booklet","type":"booklet","mail_type":"booklet",
      "created_at":"2026-04-30T10:00:00Z",
      "sender_display":"REI","sender_trust":"verified_business","display_title":"Spring catalog",
      "tags":[],
      "object_payload":{
        "pages":[
          "https://example.com/p1.png",
          "https://example.com/p2.png"
        ],
        "summary":"Spring catalog","page_count":24
      }
    }}
    """

    func testBookletDispatchProjectsBookletPayload() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.bookletJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-booklet", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .booklet)
        guard case let .booklet(booklet) = content.payload else {
            XCTFail("Expected .booklet payload, got \(content.payload)")
            return
        }
        XCTAssertEqual(booklet.pages.count, 2)
        XCTAssertEqual(booklet.pageCount, 24)
        XCTAssertNil(content.aiElf)
        XCTAssertFalse(content.sender.showStamp)
    }

    // MARK: - Certified

    private static let certifiedJSON = """
    {"mail":{
      "id":"m-cert","type":"certified","mail_type":"certified",
      "created_at":"2026-05-08T10:00:00Z",
      "sender_display":"Cambridge District Court","sender_trust":"verified_gov",
      "display_title":"Court summons","tags":[],
      "object_payload":{
        "reference_number":"CRT-2026-0091",
        "document_type":"Court summons",
        "acknowledge_by":"2026-05-25",
        "chain":[
          {"id":"sent","label":"Sent","occurred_at":"2026-05-08"},
          {"id":"delivered","label":"Delivered","occurred_at":"2026-05-10"},
          {"id":"ack","label":"Acknowledged"}
        ],
        "notice_body":"You are summoned.",
        "is_acknowledged":false
      }
    }}
    """

    func testCertifiedDispatchProjectsCertifiedPayloadAndStamp() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.certifiedJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-cert", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .certified)
        XCTAssertEqual(content.trust, .certifiedChain)
        XCTAssertTrue(content.sender.showStamp)
        XCTAssertNotNil(content.aiElf)
        XCTAssertEqual(content.timeline.count, 3)
        XCTAssertTrue(content.keyFacts.contains { $0.label == "Reference #" })
        guard case .certified = content.payload else {
            XCTFail("Expected .certified payload")
            return
        }
    }

    // MARK: - Community

    private static let communityPollJSON = """
    {"mail":{
      "id":"m-community","type":"community","mail_type":"community",
      "created_at":"2026-05-21T10:00:00Z",
      "sender_display":"Elm Park HOA","sender_trust":"verified_business",
      "display_title":"Block-party date poll","tags":[],
      "object_payload":{
        "community_item_id":"community-poll","kind":"poll",
        "group":{"name":"Elm Park HOA","tagline":"40 households","verified":true,
                 "role":"Resident","since":"Mar 2024","member_count":87},
        "poll":{
          "question":"Which weekend should we reserve?",
          "options":[
            {"id":"june-7","label":"Saturday, June 7","votes":19,"selected":true},
            {"id":"june-14","label":"Saturday, June 14","votes":11}
          ],
          "total_votes":30,"closes_at":"Fri 5 PM","status":"Residents only"
        },
        "attendees":[{"id":"jt","name":"Jamal T.","initials":"JT","verified":true}],
        "attendee_count":30,
        "attendees_from_block":6,
        "pulse_thread":{"thread_id":"pulse-1","title":"Poll thread","reply_count":4}
      }
    }}
    """

    func testCommunityDispatchProjectsPollPayload() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.communityPollJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-community", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .community)
        XCTAssertEqual(content.trust, .verified)
        XCTAssertNil(content.aiElf)
        XCTAssertTrue(content.keyFacts.isEmpty)
        guard case let .community(community) = content.payload else {
            XCTFail("Expected .community payload, got \(content.payload)")
            return
        }
        XCTAssertEqual(community.subtype, .poll)
        XCTAssertEqual(community.poll?.options.count, 2)
        XCTAssertEqual(community.poll?.totalVotes, 30)
    }

    // MARK: - Gig (A17.6)

    private static let gigJSON = """
    {"mail":{
      "id":"m-gig","type":"gig","mail_type":"gig",
      "created_at":"2026-05-21T10:00:00Z",
      "sender_display":"Marcus T.","sender_trust":"verified_business",
      "display_title":"New bid · $65 to move your sofa Saturday","tags":[],
      "object_payload":{
        "is_accepted":false,
        "bidder":{
          "initials":"MT","name":"Marcus T.","handle":"@marcus_t",
          "blurb":"Lives on Maple St · 0.8 mi from you",
          "rating":4.9,"jobs":47,"response_time":"~12 min",
          "identity":"Personal","verified":true,
          "badges":["Moving · 24 jobs","Has truck"]
        },
        "bid":{
          "amount":65,"unit":"flat","eta":"Saturday · 9–10 AM",
          "expires":"Expires in 22h",
          "message":["Hi! I can do this Saturday morning.","$65 covers the whole job."]
        },
        "post":{
          "title":"Sofa move — garage → living room","category":"Moving",
          "posted":"2 days ago · by you","expires":"Bids close in 4 days",
          "budget":"$40–80 · flexible","schedule":"This Saturday, May 24 · morning",
          "where":"1428 Elm St","details":"One 3-seater sofa, about 7 ft.","bid_count":3
        },
        "other_bids":[
          {"id":"devon","who":"Devon R.","initials":"DR","amount":55,"rating":4.7,"jobs":18,"when":"40m ago","flag":"cheapest"},
          {"id":"sasha","who":"Sasha P.","initials":"SP","amount":80,"rating":5.0,"jobs":112,"when":"1h ago","flag":"top-rated"}
        ],
        "next_steps":[
          {"id":"accepted","label":"Bid accepted","when":"Just now","state":"active"},
          {"id":"confirm","label":"Marcus confirms","when":"Pending","state":"pending"},
          {"id":"review","label":"Review each other","when":"Within 7 days","state":"upcoming"}
        ]
      }
    }}
    """

    // MARK: - Memory

    private static let memoryJSON = """
    {"mail":{
      "id":"m-memory","type":"memory","mail_type":"memory",
      "created_at":"2026-05-19T19:42:00Z",
      "sender_display":"Mei L.","sender_trust":"pantopus_user",
      "display_title":"One year ago, you found Pepper.","tags":[],
      "object_payload":{
        "title":"One year ago, you found Pepper.",
        "reference":"Memory MEM-0518 · marked Mon May 18",
        "photo":{"caption":"Pepper, May 19 2025","label":"1 of 1 · sent by Mei"},
        "note":["It's been a year.","He's nine now.","I baked you a loaf."],
        "note_signature":"Mei (and Pepper)",
        "facts":[
          {"kind":"anniversary","label":"A year ago today","value":"Mon, May 19, 2025"},
          {"kind":"pulseThread","label":"Originally a Pulse post",
           "value":"Missing — Pepper","link_hint":"Tap to reopen the thread"},
          {"kind":"location","label":"Where it happened","value":"Redwood Trail · Stop 4"},
          {"kind":"others","label":"Others on the thread","value":"6 neighbors helped search"}
        ],
        "elf_fresh":{
          "headline":"Pantopus surfaced this memory",
          "summary":"It released to you tonight.",
          "bullets":[{"glyph":"calendar","label":"Anniversary release",
                      "text":"Mei scheduled this on May 11"}]
        },
        "elf_saved":{
          "headline":"Saved to your Vault",
          "summary":"Only you can see it.",
          "bullets":[{"glyph":"archive","label":"Mailbox vault","text":"12 items"}]
        },
        "vault":{
          "trail":[
            {"glyph":"inbox","label":"Mailbox"},
            {"glyph":"archive","label":"Vault"},
            {"glyph":"heart","label":"Memories"},
            {"glyph":"calendar","label":"2025","current":true}
          ],
          "stats":[
            {"value":"12","label":"Memories"},
            {"value":"2025","label":"Folder"},
            {"value":"Only you","label":"Visibility"}
          ]
        },
        "is_saved":false
      }
    }}
    """

    func testGigDispatchProjectsGigPayload() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.gigJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-gig", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .gig)
        XCTAssertEqual(content.trust, .verified)
        // The rich gig surface lives in the body, so the shell stays bare.
        XCTAssertNil(content.aiElf)
        XCTAssertTrue(content.keyFacts.isEmpty)
        XCTAssertTrue(content.timeline.isEmpty)
        XCTAssertEqual(content.sender.displayName, "Marcus T.")
        guard case let .gig(gig) = content.payload else {
            XCTFail("Expected .gig payload, got \(content.payload)")
            return
        }
        XCTAssertFalse(gig.isAccepted)
        XCTAssertEqual(gig.bid.amount, 65)
        XCTAssertEqual(gig.bidder.rating, 4.9, accuracy: 0.001)
        XCTAssertEqual(gig.bidder.jobs, 47)
        XCTAssertEqual(gig.post.title, "Sofa move — garage → living room")
        XCTAssertEqual(gig.otherBids.count, 2)
        XCTAssertEqual(gig.otherBids.first?.flag, "cheapest")
        XCTAssertEqual(gig.nextSteps.count, 3)
    }

    func testGigAcceptFlipsToAcceptedState() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.gigJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-gig", api: makeAPI())
        await vm.load()

        await vm.acceptGigBid()

        guard case let .loaded(content) = vm.state, case let .gig(gig) = content.payload else {
            XCTFail("Expected loaded gig, got \(vm.state)")
            return
        }
        XCTAssertTrue(gig.isAccepted, "Accepting the bid should flip the gig into its accepted state.")
        XCTAssertFalse(content.ctaEnabled)
        // Accepted state preserves the surrounding data for the timeline.
        XCTAssertEqual(gig.nextSteps.count, 3)
        XCTAssertEqual(gig.bid.amount, 65)
    }

    func testGigDecodeReturnsNilWhenRequiredFieldsMissing() {
        // Missing post.title → decode bails, body falls back to placeholder.
        let json = """
        {"bidder":{"name":"Marcus T."},"bid":{"amount":65},"post":{}}
        """
        let value = try? JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
        XCTAssertNil(GigDetailDTO.decode(from: value))
    }

    func testMemoryDispatchProjectsMemoryPayload() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.memoryJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-memory", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.category, .memory)
        XCTAssertEqual(content.trust, .verified)
        guard case let .memory(memory) = content.payload else {
            XCTFail("Expected .memory payload, got \(content.payload)")
            return
        }
        XCTAssertEqual(memory.title, "One year ago, you found Pepper.")
        XCTAssertEqual(memory.facts.count, 4)
        XCTAssertEqual(memory.note.count, 3)
        XCTAssertFalse(memory.isSaved)
        // The body owns the polaroid / note / facts / vault — the shell's
        // standard elf + key-facts slots stay empty.
        XCTAssertNil(content.aiElf)
        XCTAssertTrue(content.keyFacts.isEmpty)
        XCTAssertFalse(content.sender.showStamp)
    }

    func testMemorySaveToVaultFlipsSavedState() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.memoryJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-memory", api: makeAPI())
        await vm.load()

        // "Save to Vault" is a client-side flip — no network request.
        await vm.performPrimaryAction()
        guard case let .loaded(content) = vm.state,
              case let .memory(memory) = content.payload else {
            XCTFail("Expected loaded memory after save")
            return
        }
        XCTAssertTrue(memory.isSaved, "Save to Vault should flip the memory to saved")
    }

    // MARK: - daysUntil regression

    /// Regression: backend payloads commonly carry date-only strings
    /// (`2026-05-31`). Previously `daysUntil` only accepted full ISO
    /// timestamps, so coupon AI elf and certified countdown silently
    /// returned nil / 0. We assert a non-nil result for a date-only
    /// string and a tolerant range — the absolute integer drifts by
    /// ±1 depending on UTC time-of-day at test runtime.
    func testDaysUntilParsesDateOnlyString() {
        let dateOnly = ISO8601DateFormatter.dateOnly(daysFromNow: 5)
        let result = MailboxItemDetailViewModel.daysUntil(dateOnly)
        XCTAssertNotNil(result, "Date-only string failed to parse")
        if let result {
            XCTAssertTrue((4...5).contains(result), "Got \(result), expected 4 or 5")
        }
    }

    func testDaysUntilParsesFullTimestamp() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = Date(timeIntervalSinceNow: 3 * 86400 + 1) // +1s → guarantees >= 3 days
        let iso = formatter.string(from: date)
        XCTAssertEqual(MailboxItemDetailViewModel.daysUntil(iso), 3)
    }

    func testDaysUntilReturnsNilForGarbage() {
        XCTAssertNil(MailboxItemDetailViewModel.daysUntil("not-a-date"))
    }

    func testCertifiedPrimaryActionGatedOnAckCheckbox() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.certifiedJSON)]
        let vm = MailboxItemDetailViewModel(mailId: "m-cert", api: makeAPI())
        await vm.load()

        // Without checking the gate, the primary action must no-op.
        XCTAssertFalse(vm.certifiedAckChecked)
        await vm.performPrimaryAction()
        XCTAssertFalse(vm.ctaFlags.primaryCompleted, "Primary CTA fired without ack — should be gated.")

        // After checking, the primary action should fire and call the
        // V2 item-action endpoint with `acknowledge`.
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"message\":\"Action 'acknowledge' recorded\",\"action\":\"acknowledge\"}")
        ]
        vm.certifiedAckChecked = true
        await vm.performPrimaryAction()
        XCTAssertTrue(vm.ctaFlags.primaryCompleted)
        // Last captured request must hit /api/mailbox/v2/item/m-cert/action.
        let lastPath = SequencedURLProtocol.capturedRequests.last?.url?.path
        XCTAssertEqual(lastPath, "/api/mailbox/v2/item/m-cert/action")
    }
}
