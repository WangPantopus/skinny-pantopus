@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.wallet

import app.pantopus.android.data.api.models.wallet.WalletBalanceResponse
import app.pantopus.android.data.api.models.wallet.WalletDto
import app.pantopus.android.data.api.models.wallet.WalletPendingReleaseResponse
import app.pantopus.android.data.api.models.wallet.WalletTransactionDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

/**
 * P1-F — pure projection of the read-path wallet DTOs (mirrors iOS
 * `WalletMappingTests`): cents formatting, per-field transaction mapping, day
 * labels, and the whole-content build.
 */
class WalletMapperTest {
    private val utc = ZoneId.of("UTC")
    private val now: Instant = Instant.parse("2026-06-03T18:00:00Z")

    private fun tx(
        id: String,
        type: String,
        amount: Long,
        status: String = "completed",
        description: String? = null,
        createdAt: String? = "2026-06-03T14:14:00.000Z",
    ) = WalletTransactionDto(
        id = id,
        type = type,
        amount = amount,
        description = description,
        status = status,
        createdAt = createdAt,
    )

    @Test
    fun cents_formatting() {
        assertEquals("847.50", WalletMapper.centsToPlain(84_750))
        assertEquals("1,284.50", WalletMapper.centsToPlain(128_450))
        assertEquals("\$186.00", WalletMapper.centsToCurrency(18_600))
        assertEquals("0.00", WalletMapper.centsToPlain(0))
    }

    @Test
    fun direction_mapping() {
        assertEquals(ActivityDirection.Out, WalletMapper.direction("withdrawal"))
        assertEquals(ActivityDirection.Out, WalletMapper.direction("cancellation_fee"))
        assertEquals(ActivityDirection.In, WalletMapper.direction("gig_income"))
        assertEquals(ActivityDirection.In, WalletMapper.direction("refund"))
    }

    @Test
    fun category_mapping() {
        assertEquals(ActivityCategory.Bank, WalletMapper.category("withdrawal"))
        assertEquals(ActivityCategory.Fee, WalletMapper.category("cancellation_fee"))
        assertEquals(ActivityCategory.Fee, WalletMapper.category("refund"))
        assertEquals(ActivityCategory.Handyman, WalletMapper.category("gig_income"))
    }

    @Test
    fun day_labels() {
        assertEquals("Today", WalletMapper.dayLabel(Instant.parse("2026-06-03T09:00:00Z"), utc, now))
        assertEquals("Yesterday", WalletMapper.dayLabel(Instant.parse("2026-06-02T23:00:00Z"), utc, now))
        assertEquals("May 28", WalletMapper.dayLabel(Instant.parse("2026-05-28T12:00:00Z"), utc, now))
    }

    @Test
    fun activity_item_mapping() {
        val item =
            WalletMapper.activityItem(
                tx("tx-1", "gig_income", 14_000, description = "Patio cleanup · 3 hr"),
                utc,
                now,
            )
        assertEquals("140.00", item.amount)
        assertEquals(ActivityDirection.In, item.direction)
        assertEquals(ActivityCategory.Handyman, item.category)
        assertEquals("Today", item.day)
        assertEquals("2:14 pm", item.dateLabel)
        assertTrue(item.status is ActivityStatus.Available)
        assertFalse(item.isFee)
    }

    @Test
    fun pending_transaction_maps_to_pending_status() {
        val item = WalletMapper.activityItem(tx("tx-2", "gig_income", 8_500, status = "pending"), utc, now)
        assertTrue(item.status is ActivityStatus.Pending)
    }

    @Test
    fun build_projection() {
        val content =
            WalletMapper.build(
                WalletBalanceResponse(WalletDto(id = "w1", balance = 84_750L)),
                listOf(
                    tx("tx-1", "gig_income", 14_000, createdAt = "2026-06-03T14:14:00Z"),
                    tx("tx-2", "withdrawal", 50_000, createdAt = "2026-05-28T11:14:00Z"),
                ),
                WalletPendingReleaseResponse(totalPendingCents = 18_600L, inReviewCount = 2, releasingSoonCount = 1),
                zone = utc,
                now = now,
            )
        assertEquals("847.50", content.available)
        assertEquals("\$186.00", content.pending)
        assertEquals(2, content.activity.size)
        // Only the inbound June row counts toward "this month".
        assertEquals("\$140.00", content.monthValue)
        assertEquals("1 task this month", content.monthMeta)
        assertFalse(content.isOnHold)
        assertEquals(ActivityCategory.Bank, content.activity[1].category)
    }
}
