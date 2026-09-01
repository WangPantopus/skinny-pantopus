//
//  MailItemDetailShellTests.swift
//  PantopusTests
//
//  T6.5a (P19) — Contract tests for the A17 Mailbox item detail
//  archetype shell. Asserts that:
//    - the shell renders cleanly with every slot supplied,
//    - the shell renders cleanly with only the required slots,
//    - nil optional slots (aiElf, attachments) are skipped without
//      tripping SwiftUI,
//    - the top bar payload pipes overflow menu items through.
//
//  These are construction tests — SwiftUI snapshot baselines land in
//  T6 (see `T5ScreensSnapshotTests` follow-up note). Construction
//  failures here would be compile errors anyway; the tests double as
//  living documentation for what the public API supports.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class MailItemDetailShellTests: XCTestCase {
    // MARK: - Fixtures

    private func makeTopBar(
        overflow: [MailOverflowItem] = [],
        trailingAction: MailTopBarTrailingAction? = nil
    ) -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Certified",
            trust: .verified,
            onBack: {},
            trailingAction: trailingAction,
            overflowItems: overflow
        )
    }

    private func makeAIElf() -> AIElfStripContent {
        AIElfStripContent(
            headline: "Pantopus read this for you",
            summary: "Your neighbor's hearing is June 3. You can comment in writing by May 30.",
            bullets: [
                AIElfBullet(icon: .mapPin, label: "Affects 412 Elm St", text: "next door"),
                AIElfBullet(icon: .calendar, label: "Hearing Tue Jun 3", text: "6:00 PM"),
                AIElfBullet(icon: .pencil, label: "Comments by May 30", text: "optional")
            ],
            trailingBadge: "2 min summary"
        ) {}
    }

    private func makeAttachments() -> AttachmentsRowContent {
        AttachmentsRowContent(items: [
            AttachmentItem(id: "a1", kind: .pdf, name: "Public notice ZA-2026-0188.pdf", meta: "2 pages · 84 KB"),
            AttachmentItem(id: "a2", kind: .image, name: "Site plan.jpg", meta: "1.2 MB"),
            AttachmentItem(id: "a3", kind: .video, name: "Reading.mp4", meta: "1m 22s")
        ])
    }

    // MARK: - Construction with every slot supplied

    func testShellAcceptsEverySlot() {
        let shell = MailItemDetailShell(
            topBar: makeTopBar(overflow: [
                MailOverflowItem(id: "forward", icon: .send, label: "Forward") {},
                MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {},
                MailOverflowItem(id: "delete", icon: .trash2, label: "Delete", isDestructive: true) {}
            ]),
            aiElf: makeAIElf(),
            attachments: makeAttachments()
        ) {
            Text("Hero card")
        } keyFacts: {
            Text("Key facts panel")
        } body: {
            Text("Body card")
        } sender: {
            Text("Sender card")
        } actions: {
            Text("Action buttons")
        }
        // Construct + materialise the view tree. A SwiftUI trap (missing
        // slot, wrong View constraint, etc.) would throw here.
        _ = UIHostingController(rootView: shell)
    }

    // MARK: - Required slots only (hero — no other slots)

    func testShellAcceptsOnlyHero() {
        let shell = MailItemDetailShell(
            topBar: makeTopBar()
        ) {
            Text("Just a hero")
        }
        _ = UIHostingController(rootView: shell)
    }

    // MARK: - Optional content slots default to nil and render nothing

    func testShellSkipsNilAIElfAndAttachments() {
        let shell = MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: nil,
            attachments: nil
        ) {
            Text("Hero")
        } keyFacts: {
            Text("Facts")
        } body: {
            Text("Body")
        } sender: {
            Text("Sender")
        } actions: {
            Text("Actions")
        }
        _ = UIHostingController(rootView: shell)
    }

    // MARK: - Generic view slots accept arbitrary View content

    func testShellAcceptsArbitraryViewSlots() {
        let shell = MailItemDetailShell(
            topBar: makeTopBar()
        ) {
            VStack {
                Text("Title")
                Text("Excerpt")
            }
        } keyFacts: {
            HStack { Text("Date")
                Text("Value")
            }
        } body: {
            VStack(alignment: .leading) {
                Text("Paragraph 1")
                Text("Paragraph 2")
            }
        } sender: {
            HStack {
                Circle().frame(width: 40, height: 40)
                VStack { Text("Sender name")
                    Text("Sender dept")
                }
            }
        } actions: {
            Button("Acknowledge") {}
        }
        _ = UIHostingController(rootView: shell)
    }

    // MARK: - Top bar payload

    func testTopBarPipesOverflowItems() {
        let item1 = MailOverflowItem(id: "f", icon: .send, label: "Forward") {}
        let item2 = MailOverflowItem(id: "a", icon: .archive, label: "Archive") {}
        let item3 = MailOverflowItem(id: "r", icon: .info, label: "Report") {}
        let topBar = MailTopBarConfig(
            eyebrow: "Notice",
            trust: .warning,
            onBack: {},
            overflowItems: [item1, item2, item3]
        )
        XCTAssertEqual(topBar.overflowItems.count, 3)
        XCTAssertEqual(topBar.overflowItems[2].id, "r")
        XCTAssertEqual(topBar.eyebrow, "Notice")
        XCTAssertEqual(topBar.trust, .warning)
    }

    func testTopBarTrailingActionPayload() {
        var tapped = false
        let trailing = MailTopBarTrailingAction(
            icon: .bookmark,
            accessibilityLabel: "Save to vault",
            isActive: true
        ) { tapped = true }
        XCTAssertTrue(trailing.isActive)
        XCTAssertEqual(trailing.accessibilityLabel, "Save to vault")
        trailing.handler()
        XCTAssertTrue(tapped)
    }

    // MARK: - AI elf payload defaults

    func testAIElfDefaultHeadline() {
        let elf = AIElfStripContent(summary: "Quick summary.")
        XCTAssertEqual(elf.headline, "Pantopus read this for you")
        XCTAssertTrue(elf.bullets.isEmpty)
        XCTAssertNil(elf.trailingBadge)
        XCTAssertNil(elf.onRedo)
    }

    func testAIElfCustomHeadline() {
        let elf = AIElfStripContent(
            headline: "You acknowledged this",
            summary: "Your name is on file.",
            bullets: [],
            trailingBadge: nil,
            onRedo: nil
        )
        XCTAssertEqual(elf.headline, "You acknowledged this")
    }

    func testAIElfBulletDefaultsId() {
        let bullet = AIElfBullet(icon: .calendar, label: "Hearing")
        XCTAssertFalse(bullet.id.isEmpty)
        XCTAssertNil(bullet.text)
    }

    // MARK: - Attachments payload

    func testAttachmentsKinds() {
        let kinds: [AttachmentKind] = [.pdf, .image, .video, .audio, .link, .other]
        for kind in kinds {
            let item = AttachmentItem(id: kind.id, kind: kind, name: "f")
            XCTAssertEqual(item.kind, kind)
        }
    }

    func testAttachmentsDefaultTitle() {
        let row = AttachmentsRowContent(items: [
            AttachmentItem(id: "a", kind: .pdf, name: "x.pdf")
        ])
        XCTAssertEqual(row.title, "Attachments")
        XCTAssertEqual(row.items.count, 1)
    }

    // MARK: - Trust dot color resolution

    func testTrustDotColorIsDistinctPerKind() {
        // Pure smoke — colors differ across kinds.
        let v = MailDetailTrust.verified.dotColor
        let n = MailDetailTrust.neutral.dotColor
        let w = MailDetailTrust.warning.dotColor
        let c = MailDetailTrust.celebration.dotColor
        // SwiftUI's Color isn't Equatable on raw RGB, but identity via
        // description is good enough for the smoke contract.
        XCTAssertNotEqual(String(describing: v), String(describing: n))
        XCTAssertNotEqual(String(describing: n), String(describing: w))
        XCTAssertNotEqual(String(describing: v), String(describing: w))
        XCTAssertNotEqual(String(describing: c), String(describing: v))
        XCTAssertNotEqual(String(describing: c), String(describing: w))
    }
}

private extension AttachmentKind {
    /// Stable id for the test fixture.
    var id: String {
        switch self {
        case .pdf: "pdf"
        case .image: "image"
        case .video: "video"
        case .audio: "audio"
        case .link: "link"
        case .other: "other"
        }
    }
}
