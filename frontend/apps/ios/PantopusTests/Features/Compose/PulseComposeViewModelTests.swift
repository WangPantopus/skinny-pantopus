//
//  PulseComposeViewModelTests.swift
//  PantopusTests
//
//  P2.1 — Pulse compose form. Covers each of the five intent variants
//  (ask / recommend / event / lost / announce), per-intent validation,
//  identity + visibility selectors, photo capacity, the exact
//  `POST /api/posts` body, and the close-confirm dirty signal.
//

// swiftlint:disable type_body_length

import XCTest
@testable import Pantopus

// swiftlint:disable file_length

@MainActor
final class PulseComposeViewModelTests: XCTestCase {
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

    private static let successResponse = """
    {"message":"Post created successfully","post":{"id":"p_42"}}
    """

    private static let legacySuccessResponse = """
    {"message":"Posted","post_id":"p_42"}
    """

    // MARK: - Defaults

    func testInitDefaultsMatchIntentArgument() {
        for intent in PulseComposeIntent.allCases {
            let vm = PulseComposeViewModel(intent: intent, api: makeAPI())
            XCTAssertEqual(vm.activeIntent, intent)
            XCTAssertEqual(vm.identity, .personal)
            XCTAssertEqual(vm.visibility, .neighbors)
            XCTAssertEqual(vm.lostFoundKind, .lost)
            XCTAssertEqual(vm.askCategory, .handyman)
            XCTAssertEqual(vm.announceAudience, .neighbors)
            XCTAssertEqual(vm.recommendRating, 5)
            XCTAssertTrue(vm.photos.isEmpty)
        }
    }

    func testFromRawValueFallsBackToAsk() {
        XCTAssertEqual(PulseComposeIntent.from(rawValue: "totally-unknown"), .ask)
        XCTAssertEqual(PulseComposeIntent.from(rawValue: "event"), .event)
        XCTAssertEqual(PulseComposeIntent.from(rawValue: "lost"), .lost)
        XCTAssertEqual(PulseComposeIntent.from(rawValue: "announce"), .announce)
    }

    func testFromFeedIntentBridgesAllAndIdentity() {
        XCTAssertEqual(PulseComposeIntent.from(feedIntent: .all), .ask)
        XCTAssertEqual(PulseComposeIntent.from(feedIntent: .ask), .ask)
        XCTAssertEqual(PulseComposeIntent.from(feedIntent: .recommend), .recommend)
        XCTAssertEqual(PulseComposeIntent.from(feedIntent: .event), .event)
        XCTAssertEqual(PulseComposeIntent.from(feedIntent: .lost), .lost)
        XCTAssertEqual(PulseComposeIntent.from(feedIntent: .announce), .announce)
    }

    // MARK: - Dirty / valid

    func testCleanFormIsNotDirty() {
        for intent in PulseComposeIntent.allCases {
            let vm = PulseComposeViewModel(intent: intent, api: makeAPI())
            XCTAssertFalse(vm.isDirty, "intent \(intent) should be clean")
        }
    }

    func testIdentityChangeMarksDirty() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        XCTAssertFalse(vm.isDirty)
        vm.identity = .home
        XCTAssertTrue(vm.isDirty)
    }

    func testVisibilityChangeMarksDirty() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.visibility = .publicFeed
        XCTAssertTrue(vm.isDirty)
    }

    func testFieldEditMarksDirty() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        XCTAssertTrue(vm.isDirty)
    }

    func testPhotoAttachMarksDirty() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.append(photo: PulseComposePhoto(data: Data([0xFF])))
        XCTAssertTrue(vm.isDirty)
    }

    func testValidIsFalseForBlankAsk() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        _ = vm.validateAll()
        XCTAssertFalse(vm.isValid)
        XCTAssertNotNil(vm.fields[.title]?.error)
        XCTAssertNotNil(vm.fields[.body]?.error)
    }

    func testValidWhenAskTitleAndBodyFilled() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking under the sink — anyone know someone?")
        XCTAssertTrue(vm.isValid)
    }

    func testRecommendRequiresBusinessAndBody() {
        let vm = PulseComposeViewModel(intent: .recommend, api: makeAPI())
        _ = vm.validateAll()
        XCTAssertFalse(vm.isValid)
        vm.update(.recommendBusiness, to: "Joe's Coffee")
        vm.update(.body, to: "Best lattes on Elm street.")
        XCTAssertNil(vm.fields[.recommendBusiness]?.error)
        XCTAssertNil(vm.fields[.body]?.error)
        XCTAssertTrue(vm.isValid)
    }

    func testEventRequiresTitleDateLocationAndBody() {
        let vm = PulseComposeViewModel(intent: .event, api: makeAPI())
        _ = vm.validateAll()
        XCTAssertFalse(vm.isValid)
        vm.update(.title, to: "Block party")
        vm.update(.eventDate, to: "2030-08-15 17:00")
        vm.update(.eventLocation, to: "Elm Park, near the fountain")
        vm.update(.body, to: "Bring chairs and snacks.")
        XCTAssertTrue(vm.isValid)
    }

    func testLostFoundDoesNotRequireDate() {
        let vm = PulseComposeViewModel(intent: .lost, api: makeAPI())
        vm.update(.body, to: "Tortoiseshell cat, blue collar, answers to Mochi.")
        vm.update(.lostLastSeenLocation, to: "Corner of 5th and Elm")
        XCTAssertTrue(vm.isValid)
    }

    func testAnnounceRequiresTitleAndBody() {
        let vm = PulseComposeViewModel(intent: .announce, api: makeAPI())
        _ = vm.validateAll()
        XCTAssertFalse(vm.isValid)
        vm.update(.title, to: "Street closure")
        vm.update(.body, to: "Saturday 10-2 for the parade.")
        XCTAssertTrue(vm.isValid)
    }

    // MARK: - Photo capacity

    func testPhotosCappedAtFour() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        for byte in 0..<10 {
            vm.append(photo: PulseComposePhoto(data: Data([UInt8(byte)])))
        }
        XCTAssertEqual(vm.photos.count, pulseComposeMaxPhotos)
    }

    func testSetPhotosTruncatesAtMax() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        let pool = (0..<(pulseComposeMaxPhotos + 3)).map { PulseComposePhoto(data: Data([UInt8($0)])) }
        vm.setPhotos(pool)
        XCTAssertEqual(vm.photos.count, pulseComposeMaxPhotos)
    }

    func testRemovePhoto() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        let photo = PulseComposePhoto(data: Data([0xAA]))
        vm.append(photo: photo)
        XCTAssertEqual(vm.photos.count, 1)
        vm.remove(photo: photo.id)
        XCTAssertEqual(vm.photos.count, 0)
    }

    // MARK: - Request shape

    func testAskRequestCarriesCategoryAndIdentity() {
        let vm = PulseComposeViewModel(intent: .ask, identity: .home, api: makeAPI())
        vm.update(.title, to: "Plumber recs?")
        vm.update(.body, to: "Need someone soon.")
        vm.askCategory = .handyman
        let request = vm.buildRequest()
        XCTAssertEqual(request.postType, "ask_local")
        XCTAssertEqual(request.title, "Plumber recs?")
        XCTAssertEqual(request.content, "Need someone soon.")
        XCTAssertEqual(request.postAs, "home")
        XCTAssertEqual(request.serviceCategory, "handyman")
        XCTAssertEqual(request.purpose, "ask")
    }

    func testRecommendRequestEmbedsStarsAndBusinessName() {
        let vm = PulseComposeViewModel(intent: .recommend, api: makeAPI())
        vm.update(.recommendBusiness, to: "Joe's Coffee")
        vm.update(.body, to: "Great lattes.")
        vm.recommendRating = 4
        let request = vm.buildRequest()
        XCTAssertEqual(request.postType, "recommendation")
        XCTAssertEqual(request.businessName, "Joe's Coffee")
        XCTAssertTrue(request.content.hasPrefix("★★★★☆"))
        XCTAssertTrue(request.content.contains("Great lattes."))
    }

    func testEventRequestNormalizesISODate() {
        let vm = PulseComposeViewModel(intent: .event, api: makeAPI())
        vm.update(.title, to: "Block party")
        vm.update(.eventDate, to: "2030-08-15")
        vm.update(.eventLocation, to: "Elm Park")
        vm.update(.body, to: "Bring chairs.")
        let request = vm.buildRequest()
        XCTAssertEqual(request.postType, "event")
        XCTAssertNotNil(request.eventDate)
        XCTAssertTrue(request.eventDate?.hasPrefix("2030-08-15") ?? false)
        XCTAssertEqual(request.eventVenue, "Elm Park")
    }

    func testLostRequestPrefixesLastSeenAndCarriesType() {
        let vm = PulseComposeViewModel(intent: .lost, api: makeAPI())
        vm.update(.body, to: "Mochi the cat.")
        vm.update(.lostLastSeenLocation, to: "5th & Elm")
        vm.lostFoundKind = .found
        let request = vm.buildRequest()
        XCTAssertEqual(request.postType, "lost_found")
        XCTAssertEqual(request.lostFoundType, "found")
        XCTAssertTrue(request.content.hasPrefix("Last seen: 5th & Elm"))
        XCTAssertTrue(request.content.contains("Mochi the cat."))
    }

    func testAnnounceRequestUsesAudienceVisibility() {
        let vm = PulseComposeViewModel(intent: .announce, api: makeAPI())
        vm.update(.title, to: "Street closure")
        vm.update(.body, to: "Sat 10-2.")
        vm.announceAudience = .followers
        let request = vm.buildRequest()
        XCTAssertEqual(request.postType, "local_update")
        XCTAssertEqual(request.audience, "nearby")
        XCTAssertEqual(request.visibility, "followers")
    }

    func testHeadsUpRequestCarriesSafetyAlertKind() {
        let vm = PulseComposeViewModel(
            intent: .announce,
            postingTarget: .currentLocation(latitude: 45.5, longitude: -122.4, label: "Camas, WA"),
            composePurpose: .headsUp,
            api: makeAPI()
        )
        vm.update(.title, to: "Hello")
        vm.update(.body, to: "What's up")
        vm.safetyAlertKind = .suspicious
        let request = vm.buildRequest()
        XCTAssertEqual(request.postType, "alert")
        XCTAssertEqual(request.purpose, "heads_up")
        XCTAssertEqual(request.safetyAlertKind, "suspicious")
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

    func testPlaceTagFieldsLandOnRequest() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking.")
        vm.selectPlaceTag(Self.placeTag)
        let request = vm.buildRequest()
        XCTAssertEqual(request.latitude, 45.521)
        XCTAssertEqual(request.longitude, -122.681)
        XCTAssertEqual(request.locationName, "Joe's Coffee")
        XCTAssertEqual(request.locationAddress, "123 Elm St")
        XCTAssertEqual(request.geocodeProvider, "mapbox")
        XCTAssertEqual(request.geocodeAccuracy, "poi")
        XCTAssertEqual(request.geocodePlaceId, "poi.1")
    }

    /// The tag is applied AFTER `mergeTargetContext` full-copies the
    /// request, so the picked venue wins over the flow target's
    /// location — while GPS attestation keeps attesting the device fix.
    func testPlaceTagOverridesFlowTargetLocation() {
        let vm = PulseComposeViewModel(
            intent: .announce,
            postingTarget: .currentLocation(latitude: 45.5, longitude: -122.4, label: "Camas, WA"),
            composePurpose: .localUpdate,
            api: makeAPI()
        )
        vm.update(.title, to: "New coffee spot")
        vm.update(.body, to: "Great pour-overs.")
        vm.selectPlaceTag(Self.placeTag)
        let request = vm.buildRequest()
        XCTAssertEqual(request.latitude, 45.521)
        XCTAssertEqual(request.longitude, -122.681)
        XCTAssertEqual(request.locationName, "Joe's Coffee")
        XCTAssertEqual(request.geocodePlaceId, "poi.1")
        // GPS attestation is untouched — it attests the device fix.
        XCTAssertEqual(request.gpsLatitude, 45.5)
        XCTAssertEqual(request.gpsLongitude, -122.4)
        XCTAssertNotNil(request.gpsTimestamp)
    }

    func testClearPlaceTagRemovesFields() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking.")
        vm.selectPlaceTag(Self.placeTag)
        vm.clearPlaceTag()
        XCTAssertNil(vm.selectedPlaceTag)
        let request = vm.buildRequest()
        XCTAssertNil(request.latitude)
        XCTAssertNil(request.longitude)
        XCTAssertNil(request.locationName)
        XCTAssertNil(request.locationAddress)
        XCTAssertNil(request.geocodeProvider)
        XCTAssertNil(request.geocodeAccuracy)
        XCTAssertNil(request.geocodePlaceId)
    }

    func testPlaceTagMarksDirty() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        XCTAssertFalse(vm.isDirty)
        vm.selectPlaceTag(Self.placeTag)
        XCTAssertTrue(vm.isDirty)
        vm.clearPlaceTag()
        XCTAssertFalse(vm.isDirty)
    }

    func testPlaceTagDoesNotDirtyEditMode() {
        // Place tags are create-only: buildUpdateRequest carries no
        // location fields, so a tag must never enable a no-op Save.
        let vm = PulseComposeViewModel(intent: .ask, postId: "post-1", api: makeAPI())
        vm.selectPlaceTag(Self.placeTag)
        XCTAssertFalse(vm.isDirty)
    }

    // MARK: - Media capture location (ADDENDUM 2)

    func testMediaCaptureLocationRecomputesOnAddAndRemove() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        XCTAssertNil(vm.mediaCaptureLocation)

        // First GEOTAGGED photo wins, even when an untagged one precedes it.
        let untagged = PulseComposePhoto(data: Data([0x1]))
        let tagged = PulseComposePhoto(
            data: Data([0x2]),
            capturedLatitude: 41.8781,
            capturedLongitude: -87.6298
        )
        vm.setPhotos([untagged, tagged])
        XCTAssertEqual(vm.mediaCaptureLocation?.latitude ?? 0, 41.8781, accuracy: 0.0001)
        XCTAssertEqual(vm.mediaCaptureLocation?.longitude ?? 0, -87.6298, accuracy: 0.0001)

        // Removing the geotagged photo clears the anchor.
        vm.remove(photo: tagged.id)
        XCTAssertNil(vm.mediaCaptureLocation)
        vm.remove(photo: untagged.id)
        XCTAssertNil(vm.mediaCaptureLocation)
    }

    func testMediaCaptureLocationPrefersEarliestGeotaggedPhoto() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.append(photo: PulseComposePhoto(
            data: Data([0x1]),
            capturedLatitude: 41.8781,
            capturedLongitude: -87.6298
        ))
        vm.append(photo: PulseComposePhoto(
            data: Data([0x2]),
            capturedLatitude: 30.2672,
            capturedLongitude: -97.7431
        ))
        XCTAssertEqual(vm.mediaCaptureLocation?.latitude ?? 0, 41.8781, accuracy: 0.0001)
    }

    /// PRIVACY: the media capture location never leaks onto the outgoing
    /// request — the body carries only an explicitly picked venue.
    func testMediaCaptureLocationNeverRidesTheRequest() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking.")
        vm.setPhotos([PulseComposePhoto(
            data: Data([0x2]),
            capturedLatitude: 41.8781,
            capturedLongitude: -87.6298
        )])
        let request = vm.buildRequest()
        XCTAssertNil(request.latitude)
        XCTAssertNil(request.longitude)
        XCTAssertNil(request.locationName)
        XCTAssertNil(request.geocodePlaceId)
    }

    // MARK: - Submit pipeline

    func testSubmitHappyPathSucceedsAndDismisses() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.successResponse)]
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking.")
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        if case let .success(id) = vm.state { XCTAssertEqual(id, "p_42") } else { XCTFail("state was \(vm.state)") }
        XCTAssertEqual(vm.toast?.text, "Posted")
        XCTAssertEqual(vm.toast?.kind, .success)
        XCTAssertTrue(vm.shouldDismiss)
    }

    func testSubmitAcceptsLegacyPostIdField() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.legacySuccessResponse)]
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking.")
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        if case let .success(id) = vm.state { XCTAssertEqual(id, "p_42") } else { XCTFail("state was \(vm.state)") }
    }

    func testSubmitUploadsPhotosAfterCreate() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: Self.successResponse),
            .status(200, body: """
            {"message":"1 file(s) uploaded","media_urls":["https://cdn.example.com/p.jpg"],\
            "media_types":["image"],"media_thumbnails":[""],"media_live_urls":[""]}
            """)
        ]
        let uploader = MultipartUploader(session: SequencedURLProtocol.makeSession())
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI(), multipartUploader: uploader)
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking.")
        vm.append(photo: PulseComposePhoto(data: Data([0xFF, 0xD8, 0xFF, 0x00])))
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.last?.url?.path.contains("/api/upload/post-media/p_42") ?? false
        )
    }

    func testSubmitErrorSurfacesToast() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"upstream\"}"),
            .status(500, body: "{\"error\":\"upstream\"}")
        ]
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.title, to: "Need a plumber")
        vm.update(.body, to: "Pipe is leaking.")
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertFalse(vm.shouldDismiss)
        if case .error = vm.state {} else { XCTFail("expected error state, got \(vm.state)") }
    }

    func testSubmitBlockedByValidation() async {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertEqual(vm.shakeTrigger, 1)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0, "no network call should fire")
    }

    func testAcknowledgeDismissResetsFlag() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        // Simulate a successful submit by hand to test the helper.
        vm.identity = .personal
        XCTAssertFalse(vm.shouldDismiss)
        vm.acknowledgeDismiss()
        XCTAssertFalse(vm.shouldDismiss)
    }

    // MARK: - Intent switch preserves draft

    func testSwitchIntentPreservesBody() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        vm.update(.body, to: "Need help with this.")
        vm.selectIntent(.announce)
        XCTAssertEqual(vm.fields[.body]?.value, "Need help with this.")
        XCTAssertEqual(vm.activeIntent, .announce)
    }

    // MARK: - Edit mode (P3.5)

    /// Build a JSON post-detail envelope with the supplied shape. Used
    /// by the edit-mode tests to drive the prefill loader.
    private static func postDetailJSON(
        postType: String,
        content: String,
        title: String? = nil,
        visibility: String = "neighborhood",
        eventDate: String? = nil,
        eventVenue: String? = nil,
        lostFoundType: String? = nil,
        serviceCategory: String? = nil,
        dealBusinessName: String? = nil
    ) -> String {
        var post: [String: Any] = [
            "id": "p_42",
            "user_id": "u_1",
            "content": content,
            "post_type": postType,
            "created_at": "2026-05-19T00:00:00Z",
            "visibility": visibility,
            "like_count": 0,
            "comment_count": 0,
            "comments": [],
            "userHasLiked": false,
            "userHasSaved": false,
            "userHasReposted": false
        ]
        if let title { post["title"] = title }
        if let eventDate { post["event_date"] = eventDate }
        if let eventVenue { post["event_venue"] = eventVenue }
        if let lostFoundType { post["lost_found_type"] = lostFoundType }
        if let serviceCategory { post["service_category"] = serviceCategory }
        if let dealBusinessName { post["deal_business_name"] = dealBusinessName }
        let body: [String: Any] = ["post": post]
        let data = (try? JSONSerialization.data(withJSONObject: body, options: [])) ?? Data()
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    func testIsEditingTrueWhenPostIdProvided() {
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        XCTAssertTrue(vm.isEditing)
        XCTAssertEqual(vm.editingPostId, "p_42")
        XCTAssertEqual(vm.displayTitle, "Edit post")
        XCTAssertEqual(vm.ctaLabel, "Save")
        XCTAssertTrue(vm.isIntentLocked)
    }

    func testIsEditingFalseInCreateMode() {
        let vm = PulseComposeViewModel(intent: .ask, api: makeAPI())
        XCTAssertFalse(vm.isEditing)
        XCTAssertNil(vm.editingPostId)
        XCTAssertEqual(vm.displayTitle, "New post")
        XCTAssertEqual(vm.ctaLabel, "Post")
        XCTAssertFalse(vm.isIntentLocked)
    }

    func testSelectIntentLockedInEditMode() {
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        vm.selectIntent(.announce)
        XCTAssertEqual(vm.activeIntent, .ask, "selectIntent must be a no-op in edit mode")
    }

    func testLoadForEditAskPrefillSeedsFields() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postDetailJSON(
                postType: "ask_local",
                content: "Pipe is leaking.",
                title: "Need a plumber",
                serviceCategory: "cleaning"
            ))
        ]
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        XCTAssertEqual(vm.prefillState, .loading)
        await vm.loadForEdit()
        XCTAssertEqual(vm.prefillState, .ready)
        XCTAssertEqual(vm.activeIntent, .ask)
        XCTAssertEqual(vm.fields[.title]?.value, "Need a plumber")
        XCTAssertEqual(vm.fields[.body]?.value, "Pipe is leaking.")
        XCTAssertEqual(vm.askCategory, .cleaning)
        // Re-baselined — every field starts non-dirty.
        XCTAssertFalse(vm.isDirty)
    }

    func testLoadForEditRecommendUnwrapsStarsAndBody() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postDetailJSON(
                postType: "recommendation",
                content: "★★★★☆\n\nGreat lattes.",
                dealBusinessName: "Joe's Coffee"
            ))
        ]
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        await vm.loadForEdit()
        XCTAssertEqual(vm.activeIntent, .recommend)
        XCTAssertEqual(vm.recommendRating, 4)
        XCTAssertEqual(vm.fields[.body]?.value, "Great lattes.")
        XCTAssertEqual(vm.fields[.recommendBusiness]?.value, "Joe's Coffee")
        XCTAssertFalse(vm.isDirty)
    }

    func testLoadForEditLostUnwrapsLastSeenPrefix() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postDetailJSON(
                postType: "lost_found",
                content: "Last seen: 5th & Elm\n\nMochi the cat.",
                lostFoundType: "lost"
            ))
        ]
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        await vm.loadForEdit()
        XCTAssertEqual(vm.activeIntent, .lost)
        XCTAssertEqual(vm.fields[.lostLastSeenLocation]?.value, "5th & Elm")
        XCTAssertEqual(vm.fields[.body]?.value, "Mochi the cat.")
        XCTAssertEqual(vm.lostFoundKind, .lost)
        XCTAssertFalse(vm.isDirty)
    }

    func testLoadForEditEventNormalizesISODate() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postDetailJSON(
                postType: "event",
                content: "Bring chairs.",
                title: "Block party",
                eventDate: "2030-08-15T17:00:00Z",
                eventVenue: "Elm Park"
            ))
        ]
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        await vm.loadForEdit()
        XCTAssertEqual(vm.activeIntent, .event)
        XCTAssertEqual(vm.fields[.title]?.value, "Block party")
        XCTAssertEqual(vm.fields[.eventLocation]?.value, "Elm Park")
        XCTAssertEqual(vm.fields[.eventDate]?.value, "2030-08-15 17:00")
        XCTAssertFalse(vm.isDirty)
    }

    func testLoadForEditFailureSurfacesPrefillError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"down\"}")]
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        await vm.loadForEdit()
        if case .error = vm.prefillState {} else {
            XCTFail("expected prefillState.error, got \(vm.prefillState)")
        }
    }

    func testBuildUpdateRequestForAskCarriesEditableFields() {
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        vm.update(.title, to: "New title")
        vm.update(.body, to: "Updated body.")
        vm.askCategory = .advice
        let request = vm.buildUpdateRequest()
        XCTAssertEqual(request.title, "New title")
        XCTAssertEqual(request.content, "Updated body.")
        XCTAssertEqual(request.serviceCategory, "advice")
        XCTAssertEqual(request.visibility, "neighborhood")
    }

    func testEditSubmitSendsPATCH() async {
        // Prefill response first, then PATCH ack.
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postDetailJSON(
                postType: "ask_local",
                content: "Pipe is leaking.",
                title: "Need a plumber"
            )),
            .status(200, body: "{\"message\":\"Post updated successfully\",\"post\":{\"id\":\"p_42\"}}")
        ]
        let vm = PulseComposeViewModel(intent: .ask, postId: "p_42", api: makeAPI())
        await vm.loadForEdit()
        vm.update(.body, to: "Pipe still leaking.")
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertTrue(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.text, "Saved")
        // Second captured request is the PATCH.
        let captured = SequencedURLProtocol.capturedRequests
        XCTAssertEqual(captured.count, 2)
        XCTAssertEqual(captured.last?.httpMethod, "PATCH")
        XCTAssertEqual(captured.last?.url?.path, "/api/posts/p_42")
    }
}
