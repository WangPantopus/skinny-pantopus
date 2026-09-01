//
//  BusinessOwnerViewModelTests.swift
//  PantopusTests
//
//  A10.7 / P1-C — owner-dashboard view-model coverage. The owner data is now
//  live: the suite pins the injected-content seam (used by snapshots), the
//  pure projection (`makeContent` → tiles / strength / reviews), the live
//  primary-failure path, and the optimistic reply (`submitReply`).
//

import XCTest
@testable import Pantopus

@MainActor
final class BusinessOwnerViewModelTests: XCTestCase {
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

    // MARK: - Injected-content seam (previews / snapshots)

    func test_load_withInjectedContent_emitsLoaded() async {
        let viewModel = BusinessOwnerViewModel(
            businessId: "marlow",
            content: BusinessOwnerSampleData.marlow
        )
        await viewModel.load()
        guard case let .loaded(content) = viewModel.state else {
            return XCTFail("Expected loaded state")
        }
        XCTAssertEqual(content.businessId, "marlow")
        XCTAssertTrue(content.isLive)
        XCTAssertEqual(content.insights.count, 3)
        XCTAssertEqual(content.profileStrength.percent, 92)
        XCTAssertEqual(content.publicProfile.header.displayName, "Marlow & Co. Cleaning")
    }

    // MARK: - Live path: primary failure → error

    func test_load_liveFetch_primaryFailureEmitsError() async {
        // The Business Profile primary fetch (`GET /:businessId`) fails first.
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let viewModel = BusinessOwnerViewModel(businessId: "marlow", client: makeAPI())
        await viewModel.load()
        if case .error = viewModel.state { return }
        XCTFail("Expected .error; got \(viewModel.state)")
    }

    // MARK: - Projection (pure)

    func test_makeContent_projectsTilesStrengthAndReviews() {
        let viewModel = BusinessOwnerViewModel(businessId: "marlow", client: makeAPI())

        let dashboard = decode(BusinessDashboardResponse.self, from: """
        {
          "profile": { "is_published": true, "updated_at": null },
          "onboarding": {
            "completed_count": 6,
            "total_count": 8,
            "checklist": [
              { "key": "account_created", "done": true, "label": "Create business account" },
              { "key": "logo_uploaded", "done": false, "label": "Upload a logo" }
            ]
          },
          "access": { "hasAccess": true, "isOwner": true, "role_base": "owner" }
        }
        """)

        let insights = decode(BusinessInsightsResponse.self, from: """
        {
          "views": { "total": 1234, "trend": 18 },
          "followers": { "total": 84, "new": 5, "trend": 0 },
          "reviews": { "count": 23, "trend": -4, "average_rating": 4.6 }
        }
        """)

        let reviews = decode([BusinessOwnerReviewDTO].self, from: """
        [
          {
            "id": "rev-dana", "rating": 4, "comment": "Ran a little late.",
            "created_at": "2026-05-01T00:00:00.000Z", "owner_response": null,
            "reviewer_name": "Dana R.", "reviewer_avatar": null, "gig_title": "Deep clean"
          },
          {
            "id": "rev-jamal", "rating": 5, "comment": "Always great.",
            "created_at": "2026-04-01T00:00:00.000Z", "owner_response": "Thanks Jamal!",
            "reviewer_name": "Jamal T.", "reviewer_avatar": null, "gig_title": null
          }
        ]
        """)

        let content = viewModel.makeContent(
            publicProfile: BusinessProfileSampleData.populated,
            dashboard: dashboard,
            insights: insights,
            reviews: reviews
        )

        XCTAssertTrue(content.isLive)
        // Tiles: views / followers / reviews with positive-only deltas.
        XCTAssertEqual(content.insights.map(\.label), ["Views", "Followers", "Reviews"])
        XCTAssertEqual(content.insights[0].value, "1.2k")
        XCTAssertEqual(content.insights[0].delta, "18%")
        XCTAssertNil(content.insights[1].delta, "Zero trend renders no pill")
        XCTAssertNil(content.insights[2].delta, "Negative trend renders no pill")
        // Strength: 6/8 → 75%, two-remaining caption, checklist mapped.
        XCTAssertEqual(content.profileStrength.percent, 75)
        XCTAssertEqual(content.profileStrength.caption, "2 steps from a complete page")
        XCTAssertEqual(content.profileStrength.steps.count, 2)
        XCTAssertEqual(content.profileStrength.steps.last?.ctaLabel, "Add")
        XCTAssertNil(content.profileStrength.steps.first?.ctaLabel)
        // Reviews: Dana is unanswered (composer), Jamal carries the reply.
        XCTAssertEqual(content.reviews.count, 2)
        XCTAssertNil(content.reviews.first { $0.id == "rev-dana" }?.reply)
        XCTAssertEqual(content.reviews.first { $0.id == "rev-jamal" }?.reply, "Thanks Jamal!")
        XCTAssertEqual(content.reviewsToReplyLabel, "1 to reply")
    }

    // MARK: - Optimistic reply

    func test_submitReply_setsReplyOptimistically() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"message\":\"ok\"}")]
        let viewModel = BusinessOwnerViewModel(
            businessId: "marlow",
            client: makeAPI(),
            content: BusinessOwnerSampleData.marlow
        )
        await viewModel.load()
        viewModel.submitReply(reviewId: "dana", text: "Thanks for the feedback, Dana!")
        guard case let .loaded(content) = viewModel.state else {
            return XCTFail("Expected loaded state")
        }
        XCTAssertEqual(
            content.reviews.first { $0.id == "dana" }?.reply,
            "Thanks for the feedback, Dana!"
        )
    }

    func test_submitReply_blankText_isIgnored() async {
        let viewModel = BusinessOwnerViewModel(
            businessId: "marlow",
            content: BusinessOwnerSampleData.marlow
        )
        await viewModel.load()
        viewModel.submitReply(reviewId: "dana", text: "   \n ")
        guard case let .loaded(content) = viewModel.state else {
            return XCTFail("Expected loaded state")
        }
        XCTAssertNil(content.reviews.first { $0.id == "dana" }?.reply)
    }

    func test_applyingReply_recomputesPendingReplyLabel() {
        let base = BusinessOwnerSampleData.marlow
        XCTAssertEqual(base.reviewsToReplyLabel, "2 to reply")
        let updated = base.applyingReply("Appreciate it", to: "dana")
        XCTAssertEqual(updated.reviews.first { $0.id == "dana" }?.reply, "Appreciate it")
        XCTAssertNil(updated.reviewsToReplyLabel)
    }

    // MARK: - Helpers

    private func decode<T: Decodable>(_ type: T.Type, from json: String) -> T {
        // swiftlint:disable:next force_try
        try! JSONDecoder().decode(type, from: Data(json.utf8))
    }
}
