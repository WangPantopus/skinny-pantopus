//
//  PrivacyHandshakeViewModelTests.swift
//  PantopusTests
//
//  Covers the T3.4 Privacy Handshake VM: load → ready/alreadyMember/
//  error, handle validation gates the primary CTA, tier-1 submit
//  succeeds → completedFree, tier > 1 submit returns subscribeUrl
//  → opensCheckout, 409 fan_handle_taken sticks to the handle row,
//  400 pantopus_username_requires_ack flips the username toggle.
//

import XCTest
@testable import Pantopus

@MainActor
final class PrivacyHandshakeViewModelTests: XCTestCase {
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

    private static let personaJSON = """
    {"persona":{
      "id":"p_demo","handle":"mayabuilds","displayName":"Maya Builds",
      "bio":"Builder.","audienceLabel":"followers","followerCount":12,"postCount":7
    },"channel":null}
    """

    private static let tiersJSON = """
    {"tiers":[
      {"id":"t1","rank":1,"name":"Followers","priceCents":0,"currency":"usd"},
      {"id":"t2","rank":2,"name":"Members","priceCents":500,"currency":"usd"}
    ]}
    """

    private static let suggestionJSON = """
    {"suggestion":"fan_8a2c41","locked":false}
    """

    private static let suggestionLockedJSON = """
    {"suggestion":"alreadybound","locked":true,
     "identity":{"id":"ai1","handle":"alreadybound","displayName":"Already Bound"}}
    """

    private static let followStatusNoneJSON = """
    {"following":false,"status":"none"}
    """

    private static let followStatusActiveJSON = """
    {"following":true,"status":"active","relationshipType":"follower"}
    """

    private func loadedSequence(
        suggestion: String = suggestionJSON,
        followStatus: String = followStatusNoneJSON
    ) -> [SequencedURLProtocol.Response] {
        [
            .status(200, body: Self.personaJSON),
            .status(200, body: Self.tiersJSON),
            .status(200, body: suggestion),
            .status(200, body: followStatus)
        ]
    }

    func testLoadProjectsReadyWithSuggestionPrefilled() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        guard case let .ready(content) = vm.state else {
            XCTFail("Expected .ready, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.persona.displayName, "Maya Builds")
        XCTAssertEqual(content.handle.value, "fan_8a2c41")
        XCTAssertEqual(content.handle.locked, false)
        XCTAssertEqual(content.tierOptions.count, 2)
        XCTAssertEqual(content.selectedTierRank, 1)
        XCTAssertEqual(content.step, .handleEntry)
    }

    func testLoadWithLockedSuggestionMarksFieldReadOnly() async {
        SequencedURLProtocol.sequence = loadedSequence(suggestion: Self.suggestionLockedJSON)
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        XCTAssertEqual(content.handle.value, "alreadybound")
        XCTAssertTrue(content.handle.locked)
    }

    func testActiveFollowStatusJumpsStraightToAlreadyMember() async {
        SequencedURLProtocol.sequence = loadedSequence(followStatus: Self.followStatusActiveJSON)
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        XCTAssertEqual(content.step, .alreadyMember)
    }

    func testLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(404, body: "{\"error\":\"Beacon not found\"}")]
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else { XCTFail("Expected .error")
            return
        }
    }

    func testHandleValidationGatesPrimaryCTA() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        vm.setHandle("a") // 1 char, too short
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.setHandle("invalid handle!") // contains spaces + bang
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.setHandle("valid_handle.42")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testPrimaryTapAdvancesToTierSelection() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        vm.primaryTapped() // step 1 → 2
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        XCTAssertEqual(content.step, .tierSelection)
        XCTAssertEqual(vm.chrome.progressLabel, .stepOf(current: 2, total: 2))
    }

    func testTierSelectionDrivesPrimaryCTALabel() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        vm.primaryTapped()
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Become a follower")
        vm.selectTier(rank: 2)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Continue · $5/mo")
    }

    func testFreeTierSubmitTransitionsToCompletedFree() async {
        var seq = loadedSequence()
        seq.append(.status(201, body: """
        {"follow":{"id":"f1","status":"active","relationshipType":"follower"},"status":"active"}
        """))
        SequencedURLProtocol.sequence = seq
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        vm.primaryTapped() // step 1 → 2
        vm.primaryTapped() // submit
        // Async submit needs a moment to resolve.
        await Self.waitForState(vm) {
            if case let .ready(c) = $0, c.step == .completedFree { return true }
            return false
        }
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        XCTAssertEqual(content.step, .completedFree)
    }

    func testPaidTierSubmitTransitionsToOpensCheckout() async {
        var seq = loadedSequence()
        seq.append(.status(200, body: """
        {"requiresPayment":true,"subscribeUrl":"https://checkout.stripe.com/c/abc",
         "handshake":{"tier_rank":2,"tier_id":"t2","fan_handle":"fan_8a2c41"}}
        """))
        SequencedURLProtocol.sequence = seq
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        vm.primaryTapped()
        vm.selectTier(rank: 2)
        vm.primaryTapped() // submit
        await Self.waitForState(vm) {
            if case let .ready(c) = $0, case .opensCheckout = c.step { return true }
            return false
        }
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        guard case let .opensCheckout(url) = content.step else {
            XCTFail("Expected .opensCheckout step")
            return
        }
        XCTAssertEqual(url, "https://checkout.stripe.com/c/abc")
    }

    func testHandleTakenErrorReturnsToHandleEntryWithMessage() async {
        var seq = loadedSequence()
        seq.append(.status(409, body: """
        {"code":"fan_handle_taken","error":"That fan name is already taken."}
        """))
        SequencedURLProtocol.sequence = seq
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        vm.primaryTapped()
        vm.primaryTapped()
        await Self.waitForState(vm) {
            if case let .ready(c) = $0, c.handle.error != nil { return true }
            return false
        }
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        XCTAssertEqual(content.step, .handleEntry)
        XCTAssertEqual(content.handle.error, "That handle is already taken. Try another.")
    }

    func testUsernameRequiresAckErrorFlipsToggle() async {
        var seq = loadedSequence()
        seq.append(.status(400, body: """
        {"code":"pantopus_username_requires_ack","error":"Confirm reuse."}
        """))
        SequencedURLProtocol.sequence = seq
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        vm.primaryTapped()
        vm.primaryTapped()
        await Self.waitForState(vm) {
            if case let .ready(c) = $0, c.handle.matchesUsername { return true }
            return false
        }
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        XCTAssertTrue(content.handle.matchesUsername)
        XCTAssertEqual(content.step, .handleEntry)
    }

    func testParseHandshakeError404IsOther() {
        let err = APIError.notFound
        let kind = PrivacyHandshakeViewModel.parseHandshakeError(err)
        XCTAssertEqual(kind, .other)
    }

    func testParseHandshakeErrorWithFanHandleTakenCode() {
        let err = APIError.clientError(status: 409, message: "{\"code\":\"fan_handle_taken\"}")
        XCTAssertEqual(PrivacyHandshakeViewModel.parseHandshakeError(err), .handleTaken)
    }

    func testStep2BackTapReturnsToStep1() async {
        SequencedURLProtocol.sequence = loadedSequence()
        let vm = PrivacyHandshakeViewModel(personaHandle: "mayabuilds", api: makeAPI())
        await vm.load()
        vm.primaryTapped() // → step 2
        vm.leadingTapped() // back → step 1
        guard case let .ready(content) = vm.state else { XCTFail("Expected .ready")
            return
        }
        XCTAssertEqual(content.step, .handleEntry)
    }

    /// Polls vm.state for up to ~1s waiting for `predicate(state)` to
    /// return true. Used because primaryTapped kicks off an async
    /// Task — the test needs to await its completion.
    static func waitForState(
        _ vm: PrivacyHandshakeViewModel,
        timeout: TimeInterval = 1.0,
        predicate: (HandshakeUiState) -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if predicate(vm.state) { return }
            try? await Task.sleep(nanoseconds: 20_000_000) // 20ms
        }
    }
}
