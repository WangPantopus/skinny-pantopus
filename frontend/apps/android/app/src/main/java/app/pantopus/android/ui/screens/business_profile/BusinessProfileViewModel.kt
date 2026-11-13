@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.business_profile

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessHoursDto
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessPagesRepository
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.screens.businesses.page_blocks.BusinessPageBlock
import app.pantopus.android.ui.screens.contentdetail.GigOpenChatEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.util.UUID
import javax.inject.Inject

/** Nav-arg key for the business UUID. */
const val BUSINESS_PROFILE_BUSINESS_ID_KEY = "businessId"

/** RN's copy when the named page can't be resolved at all. */
private const val PAGE_MISSING_MESSAGE = "This business page does not exist or is not published."

/** RN's copy when the page resolves but has no published blocks. */
private const val PAGE_EMPTY_MESSAGE = "This business page has no published content yet."

/**
 * C4 — optional nav-arg carrying the slug from `pantopus://b/:username/:slug`
 * (RN's `?pageSlug=`). Present only on the named-page route.
 */
const val BUSINESS_PROFILE_PAGE_SLUG_KEY = "pageSlug"

/**
 * C4 — state of the named custom page the deep link asked for. [None] when
 * the profile was opened without a slug.
 */
sealed interface BusinessProfileNamedPageState {
    data object None : BusinessProfileNamedPageState

    data class Loading(
        val title: String,
    ) : BusinessProfileNamedPageState

    data class Loaded(
        val title: String,
        val description: String?,
        val blocks: List<BusinessPageBlock>,
    ) : BusinessProfileNamedPageState

    data class Failed(
        val title: String,
        val message: String,
    ) : BusinessProfileNamedPageState
}

/** The reads the page itself waits for. Reviews arrive apart from them (see [BusinessReviewsRead]). */
private class BusinessProfilePage(
    val detail: BusinessDetailResponse,
    val publicResponse: BusinessPublicResponse?,
)

/** View-model for the single-scroll Business Profile screen (A10.6). The
 *  projection lives in [BusinessProfileMapper] so the owner dashboard can
 *  reuse it verbatim. */
@HiltViewModel
class BusinessProfileViewModel
    @Inject
    constructor(
        private val businesses: BusinessesRepository,
        private val profiles: ProfileRepository,
        private val businessPages: BusinessPagesRepository,
        savedStateHandle: SavedStateHandle,
        private val plans: PlansRepository,
    ) : ViewModel() {
        /**
         * The business id. A `/b/:username` link opens with the username, which
         * [loadDetail] resolves to the id.
         */
        private var businessId: String =
            requireNotNull(savedStateHandle[BUSINESS_PROFILE_BUSINESS_ID_KEY]) {
                "BusinessProfileViewModel requires a '$BUSINESS_PROFILE_BUSINESS_ID_KEY' nav arg."
            }

        /** C4 — slug from `pantopus://b/:username/:slug`, when present. */
        private val pageSlug: String? =
            savedStateHandle.get<String>(BUSINESS_PROFILE_PAGE_SLUG_KEY)?.takeIf { it.isNotBlank() }

        private val _namedPage =
            MutableStateFlow<BusinessProfileNamedPageState>(
                pageSlug?.let { BusinessProfileNamedPageState.Loading(it) }
                    ?: BusinessProfileNamedPageState.None,
            )
        val namedPage: StateFlow<BusinessProfileNamedPageState> = _namedPage.asStateFlow()

        private val _state = MutableStateFlow<BusinessProfileUiState>(BusinessProfileUiState.Loading)
        val state: StateFlow<BusinessProfileUiState> = _state.asStateFlow()

        private val _saveState = MutableStateFlow<BusinessProfileSaveState>(BusinessProfileSaveState.Idle)
        val saveState: StateFlow<BusinessProfileSaveState> = _saveState.asStateFlow()

        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private val _upcomingPlans = MutableStateFlow<List<PlanDto>>(emptyList())

        /**
         * The business's upcoming plans (Plans with businesses, B6), from their own read. Empty while it loads, when
         * there are none, on a failure and for anyone without the switch: the section then isn't drawn at all.
         */
        val upcomingPlans: StateFlow<List<PlanDto>> = _upcomingPlans.asStateFlow()

        private var plansJob: Job? = null

        private val _showOverflow = MutableStateFlow(false)
        val showOverflow: StateFlow<Boolean> = _showOverflow.asStateFlow()

        private val _openChatEvents = MutableSharedFlow<GigOpenChatEvent>(extraBufferCapacity = 1)
        val openChatEvents: SharedFlow<GigOpenChatEvent> = _openChatEvents.asSharedFlow()

        private var isStartingInquiry = false

        private var loadJob: Job? = null
        private var quietJob: Job? = null
        private var page: BusinessProfilePage? = null

        private var reviewsJob: Job? = null
        private var reviews: PublicProfileDto? = null
        private var reviewsFetchedAt = 0L
        private var reviewsRead: BusinessReviewsRead = BusinessReviewsRead.Loading

        /**
         * Entry and every return. Back on a loaded page, it stays as it is while its reads check for what changed
         * meanwhile: an edit saved in the page editor, a reply saved by the owner.
         */
        fun load() {
            if (_state.value is BusinessProfileUiState.Loaded) {
                refreshQuietly()
                return
            }
            refresh()
        }

        fun refresh() {
            loadJob?.cancel()
            quietJob?.cancel()
            page = null
            _state.value = BusinessProfileUiState.Loading
            loadJob = viewModelScope.launch { fetch() }
        }

        /** The Reviews section's retry; the rest of the page stays as it is. */
        fun retryReviews() = readReviews(force = true)

        fun dismissToast() {
            _toastMessage.value = null
        }

        fun showToast(message: String) {
            _toastMessage.value = message
        }

        fun setShowOverflow(show: Boolean) {
            _showOverflow.value = show
        }

        fun save() {
            if (_saveState.value is BusinessProfileSaveState.InFlight) return
            if (_saveState.value is BusinessProfileSaveState.Saved) return
            _saveState.value = BusinessProfileSaveState.InFlight
            viewModelScope.launch {
                when (val result = businesses.followBusiness(businessId)) {
                    is NetworkResult.Success -> {
                        _saveState.value = BusinessProfileSaveState.Saved
                        _toastMessage.value = if (result.data.following) "Saved" else "Updated"
                    }
                    is NetworkResult.Failure -> {
                        val message = friendlyMessage(result.error)
                        _saveState.value = BusinessProfileSaveState.Failed(message)
                        _toastMessage.value = message
                    }
                }
            }
        }

        /**
         * Contact dock — `POST /api/businesses/:id/inbox/start`, then emit a
         * one-shot chat open event. Mirrors RN/web `startBusinessInquiry`.
         */
        fun startInquiry() {
            val loaded = _state.value as? BusinessProfileUiState.Loaded ?: return
            if (isStartingInquiry) return
            isStartingInquiry = true
            val name = loaded.content.header.displayName
            val handle = loaded.content.header.handle
            val subject =
                if (!handle.isNullOrEmpty()) {
                    "Inquiry for @${handle.trimStart('@')}"
                } else {
                    "Inquiry for $name"
                }
            viewModelScope.launch {
                when (val result = businesses.startInquiry(businessId, subject)) {
                    is NetworkResult.Success -> {
                        _openChatEvents.emit(
                            GigOpenChatEvent(
                                roomId = result.data.roomId,
                                displayName = name,
                                initials = initialsFromName(name),
                                verified = loaded.content.header.isVerified,
                            ),
                        )
                    }
                    is NetworkResult.Failure -> {
                        _toastMessage.value = friendlyMessage(result.error)
                    }
                }
                isStartingInquiry = false
            }
        }

        /**
         * `/b/:username` links (a business's shared public page) carry the
         * username, but the detail read takes the id. When the id isn't found
         * and isn't a UUID, the read-only public page resolves the username; an
         * unknown or unpublished username stays not found.
         */
        private suspend fun loadDetail(): NetworkResult<BusinessDetailResponse> {
            val detail = businesses.business(businessId)
            val notFound = detail is NetworkResult.Failure && detail.error == NetworkError.NotFound
            if (!notFound || runCatching { UUID.fromString(businessId) }.isSuccess) return detail
            val resolvedId =
                (businesses.publicBusiness(businessId) as? NetworkResult.Success)
                    ?.data
                    ?.business
                    ?.id
                    ?.takeIf { it.isNotBlank() }
                    ?: return detail
            businessId = resolvedId
            return businesses.business(resolvedId)
        }

        private suspend fun fetch() {
            when (val detail = loadDetail()) {
                is NetworkResult.Success -> {
                    val payload = detail.data
                    readReviews()
                    readPlans()
                    val publicResponse =
                        payload.business.username
                            ?.takeIf { it.isNotEmpty() }
                            ?.let { username ->
                                (businesses.publicBusiness(username) as? NetworkResult.Success)?.data
                            }
                    page = BusinessProfilePage(payload, publicResponse)
                    publish()
                    loadNamedPage(payload.business.username)
                }
                is NetworkResult.Failure -> {
                    when (detail.error) {
                        NetworkError.NotFound -> _state.value = BusinessProfileUiState.NotFound
                        else -> _state.value = BusinessProfileUiState.Error(friendlyMessage(detail.error))
                    }
                }
            }
        }

        /**
         * The page's reads again, behind what it shows. A failed read leaves the page as it was; a business that's
         * gone shows as not found, as a first read would. The named page isn't read again: its read counts a view.
         */
        private fun refreshQuietly() {
            readReviews()
            readPlans()
            quietJob?.cancel()
            quietJob =
                viewModelScope.launch {
                    when (val detail = businesses.business(businessId)) {
                        is NetworkResult.Success -> {
                            val payload = detail.data
                            val previous = page?.publicResponse
                            val publicResponse =
                                payload.business.username
                                    ?.takeIf { it.isNotEmpty() }
                                    ?.let { username ->
                                        when (val result = businesses.publicBusiness(username)) {
                                            is NetworkResult.Success -> result.data
                                            // No public page any more (unpublished) shows as a first read would.
                                            is NetworkResult.Failure -> previous.takeUnless { result.error == NetworkError.NotFound }
                                        }
                                    }
                            page = BusinessProfilePage(payload, publicResponse)
                            publish()
                        }
                        is NetworkResult.Failure ->
                            if (detail.error == NetworkError.NotFound) {
                                page = null
                                _state.value = BusinessProfileUiState.NotFound
                            }
                    }
                }
        }

        /**
         * `GET /api/users/id/:id` through the store, on its own so a slow or failed read touches only the Reviews
         * section. A copy still fresh and unmarked answers without a request; a reply saved here marks it, so the next
         * read asks the server.
         */
        private fun readReviews(force: Boolean = false) {
            reviewsJob?.cancel()
            // What the section already shows stays during the read; only a section with no answer yet waits.
            val unanswered = reviews == null && reviewsRead != BusinessReviewsRead.Loaded
            reviewsRead = if (unanswered) BusinessReviewsRead.Loading else BusinessReviewsRead.Loaded
            publish()
            reviewsJob =
                viewModelScope.launch {
                    reviewsRead =
                        when (val result = profiles.publicProfile(businessId, force)) {
                            is NetworkResult.Success -> {
                                reviews = result.data
                                val copy = profiles.publicProfileCopy(businessId)
                                reviewsFetchedAt = copy.fetchedAt
                                if (copy.failure != null) BusinessReviewsRead.RefreshFailed(copy.fetchedAt) else BusinessReviewsRead.Loaded
                            }
                            is NetworkResult.Failure -> reviewsAfterFailure(result.error)
                        }
                    publish()
                }
        }

        /** B6: the business's upcoming plans; none (or a failed read) hides the section. */
        private fun readPlans() {
            plansJob?.cancel()
            val id = businessId
            plansJob =
                viewModelScope.launch {
                    val items = plans.businessPlans(id)
                    _upcomingPlans.value = items
                }
        }

        private fun reviewsAfterFailure(error: NetworkError): BusinessReviewsRead =
            when {
                // A retry can't change a refusal (a draft's own page, a private or blocked profile): nothing public to show.
                error == NetworkError.NotFound || error == NetworkError.Forbidden -> {
                    reviews = null
                    BusinessReviewsRead.Loaded
                }
                reviews != null -> BusinessReviewsRead.RefreshFailed(reviewsFetchedAt)
                else -> BusinessReviewsRead.Failed(friendlyMessage(error))
            }

        /** Shows the page with the reviews as they stand. Until the page's own reads answer, there is no page to show. */
        private fun publish() {
            val current = page ?: return
            _state.value =
                BusinessProfileUiState.Loaded(
                    BusinessProfileMapper
                        .build(current.detail, current.publicResponse, reviews)
                        .copy(reviewsRead = reviewsRead),
                )
        }

        /**
         * C4 — resolves `GET /api/b/:username/:slug` so the named custom page
         * opens with its published blocks. Mirrors RN
         * `src/app/business/[username].tsx`'s `fetchPublicPage`, including the
         * two failure copies.
         */
        private suspend fun loadNamedPage(username: String?) {
            val slug =
                pageSlug ?: run {
                    _namedPage.value = BusinessProfileNamedPageState.None
                    return
                }
            // `pantopus://b/:username/:slug` routes the *username* through as
            // the id, so it is the right fallback when the detail read has no
            // handle of its own.
            val handle = username?.takeIf { it.isNotBlank() } ?: businessId
            if (handle.isBlank()) {
                _namedPage.value =
                    BusinessProfileNamedPageState.Failed(slug, PAGE_MISSING_MESSAGE)
                return
            }
            _namedPage.value = BusinessProfileNamedPageState.Loading(slug)
            when (val result = businessPages.publicPage(handle, slug)) {
                is NetworkResult.Success -> {
                    val page = result.data.currentPage
                    _namedPage.value =
                        if (page == null) {
                            BusinessProfileNamedPageState.Failed(slug, PAGE_EMPTY_MESSAGE)
                        } else {
                            BusinessProfileNamedPageState.Loaded(
                                title = page.title ?: slug,
                                description = page.description,
                                blocks =
                                    page.blocks.orEmpty().mapIndexed { index, dto ->
                                        BusinessPageBlock.from(dto, index)
                                    },
                            )
                        }
                }
                is NetworkResult.Failure ->
                    _namedPage.value = BusinessProfileNamedPageState.Failed(slug, PAGE_MISSING_MESSAGE)
            }
        }

        /** Thin wrapper over [BusinessProfileMapper.computeOpenState] retained
         *  for the unit-test surface. */
        fun computeOpenState(
            rows: List<BusinessHoursDto>,
            now: LocalDateTime,
        ): BusinessOpenState? = BusinessProfileMapper.computeOpenState(rows, now)

        private fun friendlyMessage(error: NetworkError): String =
            when (error) {
                NetworkError.NotFound -> "We couldn't find this business."
                NetworkError.Forbidden -> "This business profile is private."
                is NetworkError.Transport -> "Check your connection and try again."
                else -> "Something went wrong. Try again."
            }

        private fun initialsFromName(name: String): String {
            val joined =
                name
                    .split(" ")
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.toString() }
                    .joinToString("")
                    .uppercase()
            return joined.ifEmpty { "··" }
        }
    }
