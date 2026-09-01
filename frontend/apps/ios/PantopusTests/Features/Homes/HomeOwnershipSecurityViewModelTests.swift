//
//  HomeOwnershipSecurityViewModelTests.swift
//  PantopusTests
//
//  A14.2 (policy variant) — projection + wiring tests for the per-home
//  ownership security policy (`GET/PATCH /api/homes/:id/security`).
//  Locks the three radio groups, the claim-window lock on owner claims,
//  and the quorum "requires owner approval" banner that RN surfaces via
//  an alert.
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeOwnershipSecurityViewModelTests: XCTestCase {
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

    private func securityBody(
        state: String = "normal",
        claimActive: Bool = false,
        claimEndsAt: String? = nil,
        ownerClaim: String = "open",
        memberAttach: String = "open_invite",
        mask: String = "normal"
    ) -> String {
        let ends = claimEndsAt.map { "\"\($0)\"" } ?? "null"
        return """
        {"security":{"security_state":"\(state)","claim_window_ends_at":\(ends),
        "owner_claim_policy":"\(ownerClaim)","member_attach_policy":"\(memberAttach)",
        "privacy_mask_level":"\(mask)","tenure_mode":"rental",
        "claim_window_active":\(claimActive),"owner_count":2}}
        """
    }

    // MARK: - Load

    func testLoadProjectsThreeRadioGroups() async {
        SequencedURLProtocol.sequence = [.status(200, body: securityBody())]
        let vm = HomeOwnershipSecurityViewModel(homeId: "home-1", api: makeAPI())
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(groups.map(\.id), ["privacyMask", "ownerClaim", "memberAttach"])
        XCTAssertEqual(groups[0].rows.count, 3)
        XCTAssertEqual(groups[1].rows.count, 2)
        XCTAssertEqual(groups[2].rows.count, 3)
        let selected = groups.flatMap(\.rows).filter {
            if case let .radio(isSelected) = $0.control { return isSelected }
            return false
        }
        XCTAssertEqual(selected.map(\.id), ["privacyMask.normal", "ownerClaim.open", "memberAttach.open_invite"])
        XCTAssertEqual(vm.footerCaption, "2 verified owners")
    }

    func testLoadFailureSurfacesErrorState() async {
        SequencedURLProtocol.sequence = [.status(403, body: "{\"error\":\"Not authorized\"}")]
        let vm = HomeOwnershipSecurityViewModel(homeId: "home-1", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
        XCTAssertNil(vm.banner)
    }

    // MARK: - Claim window

    func testClaimWindowSurfacesBannerAndLocksReviewRequired() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: securityBody(
                state: "claim_window",
                claimActive: true,
                claimEndsAt: "2026-09-01T00:00:00.000Z"
            ))
        ]
        let vm = HomeOwnershipSecurityViewModel(homeId: "home-1", api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.banner?.title, "Claim Window Active")
        XCTAssertTrue(vm.claimWindowActive)

        // No PATCH is stubbed — if the VM sent one the request would fail
        // and produce a different helper string.
        await vm.selectRadio("ownerClaim.review_required")
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(
            groups.first { $0.id == "ownerClaim" }?.helper,
            "You can't restrict owner claims during the claim window."
        )
        XCTAssertEqual(vm.policy?.ownerClaimPolicy, .open, "Selection must not stick")
    }

    // MARK: - Quorum

    func testPendingQuorumResponseSurfacesOwnerApprovalBanner() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: securityBody()),
            .status(200, body: """
            {"message":"This change will auto-approve in 7 days unless rejected",
            "quorum_action_id":"qa-1","pending":true}
            """)
        ]
        let vm = HomeOwnershipSecurityViewModel(homeId: "home-1", api: makeAPI())
        await vm.load()
        await vm.selectRadio("ownerClaim.review_required")
        XCTAssertEqual(vm.banner?.title, "Owner approval requested")
        XCTAssertEqual(vm.banner?.subtitle, "This change will auto-approve in 7 days unless rejected")
        XCTAssertEqual(
            vm.policy?.ownerClaimPolicy,
            .open,
            "A quorum-gated change must not be shown as applied"
        )
        await vm.tapBanner()
        XCTAssertNil(vm.banner)
    }

    func testAppliedPatchUpdatesSelection() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: securityBody()),
            .status(200, body: """
            {"message":"Settings updated","security":{"security_state":"normal",
            "claim_window_ends_at":null,"owner_claim_policy":"open",
            "member_attach_policy":"verified_only","privacy_mask_level":"high",
            "tenure_mode":"rental"}}
            """)
        ]
        let vm = HomeOwnershipSecurityViewModel(homeId: "home-1", api: makeAPI())
        await vm.load()
        await vm.selectRadio("privacyMask.high")
        XCTAssertEqual(vm.policy?.privacyMaskLevel, .high)
        XCTAssertEqual(vm.policy?.memberAttachPolicy, .verifiedOnly)
    }

    // MARK: - Status banner copy (parity contract — mirrored in Android)

    func testStatusBannerCopyPerSecurityState() {
        XCTAssertNil(HomeOwnershipSecurityViewModel.statusBanner(
            for: HomeOwnershipSecurityDTO(securityState: .normal)
        ))
        XCTAssertEqual(
            HomeOwnershipSecurityViewModel.statusBanner(
                for: HomeOwnershipSecurityDTO(securityState: .reviewRequired)
            )?.subtitle,
            "New owner claims require manual review."
        )
        XCTAssertEqual(
            HomeOwnershipSecurityViewModel.statusBanner(
                for: HomeOwnershipSecurityDTO(securityState: .frozen)
            )?.title,
            "Home protections enabled"
        )
    }
}
