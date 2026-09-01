@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.transaction_reviews

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewDto
import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewerDto
import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.transaction_reviews.TransactionReviewsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject
import kotlin.math.roundToInt

/** Average + count for one optional sub-rating criterion. */
data class CriterionAverage(
    val average: Double,
    val count: Int,
)

/** One projected received-review row. */
data class ReceivedReviewRow(
    val id: String,
    val reviewerName: String,
    val initials: String,
    val avatarUrl: String?,
    val rating: Int,
    val comment: String?,
    val contextLabel: String,
    val roleLabel: String?,
    val timestamp: String,
)

/** Aggregated summary backing the loaded state. */
data class ReceivedReviewsSummary(
    val average: Double,
    val total: Int,
    /** Five fractions in 0..1, ordered 5★→1★, for [RatingDistribution]. */
    val distribution: List<Float>,
    val communication: CriterionAverage?,
    val accuracy: CriterionAverage?,
    val punctuality: CriterionAverage?,
    val rows: List<ReceivedReviewRow>,
)

/** Four render states for the received-reviews section. */
sealed interface ReceivedReviewsUiState {
    data object Loading : ReceivedReviewsUiState

    data object Empty : ReceivedReviewsUiState

    data class Loaded(val summary: ReceivedReviewsSummary) : ReceivedReviewsUiState

    data class Error(val message: String) : ReceivedReviewsUiState
}

/**
 * BLOCK 2D — drives the "received reviews" section from
 * `GET /api/transaction-reviews/user/:userId`. The user id is supplied by
 * the embedding composable via [load] (the section isn't a nav destination,
 * so it can't read a SavedStateHandle arg).
 */
@HiltViewModel
class ReceivedReviewsViewModel
    @Inject
    constructor(
        private val repo: TransactionReviewsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ReceivedReviewsUiState>(ReceivedReviewsUiState.Loading)
        val state: StateFlow<ReceivedReviewsUiState> = _state.asStateFlow()

        private var userId: String? = null
        private var loadedOnce = false

        fun load(userId: String) {
            if (this.userId == userId && loadedOnce) return
            this.userId = userId
            reload()
        }

        fun refresh() = reload()

        private fun reload() {
            val uid = userId ?: return
            if (!loadedOnce) _state.value = ReceivedReviewsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.userReviews(uid)) {
                    is NetworkResult.Success -> {
                        loadedOnce = true
                        val data = result.data
                        _state.value =
                            if (data.reviews.isEmpty()) {
                                ReceivedReviewsUiState.Empty
                            } else {
                                ReceivedReviewsUiState.Loaded(summarize(data, Instant.now()))
                            }
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedOnce) {
                            _state.value = ReceivedReviewsUiState.Error(result.error.displayMessage("Couldn't load reviews."))
                        }
                    }
                }
            }
        }

        companion object {
            /** Pure aggregation — public so tests assert it without the VM. */
            fun summarize(
                response: TransactionReviewsResponse,
                now: Instant,
            ): ReceivedReviewsSummary {
                val reviews = response.reviews
                val total = reviews.size
                val buckets = IntArray(5) // index 0 == 5★ … index 4 == 1★
                for (review in reviews) {
                    val clamped = review.rating.coerceIn(1, 5)
                    buckets[5 - clamped] += 1
                }
                val distribution = buckets.map { if (total > 0) it.toFloat() / total else 0f }
                return ReceivedReviewsSummary(
                    average = response.averageRating,
                    total = if (response.total > 0) response.total else total,
                    distribution = distribution,
                    communication = criterionAverage(reviews.mapNotNull { it.communicationRating }),
                    accuracy = criterionAverage(reviews.mapNotNull { it.accuracyRating }),
                    punctuality = criterionAverage(reviews.mapNotNull { it.punctualityRating }),
                    rows = reviews.map { row(it, now) },
                )
            }

            fun criterionAverage(values: List<Int>): CriterionAverage? {
                if (values.isEmpty()) return null
                val average = (values.sum().toDouble() / values.size * 100).roundToInt() / 100.0
                return CriterionAverage(average = average, count = values.size)
            }

            fun row(
                dto: TransactionReviewDto,
                now: Instant,
            ): ReceivedReviewRow {
                val name = displayName(dto.reviewer)
                val context = TransactionReviewContext.fromRaw(dto.context)
                return ReceivedReviewRow(
                    id = dto.id,
                    reviewerName = name,
                    initials = initials(name),
                    avatarUrl = dto.reviewer?.profilePictureUrl,
                    rating = dto.rating.coerceIn(0, 5),
                    comment = dto.comment?.takeIf { it.isNotEmpty() },
                    contextLabel = context?.shortLabel ?: "Transaction",
                    roleLabel = roleLabel(dto.isBuyer),
                    timestamp = relativeTime(dto.createdAt, now),
                )
            }

            fun displayName(reviewer: TransactionReviewerDto?): String {
                val first = reviewer?.firstName?.takeIf { it.isNotEmpty() }
                if (first != null) {
                    val last = reviewer.lastName?.takeIf { it.isNotEmpty() }
                    return if (last != null) "$first $last" else first
                }
                val username = reviewer?.username?.takeIf { it.isNotEmpty() }
                if (username != null) return username
                return "Neighbor"
            }

            fun initials(name: String): String {
                val letters =
                    name
                        .split(" ")
                        .filter { it.isNotBlank() }
                        .take(2)
                        .mapNotNull { it.firstOrNull()?.toString() }
                val joined = letters.joinToString("").uppercase(Locale.ROOT)
                return joined.ifEmpty { "?" }
            }

            fun roleLabel(isBuyer: Boolean?): String? =
                when (isBuyer) {
                    true -> "From buyer"
                    false -> "From seller"
                    null -> null
                }

            fun relativeTime(
                raw: String?,
                now: Instant,
            ): String {
                val date = parseInstant(raw) ?: return ""
                val seconds = ChronoUnit.SECONDS.between(date, now)
                return when {
                    seconds < 60 -> "just now"
                    seconds < 3600 -> "${seconds / 60}m ago"
                    seconds < 86_400 -> "${seconds / 3600}h ago"
                    seconds < 2 * 86_400 -> "yesterday"
                    seconds < 7 * 86_400 -> "${seconds / 86_400}d ago"
                    else -> monthDay(date)
                }
            }

            private fun monthDay(instant: Instant): String =
                runCatching {
                    DateTimeFormatter
                        .ofPattern("MMM d", Locale.US)
                        .withZone(java.time.ZoneId.systemDefault())
                        .format(instant)
                }.getOrDefault("")

            private fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }
        }
    }
