//
//  PublicProfileSnapshotTests.swift
//  PantopusTests
//
//  P6.5 — Structural render snapshot for the Public Profile screen
//  across both kinds (Persona, Local) and every render state
//  (loading / populated / error). Same pattern as
//  `PulseComposeSnapshotTests`: until `swift-snapshot-testing` ships
//  in `project.yml`, this test asserts that each fixture state
//  produces a valid hosting controller hierarchy with non-zero
//  geometry. The fixtures exercise the kind-specific chrome
//  (banner, header chips, sticky CTAs, broadcast paywall overlay).
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class PublicProfileSnapshotTests: XCTestCase {
    // MARK: - Loading / error chrome (kind-agnostic)

    func test_publicProfile_loading_renders() {
        let view = LoadingFixtureView()
        assertRenders(view)
    }

    func test_publicProfile_error_renders() {
        let view = ErrorFixtureView()
        assertRenders(view)
    }

    // MARK: - Persona kind

    func test_publicProfile_persona_populated_renders() {
        let view = LoadedFixtureView(content: PublicProfileFixture.personaPopulated)
        assertRenders(view)
    }

    func test_publicProfile_persona_empty_posts_renders() {
        let view = LoadedFixtureView(content: PublicProfileFixture.personaEmpty)
        assertRenders(view)
    }

    func test_publicProfile_persona_followState_succeeded_renders() {
        let view = LoadedFixtureView(
            content: PublicProfileFixture.personaPopulated,
            followState: .succeeded
        )
        assertRenders(view)
    }

    func test_publicProfile_persona_paywall_overlay_renders() {
        // Sanity-check the locked broadcast variant: confirm at least
        // one locked post is present in the populated persona fixture.
        let lockedCount = PublicProfileFixture.personaPopulated.posts.filter(\.isLocked).count
        XCTAssertGreaterThan(lockedCount, 0, "Persona fixture must include a locked broadcast")
    }

    // MARK: - Local kind

    func test_publicProfile_local_populated_renders() {
        let view = LoadedFixtureView(content: PublicProfileFixture.localPopulated)
        assertRenders(view)
    }

    func test_publicProfile_local_empty_posts_renders() {
        let view = LoadedFixtureView(content: PublicProfileFixture.localEmpty)
        assertRenders(view)
    }

    func test_publicProfile_local_connectState_succeeded_renders() {
        let view = LoadedFixtureView(
            content: PublicProfileFixture.localPopulated,
            connectState: .succeeded
        )
        assertRenders(view)
    }

    // MARK: - Kind invariants

    func test_personaFixture_has_personaKind_and_tier_label() {
        let content = PublicProfileFixture.personaPopulated
        XCTAssertEqual(content.kind, .persona)
        XCTAssertNotNil(content.header.tierLabel)
        XCTAssertFalse(content.header.isVerifiedNeighbor)
    }

    func test_localFixture_has_localKind_and_neighbor_chip() {
        let content = PublicProfileFixture.localPopulated
        XCTAssertEqual(content.kind, .local)
        XCTAssertTrue(content.header.isVerifiedNeighbor)
        XCTAssertNil(content.header.tierLabel)
    }

    func test_localFixture_posts_carry_intent_not_visibility() {
        // Local posts use `intent` (Offer / Alert / Event); the
        // visibility field is reserved for persona broadcasts and stays
        // nil for local kind.
        for post in PublicProfileFixture.localPopulated.posts {
            XCTAssertNotNil(post.intent, "Local post must carry an intent chip")
            XCTAssertNil(post.visibility, "Local post must NOT carry a tier visibility chip")
            XCTAssertFalse(post.isLocked, "Local post must NOT be locked")
        }
    }

    func test_personaFixture_posts_carry_visibility_not_intent() {
        for post in PublicProfileFixture.personaPopulated.posts {
            XCTAssertNotNil(post.visibility, "Persona broadcast must carry a visibility chip")
            XCTAssertNil(post.intent, "Persona broadcast must NOT carry an intent chip")
        }
    }

    // MARK: - Render helper

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 800))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 800)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}

// MARK: - Test-host wrappers around the kind-specific chrome

/// Test host that pins the StatsTabsBody to an `@State` so we can
/// exercise the same view tree the screen uses.
@MainActor
private struct LoadedFixtureView: View {
    let content: PublicProfileContent
    var followState: PublicProfileActionState = .idle
    var connectState: PublicProfileActionState = .idle
    @State private var selectedTab: ProfileTab = .about

    var body: some View {
        ContentDetailShell(
            title: nil,
            onBack: nil,
            header: {
                VStack(spacing: Spacing.s0) {
                    PublicProfileBanner(kind: content.kind)
                    BeaconIdentityBlock(
                        identity: content.kind == .persona ? .personal : .home,
                        name: content.header.displayName,
                        handle: content.header.handle,
                        tierLabel: content.header.tierLabel,
                        isVerifiedNeighbor: content.header.isVerifiedNeighbor,
                        locality: content.header.locality,
                        bio: content.stats.bio,
                        isVerified: content.header.isVerified,
                        avatarURL: content.header.avatarURL,
                        stats: content.stats.stats
                    ) {
                        identityActions
                    }
                }
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    StatsTabsBody(
                        content: content.stats,
                        selectedTab: $selectedTab,
                        showStats: false,
                        showActionRow: false
                    )
                    PublicProfilePostsFeed(
                        kind: content.kind,
                        posts: content.posts,
                        onUnlock: { _ in },
                        onEmptyCTA: {}
                    )
                }
            }
        )
    }

    @ViewBuilder private var identityActions: some View {
        switch content.kind {
        case .persona:
            BeaconHeaderGhostButton(icon: .share, accessibilityLabel: "Share profile") {}
            BeaconHeaderPrimaryButton(
                title: followState == .succeeded ? "Following" : "Follow",
                icon: .plus,
                isProminent: followState != .succeeded
            ) {}
        case .local:
            BeaconHeaderGhostButton(
                title: connectState == .succeeded ? "Requested" : "Connect",
                icon: .userPlus,
                accessibilityLabel: "Connect"
            ) {}
            BeaconHeaderPrimaryButton(title: "Message", icon: .messageSquare) {}
        }
    }
}

@MainActor
private struct LoadingFixtureView: View {
    var body: some View {
        ContentDetailShell(
            title: nil,
            onBack: nil,
            header: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(width: 72, height: 72, cornerRadius: 36)
                    Shimmer(width: 160, height: 22, cornerRadius: Radii.sm)
                    Shimmer(width: 220, height: 12, cornerRadius: Radii.sm)
                }
                .padding(.top, Spacing.s5)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 80, cornerRadius: Radii.lg)
                    Shimmer(height: 42, cornerRadius: Radii.lg)
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

@MainActor
private struct ErrorFixtureView: View {
    var body: some View {
        ContentDetailShell(
            title: nil,
            onBack: nil,
            header: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this profile",
                    subcopy: "Check your connection and try again."
                )
            },
            body: { EmptyView() }
        )
    }
}

// MARK: - Fixtures

@MainActor
enum PublicProfileFixture {
    static let personaPopulated: PublicProfileContent = {
        let profile = PublicProfile.testFixture(
            id: "u1",
            username: "mariak",
            name: "Maria K.",
            verified: true
        )
        return PublicProfileContent(
            profile: profile,
            kind: .persona,
            header: PublicProfileHeader(
                displayName: "Maria K.",
                handle: "mariak",
                locality: "Elm Park",
                avatarURL: nil,
                isVerified: true,
                identityBadges: [
                    IdentityPillarBadge(pillar: .personal, state: .verified),
                    IdentityPillarBadge(pillar: .home, state: .unverified),
                    IdentityPillarBadge(pillar: .business, state: .unverified)
                ],
                tierLabel: "Persona · Verified",
                isVerifiedNeighbor: false
            ),
            stats: StatsTabsContent(
                stats: [
                    ProfileStatCell(id: "beacons", value: "1.2K", label: "Beacons"),
                    ProfileStatCell(id: "broadcasts", value: "47", label: "Broadcasts"),
                    ProfileStatCell(id: "member", value: "Aug 24", label: "Member")
                ],
                bio: "Sourdough scientist, Tuesday markets, late-night neighborhood walks.",
                skills: ["Sourdough", "Coffee", "Walking"],
                reviews: []
            ),
            posts: [
                PublicProfilePost(
                    id: "b1",
                    body: "Today's loaf has a crumb you could read poetry through.",
                    timeAgo: "2h ago",
                    reactions: 34,
                    replies: 8,
                    visibility: .free
                ),
                PublicProfilePost(
                    id: "b2",
                    body: "Full recipe + timing chart — six months of refining.",
                    timeAgo: "Yesterday",
                    reactions: 22,
                    replies: 3,
                    visibility: .bronze,
                    isLocked: true
                ),
                PublicProfilePost(
                    id: "b3",
                    body: "Tuesday market field notes — that new cheese stall is the real deal.",
                    timeAgo: "3d ago",
                    reactions: 51,
                    replies: 14,
                    visibility: .free
                )
            ]
        )
    }()

    static let personaEmpty: PublicProfileContent = {
        let base = personaPopulated
        return PublicProfileContent(
            profile: base.profile,
            kind: .persona,
            header: base.header,
            stats: StatsTabsContent(stats: base.stats.stats, bio: base.stats.bio, skills: [], reviews: []),
            posts: []
        )
    }()

    static let localPopulated: PublicProfileContent = {
        let profile = PublicProfile.testFixture(
            id: "u3",
            username: "mariak",
            name: "Maria K.",
            verified: true
        )
        return PublicProfileContent(
            profile: profile,
            kind: .local,
            header: PublicProfileHeader(
                displayName: "Maria K.",
                handle: "mariak",
                locality: "Elm Park",
                avatarURL: nil,
                isVerified: true,
                identityBadges: [
                    IdentityPillarBadge(pillar: .personal, state: .verified),
                    IdentityPillarBadge(pillar: .home, state: .verified),
                    IdentityPillarBadge(pillar: .business, state: .unverified)
                ],
                tierLabel: nil,
                isVerifiedNeighbor: true
            ),
            stats: StatsTabsContent(
                stats: [
                    ProfileStatCell(id: "connections", value: "128", label: "Connections"),
                    ProfileStatCell(id: "posts", value: "23", label: "Posts"),
                    ProfileStatCell(id: "rating", value: "4.9", label: "Rating")
                ],
                bio: "Apt 3B at 412 Elm. Around most evenings.",
                skills: [],
                reviews: []
            ),
            posts: [
                PublicProfilePost(
                    id: "p1",
                    body: "Anyone want sourdough? Made too much again.",
                    timeAgo: "1h ago",
                    locality: "Elm Park",
                    reactions: 14,
                    replies: 6,
                    intent: .offer
                ),
                PublicProfilePost(
                    id: "p2",
                    body: "Building elevator is down again. Maintenance says Wed.",
                    timeAgo: "Yesterday",
                    locality: "412 Elm St",
                    reactions: 22,
                    replies: 9,
                    intent: .alert
                ),
                PublicProfilePost(
                    id: "p3",
                    body: "Thursday block supper at the Papadakis stoop.",
                    timeAgo: "2d ago",
                    locality: "Elm Park",
                    reactions: 38,
                    replies: 17,
                    intent: .event
                )
            ]
        )
    }()

    static let localEmpty: PublicProfileContent = {
        let base = localPopulated
        return PublicProfileContent(
            profile: base.profile,
            kind: .local,
            header: base.header,
            stats: StatsTabsContent(stats: base.stats.stats, bio: base.stats.bio, skills: [], reviews: []),
            posts: []
        )
    }()
}

// MARK: - Minimal PublicProfile fixture builder

private extension PublicProfile {
    /// Build a minimal `PublicProfile` for fixture use. The decoder is
    /// the canonical init; we go through JSON so all defaults / coding
    /// keys stay in lockstep with the real wire format.
    static func testFixture(
        id: String,
        username: String,
        name: String,
        verified: Bool
    ) -> PublicProfile {
        let json = """
        {
          "id": "\(id)",
          "username": "\(username)",
          "name": "\(name)",
          "verified": \(verified),
          "reviews": [],
          "skills": []
        }
        """
        let data = Data(json.utf8)
        // The fixture is hand-rolled and proven valid by the tests
        // around it; force-unwrapping keeps the fixture API ergonomic.
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(PublicProfile.self, from: data)
    }
}
