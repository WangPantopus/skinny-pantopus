package app.pantopus.android.data.api.models.payments

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonClass
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.JsonReader
import kotlin.math.roundToInt

/**
 * DTOs for `GET api/payments/earnings` (`backend/routes/pays.js:1111`) and
 * `GET api/payments/spending` (`backend/routes/pays.js:1142`), both mounted
 * at `/api/payments` (`backend/app.js:331`). They back the "Earnings &
 * Spending" card on Settings → Payments.
 *
 * Both figures are lifetime totals in integer cents and are deliberately
 * *not* the wallet balance: total earned includes funds still in
 * review/hold, while the wallet hero shows only withdrawable funds.
 *
 * Distinct from `GET api/mailbox/earnings/summary`
 * ([app.pantopus.android.data.api.services.MailboxApi.earningsSummary]),
 * which counts mailbox offer-engagement points rather than payment money.
 */

/**
 * `GET api/payments/earnings` envelope. Named apart from Mailbox's
 * `EarningsSummaryResponse`, which decodes the unrelated Earn dashboard.
 */
@JsonClass(generateAdapter = false)
data class PaymentsEarningsResponse(
    val earnings: EarningsSummaryDto,
)

/**
 * Lifetime earnings for the signed-in user. [totalEarned] **includes funds
 * still in review / escrow** — the wallet balance is the withdrawable slice.
 */
@JsonClass(generateAdapter = false)
data class EarningsSummaryDto(
    /** Lifetime earned, integer cents. */
    val totalEarned: Int = 0,
    /** Already paid out to the seller, integer cents. */
    val totalPaid: Int = 0,
    /** Still held in escrow, integer cents. */
    val totalEscrowed: Int = 0,
    /** Released and available, integer cents. */
    val totalAvailable: Int = 0,
    val currency: String? = null,
)

/** `GET api/payments/spending` envelope. */
@JsonClass(generateAdapter = false)
data class SpendingSummaryResponse(
    val spending: SpendingSummaryDto,
)

/** Lifetime spending for the signed-in user, integer cents. */
@JsonClass(generateAdapter = false)
data class SpendingSummaryDto(
    val totalSpent: Int = 0,
    val totalPaid: Int = 0,
    val totalRefunded: Int = 0,
    val currency: String? = null,
)

/**
 * Decodes both summary envelopes. Each handler responds with the summary
 * under a named key *and* spread at the envelope root
 * (`res.json({ earnings, ...earnings })`), and each figure is emitted twice —
 * camelCase and snake_case. We read the nested key and fall back to the root
 * spread, preferring snake_case, so either shape maps.
 *
 * The spending RPC can hand back a JSON number with a fractional zero
 * (`1234.0`), so the numbers are read tolerantly and rounded — never
 * re-derived beyond that. Registered in
 * [app.pantopus.android.di.NetworkModule] ahead of `KotlinJsonAdapterFactory`.
 */
class PaymentsEarningsJsonAdapter {
    @FromJson
    fun earningsFromJson(reader: JsonReader): PaymentsEarningsResponse {
        val fields = readEnvelope(reader, nestedKey = "earnings")
        return PaymentsEarningsResponse(
            EarningsSummaryDto(
                totalEarned = fields.cents("total_earned", "totalEarned"),
                totalPaid = fields.cents("total_paid", "totalPaid"),
                totalEscrowed = fields.cents("total_escrowed", "totalEscrowed"),
                totalAvailable = fields.cents("total_available", "totalAvailable"),
                currency = fields.currency,
            ),
        )
    }

    @FromJson
    fun spendingFromJson(reader: JsonReader): SpendingSummaryResponse {
        val fields = readEnvelope(reader, nestedKey = "spending")
        return SpendingSummaryResponse(
            SpendingSummaryDto(
                totalSpent = fields.cents("total_spent", "totalSpent"),
                totalPaid = fields.cents("total_paid", "totalPaid"),
                totalRefunded = fields.cents("total_refunded", "totalRefunded"),
                currency = fields.currency,
            ),
        )
    }

    /**
     * Read the response object once: the summary nested under [nestedKey]
     * wins, and the root spread is the fallback. Anything that isn't an
     * object is a decode failure, not an empty summary — `safeApiCall` maps
     * it to `NetworkError.Decoding` so the tile degrades to an em-dash
     * instead of claiming a lifetime total of zero.
     */
    private fun readEnvelope(
        reader: JsonReader,
        nestedKey: String,
    ): SummaryFields {
        if (reader.peek() != JsonReader.Token.BEGIN_OBJECT) {
            throw JsonDataException("Expected a $nestedKey summary object but was ${reader.peek()} at ${reader.path}")
        }
        var nested: SummaryFields? = null
        val root = SummaryFields()
        reader.beginObject()
        while (reader.hasNext()) {
            val name = reader.nextName()
            if (name == nestedKey && reader.peek() == JsonReader.Token.BEGIN_OBJECT) {
                nested = readSummary(reader)
            } else {
                root.read(reader, name)
            }
        }
        reader.endObject()
        return nested ?: root
    }

    private fun readSummary(reader: JsonReader): SummaryFields {
        val fields = SummaryFields()
        reader.beginObject()
        while (reader.hasNext()) {
            fields.read(reader, reader.nextName())
        }
        reader.endObject()
        return fields
    }

    /** One summary object's readable values, keyed by their wire name. */
    private class SummaryFields {
        private val figures = mutableMapOf<String, Int>()

        var currency: String? = null
            private set

        fun read(
            reader: JsonReader,
            name: String,
        ) {
            when (reader.peek()) {
                JsonReader.Token.NUMBER -> figures[name] = reader.nextDouble().roundToInt()
                JsonReader.Token.STRING ->
                    if (name == CURRENCY_KEY) currency = reader.nextString() else reader.skipValue()
                else -> reader.skipValue()
            }
        }

        /** Prefer the snake_case figure, then camelCase; absent reads as 0. */
        fun cents(
            snake: String,
            camel: String,
        ): Int = figures[snake] ?: figures[camel] ?: 0
    }

    private companion object {
        const val CURRENCY_KEY = "currency"
    }
}
