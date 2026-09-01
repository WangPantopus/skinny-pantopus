//
//  NotificationPermissionViewModelTests.swift
//  PantopusTests
//
//  Stream I18 — H15 channel-connect prompt: frame transitions, channel
//  persistence wiring, and the result reported back to the presenter. Push
//  (OS-gated) is exercised via UI/manual verification, not unit tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class NotificationPermissionViewModelTests: XCTestCase {
    private final class ResultBox {
        var value: NotificationChannelConnectResult?
    }

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeService() -> NotificationChannelService {
        NotificationChannelService(client: SchedulingClient(client: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )))
    }

    private func makeViewModel(
        frame: NotificationPromptFrame,
        box: ResultBox
    ) -> NotificationPermissionViewModel {
        NotificationPermissionViewModel(
            owner: .personal,
            initialFrame: frame,
            accountEmail: "maria@pantopus.co",
            service: makeService()
        ) { box.value = $0 }
    }

    func testUseEmailInsteadShowsEmailFrameWithAccountEmail() {
        let viewModel = makeViewModel(frame: .push, box: ResultBox())
        viewModel.useEmailInstead()
        XCTAssertEqual(viewModel.frame, .emailVerify(email: "maria@pantopus.co"))
    }

    func testVerifyEmailIgnoredUntilCodeComplete() async {
        let viewModel = makeViewModel(frame: .emailVerify(email: "maria@pantopus.co"), box: ResultBox())
        viewModel.code = "123"
        await viewModel.verifyEmail()
        XCTAssertEqual(viewModel.frame, .emailVerify(email: "maria@pantopus.co"))
    }

    func testVerifyEmailConnectsAndReportsResult() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"prefs":{"notify_me":{"new_booking":true}}}"#),
            .status(200, body: #"{"prefs":{"channels":{"email":true}}}"#)
        ]
        let box = ResultBox()
        let viewModel = makeViewModel(frame: .emailVerify(email: "maria@pantopus.co"), box: box)
        viewModel.code = "123456"
        XCTAssertTrue(viewModel.isCodeComplete)
        await viewModel.verifyEmail()
        XCTAssertEqual(viewModel.frame, .connected(.email))
        XCTAssertEqual(box.value, .connected(.email))
    }

    func testVerifySmsShowsComingSoonToast() {
        let viewModel = makeViewModel(frame: .smsVerify, box: ResultBox())
        viewModel.verifySms()
        XCTAssertNotNil(viewModel.toast)
    }

    func testIsSmsReadyRequiresPhoneAndCode() {
        let viewModel = makeViewModel(frame: .smsVerify, box: ResultBox())
        viewModel.phone = "555123"
        viewModel.code = "123456"
        XCTAssertFalse(viewModel.isSmsReady, "Too few phone digits should not be ready")
        viewModel.phone = "5551234567"
        XCTAssertTrue(viewModel.isSmsReady)
    }

    func testDoneFromConnectedReportsChannelAndFinishes() {
        let box = ResultBox()
        let viewModel = makeViewModel(frame: .connected(.push), box: box)
        viewModel.done()
        XCTAssertEqual(box.value, .connected(.push))
        XCTAssertTrue(viewModel.isFinished)
    }

    func testDismissReportsDismissedAndFinishes() {
        let box = ResultBox()
        let viewModel = makeViewModel(frame: .push, box: box)
        viewModel.dismiss()
        XCTAssertEqual(box.value, .dismissed)
        XCTAssertTrue(viewModel.isFinished)
    }

    func testNonNumericSixCharCodeIsIncomplete() {
        let viewModel = makeViewModel(frame: .emailVerify(email: "m@p.co"), box: ResultBox())
        viewModel.code = "12a456" // six chars but not all digits
        XCTAssertFalse(viewModel.isCodeComplete)
        viewModel.code = "123456"
        XCTAssertTrue(viewModel.isCodeComplete)
    }
}

@MainActor
final class NotificationChannelServiceTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeService() -> NotificationChannelService {
        NotificationChannelService(client: SchedulingClient(client: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )))
    }

    func testConnectedChannelsDecodesPrefs() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"prefs":{"channels":{"push":true,"email":false,"sms":true}}}"#)
        ]
        let channels = await makeService().connectedChannels()
        XCTAssertTrue(channels.contains(.push))
        XCTAssertTrue(channels.contains(.sms))
        XCTAssertFalse(channels.contains(.email))
    }

    func testConnectedChannelsEmptyOnFailure() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let channels = await makeService().connectedChannels()
        XCTAssertTrue(channels.isEmpty)
    }

    func testSetChannelGetsThenPutsPreservingKeys() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"prefs":{"notify_me":{"new_booking":true}}}"#),
            .status(200, body: #"{"prefs":{"notify_me":{"new_booking":true},"channels":{"email":true}}}"#)
        ]
        try await makeService().setChannel(.email, enabled: true)
        // Both the GET and the PUT must have been consumed.
        XCTAssertTrue(SequencedURLProtocol.sequence.isEmpty)
    }
}
