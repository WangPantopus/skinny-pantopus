//
//  BookingPagePreviewViewModelTests.swift
//  PantopusTests
//
//  C2 · Stream I4. Verifies the public-view projection (honest paused /
//  all-hidden) and the load path against a stubbed public endpoint.
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingPagePreviewViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient() -> APIClient {
        APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    func testProjectActiveWithEventTypesRenders() {
        let state = BookingPagePreviewViewModel.project(BookingPageSampleData.publicView)
        guard case .rendered = state else { return XCTFail("expected rendered") }
    }

    func testProjectPausedIsPageOff() {
        let state = BookingPagePreviewViewModel.project(BookingPageSampleData.pausedPublicView)
        guard case let .pageOff(_, status) = state else { return XCTFail("expected pageOff") }
        XCTAssertEqual(status, .paused)
    }

    func testProjectActiveWithoutEventTypesIsAllHidden() {
        let state = BookingPagePreviewViewModel.project(BookingPageSampleData.emptyPublicView)
        guard case .allHidden = state else { return XCTFail("expected allHidden") }
    }

    func testLoadFetchesPublicView() async {
        let json = #"""
        {"page":{"slug":"maria-k","title":"Maria","timezone":"America/New_York","owner_type":"user"},
        "status":"active",
        "eventTypes":[{"id":"et_1","name":"Intro","slug":"intro","durations":[30],"default_duration":30,"location_mode":"video"}]}
        """#
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = BookingPagePreviewViewModel(owner: .personal, slug: "maria-k", api: makeClient())
        await viewModel.load()
        guard case let .rendered(_, eventTypes) = viewModel.state else { return XCTFail("expected rendered") }
        XCTAssertEqual(eventTypes.count, 1)
    }

    func testLoadPausedRendersHonestly() async {
        let json = #"""
        {"page":{"slug":"maria-k","title":"Maria","owner_type":"user"},"status":"paused","eventTypes":[]}
        """#
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = BookingPagePreviewViewModel(owner: .personal, slug: "maria-k", api: makeClient())
        await viewModel.load()
        guard case .pageOff = viewModel.state else { return XCTFail("expected pageOff") }
    }

    func testLoadFailureSurfacesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: #"{"error":"boom"}"#)]
        let viewModel = BookingPagePreviewViewModel(owner: .personal, slug: "maria-k", api: makeClient())
        await viewModel.load()
        guard case .error = viewModel.state else { return XCTFail("expected error") }
    }
}
