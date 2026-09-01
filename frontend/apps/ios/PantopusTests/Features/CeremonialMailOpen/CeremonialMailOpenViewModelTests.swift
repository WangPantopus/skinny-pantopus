//
//  CeremonialMailOpenViewModelTests.swift
//  PantopusTests
//
//  Covers the T3.8 ceremonial mail reader: projection from the v2
//  item response, four-phase progression, voice playback toggle.
//

import XCTest
@testable import Pantopus

@MainActor
final class CeremonialMailOpenViewModelTests: XCTestCase {
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

    private static let fullItemJSON = """
    {
      "mail": {
        "id":"mail_demo",
        "subject":"A note from a friend",
        "content":"Dear Alice,\\n\\nFirst paragraph.\\n\\nSecond paragraph.",
        "type":"letter",
        "mail_type":"letter",
        "drawer":"inbox",
        "lifecycle":"delivered",
        "viewed":false,
        "ack_required":false,
        "payout_amount":0,
        "trust_level":"verified",
        "created_at":"2026-05-15T12:00:00Z",
        "sender":{"name":"Maya K.","username":"mayak"},
        "sender_display":"Maya K.",
        "sender_trust":"pantopus_user",
        "package":null,
        "timeline":[],
        "object_payload":{
          "stationeryTheme":"midnight_blue",
          "inkSelection":"navy",
          "sealChoice":"wax_red",
          "voicePostscriptUri":"https://uploads.test/v1.m4a"
        }
      }
    }
    """

    func testLoadProjectsLetterFromObjectPayload() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        guard case let .loaded(letter, phase) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(phase, .sealed)
        XCTAssertEqual(letter.sender.displayName, "Maya K.")
        XCTAssertEqual(letter.sender.handle, "mayak")
        XCTAssertEqual(letter.sender.trustLabel, "Pantopus friend")
        XCTAssertEqual(letter.stationery, .midnightBlue)
        XCTAssertEqual(letter.ink, .navy)
        XCTAssertEqual(letter.seal, .waxRed)
        XCTAssertEqual(letter.voicePostscriptUri, "https://uploads.test/v1.m4a")
        XCTAssertEqual(letter.bodyParagraphs.count, 3) // Dear Alice / First / Second
        XCTAssertEqual(letter.subject, "A note from a friend")
    }

    func testMissingObjectPayloadFallsBackToDefaults() async {
        let minimalJSON = """
        {
          "mail": {
            "id":"m1","subject":"Hi","content":"Hi there.",
            "type":"letter","mail_type":"letter","drawer":"inbox",
            "lifecycle":"delivered","viewed":false,"ack_required":false,
            "payout_amount":0,"trust_level":"none",
            "created_at":"2026-05-15T12:00:00Z",
            "sender":null,
            "sender_display":"Someone",
            "sender_trust":"none",
            "package":null,"timeline":[],
            "object_payload":null
          }
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: minimalJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(letter, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(letter.stationery, .classicCream)
        XCTAssertEqual(letter.ink, .walnut)
        XCTAssertEqual(letter.seal, .waxRed)
        XCTAssertNil(letter.voicePostscriptUri)
        XCTAssertNil(letter.sender.trustLabel)
    }

    func testLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = CeremonialMailOpenViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error")
            return
        }
    }

    func testInitialPhaseIsSealed() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.phase, .sealed)
    }

    func testStartBreakingSealCyclesThroughBreakingToOpen() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        await vm.startBreakingSeal() // 750ms internal sleep, then .open
        XCTAssertEqual(vm.phase, .open)
    }

    func testOpenImmediatelySkipsAnimation() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        vm.openImmediately()
        XCTAssertEqual(vm.phase, .open)
    }

    /// T6.5d (P22) — reduce-motion + skip animation behavior.
    func testStartBreakingSealWithSkipJumpsStraightToOpen() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        // Reduce-motion path — the screen passes `skipAnimation: true`
        // so we never enter the `.breaking` intermediate frame.
        await vm.startBreakingSeal(skipAnimation: true)
        XCTAssertEqual(vm.phase, .open)
    }

    func testTotalSealToOpenDurationStaysUnderTwoSeconds() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        let start = Date()
        await vm.startBreakingSeal()
        let elapsed = Date().timeIntervalSince(start)
        XCTAssertLessThan(
            elapsed,
            2.0,
            "Animation budget exceeded (P22 cap: ≤ 2s)."
        )
        XCTAssertEqual(vm.phase, .open)
    }

    func testStartBreakingSealNoOpAfterAlreadyOpen() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        vm.openImmediately()
        XCTAssertEqual(vm.phase, .open)
        await vm.startBreakingSeal(skipAnimation: true)
        // We're past .sealed so the call is a no-op.
        XCTAssertEqual(vm.phase, .open)
    }

    func testSeasonalStationeryTonesDecode() {
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "fall"), .fall)
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "winter"), .winter)
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "spring"), .spring)
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "summer"), .summer)
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "evergreen"), .evergreen)
    }

    func testSeasonalSealTonesDecode() {
        XCTAssertEqual(CeremonialMailSealTone(wire: "fall"), .fall)
        XCTAssertEqual(CeremonialMailSealTone(wire: "winter"), .winter)
        XCTAssertEqual(CeremonialMailSealTone(wire: "spring"), .spring)
        XCTAssertEqual(CeremonialMailSealTone(wire: "summer"), .summer)
        XCTAssertEqual(CeremonialMailSealTone(wire: "evergreen"), .evergreen)
    }

    func testEnterReplyingPhase() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        vm.openImmediately()
        vm.enterReplying()
        XCTAssertEqual(vm.phase, .replying)
        vm.resetToOpen()
        XCTAssertEqual(vm.phase, .open)
    }

    func testVoicePlaybackToggleFlipsFlag() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullItemJSON)]
        let vm = CeremonialMailOpenViewModel(mailId: "mail_demo", api: makeAPI())
        await vm.load()
        XCTAssertFalse(vm.isVoicePlaying)
        vm.toggleVoicePlayback()
        XCTAssertTrue(vm.isVoicePlaying)
        vm.stopVoicePlayback()
        XCTAssertFalse(vm.isVoicePlaying)
    }

    func testStationeryToneWireDecoding() {
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "midnight_blue"), .midnightBlue)
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "linen"), .linen)
        XCTAssertEqual(CeremonialMailStationeryTone(wire: nil), .classicCream)
        XCTAssertEqual(CeremonialMailStationeryTone(wire: "unknown"), .classicCream)
    }

    func testSealToneWireDecoding() {
        XCTAssertEqual(CeremonialMailSealTone(wire: "wax_blue"), .waxBlue)
        XCTAssertEqual(CeremonialMailSealTone(wire: "wax_black"), .waxBlack)
        XCTAssertEqual(CeremonialMailSealTone(wire: "none"), CeremonialMailSealTone.none)
        XCTAssertEqual(CeremonialMailSealTone(wire: nil), .waxRed)
    }

    func testDefaultOutcomeCtasIncludeWriteBack() {
        let ctas = CeremonialMailLetter.defaultOutcomeCtas()
        XCTAssertEqual(ctas.first?.id, "write_back")
        XCTAssertEqual(ctas.first?.style, .primary)
        XCTAssertEqual(ctas.count, 3)
    }
}
