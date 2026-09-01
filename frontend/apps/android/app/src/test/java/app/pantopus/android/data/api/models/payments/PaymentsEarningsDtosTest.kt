package app.pantopus.android.data.api.models.payments

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * `GET api/payments/earnings` / `/spending` answer with the summary under a
 * named key *and* spread at the envelope root, each figure emitted in both
 * casings, and the spending RPC can return a fractional-zero float. Mirrors
 * iOS `PaymentsEarningsDTOs`.
 */
class PaymentsEarningsDtosTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PaymentsEarningsJsonAdapter())
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json))

    /** The shape `backend/routes/pays.js:1130` actually emits. */
    @Test
    fun earnings_decodes_the_nested_key_of_the_real_envelope() {
        val response =
            decode<PaymentsEarningsResponse>(
                """
                {
                  "earnings": {
                    "totalEarned": 128450, "total_earned": 128450,
                    "totalPaid": 100000, "total_paid": 100000,
                    "totalEscrowed": 20000, "total_escrowed": 20000,
                    "totalAvailable": 8450, "total_available": 8450,
                    "currency": "usd"
                  },
                  "totalEarned": 128450, "total_earned": 128450,
                  "currency": "usd"
                }
                """.trimIndent(),
            )

        assertEquals(128_450, response.earnings.totalEarned)
        assertEquals(100_000, response.earnings.totalPaid)
        assertEquals(20_000, response.earnings.totalEscrowed)
        assertEquals(8_450, response.earnings.totalAvailable)
        assertEquals("usd", response.earnings.currency)
    }

    /** Without the nested key the root spread still maps. */
    @Test
    fun earnings_falls_back_to_the_root_spread() {
        val response =
            decode<PaymentsEarningsResponse>("""{"total_earned":4200,"total_paid":4200,"currency":"usd"}""")

        assertEquals(4_200, response.earnings.totalEarned)
        assertEquals(4_200, response.earnings.totalPaid)
    }

    /** camelCase-only payloads map too. */
    @Test
    fun earnings_reads_camel_case_when_snake_case_is_absent() {
        val response = decode<PaymentsEarningsResponse>("""{"earnings":{"totalEarned":999}}""")

        assertEquals(999, response.earnings.totalEarned)
    }

    /** A user with no payment history reads as zero, not as a decode failure. */
    @Test
    fun earnings_decodes_an_empty_envelope_as_zero() {
        val response = decode<PaymentsEarningsResponse>("{}")

        assertEquals(0, response.earnings.totalEarned)
        assertNull(response.earnings.currency)
    }

    /** The spending RPC can hand back `1234.0` for an integer-cents column. */
    @Test
    fun spending_rounds_a_fractional_zero_float() {
        val response =
            decode<SpendingSummaryResponse>(
                """{"spending":{"total_spent":31800.0,"total_paid":31800.0,"total_refunded":0.0},"source":"rpc"}""",
            )

        assertEquals(31_800, response.spending.totalSpent)
        assertEquals(31_800, response.spending.totalPaid)
        assertEquals(0, response.spending.totalRefunded)
    }

    @Test
    fun spending_falls_back_to_the_root_spread() {
        val response = decode<SpendingSummaryResponse>("""{"totalSpent":250,"totalRefunded":50,"source":"aggregate"}""")

        assertEquals(250, response.spending.totalSpent)
        assertEquals(50, response.spending.totalRefunded)
    }
}
