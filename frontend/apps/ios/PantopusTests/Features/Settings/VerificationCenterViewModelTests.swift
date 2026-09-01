//
//  VerificationCenterViewModelTests.swift
//  PantopusTests
//
//  Covers the verified / unverified projections and the optimistic
//  resend-verification flow.
//

import XCTest
@testable import Pantopus

@MainActor
final class VerificationCenterViewModelTests: XCTestCase {
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

    private static let verifiedJSON = """
    {"private_account":{"id":"u_test","email":"a@b.co","name":"A","verified":true},
     "local_profile":null,"audience_profile":null,"bridges":null,
     "homes":null,"business_profiles":null,"persona_count":0,
     "block_counts":null}
    """

    private static let unverifiedJSON = """
    {"private_account":{"id":"u_test","email":"a@b.co","name":"A","verified":false},
     "local_profile":null,"audience_profile":null,"bridges":null,
     "homes":null,"business_profiles":null,"persona_count":0,
     "block_counts":null}
    """

    func testLoadVerifiedShowsSingleEmailRow() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.verifiedJSON)]
        let vm = VerificationCenterViewModel(api: makeAPI(), auth: AuthManager.previewSignedIn)
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let emailGroup = groups.first { $0.id == "email" }
        XCTAssertEqual(emailGroup?.rows.count, 1, "Verified email shows only the status row, no resend.")
        if case let .chipStatus(label, tone, _) = emailGroup?.rows.first?.control {
            XCTAssertEqual(label, "Verified")
            XCTAssertEqual(tone, .success)
        } else {
            XCTFail("Expected chipStatus on email row")
        }
        // The "Phone" and "Home address" groups were display-only "Coming soon"
        // placeholders and were removed in 76db2882 (WS5.2) on both platforms;
        // this assertion was never updated to match.
        XCTAssertEqual(groups.map(\.id), ["email", "photoid"])
    }

    func testLoadUnverifiedShowsResendRow() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.unverifiedJSON)]
        let vm = VerificationCenterViewModel(api: makeAPI(), auth: AuthManager.previewSignedIn)
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let emailGroup = groups.first { $0.id == "email" }
        XCTAssertEqual(emailGroup?.rows.count, 2)
        XCTAssertEqual(emailGroup?.rows.last?.id, "email.resend")
    }

    func testResendOnSuccessUpdatesLabel() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.unverifiedJSON),
            .status(200, body: "{\"message\":\"Verification email sent\"}")
        ]
        let vm = VerificationCenterViewModel(api: makeAPI(), auth: AuthManager.previewSignedIn)
        await vm.load()
        await vm.tapRow("email.resend")
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded after resend")
            return
        }
        let resend = groups.first { $0.id == "email" }?.rows.first { $0.id == "email.resend" }
        XCTAssertEqual(resend?.label, "Sent — check your inbox")
    }
}
