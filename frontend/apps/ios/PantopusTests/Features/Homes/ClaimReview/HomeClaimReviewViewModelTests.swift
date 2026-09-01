//
//  HomeClaimReviewViewModelTests.swift
//  PantopusTests
//
//  H6 — Per-home owner claim review. Covers:
//    - four-state transitions (loading / empty / loaded / error)
//    - partial-failure tolerance (a 403 on one collection must not wipe
//      the other — the two claim collections have different permission
//      gates)
//    - action-mode routing (verdict vs relationship vs admin-only)
//    - masked-fallback projection when `compare` is unavailable
//    - side-by-side comparison projection
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeClaimReviewViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI(routes: [String: [SequencedURLProtocol.Response]]) -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(routeResponses: routes),
            retryPolicy: .none
        )
    }

    private static let ownershipPath = "/api/homes/home_1/ownership-claims"
    private static let comparePath = "/api/homes/home_1/ownership-claims/compare"
    private static let residencyPath = "/api/homes/home_1/claims"

    private func makeVM(
        ownership: SequencedURLProtocol.Response,
        residency: SequencedURLProtocol.Response,
        comparison: SequencedURLProtocol.Response
    ) -> HomeClaimReviewViewModel {
        HomeClaimReviewViewModel(
            homeId: "home_1",
            api: makeAPI(routes: [
                Self.ownershipPath: [ownership],
                Self.comparePath: [comparison],
                Self.residencyPath: [residency]
            ])
        )
    }

    // MARK: - Fixtures

    private static let emptyClaimsJSON = #"{"claims":[]}"#

    private static let maskedClaimsJSON = """
    {"claims":[
      {"id":"c_1","home_id":"home_1","claim_type":"owner","state":"submitted",
       "method":"postcard","risk_score":12,
       "created_at":"2026-08-01T10:00:00Z","updated_at":"2026-08-01T10:00:00Z",
       "claimant":{"masked":true,"account_age_days":120,"method":"postcard","risk_score":12},
       "evidence":[{"id":"e1","evidence_type":"deed","provider":"manual",
                    "status":"verified","created_at":"2026-08-01T10:00:00Z"}]},
      {"id":"c_2","home_id":"home_1","claim_type":"owner","state":"approved",
       "method":"doc_upload","created_at":"2026-07-01T10:00:00Z",
       "updated_at":"2026-07-01T10:00:00Z"}
    ]}
    """

    private static let residencyClaimsJSON = """
    {"claims":[
      {"id":"rc_1","home_id":"home_1","user_id":"u1","status":"pending",
       "claimed_role":"renter","claimed_address":"418 Elm St",
       "created_at":"2026-08-01T10:00:00Z",
       "claimant":{"id":"u1","username":"maria","name":"Maria Kovács"}},
      {"id":"rc_2","home_id":"home_1","user_id":"u9","status":"verified",
       "claimed_role":"member","created_at":"2026-06-01T10:00:00Z",
       "claimant":{"id":"u9","username":"sam","name":"Sam Lee"}}
    ]}
    """

    private static func comparisonJSON(
        phase: String,
        hasVerifiedOwner: Bool
    ) -> String {
        """
        {"home_id":"home_1",
         "home":{"id":"home_1","name":"412 Elm Street","address":"412 Elm St",
                 "city":"Portland","state":"OR","zipcode":"97214",
                 "security_state":"normal","household_resolution_state":"contested",
                 "household_resolution_updated_at":"2026-08-01T10:00:00Z"},
         "household_resolution_state":"contested",
         "incumbent":{"owners":[
            {"id":"o1","home_id":"home_1","subject_id":"u2","owner_status":"verified",
             "is_primary_owner":true,"verification_tier":"legal","added_via":"claim",
             "created_at":"2022-03-12T10:00:00Z","updated_at":"2022-03-12T10:00:00Z",
             "user":{"id":"u2","username":"jamie","name":"Jamie Patel",
                     "email":"jamie@example.com","profile_picture_url":null,
                     "created_at":"2021-01-01T10:00:00Z"}}],
           "has_verified_owner":\(hasVerifiedOwner),"challenge_state":"none"},
         "claims":[
            {"id":"c_1","home_id":"home_1","claimant_user_id":"u1",
             "claimant":{"id":"u1","username":"rosa","name":"Rosa Delgado",
                         "email":"rosa@example.com","profile_picture_url":null,
                         "created_at":"2026-04-01T10:00:00Z"},
             "claim_type":"owner","state":"pending_review","claim_phase_v2":"\(phase)",
             "terminal_reason":"none","challenge_state":"none",
             "claim_strength":"documented_strong","routing_classification":"primary_claim",
             "identity_status":"not_started","merged_into_claim_id":null,"expires_at":null,
             "method":"doc_upload","risk_score":8,
             "created_at":"2026-08-01T10:00:00Z","updated_at":"2026-08-01T10:00:00Z",
             "evidence":[]}]}
        """
    }

    // MARK: - States

    func testAllThreeReadsFailingSurfacesError() async {
        let vm = makeVM(
            ownership: .status(403, body: #"{"error":"Not authorized"}"#),
            residency: .status(403, body: #"{"error":"Not authorized"}"#),
            comparison: .status(404, body: #"{"error":"Claim comparison not enabled"}"#)
        )
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testEmptyCollectionsSurfaceEmptyNotError() async {
        let vm = makeVM(
            ownership: .status(200, body: Self.emptyClaimsJSON),
            residency: .status(200, body: Self.emptyClaimsJSON),
            comparison: .status(404, body: #"{"error":"off"}"#)
        )
        await vm.load()
        XCTAssertEqual(vm.state, .empty)
    }

    /// The two claim collections sit behind different permission gates
    /// (`ownership.manage` vs `members.manage`), so one 403 must not
    /// hide the other list.
    func testOwnershipForbiddenStillShowsResidencyClaims() async {
        let vm = makeVM(
            ownership: .status(403, body: #"{"error":"Not authorized"}"#),
            residency: .status(200, body: Self.residencyClaimsJSON),
            comparison: .status(404, body: #"{"error":"off"}"#)
        )
        await vm.load()
        guard case let .loaded(data) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertTrue(data.ownership.isEmpty)
        XCTAssertEqual(data.residency.map(\.id), ["rc_1"])
        XCTAssertEqual(data.residency.first?.roleLabel, "Requesting: Renter")
        XCTAssertNil(data.comparison)
    }

    func testComparisonUnavailableFallsBackToMaskedList() async {
        let vm = makeVM(
            ownership: .status(200, body: Self.maskedClaimsJSON),
            residency: .status(200, body: Self.emptyClaimsJSON),
            comparison: .status(404, body: #"{"error":"off"}"#)
        )
        await vm.load()
        guard case let .loaded(data) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // Only the reviewable-state claim survives; `approved` is dropped.
        XCTAssertEqual(data.ownership.map(\.id), ["c_1"])
        XCTAssertEqual(data.ownership.first?.displayName, "Masked claimant")
        XCTAssertEqual(data.ownership.first?.accountAgeLabel, "Account 120d old")
        XCTAssertEqual(data.ownership.first?.methodLabel, "Postcard")
        XCTAssertEqual(data.ownership.first?.evidenceLabel, "1 file")
        XCTAssertEqual(data.ownership.first?.actionMode, .verdict)
        XCTAssertFalse(vm.hasComparison)
    }

    func testComparisonWithoutVerifiedOwnerKeepsPlainVerdicts() async {
        let vm = makeVM(
            ownership: .status(200, body: Self.maskedClaimsJSON),
            residency: .status(200, body: Self.emptyClaimsJSON),
            comparison: .status(
                200,
                body: Self.comparisonJSON(phase: "under_review", hasVerifiedOwner: false)
            )
        )
        await vm.load()
        guard case let .loaded(data) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // Comparison claims win over the masked fallback.
        XCTAssertEqual(data.ownership.first?.displayName, "Rosa Delgado")
        XCTAssertEqual(data.ownership.first?.actionMode, .verdict)
        XCTAssertTrue(vm.hasComparison)
    }

    func testVerifiedIncumbentSwapsInRelationshipActions() async {
        let vm = makeVM(
            ownership: .status(200, body: Self.emptyClaimsJSON),
            residency: .status(200, body: Self.emptyClaimsJSON),
            comparison: .status(
                200,
                body: Self.comparisonJSON(phase: "evidence_submitted", hasVerifiedOwner: true)
            )
        )
        await vm.load()
        guard case let .loaded(data) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(data.ownership.first?.actionMode, .relationship)
        XCTAssertEqual(data.ownership.first?.inviteTitle, "Invite as owner")
    }

    func testChallengedClaimIsAdminOnly() async {
        let vm = makeVM(
            ownership: .status(200, body: Self.emptyClaimsJSON),
            residency: .status(200, body: Self.emptyClaimsJSON),
            comparison: .status(
                200,
                body: Self.comparisonJSON(phase: "challenged", hasVerifiedOwner: true)
            )
        )
        await vm.load()
        guard case let .loaded(data) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(data.ownership.first?.actionMode, .adminReviewRequired)
        XCTAssertTrue(data.ownership.first?.isChallenged == true)
    }

    func testTerminalPhasesAreFilteredOut() async {
        let vm = makeVM(
            ownership: .status(200, body: Self.emptyClaimsJSON),
            residency: .status(200, body: Self.emptyClaimsJSON),
            comparison: .status(
                200,
                body: Self.comparisonJSON(phase: "verified", hasVerifiedOwner: true)
            )
        )
        await vm.load()
        guard case let .loaded(data) = vm.state else {
            XCTFail("Expected .loaded (comparison present), got \(vm.state)")
            return
        }
        XCTAssertTrue(data.ownership.isEmpty)
    }

    func testComparisonProjectsBothColumns() async {
        let vm = makeVM(
            ownership: .status(200, body: Self.emptyClaimsJSON),
            residency: .status(200, body: Self.emptyClaimsJSON),
            comparison: .status(
                200,
                body: Self.comparisonJSON(phase: "under_review", hasVerifiedOwner: true)
            )
        )
        await vm.load()
        guard case let .loaded(data) = vm.state,
              let comparison = data.comparison else {
            XCTFail("Expected .loaded with comparison, got \(vm.state)")
            return
        }
        XCTAssertEqual(comparison.homeTitle, "412 Elm Street")
        XCTAssertTrue(comparison.hasVerifiedOwner)
        XCTAssertEqual(comparison.resolutionLabel, "contested")
        XCTAssertEqual(comparison.incumbents.map(\.name), ["Jamie Patel"])
        XCTAssertTrue(comparison.incumbents.first?.lines.contains("Primary owner") == true)
        XCTAssertEqual(comparison.challengers.map(\.name), ["Rosa Delgado"])
    }

    // MARK: - Formatting helpers

    func testInitials() {
        XCTAssertEqual(HomeClaimReviewViewModel.initials(for: "Rosa Delgado"), "RD")
        XCTAssertEqual(HomeClaimReviewViewModel.initials(for: "@rosa"), "R")
        XCTAssertEqual(HomeClaimReviewViewModel.initials(for: ""), "?")
    }

    func testEvidenceLabel() {
        XCTAssertNil(HomeClaimReviewViewModel.evidenceLabel(0))
        XCTAssertEqual(HomeClaimReviewViewModel.evidenceLabel(1), "1 file")
        XCTAssertEqual(HomeClaimReviewViewModel.evidenceLabel(3), "3 files")
    }

    func testRelationshipCopyBranchesOnClaimType() {
        XCTAssertEqual(
            HomeClaimRelationshipAction.inviteToHousehold.title(isOwnerClaim: true),
            "Invite As Owner"
        )
        XCTAssertEqual(
            HomeClaimRelationshipAction.inviteToHousehold.title(isOwnerClaim: false),
            "Invite To Household"
        )
        XCTAssertTrue(HomeClaimRelationshipAction.flagUnknownPerson.isDestructive)
        XCTAssertFalse(HomeClaimRelationshipAction.declineRelationship.isDestructive)
    }

    func testVerdictConfirmCopyMirrorsRN() {
        XCTAssertEqual(
            HomeClaimReviewVerdict.reject.confirmBody,
            "Are you sure you want to reject this claim?"
        )
        XCTAssertEqual(HomeClaimReviewVerdict.approve.doneCopy, "Claim approved")
        XCTAssertFalse(HomeClaimReviewVerdict.approve.isDestructive)
    }
}
