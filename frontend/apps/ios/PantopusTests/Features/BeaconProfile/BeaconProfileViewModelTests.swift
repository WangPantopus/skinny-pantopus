//
//  BeaconProfileViewModelTests.swift
//  PantopusTests
//
//  Covers the A21.1 public Beacon profile VM: owner load via
//  /personas/me, visitor load via /personas/:handle (with the viewer
//  follow projection), the owner no-persona empty state, visitor
//  not-found error, and the tier-gated locked-broadcast projection.
//

import XCTest
@testable import Pantopus

@MainActor
final class BeaconProfileViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    func testOwnerLoadsPersonaAndProjectsStats() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.ownerPersonaJSON),
            .status(200, body: Self.postsJSON),
            .status(200, body: Self.tiersJSON)
        ]
        let vm = BeaconProfileViewModel(mode: .owner, client: makeAPI())
        await vm.load()

        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertTrue(content.isOwner)
        XCTAssertEqual(content.displayName, "Maria K.")
        XCTAssertEqual(content.handle, "mariak")
        XCTAssertEqual(content.posts.count, 2)
        XCTAssertEqual(content.tiers.count, 1)
        XCTAssertEqual(content.tiers.first?.priceLabel, "$4/mo")
        XCTAssertEqual(content.stats.count, 2)
        XCTAssertEqual(content.stats.first?.label, "Beacons")
        XCTAssertEqual(content.stats.first?.value, "1.2K")
        XCTAssertTrue(content.broadcastEnabled)
        XCTAssertEqual(vm.followStatus, .none)
    }

    func testOwnerWithNoPersonaShowsEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"persona":null,"channel":null}"#)
        ]
        let vm = BeaconProfileViewModel(mode: .owner, client: makeAPI())
        await vm.load()

        guard case .empty = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
    }

    func testVisitorFollowingProjection() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.visitorFollowingJSON),
            .status(200, body: Self.postsJSON),
            .status(200, body: Self.tiersJSON)
        ]
        let vm = BeaconProfileViewModel(mode: .visitor(handle: "@mariak"), client: makeAPI())
        await vm.load()

        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(content.isOwner)
        XCTAssertEqual(vm.followStatus, .active)
        XCTAssertTrue(vm.notificationsEnabled)
    }

    func testVisitorNotFoundShowsError() async {
        SequencedURLProtocol.sequence = [
            .status(404, body: #"{"error":"not found"}"#)
        ]
        let vm = BeaconProfileViewModel(mode: .visitor(handle: "ghost"), client: makeAPI())
        await vm.load()

        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testLockedBroadcastIsLockedForVisitor() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.visitorFollowingJSON),
            .status(200, body: Self.lockedPostsJSON),
            .status(200, body: Self.tiersJSON)
        ]
        let vm = BeaconProfileViewModel(mode: .visitor(handle: "mariak"), client: makeAPI())
        await vm.load()

        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.posts.count, 1)
        XCTAssertTrue(content.posts.first?.isLocked ?? false)
        XCTAssertEqual(content.posts.first?.visibility, .silver)
    }

    func testFollowerCountBumpKeepsCompactedValue() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.visitorFollowingJSON),
            .status(200, body: Self.postsJSON),
            .status(200, body: Self.tiersJSON),
            .status(200, body: #"{"message":"unfollowed"}"#)
        ]
        let vm = BeaconProfileViewModel(mode: .visitor(handle: "mariak"), client: makeAPI())
        await vm.load()

        guard case let .loaded(before) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // 1200 followers renders compacted, NOT as a raw integer.
        XCTAssertEqual(before.stats.first?.value, "1.2K")

        // Unfollow recomputes from the raw count and re-compacts — it must
        // NOT collapse "1.2K" into "11" (the pre-fix regression).
        await vm.unfollow()
        guard case let .loaded(after) = vm.state else {
            XCTFail("Expected .loaded after unfollow")
            return
        }
        XCTAssertEqual(vm.followStatus, .none)
        XCTAssertEqual(after.followerCount, 1199)
        XCTAssertEqual(after.stats.first?.value, "1.2K")
    }

    func testCredentialDrivesVerification() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.verifiedPersonaJSON),
            .status(200, body: Self.postsJSON),
            .status(200, body: Self.tiersJSON)
        ]
        let verified = BeaconProfileViewModel(mode: .visitor(handle: "mariak"), client: makeAPI())
        await verified.load()
        guard case let .loaded(v) = verified.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertTrue(v.header.isVerified)
        XCTAssertEqual(v.header.tierLabel, "Persona · Verified")

        // No credential ⇒ unverified + "New" (the owner fixture has no credential).
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.ownerPersonaJSON),
            .status(200, body: Self.postsJSON),
            .status(200, body: Self.tiersJSON)
        ]
        let unverified = BeaconProfileViewModel(mode: .owner, client: makeAPI())
        await unverified.load()
        guard case let .loaded(u) = unverified.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertFalse(u.header.isVerified)
        XCTAssertEqual(u.header.tierLabel, "Persona · New")
    }

    func testTierRankDrivesVisibilityWithoutTierString() async {
        // Real backend shape: raw Post row with visibility "followers" +
        // target_tier_rank 2 (the DB enum never carries "tier_or_above").
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.visitorFollowingJSON),
            .status(200, body: Self.gatedPostJSON),
            .status(200, body: Self.tiersJSON)
        ]
        let vm = BeaconProfileViewModel(mode: .visitor(handle: "mariak"), client: makeAPI())
        await vm.load()

        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.posts.first?.visibility, .silver)
    }

    // MARK: - Fixtures

    // JSON fixtures mirror the on-wire shape verbatim, so lines run long.
    // swiftlint:disable line_length

    private static let ownerPersonaJSON = #"""
    {"persona":{"id":"p1","handle":"mariak","displayName":"Maria K.","avatarUrl":null,"bannerUrl":null,"bio":"Sourdough scientist.","category":"creator","audienceLabel":"followers","audienceMode":"open","followerCount":1200,"postCount":47,"broadcastEnabled":true,"publicLinks":[{"label":"Site","url":"https://example.com"}]},"channel":{"id":"c1","title":"Maria","status":"active"}}
    """#

    private static let visitorFollowingJSON = #"""
    {"persona":{"id":"p1","handle":"mariak","displayName":"Maria K.","bio":"bio","category":"creator","audienceLabel":"followers","audienceMode":"open","followerCount":1200,"postCount":47,"broadcastEnabled":true,"viewer":{"isOwner":false,"isFollowing":true,"followStatus":"active","notificationLevel":"all"}},"channel":null}
    """#

    private static let verifiedPersonaJSON = #"""
    {"persona":{"id":"p1","handle":"mariak","displayName":"Maria K.","bio":"bio","category":"creator","audienceLabel":"followers","audienceMode":"open","followerCount":1200,"postCount":47,"broadcastEnabled":true,"credential":{"status":"verified","label":"Verified"},"viewer":{"isOwner":false,"isFollowing":false,"followStatus":"none","notificationLevel":"all"}},"channel":null}
    """#

    private static let postsJSON = #"""
    {"posts":[{"id":"po1","body":"Today's loaf has a crumb you could read poetry through.","created_at":"2026-06-19T10:00:00.000Z","visibility":"public","like_count":34,"comment_count":8},{"id":"po2","content":"Tuesday market field notes.","created_at":"2026-06-17T10:00:00.000Z","visibility":"followers","like_count":51,"comment_count":14}]}
    """#

    private static let lockedPostsJSON = #"""
    {"posts":[{"id":"lp1","visibility":"tier_or_above","target_tier_rank":2,"locked":true,"teaser":"Subscribe to read the full recipe…","created_at":"2026-06-19T10:00:00.000Z"}]}
    """#

    private static let gatedPostJSON = #"""
    {"posts":[{"id":"g1","body":"members only","created_at":"2026-06-19T10:00:00.000Z","visibility":"followers","target_tier_rank":2}]}
    """#

    private static let tiersJSON = #"""
    {"tiers":[{"id":"t1","rank":1,"name":"Bronze","description":"Recipes + timing charts","priceCents":400,"currency":"usd"}]}
    """#
    // swiftlint:enable line_length
}
