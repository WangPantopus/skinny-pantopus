//
//  MailRoutingQueueViewModelTests.swift
//  PantopusTests
//
//  Coverage for the mail routing queue behind the Mailbox root's
//  "N items need routing" banner:
//    GET  /api/mailbox/v2/pending  (`backend/routes/mailboxV2.js:612`)
//    POST /api/mailbox/v2/resolve  (`backend/routes/mailboxV2.js:555`)
//

import XCTest
@testable import Pantopus

@MainActor
final class MailRoutingQueueViewModelTests: XCTestCase {
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

    private static let twoPending = """
    {"pending":[
      {"mail_id":"m-1","home_id":"h-1","recipient_name_raw":"M. Kovacs",
       "Mail":{"subject":"Water bill","preview_text":"Due soon","sender_display":"EBMUD"}},
      {"mail_id":"m-2","home_id":"h-1","recipient_name_raw":"Marcus K",
       "Mail":{"subject":"Notice","sender_business_name":"City of Elm Park"}}
    ]}
    """

    func test_emptyQueueRendersAllClear() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"pending\":[]}")]
        let vm = MailRoutingQueueViewModel(api: makeAPI())
        await vm.load()

        guard case .empty = vm.state else {
            return XCTFail("Expected empty, got \(vm.state)")
        }
        XCTAssertNil(vm.counterLabel)
    }

    func test_loadProjectsFirstItemAndCounter() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPending)]
        let vm = MailRoutingQueueViewModel(api: makeAPI())
        await vm.load()

        guard case let .loaded(entry) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(entry.id, "m-1")
        XCTAssertEqual(entry.recipientName, "M. Kovacs")
        XCTAssertEqual(entry.senderDisplay, "EBMUD")
        XCTAssertEqual(entry.previewText, "Due soon")
        XCTAssertEqual(vm.counterLabel, "1 of 2")
        XCTAssertFalse(vm.canSubmit, "Nothing picked yet")
    }

    func test_aliasToggleOnlyOfferedForPersonalDrawer() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoPending)]
        let vm = MailRoutingQueueViewModel(api: makeAPI())
        await vm.load()

        vm.select(.home)
        XCTAssertFalse(vm.showsAliasToggle)
        vm.select(.personal)
        XCTAssertTrue(vm.showsAliasToggle)
        XCTAssertEqual(vm.aliasLabel, "Add \u{201C}M. Kovacs\u{201D} as my alias")
    }

    func test_resolveAdvancesToNextItem() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPending),
            .status(200, body: "{\"message\":\"Routing resolved\",\"drawer\":\"home\"}")
        ]
        let vm = MailRoutingQueueViewModel(api: makeAPI())
        await vm.load()
        vm.select(.home)
        XCTAssertTrue(vm.canSubmit)
        await vm.submit()

        guard case let .loaded(entry) = vm.state else {
            return XCTFail("Expected the next queued item, got \(vm.state)")
        }
        XCTAssertEqual(entry.id, "m-2")
        XCTAssertEqual(vm.counterLabel, "2 of 2")
        XCTAssertNil(vm.selection, "Selection resets for the next card")
        XCTAssertFalse(vm.shouldDismiss)
    }

    func test_resolvingLastItemRequestsDismiss() async {
        let onePending = """
        {"pending":[{"mail_id":"m-1","recipient_name_raw":"M. Kovacs","Mail":{"subject":"Water bill"}}]}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: onePending),
            .status(200, body: "{\"message\":\"Routing resolved\",\"drawer\":\"personal\"}")
        ]
        let vm = MailRoutingQueueViewModel(api: makeAPI())
        await vm.load()
        vm.select(.personal)
        await vm.submit()

        XCTAssertTrue(vm.shouldDismiss)
    }

    func test_resolveFailureSurfacesToastAndKeepsItem() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoPending),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = MailRoutingQueueViewModel(api: makeAPI())
        await vm.load()
        vm.select(.business)
        await vm.submit()

        guard case let .loaded(entry) = vm.state else {
            return XCTFail("Expected the item to stay, got \(vm.state)")
        }
        XCTAssertEqual(entry.id, "m-1")
        XCTAssertNotNil(vm.toast)
    }

    func test_fetchFailureSurfacesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MailRoutingQueueViewModel(api: makeAPI())
        await vm.load()

        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }
}
