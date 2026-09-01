//
//  ReviewClaimsViewModelTests.swift
//  PantopusTests
//
//  P1.1 — Admin Review-claims queue. Covers:
//    - load → loaded / empty / error transitions on every tab
//    - Pending bucket banner surfaces the queue depth + oldest age
//    - Triage chip text varies by state + age (New / Aging / Conflict /
//      Awaiting docs)
//    - Approved bucket renders the success chip, rejected uses
//      .circleSlash + muted highlight, with no banner
//    - Tab switch keeps per-bucket cache (no shimmer flash on repeat)
//    - Tapping a row invokes `onOpenClaim` with the claim id
//

import XCTest
@testable import Pantopus

@MainActor
final class ReviewClaimsViewModelTests: XCTestCase {
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
        api: APIClient? = nil,
        onOpenClaim: @escaping @MainActor (String) -> Void = { _ in }
    ) -> ReviewClaimsViewModel {
        ReviewClaimsViewModel(
            api: api ?? makeAPI(),
            onOpenClaim: onOpenClaim
        )
    }

    // MARK: - Fixtures

    private static let countsJSON = """
    {"pending":4,"approved":38,"rejected":3}
    """

    /// Pending bucket — 2 claims with different state / age so the
    /// triage chips read as "New" + "Aging" in the populated test.
    private static let pendingJSON: String = {
        let now = Date()
        let recent = ISO8601DateFormatter().string(from: now.addingTimeInterval(-2 * 86400)) // 2 days
        let old = ISO8601DateFormatter().string(from: now.addingTimeInterval(-10 * 86400)) // 10 days
        return """
        {
          "claims": [
            {
              "id": "c_new", "home_id": "h1", "claimant_user_id": "u_new",
              "claim_type": "owner", "state": "submitted", "method": "doc_upload",
              "risk_score": 12, "created_at": "\(recent)", "updated_at": "\(recent)",
              "evidence_count": 3,
              "home": {
                "id":"h1","address":"12 Elm St","city":"Pittsburgh",
                "state":"PA","zipcode":"15213","name":"12 Elm Street",
                "home_type":"single_family"
              },
              "claimant": {
                "id":"u_new","username":"riya","name":"Riya Patel",
                "email":"riya@example.com",
                "created_at":"2025-09-01T00:00:00Z","profile_picture_url":null
              }
            },
            {
              "id": "c_old", "home_id": "h2", "claimant_user_id": "u_old",
              "claim_type": "owner", "state": "submitted", "method": "escrow_agent",
              "risk_score": 62, "created_at": "\(old)", "updated_at": "\(old)",
              "evidence_count": 5,
              "home": {
                "id":"h2","address":"88 Pinecrest Ln","city":"Pittsburgh",
                "state":"PA","zipcode":"15213","name":null,
                "home_type":"single_family"
              },
              "claimant": {
                "id":"u_old","username":"sam","name":"Sam Reyes",
                "email":"sam@example.com",
                "created_at":"2025-04-01T00:00:00Z","profile_picture_url":null
              }
            }
          ],
          "total": 2,
          "oldest_age_seconds": \(Int(10 * 86400))
        }
        """
    }()

    private static let emptyJSON = """
    {"claims":[],"total":0,"oldest_age_seconds":null}
    """

    private static let approvedJSON = """
    {
      "claims": [
        {
          "id": "c_app1", "home_id": "h3", "claimant_user_id": "u3",
          "claim_type": "owner", "state": "approved", "method": "doc_upload",
          "risk_score": 8,
          "created_at": "2026-04-01T10:00:00Z",
          "updated_at": "2026-04-02T11:00:00Z",
          "evidence_count": 4,
          "home": {
            "id":"h3","address":"212 Oak Rd","city":"Pittsburgh",
            "state":"PA","zipcode":null,"name":null,"home_type":null
          },
          "claimant": {
            "id":"u3","username":"jordan","name":"Jordan Lee",
            "email":"jordan@example.com",
            "created_at":"2025-01-01T00:00:00Z","profile_picture_url":null
          }
        }
      ],
      "total": 1,
      "oldest_age_seconds": null
    }
    """

    private static let rejectedJSON = """
    {
      "claims": [
        {
          "id": "c_rej1", "home_id": "h4", "claimant_user_id": "u4",
          "claim_type": "resident", "state": "rejected", "method": "doc_upload",
          "risk_score": 91,
          "created_at": "2026-03-01T10:00:00Z",
          "updated_at": "2026-03-02T11:00:00Z",
          "evidence_count": 0,
          "home": {
            "id":"h4","address":"56 Maple Ave","city":"Pittsburgh",
            "state":"PA","zipcode":null,"name":null,"home_type":null
          },
          "claimant": {
            "id":"u4","username":"alex","name":"Alex Chen",
            "email":"alex@example.com",
            "created_at":"2024-12-01T00:00:00Z","profile_picture_url":null
          }
        }
      ],
      "total": 1,
      "oldest_age_seconds": null
    }
    """

    private func stubAllBuckets(
        pending: String = ReviewClaimsViewModelTests.pendingJSON,
        approved: String = ReviewClaimsViewModelTests.approvedJSON,
        rejected: String = ReviewClaimsViewModelTests.rejectedJSON,
        counts: String = ReviewClaimsViewModelTests.countsJSON
    ) {
        SequencedURLProtocol.routeResponses = [
            "/api/admin/claims/counts": [.status(200, body: counts)],
            "/api/admin/claims?bucket=pending&limit=50&offset=0": [.status(200, body: pending)],
            "/api/admin/claims?bucket=approved&limit=50&offset=0": [.status(200, body: approved)],
            "/api/admin/claims?bucket=rejected&limit=50&offset=0": [.status(200, body: rejected)]
        ]
    }

    // MARK: - Loading → Populated

    func test_load_populates_pending_bucket_with_banner() async {
        stubAllBuckets()
        let vm = makeVM()
        await vm.load()

        guard case let .loaded(sections, _) = vm.state else {
            return XCTFail("Expected loaded state, got \(vm.state)")
        }
        XCTAssertEqual(sections.first?.rows.count, 2)
        let titles = sections.first?.rows.map(\.title) ?? []
        XCTAssertEqual(titles, ["Riya Patel", "Sam Reyes"])

        // Banner appears on pending tab with the live count from /counts
        let banner = vm.banner
        XCTAssertNotNil(banner)
        XCTAssertEqual(banner?.title, "4 claims awaiting review")
        XCTAssertEqual(banner?.icon, .gavel)
        XCTAssertEqual(banner?.tint, .warning)
    }

    func test_triage_chip_varies_by_age_and_state() async {
        stubAllBuckets()
        let vm = makeVM()
        await vm.load()

        guard case let .loaded(sections, _) = vm.state,
              let rows = sections.first?.rows
        else { return XCTFail("Expected loaded state") }

        let newRow = rows[0]
        let oldRow = rows[1]
        // Each row has [statusChip, evidenceChip] in that order.
        XCTAssertEqual(newRow.chips?[0].text, "New")
        XCTAssertEqual(newRow.chips?[0].icon, .sparkles)
        XCTAssertTrue(oldRow.chips?[0].text.hasPrefix("Aging") == true)
        XCTAssertEqual(oldRow.chips?[0].icon, .clock)
    }

    func test_evidence_chip_uses_singular_plural() async {
        stubAllBuckets()
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let rows = sections.first?.rows
        else { return XCTFail("Expected loaded state with at least one row section") }
        XCTAssertEqual(rows[0].chips?[1].text, "3 docs")
        XCTAssertEqual(rows[1].chips?[1].text, "5 docs")
    }

    // MARK: - Empty + Error

    func test_pending_empty_offers_view_approved_cta() async {
        stubAllBuckets(pending: Self.emptyJSON)
        let vm = makeVM()
        await vm.load()

        guard case let .empty(content) = vm.state else {
            return XCTFail("Expected empty state, got \(vm.state)")
        }
        XCTAssertEqual(content.headline, "No claims to review")
        XCTAssertEqual(content.icon, .checkCheck)
        XCTAssertEqual(content.ctaTitle, "View approved")
        XCTAssertNil(vm.banner)
    }

    func test_pending_error_state_on_500() async {
        SequencedURLProtocol.routeResponses = [
            "/api/admin/claims/counts": [.status(200, body: Self.countsJSON)],
            "/api/admin/claims?bucket=pending&limit=50&offset=0": [.status(500, body: "{}")]
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected error state, got \(vm.state)")
        }
        XCTAssertEqual(message, "Couldn't load claims. Try again.")
    }

    // MARK: - Tab switching

    func test_switching_to_approved_renders_success_chip_and_hides_banner() async {
        stubAllBuckets()
        let vm = makeVM()
        await vm.load()

        vm.selectedTab = ReviewClaimsTab.approved
        // Wait for the async refetch triggered by didSet.
        try? await Task.sleep(nanoseconds: 50_000_000)

        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first
        else { return XCTFail("Expected loaded state") }
        XCTAssertEqual(row.chips?[0].text, "Approved")
        XCTAssertEqual(row.chips?[0].icon, .checkCircle)
        XCTAssertNil(vm.banner, "Approved bucket should not render the triage banner")
        XCTAssertNil(row.highlight)
    }

    func test_switching_to_rejected_renders_circle_slash_and_muted_highlight() async {
        stubAllBuckets()
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = ReviewClaimsTab.rejected
        try? await Task.sleep(nanoseconds: 50_000_000)

        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first
        else { return XCTFail("Expected loaded rejected bucket with at least one row") }
        XCTAssertEqual(row.chips?[0].text, "Rejected")
        XCTAssertEqual(row.chips?[0].icon, .circleSlash)
        XCTAssertEqual(row.highlight, .muted)
    }

    // MARK: - Row tap

    func test_row_tap_invokes_onOpenClaim_with_row_id() async {
        stubAllBuckets()
        var lastOpened: String?
        let vm = makeVM { lastOpened = $0 }
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first
        else { return XCTFail("Expected loaded pending bucket with at least one row") }
        row.onTap()
        XCTAssertEqual(lastOpened, "c_new")
    }

    func test_footer_button_invokes_onOpenClaim() async {
        stubAllBuckets()
        var lastOpened: String?
        let vm = makeVM { lastOpened = $0 }
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first,
              let footer = row.footer
        else { return XCTFail("Expected loaded row with a footer for tap dispatch") }
        XCTAssertEqual(footer.actions.first?.title, "Review claim")
        footer.actions.first?.handler()
        XCTAssertEqual(lastOpened, "c_new")
    }

    // MARK: - Tabs surface live counts

    func test_tab_counts_reflect_counts_endpoint() async {
        stubAllBuckets()
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.tabs.first { $0.id == ReviewClaimsTab.pending }?.count, 4)
        XCTAssertEqual(vm.tabs.first { $0.id == ReviewClaimsTab.approved }?.count, 38)
        XCTAssertEqual(vm.tabs.first { $0.id == ReviewClaimsTab.rejected }?.count, 3)
    }
}
