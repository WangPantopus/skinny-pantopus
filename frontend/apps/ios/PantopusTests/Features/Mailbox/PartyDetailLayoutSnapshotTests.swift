//
//  PartyDetailLayoutSnapshotTests.swift
//  PantopusTests
//
//  A17.9 - Party mail variant. Structural render coverage for the open
//  invite + going states, plus a fixture-shape guard so the deterministic
//  sample data stays aligned with the design hand-off.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class PartyDetailLayoutSnapshotTests: XCTestCase {
    func test_party_openInvite_renders() {
        assertRenders(layout(for: MailItemSampleData.partyInvite))
    }

    func test_party_going_renders() {
        assertRenders(layout(for: MailItemSampleData.partyInviteGoing))
    }

    func test_party_fixture_shapes_matchA179() {
        let invite = MailItemSampleData.partyInvite
        XCTAssertEqual(invite.event.date.dayLabel, "SAT")
        XCTAssertEqual(invite.event.date.monthLabel, "MAY")
        XCTAssertEqual(invite.event.date.dayNumber, "24")
        XCTAssertEqual(invite.bringList.count, 4)
        XCTAssertEqual(invite.goingAttendees.count, 5)
        XCTAssertEqual(invite.maybeCount, 1)
        XCTAssertEqual(invite.rsvp, .undecided)
        XCTAssertEqual(invite.elfOpen.bullets.count, 3)
        XCTAssertEqual(invite.elfGoing.bullets.count, 3)
        XCTAssertEqual(invite.note.signature, "Priya x")

        let going = MailItemSampleData.partyInviteGoing
        XCTAssertEqual(going.rsvp, .going)
        XCTAssertEqual(going.plusOneCount, 1)
        XCTAssertEqual(going.bringList.first?.claimedBy, "You")
        XCTAssertNotNil(going.rsvpConfirmedAtLabel)
        // Going state headcount: 5 friends + 2 friend plus-ones + you + your +1 = 9
        XCTAssertEqual(going.headcount, 9)
    }

    private func layout(for party: PartyDetailDTO) -> PartyDetailLayout {
        PartyDetailLayout(
            content: makeContent(party: party),
            party: party,
            rsvpInFlight: false,
            onBack: {},
            onSetRsvp: { _ in },
            onAdjustPlusOne: { _ in },
            onClaimBring: { _ in },
            onReleaseBring: { _ in },
            onOpenSenderProfile: nil
        )
    }

    private func makeContent(party: PartyDetailDTO) -> MailDetailContent {
        MailDetailContent(
            mailId: "party-test",
            category: .party,
            trust: .verified,
            detailTrust: .celebration,
            senderDisplayName: party.host.name,
            senderMeta: party.host.blurb,
            senderTypeLabel: "Pantopus user",
            carrierLine: "via Pantopus Mail",
            senderInitials: party.host.initials,
            senderUserId: "user-priya",
            title: party.event.what,
            excerpt: nil,
            referenceLabel: "Invite EVT-0517 - 12 invited - personal",
            createdAtLabel: "Wed May 21, 2026",
            expiresAtLabel: nil,
            readStatusLabel: party.rsvp == .going ? "Read" : "Unread",
            bodyParagraphs: [],
            attachments: [],
            aiSummary: nil,
            ackRequired: false,
            isAcknowledged: party.rsvp == .going,
            partyDetail: party
        )
    }

    private func assertRenders(
        _ view: PartyDetailLayout,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: view
                .frame(width: 390, height: 2400)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 2400)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
