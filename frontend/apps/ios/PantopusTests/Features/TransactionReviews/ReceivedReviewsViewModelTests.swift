//
//  ReceivedReviewsViewModelTests.swift
//  PantopusTests
//
//  BLOCK 2D — unit tests for the received-reviews aggregation. `summarize`
//  is a pure static function (the test seam), so it's exercised directly.
//

import XCTest
@testable import Pantopus

@MainActor
final class ReceivedReviewsViewModelTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_778_000_000)

    private func review(
        id: String,
        rating: Int,
        communication: Int? = nil,
        accuracy: Int? = nil,
        punctuality: Int? = nil,
        isBuyer: Bool? = nil,
        context: String = "listing_sale",
        reviewer: TransactionReviewerDTO? = nil
    ) -> TransactionReviewDTO {
        TransactionReviewDTO(
            id: id,
            context: context,
            rating: rating,
            communicationRating: communication,
            accuracyRating: accuracy,
            punctualityRating: punctuality,
            isBuyer: isBuyer,
            createdAt: "2026-05-14T12:00:00Z",
            reviewer: reviewer
        )
    }

    func testSummarize_computesDistributionAverageAndTotal() {
        let response = TransactionReviewsResponse(
            reviews: [
                review(id: "r1", rating: 5, communication: 5, accuracy: 4, isBuyer: true),
                review(id: "r2", rating: 4, communication: 3, punctuality: 4, isBuyer: false),
                review(id: "r3", rating: 5)
            ],
            averageRating: 4.67,
            total: 3
        )

        let summary = ReceivedReviewsViewModel.summarize(response, now: now)

        XCTAssertEqual(summary.total, 3)
        XCTAssertEqual(summary.average, 4.67, accuracy: 0.001)
        XCTAssertEqual(summary.distribution[0], 2.0 / 3.0, accuracy: 0.001)
        XCTAssertEqual(summary.distribution[1], 1.0 / 3.0, accuracy: 0.001)
        XCTAssertEqual(summary.distribution[2], 0, accuracy: 0.001)
        XCTAssertEqual(summary.communication?.average ?? 0, 4.0, accuracy: 0.001)
        XCTAssertEqual(summary.communication?.count, 2)
        XCTAssertEqual(summary.accuracy?.average ?? 0, 4.0, accuracy: 0.001)
        XCTAssertEqual(summary.accuracy?.count, 1)
        XCTAssertEqual(summary.punctuality?.average ?? 0, 4.0, accuracy: 0.001)
        XCTAssertEqual(summary.punctuality?.count, 1)
    }

    func testSummarize_projectsRowsWithNameRoleAndContext() {
        let response = TransactionReviewsResponse(
            reviews: [
                review(
                    id: "r1",
                    rating: 5,
                    isBuyer: true,
                    reviewer: TransactionReviewerDTO(id: "a", firstName: "Anika", lastName: "Reyes")
                ),
                review(
                    id: "r2",
                    rating: 4,
                    isBuyer: false,
                    reviewer: TransactionReviewerDTO(id: "b", username: "marcus")
                ),
                review(id: "r3", rating: 3)
            ],
            averageRating: 4.0,
            total: 3
        )

        let summary = ReceivedReviewsViewModel.summarize(response, now: now)

        XCTAssertEqual(summary.rows[0].reviewerName, "Anika Reyes")
        XCTAssertEqual(summary.rows[0].initials, "AR")
        XCTAssertEqual(summary.rows[0].roleLabel, "From buyer")
        XCTAssertEqual(summary.rows[0].contextLabel, "Sale")
        XCTAssertEqual(summary.rows[1].reviewerName, "marcus")
        XCTAssertEqual(summary.rows[1].roleLabel, "From seller")
        XCTAssertEqual(summary.rows[2].reviewerName, "Neighbor")
        XCTAssertNil(summary.rows[2].roleLabel)
    }

    func testSummarize_omitsCriteriaWhenAllNull() {
        let response = TransactionReviewsResponse(
            reviews: [review(id: "r1", rating: 5)],
            averageRating: 5,
            total: 1
        )

        let summary = ReceivedReviewsViewModel.summarize(response, now: now)

        XCTAssertNil(summary.communication)
        XCTAssertNil(summary.accuracy)
        XCTAssertNil(summary.punctuality)
    }
}
