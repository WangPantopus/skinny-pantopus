package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeBillBenchmarkDto
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendSeriesDto
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/** Format 2 uses chronological months and one currency in decimal major units. */
internal object HomeBillPresentation {
    private const val MINIMUM_HOUSEHOLDS = 10
    private const val MAXIMUM_MONTHS = 24
    private const val MAXIMUM_SAFE_MINOR_UNITS = 9_007_199_254_740_991.0

    fun isCurrent(
        data: HomeBillTrendsDto,
        currency: String = "USD",
    ): Boolean {
        if (data.formatVersion != 2 || data.calculationVersion != 2 ||
            data.currency != currency
        ) {
            return false
        }
        if (data.availableCurrencies.distinct().size != data.availableCurrencies.size ||
            !data.availableCurrencies.all { it.matches(Regex("^[A-Z]{3}$")) }
        ) {
            return false
        }
        if (!data.billsByType.values.all { valid(it.months, it.amounts) }) return false
        return data.benchmarks.values.all { row ->
            if (row.insufficientData) {
                row.months.isEmpty() && row.avgAmounts.isEmpty() && (row.needed ?: 0) in 1..7
            } else {
                (row.householdCount ?: 0) >= MINIMUM_HOUSEHOLDS && valid(row.months, row.avgAmounts)
            }
        }
    }

    private fun valid(
        months: List<String>,
        amounts: List<Double>,
    ): Boolean =
        months.isNotEmpty() && months.size <= MAXIMUM_MONTHS && months.size == amounts.size &&
            months == months.sorted() && months.distinct().size == months.size &&
            months.all { it.matches(Regex("^\\d{4}-(0[1-9]|1[0-2])$")) } &&
            amounts.all { it.isFinite() && it >= 0 && it * 100 <= MAXIMUM_SAFE_MINOR_UNITS }

    fun amount(
        value: Double,
        currency: String,
    ): String {
        val formatter = NumberFormat.getCurrencyInstance(Locale.US)
        // Unknown ISO-looking codes must not crash a financial card.
        val unit =
            runCatching { Currency.getInstance(currency) }.getOrNull()
                ?: return String.format(Locale.US, "%.2f %s", value, currency)
        formatter.currency = unit
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.format(value)
    }

    fun note(
        series: HomeBillTrendSeriesDto,
        benchmark: HomeBillBenchmarkDto?,
        currency: String,
    ): String? {
        if (series.months.isEmpty() || series.amounts.isEmpty()) return null
        val month = series.months.last()
        val mine = series.amounts.last()
        val period = "$month · $currency"
        val index = benchmark?.months?.indexOf(month) ?: -1
        if (benchmark == null || benchmark.insufficientData || (benchmark.householdCount ?: 0) < MINIMUM_HOUSEHOLDS) {
            return "$period · No comparison for this month"
        }
        if (index !in benchmark.avgAmounts.indices) {
            return "$period · No comparison for this month"
        }
        val neighbors = benchmark.avgAmounts[index]
        val label = amount(neighbors, currency)
        return when {
            mine > neighbors -> "$period · Above the $label neighborhood average"
            mine < neighbors -> "$period · Below the $label neighborhood average"
            else -> "$period · In line with the $label neighborhood average"
        }
    }
}
