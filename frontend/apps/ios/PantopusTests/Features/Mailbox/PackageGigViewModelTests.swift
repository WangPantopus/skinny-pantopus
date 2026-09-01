//
//  PackageGigViewModelTests.swift
//  PantopusTests
//
//  A17.8 → "Ask a Neighbor" coverage for the package-help gig:
//    POST /api/mailbox/v2/p2/package/:mailId/gig  (`mailboxV2Phase2.js:1280`)
//

import XCTest
@testable import Pantopus

@MainActor
final class PackageGigViewModelTests: XCTestCase {
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

    private static let created = """
    {"message":"Gig created","gigId":"g-77","title":"Hold my package","preDelivery":true}
    """

    // MARK: - Options

    func test_preDeliveryHidesPostOnlyOptions() {
        let viewModel = PackageGigViewModel(mailId: "m-1", isPreDelivery: true, client: makeAPI())
        XCTAssertEqual(viewModel.options.map(\.type), [.hold, .inside, .sign])
        XCTAssertEqual(viewModel.eyebrow, "PRE-DELIVERY GIG")
    }

    func test_postDeliveryOffersEveryOption() {
        let viewModel = PackageGigViewModel(mailId: "m-1", isPreDelivery: false, client: makeAPI())
        XCTAssertEqual(viewModel.options.map(\.type), [.hold, .inside, .sign, .assembly, .custom])
        XCTAssertEqual(viewModel.eyebrow, "POST-DELIVERY GIG")
    }

    // MARK: - Submit

    func test_submitWithoutTypeAlertsAndDoesNotPost() async {
        SequencedURLProtocol.sequence = []
        let viewModel = PackageGigViewModel(mailId: "m-1", isPreDelivery: true, client: makeAPI())
        await viewModel.create()
        XCTAssertEqual(viewModel.alert?.title, "Select a type")
        XCTAssertNil(viewModel.created)
    }

    func test_successfulSubmitRendersTheCreatedGig() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.created)]
        let viewModel = PackageGigViewModel(mailId: "m-1", isPreDelivery: true, client: makeAPI())
        viewModel.select(.hold)
        await viewModel.create()
        XCTAssertEqual(viewModel.created?.gigId, "g-77")
        XCTAssertEqual(viewModel.created?.title, "Hold my package")
        XCTAssertEqual(viewModel.created?.isPreDelivery, true)
        XCTAssertNil(viewModel.alert)
    }

    func test_failedSubmitAlertsAndStaysOnTheForm() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let viewModel = PackageGigViewModel(mailId: "m-1", isPreDelivery: false, client: makeAPI())
        viewModel.select(.assembly)
        await viewModel.create()
        XCTAssertEqual(viewModel.alert?.title, "Error")
        XCTAssertNil(viewModel.created)
    }

    func test_responseWithoutGigIdIsTreatedAsFailure() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"message":"Gig created"}"#)]
        let viewModel = PackageGigViewModel(mailId: "m-1", isPreDelivery: false, client: makeAPI())
        viewModel.select(.custom)
        await viewModel.create()
        XCTAssertEqual(viewModel.alert?.title, "Error")
        XCTAssertNil(viewModel.created)
    }
}
