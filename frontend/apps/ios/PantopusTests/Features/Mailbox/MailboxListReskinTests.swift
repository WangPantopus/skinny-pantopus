//
//  MailboxListReskinTests.swift
//  PantopusTests
//
//  T6.5b (P20) — Asserts the new row mapping for the mailbox list
//  re-skin. Covers per-category typeIcon, trust + category chips,
//  unread highlight, and the relative-time formatter.
//

import XCTest
@testable import Pantopus

// swiftlint:disable force_try force_unwrapping

@MainActor
final class MailboxListReskinTests: XCTestCase {
    private func makeMail(
        type: String = "notice",
        mailType: String? = nil,
        viewed: Bool = false,
        displayTitle: String? = "Notice of public hearing",
        previewText: String? = "Hearing June 3."
    ) -> MailItem {
        let json = """
        {
          "id": "m1",
          "type": "\(type)",
          \(mailType.map { "\"mail_type\": \"\($0)\"," } ?? "")
          \(displayTitle.map { "\"display_title\": \"\($0)\"," } ?? "")
          \(previewText.map { "\"preview_text\": \"\($0)\"," } ?? "")
          "viewed": \(viewed),
          "archived": false,
          "starred": false,
          "tags": [],
          "priority": "normal",
          "sender_business_name": "City of Oakland",
          "created_at": "2026-05-15T12:00:00Z"
        }
        """
        let data = json.data(using: .utf8)!
        return try! JSONDecoder().decode(MailItem.self, from: data)
    }

    private func makeVM() -> MailboxListViewModel {
        MailboxListViewModel(api: APIClient.shared)
    }

    // MARK: - Per-row projection

    func testRowUsesTypeIconLeadingForCategory() {
        let vm = makeVM()
        let row = vm.row(for: makeMail(type: "package", mailType: "package"))
        guard case let .typeIcon(icon, _, _) = row.leading else {
            XCTFail("Expected typeIcon leading, got \(row.leading)")
            return
        }
        XCTAssertEqual(icon, .package)
    }

    func testRowSurfacesBodyAndChips() {
        let vm = makeVM()
        let row = vm.row(for: makeMail(type: "certified", mailType: "certified"))
        XCTAssertEqual(row.body, "Hearing June 3.")
        XCTAssertEqual(row.chips?.count, 2)
        XCTAssertEqual(row.chips?.first?.text, "Certified")
        XCTAssertEqual(row.chips?.last?.text, "Unverified")
    }

    func testRowSubtitleIsSender() {
        let vm = makeVM()
        let row = vm.row(for: makeMail())
        XCTAssertEqual(row.subtitle, "City of Oakland")
    }

    func testRowFallsBackToSubjectWhenNoDisplayTitle() {
        let vm = makeVM()
        let mail = makeMail(displayTitle: nil)
        let row = vm.row(for: mail)
        XCTAssertEqual(row.title, "Mail") // subject is also nil in fixture
    }

    func testUnviewedMailGetsUnreadHighlight() {
        let vm = makeVM()
        let unread = vm.row(for: makeMail(viewed: false))
        let read = vm.row(for: makeMail(viewed: true))
        XCTAssertEqual(unread.highlight, .unread)
        XCTAssertNil(read.highlight)
    }

    // MARK: - Relative-time formatter

    func testFormatRelativeTimeReturnsSomethingForValidISO() {
        let stamp = MailboxListViewModel.formatRelativeTime("2026-05-15T12:00:00Z")
        XCTAssertNotNil(stamp)
    }

    func testFormatRelativeTimeReturnsNilForInvalid() {
        XCTAssertNil(MailboxListViewModel.formatRelativeTime("not-a-date"))
    }

    // MARK: - MailItemCategory icon mapping

    func testCategoryIconResolvesPerType() {
        XCTAssertEqual(MailItemCategory.package.icon, .package)
        XCTAssertEqual(MailItemCategory.coupon.icon, .tag)
        XCTAssertEqual(MailItemCategory.booklet.icon, .fileText)
        XCTAssertEqual(MailItemCategory.certified.icon, .badgeCheck)
        XCTAssertEqual(MailItemCategory.bill.icon, .receipt)
        XCTAssertEqual(MailItemCategory.legal.icon, .gavel)
        XCTAssertEqual(MailItemCategory.general.icon, .mailbox)
    }

    func testCategoryLabelMatchesEnum() {
        XCTAssertEqual(MailItemCategory.notice.label, "Notice")
        XCTAssertEqual(MailItemCategory.booklet.label, "Booklet")
        XCTAssertEqual(MailItemCategory.certified.label, "Certified")
    }

    // MARK: - Trust → detail trust collapse

    func testTrustCollapsesToDetailTrust() {
        XCTAssertEqual(MailTrust.verified.detailTrust, .verified)
        XCTAssertEqual(MailTrust.partial.detailTrust, .warning)
        XCTAssertEqual(MailTrust.unverified.detailTrust, .neutral)
        XCTAssertEqual(MailTrust.chain.detailTrust, .verified)
    }
}
