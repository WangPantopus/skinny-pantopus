//
//  ComposeBroadcastViewModelTests.swift
//  PantopusTests
//
//  A.7 (A22.2) — Behavioral coverage for the Compose Broadcast VM:
//  state derivation (empty / composing / scheduled / sending / error),
//  the live character count + over-limit guard, audience + media + send
//  reset, the unsaved-draft indicator, and the first-run CTA copy.
//

import XCTest
@testable import Pantopus

@MainActor
final class ComposeBroadcastViewModelTests: XCTestCase {
    private func makeVM(
        recents: [RecentBroadcastContent] = [],
        audienceReach: [BroadcastAudience: Int] = [:],
        maxCharacterCount: Int = 1000,
        onSent: @escaping @MainActor () -> Void = {}
    ) -> ComposeBroadcastViewModel {
        ComposeBroadcastViewModel(
            personaId: "p1",
            persona: ComposeBroadcastSampleData.persona,
            recentBroadcasts: recents,
            audienceReach: audienceReach,
            maxCharacterCount: maxCharacterCount,
            onSent: onSent
        )
    }

    func testInitialStateIsEmpty() {
        let vm = makeVM()
        XCTAssertEqual(vm.state, .empty)
        XCTAssertFalse(vm.canSend)
        XCTAssertEqual(vm.characterCount, 0)
        XCTAssertFalse(vm.isDirty)
    }

    func testTypingTransitionsToComposingAndCountsLive() {
        let vm = makeVM()
        vm.updateBody("Hello beacons")
        XCTAssertEqual(vm.state, .composing(vm.draft))
        XCTAssertEqual(vm.characterCount, 13)
        XCTAssertTrue(vm.canSend)
        XCTAssertTrue(vm.isDirty)
    }

    func testOverCharacterLimitBlocksSend() {
        let vm = makeVM(maxCharacterCount: 5)
        vm.updateBody("123456")
        XCTAssertTrue(vm.isOverLimit)
        XCTAssertFalse(vm.canSend)
    }

    func testMediaWithoutBodyStillAllowsSend() {
        let vm = makeVM()
        vm.attachMedia(ComposeMediaPreview(kind: .image, caption: "boule.jpg"))
        XCTAssertFalse(vm.draft.isEmpty)
        XCTAssertTrue(vm.canSend)
        XCTAssertEqual(vm.state, .composing(vm.draft))
        vm.removeMedia()
        XCTAssertTrue(vm.draft.media.isEmpty)
        XCTAssertEqual(vm.state, .empty)
    }

    func testMultiSelectAppendsUpToNineAttachments() {
        let vm = makeVM()
        vm.attachMedia((0..<5).map { ComposeMediaPreview(id: "a\($0)", kind: .image, caption: nil) })
        XCTAssertEqual(vm.draft.media.count, 5)
        XCTAssertEqual(vm.remainingMediaSlots, 4)

        // Overflowing batch is truncated at the nine-item cap, not rejected.
        vm.attachMedia((0..<6).map { ComposeMediaPreview(id: "b\($0)", kind: .video, caption: nil) })
        XCTAssertEqual(vm.draft.media.count, ComposeBroadcastDraft.mediaLimit)
        XCTAssertEqual(vm.remainingMediaSlots, 0)

        vm.removeMedia(id: "a0")
        XCTAssertEqual(vm.draft.media.count, 8)
        XCTAssertFalse(vm.draft.media.contains { $0.id == "a0" })
    }

    func testPickedMediaBecomesAMultipartFile() {
        let picked = ComposeMediaPreview(
            kind: .image,
            caption: "boule.jpg",
            data: Data([0x1, 0x2, 0x3]),
            mimeType: "image/heic"
        )
        let file = picked.uploadFile
        XCTAssertEqual(file?.fieldName, "files", "post-media expects the `files` part name")
        XCTAssertEqual(file?.mimeType, "image/heic")
        XCTAssertFalse(file?.filename.contains("IMG_") ?? true, "Picker filenames never reach S3")
        XCTAssertNil(
            ComposeMediaPreview(kind: .image, caption: nil).uploadFile,
            "Sample media with no bytes has nothing to upload"
        )
    }

    func testSetAudienceUpdatesDraftAndReach() {
        let vm = makeVM(audienceReach: [.allBeacons: 1247, .bronzePlus: 518])
        XCTAssertEqual(vm.draft.audience, .allBeacons)
        vm.setAudience(.bronzePlus)
        XCTAssertEqual(vm.draft.audience, .bronzePlus)
        XCTAssertEqual(vm.reach(for: .bronzePlus), 518)
    }

    // MARK: - Place tag

    private static let placeTag = PostPlaceTag(
        name: "Joe's Coffee",
        address: "123 Elm St",
        latitude: 45.521,
        longitude: -122.681,
        placeId: "poi.1",
        kind: "poi"
    )

    func testSelectPlaceTagStoredAndClearedAfterSend() async {
        let vm = makeVM()
        vm.selectPlaceTag(Self.placeTag)
        XCTAssertEqual(vm.selectedPlaceTag?.name, "Joe's Coffee")
        vm.updateBody("Fresh loaves at the stand today")
        await vm.send()
        XCTAssertNil(vm.selectedPlaceTag, "tag resets with the draft after a successful send")
    }

    func testClearPlaceTagRemovesSelection() {
        let vm = makeVM()
        vm.selectPlaceTag(Self.placeTag)
        vm.clearPlaceTag()
        XCTAssertNil(vm.selectedPlaceTag)
    }

    // MARK: - Media capture location (ADDENDUM 2)

    func testMediaCaptureLocationPrefersStillsOverVideosAndRecomputes() {
        let vm = makeVM()
        XCTAssertNil(vm.mediaCaptureLocation)

        // Video-only → the video's capture point anchors.
        vm.attachMedia(ComposeMediaPreview(
            id: "v1",
            kind: .video,
            caption: nil,
            capturedLatitude: 30.2672,
            capturedLongitude: -97.7431
        ))
        XCTAssertEqual(vm.mediaCaptureLocation?.latitude ?? 0, 30.2672, accuracy: 0.0001)

        // A geotagged STILL wins over the earlier-attached video.
        vm.attachMedia(ComposeMediaPreview(
            id: "i1",
            kind: .image,
            caption: nil,
            capturedLatitude: 41.8781,
            capturedLongitude: -87.6298
        ))
        XCTAssertEqual(vm.mediaCaptureLocation?.latitude ?? 0, 41.8781, accuracy: 0.0001)
        XCTAssertEqual(vm.mediaCaptureLocation?.longitude ?? 0, -87.6298, accuracy: 0.0001)

        // Removing the still falls back to the video; clearing all clears.
        vm.removeMedia(id: "i1")
        XCTAssertEqual(vm.mediaCaptureLocation?.latitude ?? 0, 30.2672, accuracy: 0.0001)
        vm.removeMedia()
        XCTAssertNil(vm.mediaCaptureLocation)
    }

    func testUntaggedMediaExposesNoCaptureLocation() {
        let vm = makeVM()
        vm.attachMedia(ComposeMediaPreview(kind: .image, caption: nil))
        vm.attachMedia(ComposeMediaPreview(kind: .video, caption: nil))
        XCTAssertNil(vm.mediaCaptureLocation, "no geotag → no anchor chips")
    }

    /// Wire contract for B5 — snake_case keys, nils dropped (the
    /// broadcast schema is a CLOSED Joi object that rejects `null`s).
    func testPublishBodyEncodesPlaceTagSnakeCaseAndDropsNils() throws {
        let tagged = PublishUpdateBody(
            body: "Fresh loaves",
            visibility: "public",
            latitude: 45.521,
            longitude: -122.681,
            locationName: "Joe's Coffee",
            locationAddress: "123 Elm St",
            placeId: "poi.1"
        )
        let json = try JSONSerialization.jsonObject(
            with: JSONEncoder().encode(tagged)
        ) as? [String: Any]
        XCTAssertEqual(json?["location_name"] as? String, "Joe's Coffee")
        XCTAssertEqual(json?["location_address"] as? String, "123 Elm St")
        XCTAssertEqual(json?["place_id"] as? String, "poi.1")
        XCTAssertEqual(json?["latitude"] as? Double ?? 0, 45.521, accuracy: 0.0001)
        XCTAssertEqual(json?["longitude"] as? Double ?? 0, -122.681, accuracy: 0.0001)

        let untagged = PublishUpdateBody(body: "Fresh loaves", visibility: "public")
        let bare = try JSONSerialization.jsonObject(
            with: JSONEncoder().encode(untagged)
        ) as? [String: Any]
        XCTAssertNil(bare?["location_name"])
        XCTAssertNil(bare?["location_address"])
        XCTAssertNil(bare?["place_id"])
        XCTAssertNil(bare?["latitude"])
        XCTAssertNil(bare?["longitude"])
    }

    func testScheduleAndSendNowToggleState() {
        let vm = makeVM()
        vm.updateBody("Loaf drop at 4")
        let date = Date(timeIntervalSince1970: 1_760_641_200)
        vm.schedule(at: date)
        XCTAssertEqual(vm.scheduledAt, date)
        XCTAssertEqual(vm.state, .scheduled(vm.draft, sendAt: date))
        vm.sendNow()
        XCTAssertNil(vm.scheduledAt)
        XCTAssertEqual(vm.state, .composing(vm.draft))
    }

    func testSaveDraftClearsUnsavedIndicator() {
        let vm = makeVM()
        vm.updateBody("draft")
        XCTAssertTrue(vm.isDirty)
        vm.saveDraft()
        XCTAssertFalse(vm.isDirty)
        vm.updateBody("draft and more")
        XCTAssertTrue(vm.isDirty)
    }

    func testSendPassesThroughSendingState() async {
        var capturedDuringSend: ComposeBroadcastState?
        let vm = makeVM()
        vm.performSend = { [weak vm] _, _ in capturedDuringSend = vm?.state }
        vm.updateBody("Going live")
        await vm.send()
        XCTAssertEqual(capturedDuringSend, .sending)
    }

    func testSendSuccessResetsComposerAndKeepsAudience() async {
        var sentCalled = false
        let vm = makeVM { sentCalled = true }
        vm.setAudience(.silverPlus)
        vm.updateBody("Q&A recording is up")
        await vm.send()
        XCTAssertTrue(sentCalled)
        XCTAssertEqual(vm.state, .empty)
        XCTAssertEqual(vm.draft.audience, .silverPlus, "Audience persists as next-broadcast default")
        XCTAssertFalse(vm.isDirty)
    }

    func testSendFailureSurfacesErrorAndPreservesDraft() async {
        struct SendError: LocalizedError {
            var errorDescription: String? {
                "Network down"
            }
        }
        let vm = makeVM()
        vm.performSend = { _, _ in throw SendError() }
        vm.updateBody("keep me")
        await vm.send()
        XCTAssertEqual(vm.state, .error(message: "Network down"))
        XCTAssertEqual(vm.draft.body, "keep me")
        vm.retry()
        XCTAssertEqual(vm.state, .composing(ComposeBroadcastDraft(body: "keep me", audience: .allBeacons)))
    }

    func testEditingClearsPriorSendError() async {
        struct SendError: LocalizedError {
            var errorDescription: String? {
                "Oops"
            }
        }
        let vm = makeVM()
        vm.performSend = { _, _ in throw SendError() }
        vm.updateBody("first")
        await vm.send()
        XCTAssertEqual(vm.state, .error(message: "Oops"))
        vm.updateBody("first edited")
        XCTAssertEqual(vm.state, .composing(vm.draft))
    }

    func testPrimaryActionTitleReflectsFirstRun() {
        XCTAssertEqual(makeVM(recents: []).primaryActionTitle, "Send your first broadcast")
        XCTAssertEqual(
            makeVM(recents: ComposeBroadcastSampleData.recentBroadcasts).primaryActionTitle,
            "Send broadcast"
        )
    }

    func testSampleDataProvidesAtLeastThreeRecentBroadcastsWithStats() {
        let recents = ComposeBroadcastSampleData.recentBroadcasts
        XCTAssertGreaterThanOrEqual(recents.count, 3)
        for broadcast in recents {
            XCTAssertFalse(broadcast.reach.isEmpty)
            XCTAssertFalse(broadcast.read.isEmpty)
            XCTAssertFalse(broadcast.reactions.isEmpty)
            XCTAssertFalse(broadcast.replies.isEmpty)
        }
    }

    func testPreviewFactoriesMatchTheirStates() {
        XCTAssertEqual(ComposeBroadcastViewModel.previewEmpty().state, .empty)

        let populated = ComposeBroadcastViewModel.previewPopulated()
        XCTAssertEqual(populated.state, .composing(populated.draft))
        XCTAssertFalse(populated.draft.media.isEmpty)

        let scheduled = ComposeBroadcastViewModel.previewScheduled()
        guard case .scheduled = scheduled.state else {
            return XCTFail("Expected .scheduled, got \(scheduled.state)")
        }
    }
}
