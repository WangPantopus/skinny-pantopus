@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.transaction_reviews

import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewDto
import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewerDto
import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewsResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

/**
 * Unit tests for the BLOCK 2D received-reviews aggregation. `summarize` is a
 * pure companion function, so it's exercised directly without the VM/Hilt.
 */
class ReceivedReviewsViewModelTest {
    private val now: Instant = Instant.parse("2026-05-15T12:00:00Z")

    private data class ReviewRatings(
        val overall: Int,
        val communication: Int? = null,
        val accuracy: Int? = null,
        val punctuality: Int? = null,
    )

    private fun review(
        id: String,
        ratings: ReviewRatings,
        isBuyer: Boolean? = null,
        context: String = "listing_sale",
        reviewer: TransactionReviewerDto? = null,
    ) = TransactionReviewDto(
        id = id,
        context = context,
        rating = ratings.overall,
        communicationRating = ratings.communication,
        accuracyRating = ratings.accuracy,
        punctualityRating = ratings.punctuality,
        isBuyer = isBuyer,
        createdAt = "2026-05-14T12:00:00Z",
        reviewer = reviewer,
    )

    @Test
    fun summarize_computes_distribution_average_and_total() {
        val response =
            TransactionReviewsResponse(
                reviews =
                    listOf(
                        review(
                            id = "r1",
                            ratings = ReviewRatings(overall = 5, communication = 5, accuracy = 4),
                            isBuyer = true,
                        ),
                        review(
                            id = "r2",
                            ratings = ReviewRatings(overall = 4, communication = 3, punctuality = 4),
                            isBuyer = false,
                        ),
                        review(id = "r3", ratings = ReviewRatings(overall = 5)),
                    ),
                averageRating = 4.67,
                total = 3,
            )

        val summary = ReceivedReviewsViewModel.summarize(response, now)

        assertEquals(3, summary.total)
        assertEquals(4.67, summary.average, 0.001)
        // 5★ × 2, 4★ × 1, rest 0 — ordered 5★→1★.
        assertEquals(2f / 3f, summary.distribution[0], 0.001f)
        assertEquals(1f / 3f, summary.distribution[1], 0.001f)
        assertEquals(0f, summary.distribution[2], 0.001f)
        assertEquals(4.0, summary.communication!!.average, 0.001)
        assertEquals(2, summary.communication!!.count)
        assertEquals(4.0, summary.accuracy!!.average, 0.001)
        assertEquals(1, summary.accuracy!!.count)
        assertEquals(4.0, summary.punctuality!!.average, 0.001)
        assertEquals(1, summary.punctuality!!.count)
    }

    @Test
    fun summarize_projects_rows_with_name_role_and_context() {
        val response =
            TransactionReviewsResponse(
                reviews =
                    listOf(
                        review(
                            id = "r1",
                            ratings = ReviewRatings(overall = 5),
                            isBuyer = true,
                            reviewer = TransactionReviewerDto(id = "a", firstName = "Anika", lastName = "Reyes"),
                        ),
                        review(
                            id = "r2",
                            ratings = ReviewRatings(overall = 4),
                            isBuyer = false,
                            reviewer = TransactionReviewerDto(id = "b", username = "marcus"),
                        ),
                        review(id = "r3", ratings = ReviewRatings(overall = 3)),
                    ),
                averageRating = 4.0,
                total = 3,
            )

        val summary = ReceivedReviewsViewModel.summarize(response, now)

        assertEquals("Anika Reyes", summary.rows[0].reviewerName)
        assertEquals("AR", summary.rows[0].initials)
        assertEquals("From buyer", summary.rows[0].roleLabel)
        assertEquals("Sale", summary.rows[0].contextLabel)
        assertEquals("marcus", summary.rows[1].reviewerName)
        assertEquals("From seller", summary.rows[1].roleLabel)
        assertEquals("Neighbor", summary.rows[2].reviewerName)
        assertNull(summary.rows[2].roleLabel)
    }

    @Test
    fun summarize_omits_criteria_when_all_null() {
        val response =
            TransactionReviewsResponse(
                reviews = listOf(review(id = "r1", ratings = ReviewRatings(overall = 5))),
                averageRating = 5.0,
                total = 1,
            )

        val summary = ReceivedReviewsViewModel.summarize(response, now)

        assertNull(summary.communication)
        assertNull(summary.accuracy)
        assertNull(summary.punctuality)
    }
}
