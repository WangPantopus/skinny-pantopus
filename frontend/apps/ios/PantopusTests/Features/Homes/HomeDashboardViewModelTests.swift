//
//  HomeDashboardViewModelTests.swift
//  PantopusTests
//
//  State-transition coverage for `HomeDashboardViewModel`. Covers the
//  private-detail happy path, the 403 → public-profile fallback, the
//  final 500 error state, and the Home Intelligence stack (health score,
//  seasonal checklist + its PATCH, property value, bill trends).
//
//  The view-model fires six requests concurrently, so these tests stub by
//  route rather than by FIFO sequence.
//

// swiftlint:disable multiline_literal_brackets type_body_length

import XCTest
@testable import Pantopus

@MainActor
final class HomeDashboardViewModelTests: XCTestCase {
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

    // MARK: - Fixtures

    private static let detailBody = """
    {"home":{
      "id":"h1","name":"Main","address":"1 Main","city":"X","state":"CA","zipcode":"90000",
      "owner":{"id":"u1","username":"alice","name":"Alice"},
      "occupants":[],"location":null,"isOwner":true,"isPendingOwner":false,
      "pendingClaimId":null,"isOccupant":false,
      "owners":[{"id":"o1","subject_type":"user","subject_id":"u1",
                 "owner_status":"verified","is_primary_owner":true,"verification_tier":"attom"}],
      "can_delete_home":true
    }}
    """

    private static let dashboardBody = """
    {
      "home":{"id":"h1","name":"Main","address":"1 Main"},
      "myAccess":{"permissions":["home.view","finance.view"],"role_base":"owner","isOwner":true},
      "today":{
        "next_events":[{"id":"e1","home_id":"h1","event_type":"maintenance","title":"Plumber",
                        "description":null,"start_at":"2999-01-01T16:00:00Z","end_at":null,
                        "location_notes":"Kitchen sink","recurrence_rule":null,"assigned_to":null,
                        "alerts_enabled":true,"created_by":"u1",
                        "created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"}],
        "tasks_due":[{"id":"t1","home_id":"h1","task_type":"chore","title":"Take out trash",
                      "description":null,"assigned_to":null,"due_at":"2999-01-01T00:00:00Z",
                      "status":"open","priority":"normal","budget":null,"completed_at":null,
                      "linked_gig_id":null,"converted_to_gig_id":null,"created_by":"u1",
                      "created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z",
                      "visibility":"household","mail_id":null}],
        "next_bill":{"id":"b1","home_id":"h1","bill_type":"electric","provider_name":"ConEd",
                     "amount":"142.80","currency":"USD","period_start":null,"period_end":null,
                     "due_date":"2999-01-03T00:00:00Z","status":"due","paid_at":null,"paid_by":null,
                     "created_by":"u1","created_at":"2025-01-01T00:00:00Z",
                     "updated_at":"2025-01-01T00:00:00Z"},
        "unread_mail_count":2,
        "active_guest_passes":1,
        "deliveries_arriving":3
      },
      "counts":{"tasks_open":5,"issues_open":1,"bills_due":2,"packages_expected":3,
                "documents":4,"events_upcoming":6,"members_active":2,"pets":1},
      "members":[{"user_id":"u2","role":"member","display_role":"owner",
                  "user":{"id":"u2","username":"maria","name":"Maria Kim",
                          "profile_picture_url":null}}],
      "recent_activity":[{"id":"a1","home_id":"h1","actor_user_id":"u2",
                          "action":"guest_pass_created","target_type":"guest_pass",
                          "target_id":"g1","metadata":{},
                          "created_at":"2025-01-01T00:00:00Z"}]
    }
    """

    private static let healthBody = """
    {"score":62,
     "breakdown":{
       "maintenance":{"score":25,"max":25,"issues":[]},
       "bills":{"score":10,"max":20,"issues":["ConEd bill is overdue"]},
       "seasonal":{"score":5,"max":20,"issues":["3 of 4 seasonal tasks incomplete"]},
       "emergency":{"score":15,"max":15,"issues":[]},
       "household":{"score":5,"max":10,"issues":[]},
       "documents":{"score":2,"max":10,"issues":[]}},
     "topIssue":"3 of 4 seasonal tasks incomplete",
     "topAction":{"type":"navigate","label":"View checklist","route":"/homes/h1/dashboard"}}
    """

    private static let checklistBody = """
    {"season":{"key":"fall_prep","label":"Fall prep"},
     "items":[
       {"id":"i1","home_id":"h1","season_key":"fall_prep","year":2026,
        "item_key":"gutter_cleaning","title":"Clean gutters before rain season",
        "description":null,"gig_category":"Cleaning",
        "gig_title_suggestion":"Gutter cleaning needed","status":"pending",
        "completed_at":null,"gig_id":null,"sort_order":1},
       {"id":"i2","home_id":"h1","season_key":"fall_prep","year":2026,
        "item_key":"furnace_inspection","title":"Inspect and service furnace",
        "description":null,"gig_category":"Handyman",
        "gig_title_suggestion":"Furnace inspection","status":"completed",
        "completed_at":"2026-01-01T00:00:00Z","gig_id":null,"sort_order":2}],
     "progress":{"total":2,"completed":1,"percentage":50}}
    """

    private static let propertyValueBody = """
    {"estimated_value":812000,"value_range_low":770000,"value_range_high":860000,
     "value_confidence":0.82,"zip_median_sale_price_trend":"up","year_built":1994,
     "sqft":1840,"last_updated":"2026-01-05T00:00:00Z","source":"cache"}
    """

    private static let billTrendsBody = """
    {"bills_by_type":{"electric":{"months":["2026-01","2025-12"],"amounts":[142.8,131.2]}},
     "benchmarks":{"electric":{"months":["2026-01"],"avg_amounts":[12000],
                               "household_count":14}},
     "bill_benchmark_opt_in":true}
    """

    private func stubHappyPath(
        detail: [SequencedURLProtocol.Response]? = nil,
        dashboard: [SequencedURLProtocol.Response]? = nil,
        health: [SequencedURLProtocol.Response]? = nil,
        checklist: [SequencedURLProtocol.Response]? = nil,
        propertyValue: [SequencedURLProtocol.Response]? = nil,
        billTrends: [SequencedURLProtocol.Response]? = nil
    ) {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/h1": detail ?? [.status(200, body: Self.detailBody)],
            "/api/homes/h1/dashboard": dashboard ?? [.status(200, body: Self.dashboardBody)],
            "/api/homes/h1/health-score": health ?? [.status(200, body: Self.healthBody)],
            "/api/homes/h1/seasonal-checklist": checklist ?? [.status(200, body: Self.checklistBody)],
            "/api/homes/h1/property-value": propertyValue ?? [.status(200, body: Self.propertyValueBody)],
            "/api/homes/h1/bill-trends": billTrends ?? [.status(200, body: Self.billTrendsBody)]
        ]
    }

    // MARK: - Core dashboard

    func testHeroStatsComeFromTheDashboardAggregate() async {
        stubHappyPath()
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.address, "1 Main")
        XCTAssertTrue(content.verified)
        XCTAssertEqual(content.stats.map(\.label), ["Packages", "Bills", "Tasks"])
        // counts.packages_expected / counts.bills_due / counts.tasks_open
        XCTAssertEqual(content.stats.map(\.value), ["3", "2", "5"])
        XCTAssertEqual(content.tabs.count, 6)
    }

    func testQuickActionBadgesComeFromCounts() async {
        stubHappyPath()
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        func badge(_ id: String) -> String? {
            content.quickActions.first { $0.id == id }?.badge
        }
        XCTAssertEqual(badge("view_tasks"), "5")
        XCTAssertEqual(badge("view_bills"), "2")
        XCTAssertEqual(badge("view_packages"), "3")
    }

    func testOverviewIsBuiltFromTheAggregateNotFixtures() async {
        stubHappyPath()
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        let titles = content.overview.upcoming.map(\.title)
        XCTAssertEqual(titles.first, "ConEd bill due")
        XCTAssertTrue(titles.contains("Plumber"))
        XCTAssertTrue(titles.contains("Take out trash"))
        XCTAssertTrue(titles.contains("3 packages on the way"))
        XCTAssertFalse(titles.contains("Amazon - waiting pickup"), "Sample fixtures must be gone")

        XCTAssertEqual(content.overview.activity.count, 1)
        XCTAssertEqual(content.overview.activity.first?.title, "Maria Kim: Guest pass created")
        XCTAssertEqual(content.overview.activity.first?.initials, "MK")

        // emergency dimension scored 15/15 → configured
        XCTAssertTrue(content.overview.emergency.isConfigured)
    }

    func testForbiddenFallsBackToPublicProfile() async {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/h1": [.status(403, body: "{\"error\":\"no access\"}")],
            "/api/homes/h1/public-profile": [.status(200, body: """
            {"home":{
              "id":"h1","name":null,"address":"200 Public St","city":"Y","state":"CA","zipcode":"90000",
              "home_type":"single_family","visibility":"public","description":null,
              "created_at":"2025-01-01T00:00:00Z","hasVerifiedOwner":true,"verifiedOwner":null,
              "userMembershipStatus":"none","userResidencyClaim":null,"memberCount":2,"nearbyGigs":5
            }}
            """)],
            "/api/homes/h1/dashboard": [.status(403, body: "{}")],
            "/api/homes/h1/health-score": [.status(403, body: "{}")],
            "/api/homes/h1/seasonal-checklist": [.status(403, body: "{}")],
            "/api/homes/h1/property-value": [.status(403, body: "{}")],
            "/api/homes/h1/bill-trends": [.status(403, body: "{}")]
        ]
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.address, "200 Public St")
        XCTAssertTrue(content.verified, "Public profile with a verified owner should flip verified=true")
        // No dashboard access → zeroed hero stats, never fixtures.
        XCTAssertEqual(content.stats.map(\.value), ["0", "0", "0"])
    }

    func testServerErrorSurfacesError() async {
        SequencedURLProtocol.routeResponses = ["/api/homes/h1": [.status(500, body: "{}")]]
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        if case .error = vm.state {
            // pass
        } else {
            XCTFail("Expected error, got \(vm.state)")
        }
    }

    func testRetryRecovers() async {
        stubHappyPath(detail: [
            .status(500, body: "{}"),
            .status(200, body: Self.detailBody)
        ])
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error first")
            return
        }
        // Re-stub the one-shot intelligence routes for the retry pass.
        stubHappyPath(detail: [.status(200, body: Self.detailBody)])
        await vm.refresh()
        guard case .loaded = vm.state else {
            XCTFail("Expected loaded after retry")
            return
        }
    }

    // MARK: - Home Intelligence

    func testIntelligenceCardsLoadIndependently() async {
        stubHappyPath(
            health: [.status(500, body: "{}")],
            billTrends: [.status(403, body: "{}")]
        )
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()

        // A failed health score must not blank the screen.
        guard case .loaded = vm.state else {
            XCTFail("Expected loaded despite the health-score failure, got \(vm.state)")
            return
        }
        if case .failed = vm.healthScore {
            // pass
        } else {
            XCTFail("Expected the health-score card to be in its error state")
        }
        if case .forbidden = vm.billTrends {
            // pass
        } else {
            XCTFail("Expected bill trends to be forbidden without finance access")
        }
        XCTAssertEqual(vm.checklist.value?.items.count, 2)
        XCTAssertEqual(vm.propertyValue.value?.estimatedValue, 812_000)
    }

    func testCompleteChecklistItemReflectsTheServerReturnedRow() async {
        stubHappyPath(health: [
            .status(200, body: Self.healthBody),
            .status(200, body: Self.healthBody)
        ])
        SequencedURLProtocol.routeResponses["/api/homes/h1/seasonal-checklist/i1"] = [
            .status(200, body: """
            {"id":"i1","home_id":"h1","season_key":"fall_prep","year":2026,
             "item_key":"gutter_cleaning","title":"Clean gutters before rain season",
             "description":null,"gig_category":"Cleaning",
             "gig_title_suggestion":"Gutter cleaning needed","status":"completed",
             "completed_at":"2026-02-01T00:00:00Z","gig_id":null,"sort_order":1}
            """)
        ]
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.checklist.value?.items.first?.status, "pending")

        await vm.completeChecklistItem("i1")

        XCTAssertEqual(vm.checklist.value?.items.first?.status, "completed")
        XCTAssertEqual(vm.checklist.value?.progress.completed, 2)
        XCTAssertEqual(vm.checklist.value?.progress.percentage, 100)
        XCTAssertTrue(vm.pendingChecklistItemIds.isEmpty)
    }

    func testSkipChecklistItemSendsSkippedStatus() async {
        stubHappyPath(health: [
            .status(200, body: Self.healthBody),
            .status(200, body: Self.healthBody)
        ])
        SequencedURLProtocol.routeResponses["/api/homes/h1/seasonal-checklist/i1"] = [
            .status(200, body: """
            {"id":"i1","home_id":"h1","season_key":"fall_prep","year":2026,
             "item_key":"gutter_cleaning","title":"Clean gutters before rain season",
             "description":null,"gig_category":"Cleaning",
             "gig_title_suggestion":"Gutter cleaning needed","status":"skipped",
             "completed_at":"2026-02-01T00:00:00Z","gig_id":null,"sort_order":1}
            """)
        ]
        let vm = HomeDashboardViewModel(homeId: "h1", api: makeAPI())
        await vm.load()
        await vm.skipChecklistItem("i1")

        XCTAssertEqual(vm.checklist.value?.items.first?.status, "skipped")
        let patch = SequencedURLProtocol.capturedRequests.last {
            $0.url?.path == "/api/homes/h1/seasonal-checklist/i1"
        }
        XCTAssertEqual(patch?.httpMethod, "PATCH")
    }

    func testTopActionRouteMapsToADashboardActionId() {
        XCTAssertEqual(HealthScoreRingCard.actionId(for: "/homes/h1/maintenance"), "view_maintenance")
        XCTAssertEqual(HealthScoreRingCard.actionId(for: "/homes/h1/bills"), "view_bills")
        XCTAssertEqual(HealthScoreRingCard.actionId(for: "/homes/h1/emergency"), "view_emergency")
        XCTAssertEqual(HealthScoreRingCard.actionId(for: "/homes/h1/members"), "add_member")
        XCTAssertEqual(HealthScoreRingCard.actionId(for: "/homes/h1/documents"), "view_docs")
        XCTAssertNil(HealthScoreRingCard.actionId(for: "/homes/h1/dashboard"))
    }

    // MARK: - Sample-id shortcuts (QA fixtures, not live data)

    func testBrandNewSampleRendersEmptyState() async {
        let vm = HomeDashboardViewModel(homeId: HomeDashboardSampleData.emptyHomeId, api: makeAPI())
        await vm.load()
        guard case let .empty(brandNew) = vm.state else {
            XCTFail("Expected empty brand-new sample, got \(vm.state)")
            return
        }
        XCTAssertEqual(brandNew.onboardingSteps.map(\.title), [
            "Add members",
            "Set access codes",
            "Log emergency info"
        ])
        XCTAssertEqual(brandNew.content.stats.map(\.value), ["0", "0", "0"])
    }

    func testNeedsAttentionSampleRendersAttentionState() async {
        let vm = HomeDashboardViewModel(homeId: HomeDashboardSampleData.needsAttentionHomeId, api: makeAPI())
        await vm.load()
        guard case let .needsAttention(content) = vm.state else {
            XCTFail("Expected needsAttention sample, got \(vm.state)")
            return
        }
        XCTAssertEqual(
            content.attentionSummary?.message,
            "3 items need attention: 1 overdue bill, 2 maintenance items past due, 1 pending claim"
        )
        XCTAssertEqual(content.attentionSummary?.chips.map(\.actionId), [
            "view_bills",
            "view_maintenance",
            "view_claims"
        ])
    }
}
