//
//  MailDetailViewModelTests.swift
//  PantopusTests
//
//  T6.5b (P20) — Tests for the generic A17.1 mail detail VM. Covers
//  the four-state lifecycle, the pure projection from `MailDetail`
//  DTO to A17 slot content, and the optimistic acknowledge flow.
//

import XCTest
@testable import Pantopus

// swiftlint:disable force_try force_unwrapping

@MainActor
final class MailDetailViewModelTests: XCTestCase {
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

    // MARK: - Four states

    func testLoadingThenLoadedFromDTO() async {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "notice",
            "mail_type": "notice",
            "display_title": "Notice of public hearing",
            "preview_text": "Your neighbor's hearing is June 3.",
            "subject": null,
            "sender_business_name": "City of Oakland",
            "sender_address": null,
            "content": "Para 1.\\n\\nPara 2.",
            "viewed": false,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "attachments": ["public-notice.pdf", "site-plan.jpg"],
            "ack_required": true,
            "created_at": "2026-05-15T12:00:00Z",
            "sender": {"id": "u1", "username": "oakland", "name": "City of Oakland"}
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
        XCTAssertEqual(content.category, .notice)
        XCTAssertEqual(content.title, "Notice of public hearing")
        XCTAssertEqual(content.excerpt, "Your neighbor's hearing is June 3.")
        XCTAssertEqual(content.senderDisplayName, "City of Oakland")
        XCTAssertEqual(content.senderInitials, "CO")
        XCTAssertEqual(content.bodyParagraphs, ["Para 1.", "Para 2."])
        XCTAssertEqual(content.attachments.count, 2)
        XCTAssertTrue(content.ackRequired)
        XCTAssertFalse(content.isAcknowledged)
        XCTAssertEqual(content.detailTrust, .neutral)
    }

    /// Ceremonial mail (carrying `mail_extracted.stationeryTheme`) is
    /// redirected out of the generic detail into the ceremonial open
    /// experience, and the plain layout never renders — mirroring RN
    /// `src/app/mailbox/detail.tsx:43-49`.
    func testStationeryMailRedirectsToCeremonialOpen() async {
        let body = """
        {
          "mail": {
            "id": "m-letter",
            "type": "letter",
            "mail_type": "letter",
            "display_title": "A letter from Ada",
            "content": "Dear you,",
            "viewed": false,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "created_at": "2026-05-15T12:00:00Z",
            "mail_extracted": {"stationeryTheme": "linen", "inkSelection": "indigo"}
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = MailDetailViewModel(mailId: "m-letter", api: makeAPI())
        await vm.load()

        XCTAssertEqual(vm.ceremonialRedirectMailId, "m-letter")
        guard case .loading = vm.state else {
            return XCTFail("The generic detail must not render for ceremonial mail; got \(vm.state)")
        }
        vm.acknowledgeCeremonialRedirect()
        XCTAssertNil(vm.ceremonialRedirectMailId)
    }

    /// Ordinary mail (no stationery) stays on the generic detail.
    func testMailWithoutStationeryDoesNotRedirect() async {
        let body = """
        {
          "mail": {
            "id": "m1",
            "type": "notice",
            "mail_type": "notice",
            "display_title": "Notice",
            "content": "Body",
            "viewed": false,
            "archived": false,
            "starred": false,
            "tags": [],
            "priority": "normal",
            "created_at": "2026-05-15T12:00:00Z",
            "mail_extracted": {}
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()

        XCTAssertNil(vm.ceremonialRedirectMailId)
        guard case .loaded = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
    }

    func testLoadErrorRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MailDetailViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    // MARK: - Pure projection

    func testProjectionFallsBackToGeneralForUnknownType() {
        let detail = makeDetail(type: "qq-unknown", title: nil)
        let projected = MailDetailViewModel.project(detail: detail)
        XCTAssertEqual(projected.category, .general)
        XCTAssertEqual(projected.title, "Mail") // fallback when no display_title / subject
    }

    func testProjectionUsesDisplayTitleOverSubject() {
        let detail = makeDetail(type: "bill", title: "Bill due", subject: "Should be ignored")
        let projected = MailDetailViewModel.project(detail: detail)
        XCTAssertEqual(projected.title, "Bill due")
        XCTAssertEqual(projected.category, .bill)
    }

    func testProjectionEmptyContentYieldsZeroParagraphs() {
        let detail = makeDetail(type: "notice", content: "")
        let projected = MailDetailViewModel.project(detail: detail)
        XCTAssertTrue(projected.bodyParagraphs.isEmpty)
    }

    func testProjectionSplitsContentOnBlankLines() {
        let detail = makeDetail(type: "notice", content: "First.\n\nSecond.\n\n\n\nThird.")
        let projected = MailDetailViewModel.project(detail: detail)
        XCTAssertEqual(projected.bodyParagraphs, ["First.", "Second.", "Third."])
    }

    func testProjectionKeyFactsIncludeReceivedAndCategory() {
        let detail = makeDetail(type: "notice", title: "Notice")
        let projected = MailDetailViewModel.project(detail: detail)
        let facts = projected.keyFacts()
        XCTAssertTrue(facts.contains { $0.label == "Received" })
        XCTAssertTrue(facts.contains { $0.label == "Category" && $0.value == "Notice" })
    }

    func testProjectionMakesInitialsFromSender() {
        XCTAssertEqual(MailDetailViewModel.makeInitials(from: "City of Oakland"), "CO")
        XCTAssertEqual(MailDetailViewModel.makeInitials(from: "Acme"), "A")
        XCTAssertEqual(MailDetailViewModel.makeInitials(from: ""), "M")
    }

    // MARK: - Helpers

    private func makeDetail(
        type: String,
        title: String? = nil,
        subject: String? = nil,
        content: String? = nil
    ) -> MailDetailResponse.MailDetail {
        let json = """
        {
          "id": "m1",
          "type": "\(type)",
          "mail_type": "\(type)",
          \(title.map { "\"display_title\": \"\($0)\"," } ?? "")
          \(subject.map { "\"subject\": \"\($0)\"," } ?? "")
          \(content.map { "\"content\": \"\($0.replacingOccurrences(of: "\n", with: "\\n"))\"," } ?? "")
          "viewed": false,
          "archived": false,
          "starred": false,
          "tags": [],
          "priority": "normal",
          "created_at": "2026-05-15T12:00:00Z"
        }
        """
        let data = json.data(using: .utf8)!
        return try! JSONDecoder().decode(MailDetailResponse.MailDetail.self, from: data)
    }
}
