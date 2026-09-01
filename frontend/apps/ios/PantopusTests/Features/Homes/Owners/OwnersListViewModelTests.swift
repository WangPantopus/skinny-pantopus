//
//  OwnersListViewModelTests.swift
//  PantopusTests
//
//  P15 / T6.3g — Owners list. Covers:
//    - load → loaded / empty / error transitions
//    - row mapping (proof tone resolution; role subtitle; You badge)
//    - optimistic remove + rollback on failure
//    - FAB shape (secondary-create, home-tinted, user-plus glyph)
//    - load idempotency
//

import XCTest
@testable import Pantopus

@MainActor
final class OwnersListViewModelTests: XCTestCase {
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

    private func makeVM(
        homeId: String = "home_1",
        currentUserId: String? = "user_1",
        showsClaimReview: Bool = true
    ) -> OwnersListViewModel {
        OwnersListViewModel(
            homeId: homeId,
            currentUserId: currentUserId,
            api: makeAPI(),
            showsClaimReview: showsClaimReview
        )
    }

    /// Three-owner roster: a verified primary (legal tier), a verified
    /// co-owner (standard tier), and a pending invitee.
    private static let threeOwnersJSON = """
    {"owners":[
      {"id":"o1","subject_type":"user","subject_id":"user_1",
       "owner_status":"verified","is_primary_owner":true,
       "added_via":"claim","verification_tier":"legal",
       "created_at":"2022-03-12T10:00:00Z",
       "updated_at":"2022-03-12T10:00:00Z",
       "user":{"id":"user_1","username":"maria","name":"Maria Kovács",
               "profile_picture_url":null}},
      {"id":"o2","subject_type":"user","subject_id":"user_2",
       "owner_status":"verified","is_primary_owner":false,
       "added_via":"invite","verification_tier":"standard",
       "created_at":"2022-03-15T10:00:00Z",
       "updated_at":"2022-03-15T10:00:00Z",
       "user":{"id":"user_2","username":"jamie","name":"Jamie Patel",
               "profile_picture_url":null}},
      {"id":"o3","subject_type":"user","subject_id":"user_3",
       "owner_status":"pending","is_primary_owner":false,
       "added_via":"invite","verification_tier":"weak",
       "created_at":"2026-10-04T10:00:00Z",
       "updated_at":"2026-10-04T10:00:00Z",
       "user":{"id":"user_3","username":"ana","name":"Ana Kovács",
               "profile_picture_url":null}}
    ]}
    """

    private static let soleOwnerJSON = """
    {"owners":[
      {"id":"o1","subject_type":"user","subject_id":"user_1",
       "owner_status":"verified","is_primary_owner":true,
       "added_via":"claim","verification_tier":"legal",
       "created_at":"2022-03-12T10:00:00Z",
       "updated_at":"2022-03-12T10:00:00Z",
       "user":{"id":"user_1","username":"maria","name":"Maria Kovács",
               "profile_picture_url":null}}
    ]}
    """

    private static let emptyJSON = """
    {"owners":[]}
    """

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No owners yet")
        XCTAssertEqual(content.icon, .shield)
        XCTAssertEqual(content.ctaTitle, "Invite an owner")
    }

    func testLoadPopulatedTransitionsToLoaded() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.threeOwnersJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections.first?.rows.count, 3)
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections.first?.rows.first?.title, "Maria Kovács")
    }

    func testLoadFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testLoadIsIdempotentAfterLoaded() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.threeOwnersJSON),
            // Second response would only fire if `load()` refetched. The VM
            // must short-circuit so this stays in the queue.
            .status(200, body: Self.emptyJSON)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.load()
        XCTAssertEqual(SequencedURLProtocol.sequence.count, 1)
    }

    // MARK: - Row mapping

    func testPrimaryOwnerRendersWithDeedAndYouChip() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.threeOwnersJSON)]
        let vm = makeVM(currentUserId: "user_1")
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let maria = sections.first?.rows.first else {
            XCTFail("Expected loaded with rows")
            return
        }
        XCTAssertEqual(maria.title, "Maria Kovács")
        XCTAssertEqual(maria.subtitle, "Primary owner")
        XCTAssertEqual(maria.body, "Deed on file")
        XCTAssertEqual(maria.bodyIcon, .shieldCheck)
        XCTAssertEqual(maria.inlineChip?.text, "You")
        if case .kebab = maria.trailing {} else {
            XCTFail("Expected kebab trailing")
        }
        if case let .avatarWithBadge(_, _, _, size, verified) = maria.leading {
            XCTAssertEqual(size, .medium)
            XCTAssertTrue(verified)
        } else {
            XCTFail("Expected avatarWithBadge leading")
        }
    }

    func testSecondaryOwnerRendersAsCoOwnerWithTitle() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.threeOwnersJSON)]
        let vm = makeVM(currentUserId: "user_1")
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        let jamie = sections.first?.rows.first { $0.id == "o2" }
        XCTAssertEqual(jamie?.title, "Jamie Patel")
        XCTAssertEqual(jamie?.subtitle, "Co-owner")
        XCTAssertEqual(jamie?.body, "Title on file")
        XCTAssertEqual(jamie?.bodyIcon, .file)
        XCTAssertNil(jamie?.inlineChip)
    }

    func testPendingOwnerRendersAsInvitedAndUnverifiedAvatar() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.threeOwnersJSON)]
        let vm = makeVM(currentUserId: "user_1")
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        let ana = sections.first?.rows.first { $0.id == "o3" }
        XCTAssertEqual(ana?.subtitle, "Invited · awaiting verification")
        XCTAssertEqual(ana?.body, "Pending review")
        XCTAssertEqual(ana?.bodyIcon, .clock)
        if case let .avatarWithBadge(_, _, _, _, verified) = ana?.leading {
            XCTAssertFalse(verified)
        } else {
            XCTFail("Expected avatarWithBadge leading")
        }
    }

    func testSoleOwnerSubtitleReadsSoleOwner() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.soleOwnerJSON)]
        let vm = makeVM(currentUserId: "user_1")
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let only = sections.first?.rows.first else {
            XCTFail("Expected one row")
            return
        }
        XCTAssertEqual(only.subtitle, "Sole owner")
    }

    func testProofMappingCoversAllTierCombinations() {
        // Status precedence wins over verification tier.
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "pending", verificationTier: "legal"),
            .pending
        )
        // disputed / revoked map to Document (rejected proof on file).
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "disputed", verificationTier: "legal"),
            .document
        )
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "revoked", verificationTier: "strong"),
            .document
        )
        // Verified rows hit the tier table.
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "verified", verificationTier: "legal"),
            .deed
        )
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "verified", verificationTier: "strong"),
            .deed
        )
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "verified", verificationTier: "standard"),
            .title
        )
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "verified", verificationTier: "weak"),
            .document
        )
        // Casing tolerance.
        XCTAssertEqual(
            OwnerProof.resolve(ownerStatus: "VERIFIED", verificationTier: "LEGAL"),
            .deed
        )
    }

    func testDisplayNameFallsBackToUsernameThenSubjectIdSuffix() async {
        let json = """
        {"owners":[
          {"id":"o1","subject_type":"user","subject_id":"user_alpha_long",
           "owner_status":"verified","is_primary_owner":true,
           "added_via":"claim","verification_tier":"legal",
           "created_at":"2022-03-12T10:00:00Z",
           "updated_at":"2022-03-12T10:00:00Z",
           "user":{"id":"user_alpha_long","username":"alpha","name":null,
                   "profile_picture_url":null}},
          {"id":"o2","subject_type":"business","subject_id":"biz_beta_1234",
           "owner_status":"verified","is_primary_owner":false,
           "added_via":"transfer","verification_tier":"legal",
           "created_at":"2022-04-12T10:00:00Z",
           "updated_at":"2022-04-12T10:00:00Z",
           "user":null}
        ]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = makeVM(currentUserId: nil)
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.title, "@alpha")
        XCTAssertEqual(sections.first?.rows.last?.title, "Business · 1234")
    }

    // MARK: - Mutations

    func testRemoveOwnerOptimisticallyDropsRow() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.threeOwnersJSON),
            .status(200, body: "{\"message\":\"Owner removed\"}")
        ]
        let vm = makeVM(currentUserId: "user_1")
        await vm.load()
        await vm.removeOwner(ownerId: "o2")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded after remove")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 2)
        XCTAssertNil(sections.first?.rows.first { $0.id == "o2" })
    }

    func testRemoveFailureRollsBack() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.threeOwnersJSON),
            .status(500, body: "{}")
        ]
        let vm = makeVM(currentUserId: "user_1")
        await vm.load()
        await vm.removeOwner(ownerId: "o2")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded after rollback")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 3)
        XCTAssertNotNil(sections.first?.rows.first { $0.id == "o2" })
    }

    func testCachedOwnerLookupAfterLoad() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.threeOwnersJSON)]
        let vm = makeVM(currentUserId: "user_1")
        await vm.load()
        XCTAssertEqual(vm.cachedOwner(withId: "o1")?.user?.name, "Maria Kovács")
        XCTAssertNil(vm.cachedOwner(withId: "missing"))
    }

    // MARK: - Chrome

    func testFABIsHomeTintedSecondaryCreateWithUserPlus() {
        let vm = makeVM()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.icon, .userPlus)
        XCTAssertEqual(fab.accessibilityLabel, "Invite an owner")
        if case .secondaryCreate = fab.variant {} else {
            XCTFail("Expected .secondaryCreate variant")
        }
        XCTAssertEqual(fab.tint, .home)
    }

    func testTopBarActionOpensClaimReview() {
        let vm = makeVM()
        // H6 — the top bar now carries the per-home claim-review gavel;
        // the FAB still owns the create (invite) affordance.
        let action = vm.topBarAction
        XCTAssertNotNil(action)
        XCTAssertEqual(action?.icon, .gavel)
        XCTAssertEqual(action?.accessibilityLabel, "Review claims on this home")
        // …and stays hidden when the host has no claim-review route.
        XCTAssertNil(makeVM(showsClaimReview: false).topBarAction)
    }

    func testNoTabsByDesign() {
        let vm = makeVM()
        XCTAssertTrue(vm.tabs.isEmpty)
    }
}
