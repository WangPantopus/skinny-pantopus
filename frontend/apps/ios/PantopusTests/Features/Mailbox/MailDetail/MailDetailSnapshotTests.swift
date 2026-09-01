//
//  MailDetailSnapshotTests.swift
//  PantopusTests
//
//  A17.1 — structural snapshots for the generic mail-detail layout.
//  These cover three category accents and the sender / subject / actions
//  slots while the project waits on pixel snapshot support for SwiftUI.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class MailDetailSnapshotTests: XCTestCase {
    func test_notice_generic_detail_renders() {
        assertRenders(makeLayout(category: .notice, title: "Notice of public hearing"))
    }

    func test_package_generic_detail_renders() {
        assertRenders(makeLayout(category: .package, title: "Package delivered to porch"))
    }

    func test_coupon_generic_detail_renders() {
        assertRenders(makeLayout(category: .coupon, title: "Neighborhood bakery coupon"))
    }

    func test_booklet_voterGuide_detail_renders() {
        assertRenders(
            makeBookletLayout(
                booklet: MailItemSampleData.bookletVoterGuide,
                title: "June 2026 primary voter guide",
                sender: "League of Women Voters",
                excerpt: "Vol. 47 · Nonpartisan · Local races and measures"
            )
        )
    }

    func test_booklet_catalog_detail_renders() {
        assertRenders(
            makeBookletLayout(
                booklet: MailItemSampleData.bookletNeighborhoodCatalog,
                title: "Spring home services booklet",
                sender: "Elm Park Merchant Guild",
                excerpt: "Seasonal repair windows and neighborhood-only pricing"
            )
        )
    }

    private func makeLayout(
        category: MailItemCategory,
        title: String
    ) -> some View {
        GenericMailDetailLayout(
            content: makeContent(category: category, title: title),
            ackInFlight: false,
            onBack: {},
            onAcknowledge: {},
            onOpenSenderProfile: { _ in },
            onSaveToVault: {}
        )
    }

    private func makeBookletLayout(
        booklet: BookletDetailDTO,
        title: String,
        sender: String,
        excerpt: String
    ) -> some View {
        BookletDetailLayout(
            content: makeBookletContent(title: title, sender: sender, excerpt: excerpt),
            booklet: booklet,
            ackInFlight: false,
            onBack: {},
            onAcknowledge: {},
            onOpenSenderProfile: { _ in },
            onSaveToVault: {}
        )
    }

    private func makeContent(
        category: MailItemCategory,
        title: String
    ) -> MailDetailContent {
        MailDetailContent(
            mailId: "mail-\(category.rawValue)",
            category: category,
            trust: .verified,
            detailTrust: category.detailTrust,
            senderDisplayName: "City of Oakland",
            senderMeta: "@oakland",
            senderTypeLabel: "Verified sender",
            carrierLine: "via Pantopus Mail",
            senderInitials: "CO",
            senderUserId: "sender-1",
            title: title,
            excerpt: "A short preview line keeps the subject block in the same shape as production mail.",
            referenceLabel: "Ref \(category.rawValue.uppercased())-2026",
            createdAtLabel: "Fri May 15, 2026",
            expiresAtLabel: nil,
            readStatusLabel: "Unread",
            bodyParagraphs: [
                "This is the first paragraph of the mail body, rendered in the category body slot.",
                "A second paragraph validates spacing before the sticky action shelf."
            ],
            attachments: ["notice.pdf"],
            aiSummary: nil,
            ackRequired: category == .notice,
            isAcknowledged: false
        )
    }

    private func makeBookletContent(
        title: String,
        sender: String,
        excerpt: String
    ) -> MailDetailContent {
        MailDetailContent(
            mailId: "mail-booklet-\(title.replacingOccurrences(of: " ", with: "-").lowercased())",
            category: .booklet,
            trust: .verified,
            detailTrust: MailItemCategory.booklet.detailTrust,
            senderDisplayName: sender,
            senderMeta: "Verified nonprofit",
            senderTypeLabel: "Verified sender",
            carrierLine: "via Pantopus Mail",
            senderInitials: sender
                .split(separator: " ")
                .prefix(2)
                .compactMap(\.first)
                .map(String.init)
                .joined(),
            senderUserId: "sender-booklet",
            title: title,
            excerpt: excerpt,
            referenceLabel: "Booklet · 2026",
            createdAtLabel: "Fri May 15, 2026",
            expiresAtLabel: nil,
            readStatusLabel: "Unread",
            bodyParagraphs: [],
            attachments: ["booklet.pdf"],
            aiSummary: "Pantopus found the key sections and can jump you to the relevant pages.",
            ackRequired: false,
            isAcknowledged: false,
            bookletDetail: nil
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: view
                .frame(width: 390, height: 1500)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1500)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
