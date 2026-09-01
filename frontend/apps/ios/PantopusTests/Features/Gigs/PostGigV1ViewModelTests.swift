//
//  PostGigV1ViewModelTests.swift
//  PantopusTests
//
//  A13.8 — covers the legacy gig composer's `submit()` now that it posts
//  to `POST /api/gigs` (`GigsEndpoints.create`): a valid form round-trips
//  to the backend-issued id, an invalid form short-circuits before the
//  network, and a server failure surfaces the error chrome with the form
//  preserved for retry.
//
//  Phase 4 adds: the real photo pipeline (`POST /api/files/upload` per
//  tile, uploaded URLs riding the create body's `attachments`, CTA gated
//  on in-flight uploads) and edit mode (`GET /api/gigs/:id` prefill →
//  `PATCH /api/gigs/:id`).
//

import XCTest
@testable import Pantopus

@MainActor
final class PostGigV1ViewModelTests: XCTestCase {
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

    private func makeUploader() -> MultipartUploader {
        MultipartUploader(
            environment: .current,
            session: SequencedURLProtocol.makeSession()
        )
    }

    private func filledViewModel() -> PostGigV1ViewModel {
        PostGigV1ViewModel(
            api: makeAPI(),
            uploader: makeUploader(),
            initialState: PostGigV1State(form: PostGigV1SampleData.filledForm),
            referenceNow: PostGigV1SampleData.referenceNow
        )
    }

    private func editViewModel(gigId: String = "gig-77") -> PostGigV1ViewModel {
        PostGigV1ViewModel(
            api: makeAPI(),
            uploader: makeUploader(),
            referenceNow: PostGigV1SampleData.referenceNow,
            editGigId: gigId
        )
    }

    private static let uploadOKJSON = """
    {"message":"File uploaded","file":{"id":"f1","url":"https://cdn.pantopus.app/gigs/photo-1.jpg"}}
    """

    private static let editGigDetailJSON = """
    {"gig":{
      "id":"gig-77",
      "title":"Help moving a sofa up 3 flights",
      "description":"Sleeper sofa from the curb up to apt 3B. No elevator, tight corner on the 2nd-floor landing.",
      "price":80,
      "category":"moving",
      "status":"open",
      "pay_type":"fixed",
      "schedule_type":"scheduled",
      "scheduled_start":"2026-05-30T21:00:00.000Z",
      "exact_address":"Pearl District · NW 11th & Johnson",
      "attachments":["https://cdn.pantopus.app/gigs/sofa.jpg"],
      "location":{"latitude":45.5266,"longitude":-122.6845}
    }}
    """

    // MARK: - Create

    func testSubmitValidFormPostsAndReturnsBackendId() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: """
            {"message":"Gig created successfully",
             "gig":{"id":"gig-from-server","title":"Help moving a sofa up 3 flights"}}
            """)
        ]
        let vm = filledViewModel()
        let id = await vm.submit()
        XCTAssertEqual(id, "gig-from-server")
        XCTAssertEqual(vm.state.postedGigId, "gig-from-server")
        XCTAssertFalse(vm.state.isSubmitting)
        XCTAssertTrue(vm.state.validationErrors.isEmpty)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.url?.path, "/api/gigs")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.httpMethod, "POST")
    }

    func testSubmitInvalidFormSurfacesValidationAndSkipsNetwork() async {
        // Empty default form fails category/title/description/price/location.
        let vm = PostGigV1ViewModel(api: makeAPI(), uploader: makeUploader())
        let id = await vm.submit()
        XCTAssertNil(id)
        XCTAssertFalse(vm.state.validationErrors.isEmpty)
        XCTAssertNil(vm.state.postedGigId)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty, "Validation fails before any request")
    }

    func testSubmitServerErrorSurfacesErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = filledViewModel()
        let id = await vm.submit()
        XCTAssertNil(id)
        guard case .error = vm.state.loadState else {
            return XCTFail("Expected error loadState, got \(vm.state.loadState)")
        }
        XCTAssertFalse(vm.state.isSubmitting)
        // Form survives so retry() can re-attempt without re-entry.
        XCTAssertEqual(vm.state.form.title, PostGigV1SampleData.filledForm.title)
    }

    func testFreePriceTypeClearsPriceAndPassesValidation() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: "{\"gig\":{\"id\":\"gig-free\",\"title\":\"t\"}}")
        ]
        let vm = filledViewModel()
        vm.updatePrice("")
        vm.updatePriceType(.free)
        XCTAssertTrue(vm.state.form.price.isEmpty, "Picking Free clears the price field")
        let id = await vm.submit()
        XCTAssertEqual(id, "gig-free", "Free + empty price passes validation")
        XCTAssertTrue(vm.state.validationErrors.isEmpty)
    }

    func testEmptyPriceWithoutFreeFailsWithDesignCopy() async {
        let vm = filledViewModel()
        vm.updatePrice("")
        let id = await vm.submit()
        XCTAssertNil(id)
        XCTAssertEqual(vm.error(for: .price), "Enter a price, or pick Free.")
    }

    // MARK: - Photo uploads

    func testPhotoUploadSuccessMarksTileUploaded() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.uploadOKJSON)]
        let vm = filledViewModel()
        let before = vm.state.form.photos.count
        vm.addPhotoData(Data([0xFF, 0xD8]))
        XCTAssertEqual(vm.state.form.photos.last?.status, .uploading)
        XCTAssertTrue(vm.hasUploadsInFlight)
        XCTAssertFalse(vm.canAttemptSubmit, "Post CTA waits for in-flight uploads")
        await vm.awaitUploadsForTesting()
        XCTAssertEqual(vm.state.form.photos.count, before + 1)
        XCTAssertEqual(
            vm.state.form.photos.last?.status,
            .uploaded(url: "https://cdn.pantopus.app/gigs/photo-1.jpg")
        )
        XCTAssertFalse(vm.hasUploadsInFlight)
        XCTAssertTrue(vm.canAttemptSubmit)
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.url?.path, "/api/files/upload")
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertTrue(
            request?.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("multipart/form-data") ?? false
        )
    }

    func testPhotoUploadFailureMarksTileFailedAndRetryRecovers() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}"),
            .status(201, body: Self.uploadOKJSON)
        ]
        let vm = filledViewModel()
        vm.addPhotoData(Data([0x1]))
        await vm.awaitUploadsForTesting()
        guard let failed = vm.state.form.photos.last, failed.status == .failed else {
            return XCTFail("Expected a failed tile")
        }
        XCTAssertFalse(vm.hasUploadsInFlight, "A failed tile doesn't hold the CTA hostage")
        vm.retryUpload(id: failed.id)
        XCTAssertEqual(vm.state.form.photos.last?.status, .uploading)
        await vm.awaitUploadsForTesting()
        XCTAssertEqual(
            vm.state.form.photos.last?.status,
            .uploaded(url: "https://cdn.pantopus.app/gigs/photo-1.jpg")
        )
    }

    func testRemovePhotoDropsTile() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.uploadOKJSON)]
        let vm = PostGigV1ViewModel(api: makeAPI(), uploader: makeUploader())
        vm.addPhotoData(Data([0x1]))
        await vm.awaitUploadsForTesting()
        guard let id = vm.state.form.photos.first?.id else { return XCTFail("Expected a photo") }
        vm.removePhoto(id: id)
        XCTAssertTrue(vm.state.form.photos.isEmpty)
    }

    // MARK: - Edit mode

    func testEditModeLoadsAndPrefillsEveryField() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.editGigDetailJSON)]
        let vm = editViewModel()
        XCTAssertEqual(vm.state.loadState, .loading, "Edit mode starts in loading until prefill lands")
        XCTAssertEqual(vm.screenTitle, "Edit gig")
        XCTAssertEqual(vm.commitLabel, "Save")
        await vm.load()
        XCTAssertEqual(vm.state.loadState, .ready)
        XCTAssertEqual(vm.state.form.category, .moving)
        XCTAssertEqual(vm.state.form.title, "Help moving a sofa up 3 flights")
        XCTAssertEqual(vm.state.form.price, "80")
        XCTAssertEqual(vm.state.form.priceType, .flat)
        XCTAssertEqual(vm.state.form.location, "Pearl District · NW 11th & Johnson")
        XCTAssertEqual(
            vm.state.form.photos.map(\.uploadedURL),
            ["https://cdn.pantopus.app/gigs/sofa.jpg"],
            "Stored attachments rehydrate as uploaded tiles"
        )
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.url?.path, "/api/gigs/gig-77")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.httpMethod, "GET")
    }

    func testEditModeSubmitPatchesAndReturnsId() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editGigDetailJSON),
            .status(200, body: "{\"gig\":{\"id\":\"gig-77\",\"title\":\"Updated\"}}")
        ]
        let vm = editViewModel()
        await vm.load()
        vm.updateTitle("Updated title for the sofa move")
        let id = await vm.submit()
        XCTAssertEqual(id, "gig-77")
        XCTAssertEqual(vm.state.postedGigId, "gig-77")
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.url?.path, "/api/gigs/gig-77")
        XCTAssertEqual(request?.httpMethod, "PATCH")
    }

    func testEditModeLoadFailureSurfacesErrorAndRetryRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}"),
            .status(200, body: Self.editGigDetailJSON)
        ]
        let vm = editViewModel()
        await vm.load()
        guard case .error = vm.state.loadState else {
            return XCTFail("Expected error loadState, got \(vm.state.loadState)")
        }
        // retry() refetches the prefill rather than exposing an empty form.
        vm.retry()
        // Wait for the retry-kicked load to settle.
        for _ in 0..<50 where vm.state.loadState != .ready {
            try? await Task.sleep(nanoseconds: 20_000_000)
        }
        XCTAssertEqual(vm.state.loadState, .ready)
        XCTAssertEqual(vm.state.form.title, "Help moving a sofa up 3 flights")
    }
}
