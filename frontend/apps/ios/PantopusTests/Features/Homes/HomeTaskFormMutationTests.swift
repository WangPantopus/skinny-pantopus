import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskFormMutationTests: HomeTaskCreationTestCase {
    func testTitleOnlyEditPreservesExactStoredScheduleAndUnchangedFields() async throws {
        let model = form(CreationMemoryStore(), taskId: task)
        SequencedURLProtocol.sequence = [
            .status(200, body: detail()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: detail()),
            .status(200, body: detail(overrides: ["title": "New title"])),
            .status(200, body: detail(overrides: ["title": "New title"]))
        ]
        await model.load()
        model.update(.title, to: "New title")
        let saved = await model.save()
        XCTAssertTrue(saved)
        let request = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first { $0.httpMethod == "PUT" })
        XCTAssertEqual(try body(request) as NSDictionary, ["title": "New title"] as NSDictionary)
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), session)
        XCTAssertTrue(model.shouldDismiss)
    }

    func testIntentionalClearsSendNullAndRequireTheClearedResult() async throws {
        let model = form(CreationMemoryStore(), taskId: task)
        let cleared: [String: Any] = ["description": NSNull(), "assigned_to": NSNull(), "due_at": NSNull(), "recurrence_rule": NSNull()]
        SequencedURLProtocol.sequence = [
            .status(200, body: detail()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: detail()),
            .status(200, body: detail(overrides: cleared)),
            .status(
                200,
                body: detail(overrides: cleared)
            )
        ]
        await model.load()
        model.update(.notes, to: "")
        model.selectAssignee(nil)
        model.setDueDate(nil)
        model.selectRecurrence(.oneTime)
        let saved = await model.save()
        XCTAssertTrue(saved)
        let request = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first { $0.httpMethod == "PUT" })
        XCTAssertEqual(try body(request) as NSDictionary, cleared as NSDictionary)
    }

    func testUnknownEditKeepsOnlyOriginalPatchDuringExplicitRetry() async throws {
        let model = form(CreationMemoryStore(), taskId: task)
        SequencedURLProtocol.sequence = [
            .status(200, body: detail()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: detail()),
            .status(503, body: "{}")
        ]
        await model.load()
        model.update(.title, to: "Saved edit")
        let first = await model.save()
        XCTAssertFalse(first)
        XCTAssertTrue(model.hasPendingSave)
        model.update(.title, to: "Must not replace edit")
        XCTAssertEqual(model.fields[.title]?.value, "Saved edit")
        let newer = ["title": "Saved edit", "description": "Someone else's later note"]
        SequencedURLProtocol.sequence = [
            .status(200, body: detail(overrides: newer)),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: detail(overrides: newer)),
            .status(200, body: detail(overrides: newer)),
            .status(
                200,
                body: detail(overrides: newer)
            )
        ]
        await model.load()
        let second = await model.save()
        XCTAssertTrue(second)
        let requests = SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "PUT" }
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(try body(requests[0]) as NSDictionary, try body(requests[1]) as NSDictionary)
        XCTAssertEqual(try body(requests[1]) as NSDictionary, ["title": "Saved edit"] as NSDictionary)
    }

    func testWrongPutResultOrRevokedReadCannotClaimEditCompletion() async {
        for response in [detail(overrides: ["id": actor]), detail(overrides: ["home_id": actor]), detail()] {
            SequencedURLProtocol.reset()
            let model = form(CreationMemoryStore(), taskId: task)
            SequencedURLProtocol.sequence = [
                .status(200, body: detail()),
                .status(200, body: "{\"occupants\":[]}"),
                .status(200, body: detail()),
                .status(200, body: response)
            ]
            await model.load()
            model.update(.title, to: "Changed")
            let saved = await model.save()
            XCTAssertFalse(saved)
            XCTAssertFalse(model.shouldDismiss)
            XCTAssertTrue(model.hasPendingSave)
        }
    }

    func testRevokedEditBeforePutDoesNotWrite() async {
        let model = form(CreationMemoryStore(), taskId: task)
        SequencedURLProtocol.sequence = [
            .status(200, body: detail()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: detail(edit: false))
        ]
        await model.load()
        model.update(.title, to: "Changed")
        let saved = await model.save()
        XCTAssertFalse(saved)
        XCTAssertFalse(model.shouldDismiss)
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.httpMethod == "PUT" })
    }

    func testLostReadAfterAppliedEditRequiresExplicitRecovery() async {
        let model = form(CreationMemoryStore(), taskId: task)
        SequencedURLProtocol.sequence = [
            .status(200, body: detail()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: detail()),
            .status(200, body: detail(overrides: ["title": "Changed"])),
            .status(
                403,
                body: "{}"
            )
        ]
        await model.load()
        model.update(.title, to: "Changed")
        let saved = await model.save()
        XCTAssertFalse(saved)
        XCTAssertTrue(model.hasPendingSave)
        XCTAssertFalse(model.shouldDismiss)
    }

    func testReplacementSessionBeforeSaveCannotSendAndClearsPrivateFields() async {
        var identity: String? = "opening"
        let model = form(CreationMemoryStore()) { identity }
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: "{\"occupants\":[]}")]
        await model.load()
        model.update(.title, to: "Private title")
        identity = "replacement"
        model.accessChanged()
        let saved = await model.save()
        XCTAssertFalse(saved)
        XCTAssertTrue(model.fields.isEmpty)
        XCTAssertFalse(model.shouldDismiss)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testReplacementDuringCreatePreflightCannotPost() async throws {
        var identity: String? = "opening"
        let client = coordinator(CreationMemoryStore()) { identity }
        SequencedURLProtocol.sequence = [.status(200, body: collection(), delay: 0.1)]
        let operation = Task { try await client.save(payload) }
        try await waitForRequests(1)
        identity = "replacement"
        do { _ = try await operation.value
            XCTFail("Changed session accepted")
        } catch {}
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testQueuedActivationCannotReopenAfterAnotherSuspension() async {
        let model = form(CreationMemoryStore())
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: "{\"occupants\":[]}")]
        await model.load()
        model.suspend()
        let revision = model.activationRevision
        model.suspend()
        await model.resume(ifCurrent: revision)
        XCTAssertFalse(model.isValid)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testPickerCallbackAfterSuspensionDoesNotChangeRetainedDraft() async {
        let model = form(CreationMemoryStore(), taskId: task)
        SequencedURLProtocol.sequence = [
            .status(200, body: detail()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: detail()),
            .status(200, body: "{\"occupants\":[]}")
        ]
        await model.load()
        model.update(.title, to: "My unsaved title")
        model.suspend()
        model.update(.title, to: "Late callback")
        model.selectRecurrence(.custom)
        XCTAssertEqual(model.fields[.title]?.value, "My unsaved title")
        XCTAssertEqual(model.selectedRecurrence, .weekly)
        await model.load()
        XCTAssertEqual(model.fields[.title]?.value, "My unsaved title")
        XCTAssertEqual(model.selectedRecurrence, .weekly)
    }

    func testPickerCallbackAfterSessionReplacementCannotModifyPrivateDraft() async {
        var identity: String? = "opening"
        let model = form(CreationMemoryStore()) { identity }
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: "{\"occupants\":[]}")]
        await model.load()
        model.update(.title, to: "Private draft")
        identity = "replacement"
        model.update(.title, to: "Late callback")
        model.selectRecurrence(.custom)
        XCTAssertEqual(model.fields[.title]?.value, "Private draft")
        XCTAssertEqual(model.selectedRecurrence, .oneTime)
        model.accessChanged()
        XCTAssertTrue(model.fields.isEmpty)
    }

    func testMalformedNewServerSessionCannotConfirmCreation() async {
        let store = CreationMemoryStore()
        SequencedURLProtocol.sequence = [
            .status(200, body: collection()),
            .status(200, body: created(token: String(repeating: "c", count: 64)))
        ]
        do { _ = try await coordinator(store).save(payload)
            XCTFail("Changed proof accepted")
        } catch {}
        XCTAssertEqual(store.singleDraft, draft)
    }
}
