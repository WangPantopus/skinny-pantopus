import XCTest
@testable import Pantopus

@MainActor
final class PlaceArrivalTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suite: String!
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private var suggestion: GeoSuggestion {
        GeoSuggestion(
            suggestionId: "address",
            placeId: nil,
            primaryText: "12 Example St",
            secondaryText: "Camas, WA 98607",
            label: "12 Example St, Camas, WA 98607",
            text: nil,
            center: [-122.4, 45.6],
            kind: "address"
        )
    }

    override func setUp() {
        super.setUp()
        suite = "place-arrival-tests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suite)
        defaults = nil
        super.tearDown()
    }

    func testDraftSurvivesRepeatedReadsAndExpiresAt24Hours() throws {
        XCTAssertTrue(PlacePendingStore.stash(suggestion, defaults: defaults, now: now))
        let draft = try XCTUnwrap(PlacePendingStore.read(defaults: defaults, now: now))
        XCTAssertEqual(draft.label, suggestion.label)
        XCTAssertEqual(draft.latitude, 45.6)
        XCTAssertEqual(PlacePendingStore.read(defaults: defaults, now: now), draft)
        XCTAssertNil(PlacePendingStore.read(defaults: defaults, now: now.addingTimeInterval(86400)))
        XCTAssertNil(defaults.data(forKey: PlacePendingStore.key))
    }

    func testBindingCannotAttachToAnotherAccountOrExtendExpiry() throws {
        PlacePendingStore.stash(suggestion, defaults: defaults, now: now)
        let draft = try XCTUnwrap(PlacePendingStore.bind(to: "a", defaults: defaults, now: now.addingTimeInterval(60)))
        XCTAssertEqual(draft.expiresAt, now.addingTimeInterval(86400))
        XCTAssertEqual(draft.userId, "a")
        XCTAssertNil(PlacePendingStore.bind(to: "b", defaults: defaults, now: now.addingTimeInterval(120)))
        XCTAssertNil(defaults.data(forKey: PlacePendingStore.key))
    }

    func testOldOrMalformedDraftIsCleared() {
        defaults.set(Data(#"{"street":"Old address"}"#.utf8), forKey: PlacePendingStore.key)
        XCTAssertNil(PlacePendingStore.read(defaults: defaults))
        XCTAssertNil(defaults.data(forKey: PlacePendingStore.key))
    }

    func testLateSaveCannotClearNewDraft() throws {
        PlacePendingStore.stash(suggestion, defaults: defaults)
        let old = try XCTUnwrap(PlacePendingStore.read(defaults: defaults))
        PlacePendingStore.stash(suggestion, defaults: defaults)
        PlacePendingStore.clear(id: old.id, defaults: defaults)
        XCTAssertNotNil(PlacePendingStore.read(defaults: defaults))
    }

    func testNoAutomaticSaveAndRetryRetainsDraftUntilConfirmed() async {
        PlacePendingStore.stash(suggestion, defaults: defaults)
        var calls = 0
        let vm = PendingPlaceViewModel(userId: "a", defaults: defaults, currentUser: { "a" }, savePlace: { body in
            calls += 1
            XCTAssertEqual(body.expectedUserId, "a")
            XCTAssertEqual(body.label, self.suggestion.label)
            if calls == 1 { throw URLError(.notConnectedToInternet) }
            return self.savedPlace(userId: "a")
        })
        XCTAssertEqual(calls, 0)
        await vm.save()
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertNotNil(PlacePendingStore.read(defaults: defaults))
        await vm.save()
        XCTAssertEqual(calls, 2)
        XCTAssertEqual(vm.saved?.id, "saved-1")
        XCTAssertNil(PlacePendingStore.read(defaults: defaults))
        await vm.save()
        XCTAssertEqual(calls, 2)
    }

    func testSessionChangePreventsRequestAndWrongResponseRetainsDraft() async {
        PlacePendingStore.stash(suggestion, defaults: defaults)
        var currentUser = "b"
        var calls = 0
        let vm = PendingPlaceViewModel(userId: "a", defaults: defaults, currentUser: { currentUser }, savePlace: { _ in
            calls += 1
            return self.savedPlace(userId: "b")
        })
        await vm.save()
        XCTAssertEqual(calls, 0)
        currentUser = "a"
        await vm.save()
        XCTAssertEqual(calls, 1)
        XCTAssertNil(vm.saved)
        XCTAssertNotNil(PlacePendingStore.read(defaults: defaults))
    }

    func testDuplicateTapStartsOnlyOneSave() async {
        PlacePendingStore.stash(suggestion, defaults: defaults)
        var calls = 0
        var resume: CheckedContinuation<Void, Never>?
        let vm = PendingPlaceViewModel(userId: "a", defaults: defaults, currentUser: { "a" }, savePlace: { _ in
            calls += 1
            await withCheckedContinuation { resume = $0 }
            return self.savedPlace(userId: "a")
        })
        let task = Task { await vm.save() }
        while resume == nil {
            await Task.yield()
        }
        await vm.save()
        XCTAssertEqual(calls, 1)
        resume?.resume()
        await task.value
        XCTAssertNotNil(vm.saved)
    }

    func testSocialDestinationsSurviveSignIn() throws {
        let router = DeepLinkRouter.shared
        defer {
            router.clearPending()
            PendingDeepLinkStore.clear()
            DeepLinkRouter.bindSignedInProvider(nil)
        }
        let cases: [(String, DeepLinkRouter.Destination)] = [
            ("https://pantopus.app/app/feed?surface=personas", .beacons),
            ("https://pantopus.app/app/feed?post=p1&surface=place", .post(id: "p1")),
            ("https://pantopus.app/persona/maria", .beaconProfile(handle: "maria"))
        ]
        for (link, expected) in cases {
            DeepLinkRouter.bindSignedInProvider { false }
            router.clearPending()
            try router.handle(url: XCTUnwrap(URL(string: link)))
            XCTAssertNil(router.pending)
            let saved = try XCTUnwrap(PendingDeepLinkStore.take())
            DeepLinkRouter.bindSignedInProvider { true }
            try router.handle(url: XCTUnwrap(URL(string: saved)))
            XCTAssertEqual(router.consume(), expected)
        }
    }

    func testSavedPlaceWireContractCarriesAccountGuard() throws {
        let body = SavePlaceBody(
            label: "Example",
            placeType: "searched",
            latitude: 45.6,
            longitude: -122.4,
            expectedUserId: "a"
        )
        let data = try JSONEncoder().encode(body)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["expectedUserId"] as? String, "a")
        let response = try JSONDecoder().decode(SavedPlaceResponse.self, from: Data(
            #"{"savedPlace":{"id":"saved-1","user_id":"a","label":"Example","place_type":"searched","latitude":45.6,"longitude":-122.4}}"#
                .utf8
        ))
        XCTAssertEqual(response.savedPlace.userId, "a")
    }

    private func savedPlace(userId: String) -> SavedPlaceDTO {
        SavedPlaceDTO(
            id: "saved-1",
            label: suggestion.label,
            placeType: "searched",
            latitude: 45.6,
            longitude: -122.4,
            city: nil,
            state: nil,
            sourceId: nil,
            geocodePlaceId: nil,
            createdAt: nil,
            userId: userId
        )
    }
}
