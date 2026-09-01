//
//  StampsViewModelTests.swift
//  PantopusTests
//
//  A17.11 — state-projection coverage for the Stamps view-model. Asserts
//  the populated + empty wallet frames project off the sample fixtures,
//  the book balance maths line up, the buy-CTA stubs mutate local state,
//  and the two live surfaces (stamp collection + seasonal themes) project
//  their backend payloads and apply an unlocked theme.
//

import XCTest
@testable import Pantopus

@MainActor
final class StampsViewModelTests: XCTestCase {
    private static let stampsPath = "/api/mailbox/v2/p3/stamps"
    private static let themesPath = "/api/mailbox/v2/p3/themes"
    private static let applyPath = "/api/mailbox/v2/p3/themes/apply"

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    /// Both live fetches stubbed out with 500s — the wallet frame is
    /// unaffected, which is what the fixture assertions below care about.
    private func makeVM(
        seed: StampsSeed = .populated,
        routes: [String: [SequencedURLProtocol.Response]] = [:],
        onBack: @escaping @MainActor () -> Void = {}
    ) -> StampsViewModel {
        var merged = routes
        merged[Self.stampsPath] = merged[Self.stampsPath]
            ?? [.status(500, body: "{\"error\":\"stub\"}")]
        merged[Self.themesPath] = merged[Self.themesPath]
            ?? [.status(500, body: "{\"error\":\"stub\"}")]
        return StampsViewModel(
            seed: seed,
            api: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: merged),
                retryPolicy: .none
            ),
            onBack: onBack
        )
    }

    // MARK: - Initial / loading

    func test_initialState_isLoading() {
        let vm = makeVM()
        guard case .loading = vm.state else {
            return XCTFail("Expected .loading before load(), got \(vm.state)")
        }
    }

    // MARK: - Populated frame

    func test_load_populated_projectsContent() async {
        let vm = makeVM()
        await vm.load()

        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.book.total, 12)
        XCTAssertEqual(content.book.used, 4)
        XCTAssertEqual(content.book.remaining, 8)
        XCTAssertEqual(content.wallet.count, 4)
        XCTAssertEqual(content.usage.count, 4)
        XCTAssertEqual(content.insights.count, 3)
        XCTAssertEqual(content.trust, .verified)
        XCTAssertEqual(content.categoryLabel, "Stamps")
    }

    func test_book_remainingFraction() {
        let book = StampsSampleData.populated.book
        XCTAssertEqual(book.remainingFraction, 8.0 / 12.0, accuracy: 0.0001)
    }

    // MARK: - Empty frame

    func test_load_empty_projectsEmpty() async {
        let vm = makeVM(seed: .empty)
        await vm.load()

        guard case let .empty(content) = vm.state else {
            return XCTFail("Expected .empty, got \(vm.state)")
        }
        XCTAssertEqual(content.headline, "No stamps yet")
        XCTAssertEqual(content.starterBook.priceLabel, "$4.80")
    }

    // MARK: - Buy stubs (local state, no Stripe)

    func test_buyMore_refillsTheBook() async {
        let vm = makeVM()
        await vm.load()

        vm.buyMore()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded after buyMore")
        }
        XCTAssertEqual(content.book.used, 0, "Buying more refills the featured book")
        XCTAssertEqual(content.book.remaining, content.book.total)
    }

    func test_buyMore_noOpWhenEmpty() async {
        let vm = makeVM(seed: .empty)
        await vm.load()

        vm.buyMore() // should not crash or change the empty frame
        guard case .empty = vm.state else {
            return XCTFail("buyMore on empty should leave .empty intact")
        }
    }

    func test_purchaseStarterBook_flipsEmptyToPopulated() async {
        let vm = makeVM(seed: .empty)
        await vm.load()
        guard case .empty = vm.state else { return XCTFail("Expected .empty start") }

        vm.purchaseStarterBook()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded after acquiring the starter book")
        }
        XCTAssertEqual(content.book.total, 12)
    }

    // MARK: - Navigation

    func test_tapBack_invokesCallback() {
        var backs = 0
        let vm = makeVM { backs += 1 }
        vm.tapBack()
        XCTAssertEqual(backs, 1)
    }

    // MARK: - Mode toggle

    func test_toggleMode_flipsBetweenStampsAndThemes() {
        let vm = makeVM()
        XCTAssertEqual(vm.mode, .stamps)
        vm.toggleMode()
        XCTAssertEqual(vm.mode, .themes)
        vm.toggleMode()
        XCTAssertEqual(vm.mode, .stamps)
    }

    // MARK: - Collection (GET /p3/stamps)

    func test_load_projectsStampCollection() async {
        let vm = makeVM(routes: [
            Self.stampsPath: [
                .status(200, body: """
                {"earned":[{"id":"s1","stamp_type":"first_mail","name":"First Mail",\
                "description":"Received your first mail item","rarity":"common",\
                "earned_at":"2026-05-04T12:00:00Z"}],\
                "locked":[{"stamp_type":"collector","name":"Collector",\
                "description":"Earned 10 stamps","rarity":"legendary","progress":0,"target":1}],\
                "total_earned":1,"total_available":13}
                """)
            ]
        ])
        await vm.load()

        guard case let .loaded(collection) = vm.collection else {
            return XCTFail("Expected .loaded collection, got \(vm.collection)")
        }
        XCTAssertEqual(collection.totalEarned, 1)
        XCTAssertEqual(collection.totalAvailable, 13)
        XCTAssertEqual(collection.progressLabel, "1 of 13 collected")
        XCTAssertEqual(collection.earned.first?.name, "First Mail")
        XCTAssertEqual(collection.earned.first?.rarity, .common)
        XCTAssertEqual(collection.earned.first?.earnedLabel, "Earned May 4, 2026")
        XCTAssertEqual(collection.locked.first?.id, "collector")
        XCTAssertEqual(collection.locked.first?.rarity, .legendary)
        XCTAssertTrue(collection.locked.first?.isLocked == true)
    }

    func test_load_emptyCollection_projectsEmptyState() async {
        let vm = makeVM(routes: [
            Self.stampsPath: [
                .status(200, body: """
                {"earned":[],"locked":[],"total_earned":0,"total_available":0}
                """)
            ]
        ])
        await vm.load()

        guard case .empty = vm.collection else {
            return XCTFail("Expected .empty collection, got \(vm.collection)")
        }
    }

    func test_load_collectionFailure_projectsError() async {
        let vm = makeVM()
        await vm.load()

        guard case .error = vm.collection else {
            return XCTFail("Expected .error collection, got \(vm.collection)")
        }
    }

    // MARK: - Themes (GET /p3/themes · POST /p3/themes/apply)

    func test_load_projectsThemes() async {
        let vm = makeVM(routes: [
            Self.themesPath: [.status(200, body: Self.themesBody)]
        ])
        await vm.load()

        guard case let .loaded(themes) = vm.themes else {
            return XCTFail("Expected .loaded themes, got \(vm.themes)")
        }
        // The fixture carries three themes — t3 ("Harvest", the default-unlock
        // autumn theme) was added with the wave-B stamps work but the count was
        // never updated. Locked themes are projected too, which the
        // `themes[1].isUnlocked == false` assertion below relies on.
        XCTAssertEqual(themes.themes.count, 3)
        XCTAssertEqual(themes.activeThemeId, "t1")
        XCTAssertEqual(themes.activeTheme?.name, "First Frost")
        XCTAssertEqual(themes.themes.first?.season, .winter)
        XCTAssertTrue(themes.themes.first?.autoApplies == true)
        XCTAssertFalse(themes.themes[1].isUnlocked)
    }

    func test_applyTheme_swapsActiveTheme() async {
        let vm = makeVM(routes: [
            Self.themesPath: [.status(200, body: Self.themesBody)],
            Self.applyPath: [.status(200, body: "{\"message\":\"Theme applied\"}")]
        ])
        await vm.load()
        await vm.applyTheme(id: "t3")

        guard case let .loaded(themes) = vm.themes else {
            return XCTFail("Expected .loaded themes, got \(vm.themes)")
        }
        XCTAssertEqual(themes.activeThemeId, "t3")
        XCTAssertEqual(vm.toast, "Harvest applied")
    }

    func test_applyTheme_lockedThemeIsIgnored() async {
        let vm = makeVM(routes: [
            Self.themesPath: [.status(200, body: Self.themesBody)]
        ])
        await vm.load()
        await vm.applyTheme(id: "t2")

        guard case let .loaded(themes) = vm.themes else {
            return XCTFail("Expected .loaded themes, got \(vm.themes)")
        }
        XCTAssertEqual(themes.activeThemeId, "t1", "A locked theme must not be applied")
    }

    func test_applyTheme_failureRollsBack() async {
        let vm = makeVM(routes: [
            Self.themesPath: [.status(200, body: Self.themesBody)],
            Self.applyPath: [.status(500, body: "{\"error\":\"Failed to apply theme\"}")]
        ])
        await vm.load()
        await vm.applyTheme(id: "t3")

        guard case let .loaded(themes) = vm.themes else {
            return XCTFail("Expected .loaded themes, got \(vm.themes)")
        }
        XCTAssertEqual(themes.activeThemeId, "t1", "A failed apply rolls the active theme back")
        XCTAssertNotNil(vm.toast)
    }

    private static let themesBody = """
    {"themes":[\
    {"id":"t1","name":"First Frost","season":"winter","accent_color":"#60A5FA",\
    "auto_apply":true,"active_from":"2026-12-01T00:00:00Z",\
    "active_until":"2027-02-28T00:00:00Z","unlock_condition":"seasonal_auto","unlocked":true},\
    {"id":"t2","name":"Gold Leaf","season":"custom","accent_color":"#9CA3AF",\
    "auto_apply":false,"unlock_condition":"premium","unlocked":false},\
    {"id":"t3","name":"Harvest","season":"autumn","accent_color":"#EA580C",\
    "auto_apply":false,"unlock_condition":"default","unlocked":true}],\
    "active":"t1"}
    """
}
