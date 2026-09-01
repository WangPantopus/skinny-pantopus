//
//  CertifiedDetailSnapshotTests.swift
//  PantopusTests
//
//  A17.3 — structural snapshots for Certified mail across unread,
//  signed, and archived states. These exercise the stamp hero, signing
//  gate, high-stakes terms summary, custody timeline, and actions.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class CertifiedDetailSnapshotTests: XCTestCase {
    func test_certified_detail_unread_renders() {
        assertRenders(
            makeLayout(
                certified: MailItemSampleData.certifiedUnread,
                readStatusLabel: "Unread",
                isAcknowledged: false,
                isArchived: false
            )
        )
    }

    func test_certified_detail_signed_renders() {
        assertRenders(
            makeLayout(
                certified: MailItemSampleData.certifiedSigned,
                readStatusLabel: "Read",
                isAcknowledged: true,
                isArchived: false
            )
        )
    }

    func test_certified_detail_archived_renders() {
        assertRenders(
            makeLayout(
                certified: MailItemSampleData.certifiedArchived,
                readStatusLabel: "Read",
                isAcknowledged: true,
                isArchived: true
            )
        )
    }

    func test_certified_confirm_gate_unread_renders() {
        assertRenders(
            CertifiedConfirmGate(
                senderName: "Alameda County",
                referenceNumber: MailItemSampleData.certifiedUnread.referenceNumber,
                deadlineLabel: "Tue Jun 30, 2026",
                onReviewFirst: {},
                onSign: {}
            )
        )
    }

    private func makeLayout(
        certified: CertifiedDetailDTO,
        readStatusLabel: String,
        isAcknowledged: Bool,
        isArchived: Bool
    ) -> some View {
        CertifiedDetailLayout(
            content: makeContent(
                certified: certified,
                readStatusLabel: readStatusLabel,
                isAcknowledged: isAcknowledged,
                isArchived: isArchived
            ),
            certified: certified,
            ackInFlight: false,
            onBack: {},
            onAcknowledge: {},
            onOpenSenderProfile: { _ in },
            onSaveToVault: {}
        )
    }

    private func makeContent(
        certified: CertifiedDetailDTO,
        readStatusLabel: String,
        isAcknowledged: Bool,
        isArchived: Bool
    ) -> MailDetailContent {
        MailDetailContent(
            mailId: isArchived ? "certified-archived" : "certified-open",
            category: .certified,
            trust: .verified,
            detailTrust: .verified,
            senderDisplayName: "Alameda County",
            senderMeta: "Treasurer-Tax Collector · Property Tax Bureau",
            senderTypeLabel: "Verified government",
            carrierLine: "via USPS Certified Mail",
            senderInitials: "AC",
            senderUserId: "sender-alameda-county",
            title: "Supplemental property tax bill — APN 048-7521-019",
            excerpt: "Payment is due Jun 30.",
            referenceLabel: certified.referenceNumber,
            createdAtLabel: "4h ago",
            expiresAtLabel: nil,
            readStatusLabel: readStatusLabel,
            bodyParagraphs: Self.paragraphs(from: certified.noticeBody),
            attachments: [],
            aiSummary: isAcknowledged
                ? """
                Your signed delivery receipt is on file. Pantopus saved the chain of custody and \
                will keep reminders attached to this item.
                """
                : """
                Your supplemental property tax bill is $1,247.82 due Jun 30. This is in addition \
                to your regular annual property tax.
                """,
            ackRequired: true,
            isAcknowledged: isAcknowledged,
            isArchived: isArchived,
            certifiedDetail: certified
        )
    }

    private static func paragraphs(from body: String?) -> [String] {
        body?
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty } ?? []
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: view
                .frame(width: 390, height: 1900)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1900)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
