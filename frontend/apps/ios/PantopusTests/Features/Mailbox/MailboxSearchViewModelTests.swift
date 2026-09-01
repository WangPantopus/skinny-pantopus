//
//  MailboxSearchViewModelTests.swift
//  PantopusTests
//
//  P4.2 — Covers the Mailbox Search VM:
//    - corpus loads once; isLoading clears on settle (success + failure)
//    - blank query → no results (shell falls back to recent/empty)
//    - matching across sender / subject / body / category (case-insensitive)
//    - result rows reuse the Mailbox list row projection
//    - result taps route to the mail id
//    - the view materialises in each render phase
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class MailboxSearchViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func mail(
        id: String = "m1",
        type: String = "general",
        mailType: String? = nil,
        subject: String? = nil,
        displayTitle: String? = nil,
        previewText: String? = nil,
        content: String? = nil,
        sender: String? = nil
    ) -> MailItem {
        let fields: [(String, String)?] = [
            mailType.map { ("mail_type", $0) },
            subject.map { ("subject", $0) },
            displayTitle.map { ("display_title", $0) },
            previewText.map { ("preview_text", $0) },
            content.map { ("content", $0) },
            sender.map { ("sender_business_name", $0) }
        ]
        let extras = fields.compactMap { $0 }.map { "\"\($0.0)\":\"\($0.1)\"," }.joined()
        let json = """
        {
          "id": "\(id)", "type": "\(type)", \(extras)
          "viewed": false, "archived": false, "starred": false,
          "tags": [], "priority": "normal",
          "created_at": "2026-05-15T12:00:00Z"
        }
        """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(MailItem.self, from: Data(json.utf8))
    }

    /// Build a `{ "mail": [...], "count": N }` response body.
    private func body(_ items: [MailItem]) -> String {
        let rows = items
            .map { m -> String in
                var parts = ["\"id\":\"\(m.id)\"", "\"type\":\"\(m.type)\""]
                if let v = m.mailType { parts.append("\"mail_type\":\"\(v)\"") }
                if let v = m.subject { parts.append("\"subject\":\"\(v)\"") }
                if let v = m.displayTitle { parts.append("\"display_title\":\"\(v)\"") }
                if let v = m.previewText { parts.append("\"preview_text\":\"\(v)\"") }
                if let v = m.content { parts.append("\"content\":\"\(v)\"") }
                if let v = m.senderBusinessName { parts.append("\"sender_business_name\":\"\(v)\"") }
                parts.append("\"viewed\":false,\"archived\":false,\"starred\":false")
                parts.append("\"tags\":[],\"priority\":\"normal\"")
                parts.append("\"created_at\":\"2026-05-15T12:00:00Z\"")
                return "{\(parts.joined(separator: ","))}"
            }
            .joined(separator: ",")
        return "{\"mail\":[\(rows)],\"count\":\(items.count)}"
    }

    /// m1 — sender "City of Oakland", subject "Water bill", category bill
    /// m2 — sender "Maria Kovacs", body "Booklet enclosed", category booklet
    /// m3 — sender "Acme Insurance", subject "Policy renewal", category insurance
    private func corpus() -> [MailItem] {
        [
            mail(
                id: "m1",
                type: "bill",
                mailType: "bill",
                subject: "Water bill",
                previewText: "Due June 1",
                sender: "City of Oakland"
            ),
            mail(
                id: "m2",
                type: "booklet",
                mailType: "booklet",
                displayTitle: "Welcome packet",
                previewText: "Booklet enclosed",
                sender: "Maria Kovacs"
            ),
            mail(
                id: "m3",
                type: "insurance",
                mailType: "insurance",
                subject: "Policy renewal",
                previewText: "Renew by July",
                sender: "Acme Insurance"
            )
        ]
    }

    private func loadedVM(
        onOpenMail: @escaping @Sendable (String) -> Void = { _ in }
    ) async -> MailboxSearchViewModel {
        SequencedURLProtocol.sequence = [.status(200, body: body(corpus()))]
        let vm = MailboxSearchViewModel(api: makeAPI(), onOpenMail: onOpenMail)
        await vm.load()
        return vm
    }

    // MARK: - Pure search

    func testMatchesBySender() {
        let m = mail(sender: "City of Oakland")
        XCTAssertTrue(MailboxSearchViewModel.matches(m, query: "oakland"))
        XCTAssertTrue(MailboxSearchViewModel.matches(m, query: "CITY"))
        XCTAssertFalse(MailboxSearchViewModel.matches(m, query: "berkeley"))
    }

    func testMatchesBySubjectAndBody() {
        let m = mail(subject: "Water bill", previewText: "Booklet enclosed")
        XCTAssertTrue(MailboxSearchViewModel.matches(m, query: "water"))
        XCTAssertTrue(MailboxSearchViewModel.matches(m, query: "enclosed"))
    }

    func testMatchesByCategoryLabel() {
        // mail_type "insurance" → category label "Insurance".
        let m = mail(type: "insurance", mailType: "insurance", subject: "Policy")
        XCTAssertTrue(MailboxSearchViewModel.matches(m, query: "insurance"))
    }

    func testFilterBlankQueryYieldsEmpty() {
        let items = corpus()
        XCTAssertTrue(MailboxSearchViewModel.filter(items, query: "").isEmpty)
        XCTAssertTrue(MailboxSearchViewModel.filter(items, query: "   ").isEmpty)
    }

    func testFilterReturnsOnlyMatches() {
        XCTAssertEqual(MailboxSearchViewModel.filter(corpus(), query: "policy").map(\.id), ["m3"])
    }

    // MARK: - Load + query lifecycle

    func testInitialStateIsLoadingWithNoResults() {
        let vm = MailboxSearchViewModel(api: makeAPI())
        XCTAssertTrue(vm.isLoading)
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testLoadClearsLoadingAndKeepsResultsEmptyForBlankQuery() async {
        let vm = await loadedVM()
        XCTAssertFalse(vm.isLoading)
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testQueryFiltersLoadedCorpus() async {
        let vm = await loadedVM()
        vm.query = "oakland"
        XCTAssertEqual(vm.results.map(\.id), ["m1"])
        vm.query = "booklet"
        XCTAssertEqual(vm.results.map(\.id), ["m2"])
        vm.query = "zzzzz"
        XCTAssertTrue(vm.results.isEmpty)
        vm.query = ""
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testLoadFailureLeavesEmptyResults() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MailboxSearchViewModel(api: makeAPI())
        await vm.load()
        XCTAssertFalse(vm.isLoading)
        vm.query = "oakland"
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testRowModelReusesMailboxRow() async {
        let vm = await loadedVM()
        vm.query = "oakland"
        guard let match = vm.results.first else {
            return XCTFail("Expected a result")
        }
        let row = vm.rowModel(for: match)
        XCTAssertEqual(row.title, "Water bill")
        XCTAssertEqual(row.chips?.first?.text, "Bill") // reused category chip
        if case .typeIcon = row.leading {} else {
            XCTFail("Expected reused typeIcon leading")
        }
    }

    func testRowTapRoutesToMail() async {
        final class Captured: @unchecked Sendable { var id: String? }
        let captured = Captured()
        let vm = await loadedVM { captured.id = $0 }
        vm.query = "oakland"
        vm.rowModel(for: vm.results[0]).onTap()
        XCTAssertEqual(captured.id, "m1")
    }

    // MARK: - View construction per phase

    func testViewConstructsWhileLoading() {
        let vm = MailboxSearchViewModel(api: makeAPI())
        _ = UIHostingController(rootView: NavigationStack { MailboxSearchView(viewModel: vm) })
    }

    func testViewConstructsPopulated() async {
        let vm = await loadedVM()
        vm.query = "oakland"
        _ = UIHostingController(rootView: NavigationStack { MailboxSearchView(viewModel: vm) })
    }

    func testViewConstructsEmpty() async {
        let vm = await loadedVM()
        vm.query = "zzzzz"
        _ = UIHostingController(rootView: NavigationStack { MailboxSearchView(viewModel: vm) })
    }
}
