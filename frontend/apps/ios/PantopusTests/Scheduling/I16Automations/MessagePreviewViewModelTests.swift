//
//  MessagePreviewViewModelTests.swift
//  PantopusTests
//
//  Stream I16 — H7 Message Preview projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class MessagePreviewViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeClient() -> SchedulingClient {
        SchedulingClient(client: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        ))
    }

    func testDraftPreviewFillsFromBackend() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"subject":"Hi Sam R.","body":"Hello Maria K., see you soon."}"#)
        ]
        let vm = MessagePreviewViewModel(
            owner: .personal,
            source: .draft(subject: "Hi {{host_name}}", body: "Hello {{attendee_name}}, see you soon.", channel: .email),
            client: makeClient()
        )
        await vm.load()
        guard case .loaded = vm.phase else { return XCTFail("expected loaded") }
        XCTAssertEqual(vm.filledBody, "Hello Maria K., see you soon.")
        XCTAssertEqual(vm.activeChannel, .email)
    }

    func testPreviewFallsBackToLocalInterpolation() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = MessagePreviewViewModel(
            owner: .personal,
            source: .draft(subject: nil, body: "Hello {{attendee_name}}", channel: .push),
            client: makeClient()
        )
        await vm.load()
        guard case .loaded = vm.phase else { return XCTFail("expected loaded even on preview failure") }
        XCTAssertEqual(vm.filledBody, "Hello Maria K.")
    }

    func testInterpolateReplacesAllTokens() {
        let filled = MessagePreviewViewModel.interpolate(
            "{{a}} and {{b}}",
            with: ["a": "X", "b": "Y"]
        )
        XCTAssertEqual(filled, "X and Y")
    }
}
