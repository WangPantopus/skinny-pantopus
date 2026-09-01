//
//  GigComposeUploadTests.swift
//  PantopusTests
//
//  P15.5 — Post-a-Task Fill-gaps-step photo pipeline: picked bytes
//  upload immediately via `POST /api/files/upload` (per-tile uploading /
//  failed-with-retry / uploaded states), uploaded URLs ride the
//  magic-post draft's `attachments`, and the Continue/Post CTAs wait
//  for in-flight uploads.
//

import XCTest
@testable import Pantopus

@MainActor
final class GigComposeUploadTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeVM(initialState: GigComposeFormState = .empty) -> GigComposeViewModel {
        GigComposeViewModel(
            api: APIClient(
                environment: .current,
                session: SequencedURLProtocol.makeSession(),
                retryPolicy: .none
            ),
            uploader: MultipartUploader(
                environment: .current,
                session: SequencedURLProtocol.makeSession()
            ),
            location: FixedLocationProvider(
                UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)
            ),
            initialState: initialState
        ) { true }
    }

    private static let uploadOKJSON = """
    {"message":"File uploaded","file":{"id":"f1","url":"https://cdn.pantopus.app/gigs/photo-1.jpg"}}
    """

    private static let uploadOK2JSON = """
    {"message":"File uploaded","file":{"id":"f2","url":"https://cdn.pantopus.app/gigs/photo-2.jpg"}}
    """

    private func validBasicsState() -> GigComposeFormState {
        GigComposeFormState(
            step: GigComposeStep.fillGaps.rawValue,
            category: .handyman,
            title: "Hang 3 shelves in the living room",
            description: "Need three IKEA Lack shelves mounted on drywall."
        )
    }

    // MARK: - Success

    func testUploadSuccessStoresURLAndClearsInFlight() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.uploadOKJSON)]
        let vm = makeVM(initialState: validBasicsState())
        vm.addPhotoData(Data([0xFF, 0xD8]))
        XCTAssertEqual(vm.attachments.first?.status, .uploading)
        XCTAssertTrue(vm.hasUploadsInFlight)
        await vm.awaitUploadsForTesting()
        XCTAssertEqual(
            vm.attachments.first?.status,
            .uploaded(url: "https://cdn.pantopus.app/gigs/photo-1.jpg")
        )
        XCTAssertEqual(vm.form.photoIds, ["https://cdn.pantopus.app/gigs/photo-1.jpg"])
        XCTAssertFalse(vm.hasUploadsInFlight)
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.url?.path, "/api/files/upload")
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertTrue(
            request?.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("multipart/form-data") ?? false
        )
    }

    func testUploadedURLsRideMagicPostDraftAttachments() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: Self.uploadOKJSON),
            .status(201, body: Self.uploadOK2JSON)
        ]
        var state = validBasicsState()
        state.step = GigComposeStep.review.rawValue
        state.budgetType = .fixed
        state.budgetMin = "60"
        state.scheduleType = .flexible
        state.locationMode = .yourAddress
        let vm = makeVM(initialState: state)
        // Sequential awaits keep the FIFO stub → tile mapping
        // deterministic; the grid-order guarantee itself is what the
        // assertion checks.
        vm.addPhotoData(Data([0x1]))
        await vm.awaitUploadsForTesting()
        vm.addPhotoData(Data([0x2]))
        await vm.awaitUploadsForTesting()
        XCTAssertEqual(
            vm.buildMagicPostBody()?.draft.attachments,
            [
                "https://cdn.pantopus.app/gigs/photo-1.jpg",
                "https://cdn.pantopus.app/gigs/photo-2.jpg"
            ],
            "attachments ride in grid order — first tile is the cover"
        )
    }

    // MARK: - Failure + retry

    func testUploadFailureMarksTileFailed() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM(initialState: validBasicsState())
        vm.addPhotoData(Data([0x1]))
        await vm.awaitUploadsForTesting()
        XCTAssertEqual(vm.attachments.first?.status, .failed)
        XCTAssertTrue(vm.form.photoIds.isEmpty, "Failed uploads never reach the create body.")
        XCTAssertFalse(vm.hasUploadsInFlight, "A failed tile doesn't hold the CTA hostage.")
    }

    func testRetryAfterFailureUploads() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}"),
            .status(201, body: Self.uploadOKJSON)
        ]
        let vm = makeVM(initialState: validBasicsState())
        vm.addPhotoData(Data([0x1]))
        await vm.awaitUploadsForTesting()
        guard let failedId = vm.attachments.first?.id else {
            return XCTFail("Expected a (failed) attachment")
        }
        vm.retryUpload(id: failedId)
        XCTAssertEqual(vm.attachments.first?.status, .uploading, "Retry flips the tile back to uploading.")
        await vm.awaitUploadsForTesting()
        XCTAssertEqual(
            vm.attachments.first?.status,
            .uploaded(url: "https://cdn.pantopus.app/gigs/photo-1.jpg")
        )
        XCTAssertEqual(vm.form.photoIds, ["https://cdn.pantopus.app/gigs/photo-1.jpg"])
    }

    func testRetryIgnoredUnlessFailed() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.uploadOKJSON)]
        let vm = makeVM(initialState: validBasicsState())
        vm.addPhotoData(Data([0x1]))
        await vm.awaitUploadsForTesting()
        guard let id = vm.attachments.first?.id else { return XCTFail("Expected an attachment") }
        vm.retryUpload(id: id)
        XCTAssertEqual(
            vm.attachments.first?.status,
            .uploaded(url: "https://cdn.pantopus.app/gigs/photo-1.jpg"),
            "Retry is a no-op on uploaded tiles."
        )
    }

    // MARK: - Remove

    func testRemoveUploadedAttachmentDropsURL() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.uploadOKJSON)]
        let vm = makeVM(initialState: validBasicsState())
        vm.addPhotoData(Data([0x1]))
        await vm.awaitUploadsForTesting()
        guard let id = vm.attachments.first?.id else { return XCTFail("Expected an attachment") }
        vm.removeAttachment(id: id)
        XCTAssertTrue(vm.attachments.isEmpty)
        XCTAssertTrue(vm.form.photoIds.isEmpty)
    }

    // MARK: - CTA gating

    func testUploadInFlightBlocksBasicsContinue() async {
        // Slow response keeps the upload in flight while we assert.
        SequencedURLProtocol.sequence = [.status(201, body: Self.uploadOKJSON, delay: 0.3)]
        let vm = makeVM(initialState: validBasicsState())
        XCTAssertTrue(vm.chrome.primaryCTAEnabled, "Valid basics enable Continue before any photo.")
        vm.addPhotoData(Data([0x1]))
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Continue waits for the in-flight upload.")
        await vm.awaitUploadsForTesting()
        XCTAssertTrue(vm.chrome.primaryCTAEnabled, "Continue re-enables once the upload settles.")
    }

    // MARK: - Restore

    func testRestoreRehydratesUploadedURLsAndDropsPlaceholders() {
        let vm = makeVM()
        var snapshot = validBasicsState()
        snapshot.photoIds = [
            "https://cdn.pantopus.app/gigs/photo-1.jpg",
            "placeholder://photo/legacy"
        ]
        vm.restore(from: snapshot)
        XCTAssertEqual(vm.form.photoIds, ["https://cdn.pantopus.app/gigs/photo-1.jpg"])
        XCTAssertEqual(vm.attachments.count, 1)
        XCTAssertEqual(
            vm.attachments.first?.status,
            .uploaded(url: "https://cdn.pantopus.app/gigs/photo-1.jpg")
        )
    }
}
