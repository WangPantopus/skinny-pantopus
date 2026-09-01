@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.payments

import app.pantopus.android.data.api.models.payments.EarningsSummaryDto
import app.pantopus.android.data.api.models.payments.SpendingSummaryDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * A14.6 — the "Earnings & Spending" card projects `GET api/payments/earnings`
 * and `GET api/payments/spending`. The two reads degrade independently, and
 * the card is hidden outright when neither could be read. Mirrors iOS
 * `PaymentsViewModel.earnings(earned:spent:)`.
 */
class PaymentsEarningsProjectionTest {
    /** Both summaries read → both tiles carry the formatted lifetime total. */
    @Test
    fun both_summaries_format_the_two_tiles() {
        val earnings =
            PaymentsMapper.earnings(
                earned = EarningsSummaryDto(totalEarned = 128_450, totalPaid = 100_000, totalEscrowed = 20_000),
                spent = SpendingSummaryDto(totalSpent = 31_800, totalPaid = 31_800),
            )

        assertNotNull(earnings)
        assertEquals("$1,284.50", earnings?.totalEarned)
        assertEquals("$318.00", earnings?.totalSpent)
    }

    /** The caption states that earned money can still be in review. */
    @Test
    fun caption_explains_that_earned_includes_funds_on_hold() {
        val earnings =
            PaymentsMapper.earnings(
                earned = EarningsSummaryDto(totalEarned = 0),
                spent = SpendingSummaryDto(totalSpent = 0),
            )

        assertEquals(
            "Total earned includes funds still in review or on hold. " +
                "Your wallet balance shows what's withdrawable now.",
            earnings?.caption,
        )
    }

    /** A spending failure must not blank out the earned figure. */
    @Test
    fun spending_failure_degrades_only_the_spent_tile() {
        val earnings = PaymentsMapper.earnings(earned = EarningsSummaryDto(totalEarned = 4_200), spent = null)

        assertEquals("$42.00", earnings?.totalEarned)
        assertEquals("Spent falls back to an em-dash, never \$0.00", "—", earnings?.totalSpent)
    }

    /** …and the same the other way round. */
    @Test
    fun earnings_failure_degrades_only_the_earned_tile() {
        val earnings = PaymentsMapper.earnings(earned = null, spent = SpendingSummaryDto(totalSpent = 25_000))

        assertEquals("Earned falls back to an em-dash, never \$0.00", "—", earnings?.totalEarned)
        assertEquals("$250.00", earnings?.totalSpent)
    }

    /** Neither read landed → hide the card rather than claim two zeroes. */
    @Test
    fun both_failures_hide_the_card() {
        assertNull(PaymentsMapper.earnings(earned = null, spent = null))
    }

    /** A genuine zero is a real figure and still renders. */
    @Test
    fun genuine_zero_totals_still_render() {
        val earnings =
            PaymentsMapper.earnings(
                earned = EarningsSummaryDto(totalEarned = 0),
                spent = SpendingSummaryDto(totalSpent = 0),
            )

        assertEquals("$0.00", earnings?.totalEarned)
        assertEquals("$0.00", earnings?.totalSpent)
    }
}
