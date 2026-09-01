@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.profile.tabs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.profile.GigReviewDto
import app.pantopus.android.data.api.models.profile.GigReviewsResponse
import app.pantopus.android.data.api.models.profile.PortfolioFileDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.profile.ProfileTabsRepository
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.floor

/**
 * View-models behind the three public-profile tabs: Portfolio, Gigs and
 * (gig) Reviews.
 *
 *   Portfolio  GET    /api/files/portfolio[/{userId}]  files.js:489 / :526
 *              POST   /api/files/portfolio             files.js:362
 *              DELETE /api/files/{id}                  files.js:853
 *   Gigs       GET    /api/gigs?user_id=…&limit=20     gigs.js:2089
 *   Reviews    GET    /api/reviews/user/{userId}       reviews.js:149
 *
 * iOS counterpart: `Features/Profile/Tabs/ProfileTabsViewModels.swift`.
 */

// region Portfolio

/**
 * Display bucket for a portfolio item, derived from the row's
 * `file_type`. Mirrors iOS `PortfolioItemKind`.
 */
enum class PortfolioItemKind(
    val slug: String,
    val label: String,
    val icon: PantopusIcon,
) {
    Photo("photo", "Photo", PantopusIcon.Camera),
    Video("video", "Video", PantopusIcon.Video),
    Article("article", "Article", PantopusIcon.FileText),
    Certificate("certificate", "Certificate", PantopusIcon.Ribbon),
    Other("other", "Other", PantopusIcon.MoreHorizontal),
    ;

    companion object {
        fun fromFileType(fileType: String?): PortfolioItemKind =
            when (fileType.orEmpty()) {
                "portfolio_image" -> Photo
                "portfolio_video" -> Video
                "portfolio_document", "resume" -> Article
                "certification" -> Certificate
                else -> Other
            }
    }
}

/** One projected portfolio card. */
data class PortfolioItem(
    val id: String,
    val title: String,
    val subtitle: String?,
    /** Grid thumbnail — the medium resize when the server made one. */
    val imageUrl: String?,
    /** Full-size asset opened by the viewer; falls back to [imageUrl]. */
    val fullUrl: String?,
    val kind: PortfolioItemKind,
)

/** A file the picker handed back, ready to upload. */
data class PickedPortfolioFile(
    val filename: String,
    val mimeType: String,
    val bytes: ByteArray,
) {
    override fun equals(other: Any?): Boolean =
        this === other ||
            (
                other is PickedPortfolioFile &&
                    filename == other.filename &&
                    mimeType == other.mimeType &&
                    bytes.contentEquals(other.bytes)
            )

    override fun hashCode(): Int = (filename.hashCode() * 31 + mimeType.hashCode()) * 31 + bytes.contentHashCode()
}

/** Four render states for the Portfolio tab. */
sealed interface ProfilePortfolioUiState {
    data object Loading : ProfilePortfolioUiState

    data object Empty : ProfilePortfolioUiState

    data class Loaded(val items: List<PortfolioItem>) : ProfilePortfolioUiState

    data class Error(val message: String) : ProfilePortfolioUiState
}

/** Loads — and, on your own profile, mutates — the portfolio grid. */
@HiltViewModel
class ProfilePortfolioViewModel
    @Inject
    constructor(
        private val repo: ProfileTabsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ProfilePortfolioUiState>(ProfilePortfolioUiState.Loading)
        val state: StateFlow<ProfilePortfolioUiState> = _state.asStateFlow()

        /** `null` = "All". Drives the media-type filter chips. */
        private val _activeFilter = MutableStateFlow<PortfolioItemKind?>(null)
        val activeFilter: StateFlow<PortfolioItemKind?> = _activeFilter.asStateFlow()

        /** True while a delete or upload is in flight. */
        private val _isMutating = MutableStateFlow(false)
        val isMutating: StateFlow<Boolean> = _isMutating.asStateFlow()

        /** Item queued for the destructive confirm. */
        private val _pendingDelete = MutableStateFlow<PortfolioItem?>(null)
        val pendingDelete: StateFlow<PortfolioItem?> = _pendingDelete.asStateFlow()

        /** Item opened in the full-screen viewer. */
        private val _viewerItem = MutableStateFlow<PortfolioItem?>(null)
        val viewerItem: StateFlow<PortfolioItem?> = _viewerItem.asStateFlow()

        private val _showAddSheet = MutableStateFlow(false)
        val showAddSheet: StateFlow<Boolean> = _showAddSheet.asStateFlow()

        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private var userId: String? = null
        private var isOwnProfile: Boolean = false
        private var allItems: List<PortfolioItem> = emptyList()
        private var loadedOnce = false

        /** Your own portfolio unlocks the add bar and the delete affordance. */
        val canEdit: Boolean get() = isOwnProfile

        fun load(
            userId: String,
            isOwnProfile: Boolean,
        ) {
            if (this.userId == userId && this.isOwnProfile == isOwnProfile && loadedOnce) return
            this.userId = userId
            this.isOwnProfile = isOwnProfile
            reload()
        }

        fun refresh() = reload()

        fun setFilter(kind: PortfolioItemKind?) {
            _activeFilter.value = kind
        }

        fun setShowAddSheet(show: Boolean) {
            _showAddSheet.value = show
        }

        fun openViewer(item: PortfolioItem?) {
            _viewerItem.value = item
        }

        fun requestDelete(item: PortfolioItem?) {
            _pendingDelete.value = item
        }

        fun dismissToast() {
            _toastMessage.value = null
        }

        /** Visible items after the media-type filter. */
        fun filteredItems(): List<PortfolioItem> {
            val filter = _activeFilter.value ?: return allItems
            return allItems.filter { it.kind == filter }
        }

        /**
         * Filter chips worth showing — the strip only renders when more
         * than one media type is present.
         */
        fun availableFilters(): List<PortfolioItemKind> = PortfolioItemKind.entries.filter { kind -> allItems.any { it.kind == kind } }

        fun countOf(kind: PortfolioItemKind): Int = allItems.count { it.kind == kind }

        /**
         * `DELETE /api/files/{id}` behind the confirm. Awaited, not
         * optimistic — a 403 must leave the grid untouched.
         */
        fun confirmDelete() {
            val item = _pendingDelete.value ?: return
            if (_isMutating.value) return
            _pendingDelete.value = null
            _isMutating.value = true
            viewModelScope.launch {
                when (val result = repo.deleteFile(item.id)) {
                    is NetworkResult.Success -> {
                        _toastMessage.value = "Portfolio item deleted"
                        _isMutating.value = false
                        reload()
                    }
                    is NetworkResult.Failure -> {
                        _toastMessage.value = result.error.displayMessage("Couldn't delete that item.")
                        _isMutating.value = false
                    }
                }
            }
        }

        /**
         * `POST /api/files/portfolio`. A null [file] means the picker
         * handed back something we couldn't read — a real error, not a
         * silent no-op.
         */
        fun upload(
            file: PickedPortfolioFile?,
            title: String,
            description: String,
            category: PortfolioItemKind,
        ) {
            val trimmedTitle = title.trim()
            if (trimmedTitle.isEmpty()) {
                _toastMessage.value = "Please enter a title for your portfolio item."
                return
            }
            if (file == null || file.bytes.isEmpty()) {
                _toastMessage.value = "Couldn't read that file. Pick it again."
                return
            }
            if (_isMutating.value) return
            _isMutating.value = true
            viewModelScope.launch {
                val result =
                    repo.uploadPortfolioItem(
                        filename = file.filename,
                        mimeType = file.mimeType,
                        bytes = file.bytes,
                        title = trimmedTitle,
                        description = description.trim(),
                        category = category.slug,
                    )
                when (result) {
                    is NetworkResult.Success -> {
                        _showAddSheet.value = false
                        _toastMessage.value = "Portfolio item added"
                        _isMutating.value = false
                        reload()
                    }
                    is NetworkResult.Failure -> {
                        _toastMessage.value = result.error.displayMessage("Could not upload portfolio item.")
                        _isMutating.value = false
                    }
                }
            }
        }

        private fun reload() {
            val uid = userId ?: return
            if (!loadedOnce) _state.value = ProfilePortfolioUiState.Loading
            viewModelScope.launch {
                when (val result = repo.portfolio(uid, isOwnProfile)) {
                    is NetworkResult.Success -> {
                        loadedOnce = true
                        allItems = result.data.files.map(::project)
                        _state.value =
                            if (allItems.isEmpty()) {
                                ProfilePortfolioUiState.Empty
                            } else {
                                ProfilePortfolioUiState.Loaded(allItems)
                            }
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedOnce) {
                            _state.value = ProfilePortfolioUiState.Error(friendlyMessage(result.error))
                        }
                    }
                }
            }
        }

        companion object {
            /**
             * Pure projection — metadata title wins, then the original
             * filename; the medium thumbnail drives the grid and the raw
             * file URL drives the viewer.
             */
            fun project(file: PortfolioFileDto): PortfolioItem {
                val meta = file.metadata
                val thumbs = meta?.thumbnails.orEmpty()
                val thumb = thumbs["medium"] ?: thumbs["small"] ?: thumbs["large"] ?: file.fileUrl
                val title =
                    meta?.title?.takeIf { it.isNotBlank() }
                        ?: file.originalFilename?.takeIf { it.isNotBlank() }
                        ?: file.filename?.takeIf { it.isNotBlank() }
                        ?: "Untitled"
                return PortfolioItem(
                    id = file.id,
                    title = title,
                    subtitle = meta?.description?.takeIf { it.isNotBlank() },
                    imageUrl = thumb,
                    fullUrl = file.fileUrl ?: thumb,
                    kind = PortfolioItemKind.fromFileType(file.fileType),
                )
            }

            fun friendlyMessage(error: NetworkError): String =
                when (error) {
                    NetworkError.NotFound -> "We couldn't find that portfolio."
                    NetworkError.Forbidden -> "This portfolio is private."
                    else -> error.displayMessage("Something went wrong. Try again.")
                }
        }
    }

// endregion

// region Gigs

/** One gig row on the profile's Gigs tab. */
data class ProfileGigRow(
    val id: String,
    val title: String,
    val summary: String?,
    val price: String,
    val category: String?,
    val status: String,
) {
    /** Only `open` gets the green badge. */
    val isOpen: Boolean get() = status.equals("open", ignoreCase = true)
}

/** Four render states for the Gigs tab. */
sealed interface ProfileGigsUiState {
    data object Loading : ProfileGigsUiState

    data object Empty : ProfileGigsUiState

    data class Loaded(val rows: List<ProfileGigRow>) : ProfileGigsUiState

    data class Error(val message: String) : ProfileGigsUiState
}

/** Loads the gigs a profile owner has posted. */
@HiltViewModel
class ProfileGigsViewModel
    @Inject
    constructor(
        private val repo: GigsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ProfileGigsUiState>(ProfileGigsUiState.Loading)
        val state: StateFlow<ProfileGigsUiState> = _state.asStateFlow()

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
            if (!loadedOnce) _state.value = ProfileGigsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.userGigs(uid, PAGE_LIMIT)) {
                    is NetworkResult.Success -> {
                        loadedOnce = true
                        val rows = result.data.gigs.map(::project)
                        _state.value =
                            if (rows.isEmpty()) ProfileGigsUiState.Empty else ProfileGigsUiState.Loaded(rows)
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedOnce) {
                            _state.value =
                                ProfileGigsUiState.Error(
                                    ProfilePortfolioViewModel.friendlyMessage(result.error),
                                )
                        }
                    }
                }
            }
        }

        companion object {
            const val PAGE_LIMIT = 20

            fun project(gig: GigDto): ProfileGigRow =
                ProfileGigRow(
                    id = gig.id,
                    title = gig.title,
                    summary = gig.description?.takeIf { it.isNotBlank() },
                    price = formatPrice(gig.price),
                    category = gig.category?.takeIf { it.isNotBlank() },
                    status = gig.status?.takeIf { it.isNotBlank() } ?: "unknown",
                )

            /**
             * The list DTO carries only `price`, so a missing price
             * renders `$0` rather than inventing a range.
             */
            fun formatPrice(price: Double?): String {
                val value = price ?: 0.0
                return if (value.isFinite() && value == floor(value)) {
                    "$${value.toLong()}"
                } else {
                    String.format(Locale.US, "$%.2f", value)
                }
            }
        }
    }

// endregion

// region Gig reviews

/**
 * Role filter over reviews received, backed by the server's
 * `received_as` discriminator.
 */
enum class ProfileReviewFilter(
    val slug: String,
    val label: String,
) {
    All("all", "All"),
    Worker("worker", "As Worker"),
    Poster("poster", "As Poster"),
}

/** One projected gig review. */
data class ProfileGigReview(
    val id: String,
    val reviewerId: String?,
    val reviewerName: String,
    val reviewerHandle: String?,
    val reviewerAvatarUrl: String?,
    val rating: Int,
    val comment: String?,
    val mediaUrls: List<String>,
    val dateLabel: String?,
    /** "Review as worker" / "Review as gig poster". `null` for unknown. */
    val roleLabel: String?,
    val receivedAs: ProfileReviewFilter?,
)

/** Server-computed summary header (average · totals · per-star bars). */
data class ProfileReviewSummary(
    val average: Double,
    val total: Int,
    val workerCount: Int,
    val posterCount: Int,
    /** Star → count over the page we loaded. */
    val distribution: Map<Int, Int>,
)

/** Four render states for the Reviews tab. */
sealed interface ProfileGigReviewsUiState {
    data object Loading : ProfileGigReviewsUiState

    data object Empty : ProfileGigReviewsUiState

    data class Loaded(
        val summary: ProfileReviewSummary,
        val reviews: List<ProfileGigReview>,
    ) : ProfileGigReviewsUiState

    data class Error(val message: String) : ProfileGigReviewsUiState
}

/** Loads gig reviews received by a profile. */
@HiltViewModel
class ProfileGigReviewsViewModel
    @Inject
    constructor(
        private val repo: ProfileTabsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ProfileGigReviewsUiState>(ProfileGigReviewsUiState.Loading)
        val state: StateFlow<ProfileGigReviewsUiState> = _state.asStateFlow()

        private val _activeFilter = MutableStateFlow(ProfileReviewFilter.All)
        val activeFilter: StateFlow<ProfileReviewFilter> = _activeFilter.asStateFlow()

        /** Media opened in the full-screen viewer. */
        private val _viewerUrl = MutableStateFlow<String?>(null)
        val viewerUrl: StateFlow<String?> = _viewerUrl.asStateFlow()

        /** Server `total`, not the page size — drives the tab count badge. */
        private val _totalCount = MutableStateFlow(0)
        val totalCount: StateFlow<Int> = _totalCount.asStateFlow()

        private var userId: String? = null
        private var allReviews: List<ProfileGigReview> = emptyList()
        private var loadedOnce = false

        fun load(userId: String) {
            if (this.userId == userId && loadedOnce) return
            this.userId = userId
            reload()
        }

        fun refresh() = reload()

        fun setFilter(filter: ProfileReviewFilter) {
            _activeFilter.value = filter
        }

        fun openViewer(url: String?) {
            _viewerUrl.value = url
        }

        fun filteredReviews(): List<ProfileGigReview> {
            val filter = _activeFilter.value
            if (filter == ProfileReviewFilter.All) return allReviews
            return allReviews.filter { it.receivedAs == filter }
        }

        private fun reload() {
            val uid = userId ?: return
            if (!loadedOnce) _state.value = ProfileGigReviewsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.userGigReviews(uid, ProfileTabsRepository.REVIEW_PAGE_LIMIT)) {
                    is NetworkResult.Success -> {
                        loadedOnce = true
                        allReviews = result.data.reviews.map(::project)
                        val summary = summarize(result.data, allReviews)
                        _totalCount.value = summary.total
                        _state.value =
                            if (allReviews.isEmpty() && summary.total == 0) {
                                ProfileGigReviewsUiState.Empty
                            } else {
                                ProfileGigReviewsUiState.Loaded(summary, allReviews)
                            }
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedOnce) {
                            _state.value =
                                ProfileGigReviewsUiState.Error(
                                    ProfilePortfolioViewModel.friendlyMessage(result.error),
                                )
                        }
                    }
                }
            }
        }

        companion object {
            fun summarize(
                response: GigReviewsResponse,
                reviews: List<ProfileGigReview>,
            ): ProfileReviewSummary =
                ProfileReviewSummary(
                    average = response.averageRating ?: 0.0,
                    total = response.total ?: reviews.size,
                    workerCount = response.counts?.worker ?: 0,
                    posterCount = response.counts?.poster ?: 0,
                    distribution = distribution(reviews),
                )

            fun distribution(reviews: List<ProfileGigReview>): Map<Int, Int> =
                (1..5).associateWith { star -> reviews.count { it.rating == star } }

            fun project(review: GigReviewDto): ProfileGigReview {
                val received =
                    when (review.receivedAs.orEmpty()) {
                        "worker" -> ProfileReviewFilter.Worker
                        "poster" -> ProfileReviewFilter.Poster
                        else -> null
                    }
                val roleLabel =
                    when (received) {
                        ProfileReviewFilter.Worker -> "Review as worker"
                        ProfileReviewFilter.Poster -> "Review as gig poster"
                        else -> null
                    }
                val name =
                    review.reviewer?.name?.takeIf { it.isNotBlank() }
                        ?: review.reviewerName?.takeIf { it.isNotBlank() }
                        ?: review.reviewer?.firstName?.takeIf { it.isNotBlank() }
                        ?: review.reviewer?.username?.takeIf { it.isNotBlank() }
                        ?: "Anonymous"
                return ProfileGigReview(
                    id = review.id,
                    reviewerId = review.reviewer?.id ?: review.reviewerId,
                    reviewerName = name,
                    reviewerHandle = review.reviewer?.username ?: review.reviewerUsername,
                    reviewerAvatarUrl = review.reviewer?.profilePictureUrl ?: review.reviewerAvatar,
                    rating = review.rating.coerceIn(0, 5),
                    comment = review.comment?.takeIf { it.isNotBlank() },
                    mediaUrls = review.mediaUrls.orEmpty().filter { it.isNotBlank() },
                    dateLabel = dateLabel(review.createdAt),
                    roleLabel = roleLabel,
                    receivedAs = received,
                )
            }

            /** Long-form date, matching the web tab's `toLocaleDateString`. */
            fun dateLabel(raw: String?): String? {
                if (raw.isNullOrBlank()) return null
                val instant = runCatching { Instant.parse(raw) }.getOrNull() ?: return null
                return runCatching {
                    DateTimeFormatter
                        .ofPattern("MMMM d, yyyy", Locale.US)
                        .withZone(ZoneId.systemDefault())
                        .format(instant)
                }.getOrNull()
            }
        }
    }

// endregion
