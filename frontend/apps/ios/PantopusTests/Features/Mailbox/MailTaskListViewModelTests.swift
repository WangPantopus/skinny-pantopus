//
//  MailTaskListViewModelTests.swift
//  PantopusTests
//
//  A17.12 (list surface) coverage for the mail-linked task list:
//    GET   /api/mailbox/v2/p3/tasks             (`mailboxV2Phase3.js:831`)
//    POST  /api/mailbox/v2/p3/tasks/from-mail   (`mailboxV2Phase3.js:886`)
//    PATCH /api/mailbox/v2/p3/tasks/:id         (`mailboxV2Phase3.js:935`)
//    POST  /api/mailbox/v2/p3/tasks/:id/to-gig  (`mailboxV2Phase3.js:977`)
//

import XCTest
@testable import Pantopus

@MainActor
final class MailTaskListViewModelTests: XCTestCase {
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

    private static let twoTasks = """
    {"active":[
      {"id":"t-1","home_id":"h-1","mail_id":"m-1","title":"Submit written comment",
       "description":"Case ZA-2026-0188","priority":"high","status":"pending",
       "mail_preview":"Notice of public hearing","mail_sender":"City of Oakland"}
    ],
     "completed":[
      {"id":"t-2","home_id":"h-1","mail_id":"m-2","title":"Pay the water bill",
       "priority":"medium","status":"completed","converted_to_gig_id":"g-9"}
    ]}
    """

    // MARK: - Load

    func test_loadSplitsActiveAndCompleted() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoTasks)]
        let viewModel = MailTaskListViewModel(client: makeAPI())
        await viewModel.load()

        guard case let .loaded(active, completed) = viewModel.state else {
            return XCTFail("Expected loaded, got \(viewModel.state)")
        }
        XCTAssertEqual(active.map(\.id), ["t-1"])
        XCTAssertEqual(completed.map(\.id), ["t-2"])
        XCTAssertEqual(active.first?.priority, .high)
        XCTAssertEqual(active.first?.mailSender, "City of Oakland")
        XCTAssertTrue(completed.first?.isConvertedToGig ?? false)
    }

    func test_emptyBothBucketsRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"active\":[],\"completed\":[]}")]
        let viewModel = MailTaskListViewModel(client: makeAPI())
        await viewModel.load()
        guard case .empty = viewModel.state else {
            return XCTFail("Expected empty, got \(viewModel.state)")
        }
    }

    func test_loadFailureRendersError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let viewModel = MailTaskListViewModel(client: makeAPI())
        await viewModel.load()
        guard case .error = viewModel.state else {
            return XCTFail("Expected error, got \(viewModel.state)")
        }
    }

    // MARK: - Mode

    func test_openedFromMailStartsInCreateFrameSeededWithSubject() {
        let viewModel = MailTaskListViewModel(
            mailId: "m-1",
            mailSubject: "Notice of public hearing",
            mailSender: "City of Oakland",
            client: makeAPI()
        )
        XCTAssertEqual(viewModel.mode, .create)
        XCTAssertEqual(viewModel.draftTitle, "Notice of public hearing")
    }

    func test_openedWithoutMailStartsInListFrame() {
        let viewModel = MailTaskListViewModel(client: makeAPI())
        XCTAssertEqual(viewModel.mode, .list)
    }

    // MARK: - Create

    func test_createRequiresATitle() async {
        let viewModel = MailTaskListViewModel(mailId: "m-1", client: makeAPI())
        viewModel.draftTitle = "   "
        await viewModel.create()
        XCTAssertEqual(viewModel.alert?.title, "Title Required")
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func test_createResolvesHomeThenPostsFromMail() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoTasks),
            .status(200, body: "{\"homes\":[{\"id\":\"h-1\",\"name\":\"Elm St\"}]}"),
            .status(200, body: """
            {"task":{"id":"t-3","home_id":"h-1","mail_id":"m-1","title":"Call the city",
                     "priority":"low","status":"pending"}}
            """)
        ]
        let viewModel = MailTaskListViewModel(mailId: "m-1", client: makeAPI())
        await viewModel.load()
        viewModel.draftTitle = "Call the city"
        viewModel.draftPriority = .low
        await viewModel.create()

        XCTAssertEqual(viewModel.mode, .list)
        guard case let .loaded(active, _) = viewModel.state else {
            return XCTFail("Expected loaded, got \(viewModel.state)")
        }
        XCTAssertEqual(active.first?.id, "t-3")

        let body = SequencedURLProtocol.capturedRequests.last?.httpBodyData() ?? Data()
        let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        XCTAssertEqual(json?["mailId"] as? String, "m-1")
        XCTAssertEqual(json?["homeId"] as? String, "h-1")
        XCTAssertEqual(json?["title"] as? String, "Call the city")
        XCTAssertEqual(json?["priority"] as? String, "low")
    }

    func test_createWithoutAHomeAlerts() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoTasks),
            .status(200, body: "{\"homes\":[]}")
        ]
        let viewModel = MailTaskListViewModel(mailId: "m-1", client: makeAPI())
        await viewModel.load()
        viewModel.draftTitle = "Call the city"
        await viewModel.create()
        XCTAssertEqual(viewModel.alert?.title, "No Home")
    }

    // MARK: - Complete / reopen

    func test_toggleMovesTheRowOptimistically() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoTasks),
            .status(200, body: "{\"task\":{\"id\":\"t-1\",\"title\":\"x\",\"status\":\"completed\"}}")
        ]
        let viewModel = MailTaskListViewModel(client: makeAPI())
        await viewModel.load()
        guard case let .loaded(active, _) = viewModel.state, let row = active.first else {
            return XCTFail("Expected loaded")
        }
        viewModel.toggle(row)
        guard case let .loaded(nextActive, nextCompleted) = viewModel.state else {
            return XCTFail("Expected loaded")
        }
        XCTAssertTrue(nextActive.isEmpty)
        XCTAssertEqual(nextCompleted.first?.id, "t-1")
        XCTAssertTrue(nextCompleted.first?.isDone ?? false)
    }

    // MARK: - Convert to gig

    func test_convertToGigBadgesTheRow() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoTasks),
            .status(200, body: "{\"gigId\":\"g-1\",\"title\":\"Submit written comment\"}")
        ]
        let viewModel = MailTaskListViewModel(client: makeAPI())
        await viewModel.load()
        guard case let .loaded(active, _) = viewModel.state, let row = active.first else {
            return XCTFail("Expected loaded")
        }
        viewModel.requestConvert(row)
        XCTAssertEqual(viewModel.convertTarget?.id, "t-1")
        await viewModel.confirmConvert()

        guard case let .loaded(nextActive, _) = viewModel.state else {
            return XCTFail("Expected loaded")
        }
        XCTAssertTrue(nextActive.first?.isConvertedToGig ?? false)
        XCTAssertNotNil(viewModel.toast)
    }

    func test_convertIsWithheldOnceTheTaskIsAlreadyAGig() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.twoTasks)]
        let viewModel = MailTaskListViewModel(client: makeAPI())
        await viewModel.load()
        guard case let .loaded(_, completed) = viewModel.state, let row = completed.first else {
            return XCTFail("Expected loaded")
        }
        viewModel.requestConvert(row)
        XCTAssertNil(viewModel.convertTarget)
    }
}

private extension URLRequest {
    /// `URLProtocol`-stubbed sessions move the body onto
    /// `httpBodyStream`; drain it so assertions don't flake. Each test file
    /// carries its own `fileprivate` copy — see
    /// `NotificationSettingsViewModelTests.swift:333`.
    func httpBodyData() -> Data? {
        if let direct = httpBody { return direct }
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }

        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }

        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
