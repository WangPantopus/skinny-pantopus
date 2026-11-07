@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "ReturnCount")

package app.pantopus.android.ui.screens.businesses.owner_dashboard

import android.content.SharedPreferences
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemsResponse
import app.pantopus.android.data.api.models.businesses.BusinessDashboardResponse
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessInsightsResponse
import app.pantopus.android.data.api.models.businesses.BusinessOnboardingDto
import app.pantopus.android.data.api.models.businesses.BusinessOwnerReviewDto
import app.pantopus.android.data.api.models.businesses.BusinessPermission
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.businessfounding.FoundingOfferStatusDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.businessfounding.BusinessFoundingRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.screens.business_profile.BusinessProfileContent
import app.pantopus.android.ui.screens.business_profile.BusinessProfileMapper
import app.pantopus.android.ui.screens.businesses.MyBusinessesViewModel
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject
import kotlin.math.roundToInt

/** Nav-arg key for the owned business UUID (matches `ChildRoutes.BUSINESS_OWNER`). */
const val BUSINESS_OWNER_BUSINESS_ID_KEY = "businessId"

/**
 * A10.7 / P1-C — view-model for the single-business owner dashboard. The
 * owner data is now live:
 *   · the shared public render ([BusinessOwnerContent.publicProfile]) is built
 *     by [BusinessProfileMapper] — the exact A10.6 projection;
 *   · live status + edit recency + the profile-strength checklist come from
 *     `GET /:businessId/dashboard`;
 *   · the "This week" tiles come from `GET /:businessId/insights`;
 *   · the reply composer reads `GET /:businessId/reviews` and commits via
 *     `POST /:businessId/reviews/:reviewId/respond` (optimistic + rollback).
 *
 * [BusinessOwnerSampleData] is retained as the preview / snapshot seam —
 * call [seedForPreview] to skip the network. Mirrors iOS
 * `BusinessOwnerViewModel.swift`.
 */
@HiltViewModel
class BusinessOwnerViewModel
    @Inject
    constructor(
        private val businesses: BusinessesRepository,
        private val profiles: ProfileRepository,
        private val founding: BusinessFoundingRepository,
        private val prefs: SharedPreferences,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String =
            requireNotNull(savedStateHandle[BUSINESS_OWNER_BUSINESS_ID_KEY]) {
                "BusinessOwnerViewModel requires a '$BUSINESS_OWNER_BUSINESS_ID_KEY' nav arg."
            }

        /**
         * Per-business dismissal flag for the founding banner. Mirrors RN's
         * `AsyncStorage` key `pantopus_founding_dismissed_<businessId>`
         * (`src/app/businesses/[id]/index.tsx:109`).
         */
        private val foundingDismissedKey = "business.foundingBanner.dismissed.$businessId"

        private val _state = MutableStateFlow<BusinessOwnerUiState>(BusinessOwnerUiState.Loading)
        val state: StateFlow<BusinessOwnerUiState> = _state.asStateFlow()

        /**
         * Transient confirmation / error copy for the founding-offer claim.
         * RN raises an `Alert`; native surfaces the same strings in a toast.
         */
        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var loadJob: Job? = null
        private var generation = 0
        private var active = true

        fun consumeToast() {
            _toast.value = null
        }

        fun load() {
            if (_state.value is BusinessOwnerUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            active = true
            val request = ++generation
            loadJob?.cancel()
            _state.value = BusinessOwnerUiState.Loading
            loadJob = viewModelScope.launch { fetch(request) }
        }

        fun pause() {
            active = false
            generation++
            loadJob?.cancel()
            _state.value = BusinessOwnerUiState.Loading
            _toast.value = null
        }

        /** Test / preview hook: seed the loaded state directly. */
        fun seedForPreview(content: BusinessOwnerContent) {
            _state.value = BusinessOwnerUiState.Loaded(content)
        }

        /**
         * Commit a review reply: optimistic local update, then `POST …/respond`.
         * On failure the optimistic change is rolled back and a toast says why;
         * the composer keeps the draft for another try.
         */
        fun submitReply(
            reviewId: String,
            text: String,
        ) {
            val current = _state.value as? BusinessOwnerUiState.Loaded ?: return
            if (!current.content.allows(BusinessPermission.REVIEWS_RESPOND)) return
            val trimmed = text.trim()
            if (trimmed.isEmpty()) return
            _toast.value = null

            // Optimistic update.
            _state.value = BusinessOwnerUiState.Loaded(current.content.applyingReply(trimmed, reviewId))
            val request = generation

            viewModelScope.launch {
                val result = businesses.respondToReview(businessId, reviewId, trimmed)
                if (result is NetworkResult.Success && active && !isCurrent(request)) refresh()
                if (result is NetworkResult.Failure && active) {
                    // A newer read already shows the server's reviews, so only the current one is rolled back.
                    updateContent(request) { latest ->
                        val original = current.content.reviews.firstOrNull { it.id == reviewId }
                        val restored = latest.reviews.map { if (it.id == reviewId) original ?: it else it }
                        val pending = restored.count { it.reply == null }
                        latest.copy(reviews = restored, reviewsToReplyLabel = if (pending > 0) "$pending to reply" else null)
                    }
                    // Say so, rather than letting the reply silently vanish (as on iOS).
                    _toast.value = "Your reply wasn't posted. ${result.error.message.ifBlank { "Please try again." }}"
                }
            }
        }

        // MARK: - Founding offer

        /**
         * Dismiss the founding banner for this business — persisted so it
         * stays hidden across launches (RN writes the same per-business flag
         * to `AsyncStorage`).
         */
        fun dismissFoundingBanner() {
            prefs.edit().putBoolean(foundingDismissedKey, true).apply()
            val current = _state.value as? BusinessOwnerUiState.Loaded ?: return
            _state.value = BusinessOwnerUiState.Loaded(current.content.copy(foundingOffer = null))
        }

        /**
         * Claim a numbered founding slot. On success RN alerts
         * "You claimed founding slot #N!", hides the banner, and refreshes
         * the dashboard so the founding badge appears.
         */
        fun claimFoundingOffer() {
            val current = _state.value as? BusinessOwnerUiState.Loaded ?: return
            if (!current.content.access.isOwner) return
            val offer = current.content.foundingOffer ?: return
            if (offer.isClaiming) return
            _toast.value = null
            val request = generation
            _state.value =
                BusinessOwnerUiState.Loaded(
                    current.content.copy(foundingOffer = offer.copy(isClaiming = true)),
                )
            viewModelScope.launch {
                when (val result = founding.claim(businessId)) {
                    is NetworkResult.Success -> {
                        prefs.edit().putBoolean(foundingDismissedKey, true).apply()
                        if (!isCurrent(request)) {
                            if (active) refresh()
                            return@launch
                        }
                        val number = result.data.slotNumber
                        _toast.value =
                            if (number != null) {
                                "You claimed founding slot #$number!"
                            } else {
                                result.data.message ?: "You claimed a founding slot!"
                            }
                        // The banner is gone for good once claimed — persist
                        // so a refresh race can't bring it back.
                        refresh()
                    }
                    is NetworkResult.Failure -> {
                        if (!isCurrent(request)) return@launch
                        _toast.value =
                            result.error.message.ifBlank { "Failed to claim founding offer" }
                        val latest = _state.value as? BusinessOwnerUiState.Loaded ?: return@launch
                        _state.value =
                            BusinessOwnerUiState.Loaded(
                                latest.content.copy(foundingOffer = offer.copy(isClaiming = false)),
                            )
                    }
                }
            }
        }

        /**
         * `GET /founding-offer/status`, gated on the dismissal flag. Returns
         * `null` (no banner) when dismissed, when the offer is over, or when
         * this business already holds a slot — RN's exact three-way gate.
         */
        private suspend fun loadFoundingOffer(): OwnerFoundingOffer? {
            if (prefs.getBoolean(foundingDismissedKey, false)) return null
            val status = (founding.status() as? NetworkResult.Success)?.data ?: return null
            return foundingOfferFrom(status, businessId)
        }

        // MARK: - Fetch

        private suspend fun fetch(request: Int) =
            coroutineScope {
                // The current dashboard authority and business detail are independent reads.
                val dashboardRead = async { businesses.dashboard(businessId) }
                val detail = businesses.business(businessId)
                if (detail is NetworkResult.Failure) {
                    publish(request, mapDetailFailure(detail.error))
                    return@coroutineScope
                }
                val payload = (detail as NetworkResult.Success).data
                val publicRead =
                    async {
                        payload.business.username
                            ?.takeIf { it.isNotEmpty() }
                            ?.let { (businesses.publicBusiness(it) as? NetworkResult.Success)?.data }
                    }
                val dash = dashboardRead.await()
                if (dash is NetworkResult.Failure) {
                    publish(request, mapDashboardFailure(dash.error))
                    return@coroutineScope
                }
                val dashboard = (dash as NetworkResult.Success).data
                val access = dashboard.access ?: BusinessAccessDto()
                val publicData = publicRead.await()
                val renderData =
                    publicData ?: when (val result = ownerProfileData(payload, access)) {
                        is NetworkResult.Success -> result.data
                        is NetworkResult.Failure -> {
                            publish(request, mapDetailFailure(result.error))
                            return@coroutineScope
                        }
                    }
                if (!isCurrent(request)) return@coroutineScope
                val profile = BusinessProfileMapper.build(payload, renderData, null).copy(hasPublicPage = publicData != null)
                publish(request, BusinessOwnerUiState.Loaded(buildContent(profile, dashboard, null, emptyList())))
                loadOverlays(request, payload, renderData, publicData != null, access)
            }

        /** Optional sections must not hold the business page behind their network latency. */
        private suspend fun loadOverlays(
            request: Int,
            detail: BusinessDetailResponse,
            renderData: BusinessPublicResponse,
            hasPublicPage: Boolean,
            access: BusinessAccessDto,
        ) = coroutineScope {
            launch {
                val reviews = (profiles.publicProfile(businessId) as? NetworkResult.Success)?.data ?: return@launch
                updateContent(request) {
                    it.copy(publicProfile = BusinessProfileMapper.build(detail, renderData, reviews).copy(hasPublicPage = hasPublicPage))
                }
            }
            if (access.allows(BusinessPermission.INSIGHTS_VIEW)) {
                launch {
                    val insights = (businesses.insights(businessId) as? NetworkResult.Success)?.data ?: return@launch
                    updateContent(request) { it.copy(insights = insightTiles(insights)) }
                }
            }
            if (access.allows(BusinessPermission.REVIEWS_VIEW)) {
                launch {
                    val reviews = (businesses.reviews(businessId) as? NetworkResult.Success)?.data?.reviews ?: return@launch
                    val mapped = reviews.map(::ownerReview)
                    val pending = mapped.count { it.reply == null }
                    updateContent(request) {
                        it.copy(reviews = mapped, reviewsToReplyLabel = if (pending > 0) "$pending to reply" else null)
                    }
                }
            }
            // Only the owner can claim a founding slot (the claim route refuses everyone else), as on iOS and web.
            if (access.isOwner) {
                launch {
                    val offer = loadFoundingOffer()
                    updateContent(request) { it.copy(foundingOffer = offer) }
                }
            }
        }

        private fun isCurrent(request: Int): Boolean = active && request == generation

        private fun publish(
            request: Int,
            state: BusinessOwnerUiState,
        ) {
            if (isCurrent(request)) _state.value = state
        }

        private fun updateContent(
            request: Int,
            update: (BusinessOwnerContent) -> BusinessOwnerContent,
        ) {
            if (!isCurrent(request)) return
            val current = _state.value as? BusinessOwnerUiState.Loaded ?: return
            _state.value = BusinessOwnerUiState.Loaded(update(current.content))
        }

        /** Drafts have no public projection, but their saved hours and services still exist. */
        private suspend fun ownerProfileData(
            payload: BusinessDetailResponse,
            access: BusinessAccessDto,
        ): NetworkResult<BusinessPublicResponse> =
            coroutineScope {
                val location =
                    payload.profile?.primaryLocation
                        ?: payload.locations.firstOrNull { it.isPrimary == true }
                        ?: payload.locations.firstOrNull()
                val hoursRead =
                    async {
                        // A section this person can't read is left empty; its refusal must not close the whole page.
                        if (location == null || !access.allows(BusinessPermission.HOURS_VIEW)) {
                            NetworkResult.Success(emptyList())
                        } else {
                            when (val result = businesses.locationHours(businessId, location.id)) {
                                is NetworkResult.Success -> NetworkResult.Success(result.data.hours)
                                is NetworkResult.Failure -> result
                            }
                        }
                    }
                val catalogRead =
                    async {
                        if (access.allows(BusinessPermission.CATALOG_VIEW)) {
                            businesses.catalogItems(businessId)
                        } else {
                            NetworkResult.Success(BusinessCatalogItemsResponse())
                        }
                    }
                val hours =
                    when (val result = hoursRead.await()) {
                        is NetworkResult.Success -> result.data
                        is NetworkResult.Failure -> return@coroutineScope result
                    }
                when (val result = catalogRead.await()) {
                    is NetworkResult.Success -> NetworkResult.Success(BusinessPublicResponse(hours = hours, catalog = result.data.items))
                    is NetworkResult.Failure -> result
                }
            }

        private fun mapDetailFailure(error: NetworkError): BusinessOwnerUiState =
            when (error) {
                NetworkError.NotFound -> BusinessOwnerUiState.NotFound
                else -> BusinessOwnerUiState.Error("Couldn't load your business")
            }

        private fun mapDashboardFailure(error: NetworkError): BusinessOwnerUiState =
            when (error) {
                NetworkError.Forbidden -> BusinessOwnerUiState.Error("You don't have access to this business.", refused = true)
                NetworkError.NotFound -> BusinessOwnerUiState.NotFound
                else -> BusinessOwnerUiState.Error("Couldn't load your business")
            }

        // MARK: - Projection (pure; testable)

        /** Compose the owner content from the public render + owner fetches. */
        fun buildContent(
            publicProfile: BusinessProfileContent,
            dashboard: BusinessDashboardResponse,
            insights: BusinessInsightsResponse?,
            reviews: List<BusinessOwnerReviewDto>,
            foundingOffer: OwnerFoundingOffer? = null,
        ): BusinessOwnerContent {
            val access = dashboard.access ?: BusinessAccessDto()
            val isLive = dashboard.profile?.isPublished == true
            val mappedReviews = reviews.map { ownerReview(it) }
            val pending = mappedReviews.count { it.reply == null }
            return BusinessOwnerContent(
                businessId = businessId,
                isLive = isLive,
                editedMeta = editedMeta(dashboard.profile?.updatedAt, isLive),
                insights = insightTiles(insights),
                profileStrength = profileStrength(dashboard.onboarding, access),
                reviewsToReplyLabel = if (pending > 0) "$pending to reply" else null,
                reviews = mappedReviews,
                publicProfile = publicProfile,
                canPostAsBusiness = access.allows(BusinessPermission.PROFILE_EDIT),
                foundingOffer = foundingOffer,
                isVerified = MyBusinessesViewModel.isVerified(dashboard.profile?.identityVerificationTier),
                access = access,
            )
        }

        private fun insightTiles(insights: BusinessInsightsResponse?): List<OwnerInsightTile> {
            if (insights == null) return emptyList()
            return listOf(
                OwnerInsightTile(
                    id = "views",
                    icon = PantopusIcon.Eye,
                    value = formatCount(insights.views.total),
                    label = "Views",
                    delta = trendLabel(insights.views.trend),
                ),
                OwnerInsightTile(
                    id = "followers",
                    icon = PantopusIcon.Users,
                    value = formatCount(insights.followers.total),
                    label = "Followers",
                    delta = trendLabel(insights.followers.trend),
                ),
                OwnerInsightTile(
                    id = "reviews",
                    icon = PantopusIcon.Star,
                    value = formatCount(insights.reviews.count),
                    label = "Reviews",
                    delta = trendLabel(insights.reviews.trend),
                ),
            )
        }

        private fun profileStrength(
            onboarding: BusinessOnboardingDto?,
            access: BusinessAccessDto,
        ): OwnerProfileStrength {
            if (onboarding == null || onboarding.totalCount <= 0) {
                return OwnerProfileStrength(0, "Finish setting up your page", emptyList())
            }
            val percent = (onboarding.completedCount.toDouble() / onboarding.totalCount * 100).roundToInt()
            val remaining = (onboarding.totalCount - onboarding.completedCount).coerceAtLeast(0)
            val caption =
                when (remaining) {
                    0 -> "Your page is complete"
                    1 -> "One step from a complete page"
                    else -> "$remaining steps from a complete page"
                }
            val steps =
                onboarding.checklist.map {
                    val canAdd = !it.done && access.allows(stepPermission(it.key))
                    OwnerStrengthStep(it.key, it.label, it.done, ctaLabel = if (canAdd) "Add" else null)
                }
            return OwnerProfileStrength(percent, caption, steps)
        }

        /** The permission the editor needs before this checklist step's Add leads anywhere. */
        private fun stepPermission(step: String): String =
            when (step) {
                "location_added" -> BusinessPermission.LOCATIONS_EDIT
                "hours_set" -> BusinessPermission.HOURS_EDIT
                "catalog_item_added" -> BusinessPermission.CATALOG_EDIT
                else -> BusinessPermission.PROFILE_EDIT
            }

        private fun ownerReview(dto: BusinessOwnerReviewDto): OwnerReviewItem {
            val meta =
                listOfNotNull(relativeTimestamp(dto.createdAt), dto.gigTitle?.takeIf { it.isNotEmpty() })
                    .joinToString(" · ")
            return OwnerReviewItem(
                id = dto.id,
                reviewerName = dto.reviewerName?.takeIf { it.isNotEmpty() } ?: "Anonymous",
                reviewerAvatarUrl = dto.reviewerAvatar,
                meta = meta,
                rating = dto.rating,
                body = dto.comment.orEmpty(),
                reply = dto.ownerResponse?.takeIf { it.isNotEmpty() },
            )
        }

        // MARK: - Formatting

        private fun editedMeta(
            updatedAt: String?,
            isLive: Boolean,
        ): String {
            val relative = relativeTimestamp(updatedAt)
            return when {
                relative != null -> "Edited $relative"
                isLive -> "Live"
                else -> "Draft"
            }
        }

        /** `1234 → "1.2k"`, `84 → "84"`. */
        private fun formatCount(value: Int): String {
            if (value < 1_000) return value.toString()
            val truncated = value / 1_000.0
            return String.format(java.util.Locale.US, "%.1fk", truncated).replace(".0k", "k")
        }

        /** Only positive trends render a pill — the tile draws a fixed up-arrow. */
        private fun trendLabel(trend: Int): String? = if (trend > 0) "$trend%" else null

        private fun relativeTimestamp(iso: String?): String? {
            if (iso.isNullOrEmpty()) return null
            val instant =
                try {
                    Instant.parse(iso)
                } catch (_: Throwable) {
                    return null
                }
            val seconds = Duration.between(instant, Instant.now()).seconds
            return when {
                seconds < 60 -> "just now"
                seconds < 3_600 -> "${seconds / 60}m ago"
                seconds < 86_400 -> "${seconds / 3_600}h ago"
                seconds < 604_800 -> "${seconds / 86_400}d ago"
                else -> "${seconds / 604_800}w ago"
            }
        }

        companion object {
            /** Pure projection of the status payload (exposed for unit tests). */
            fun foundingOfferFrom(
                status: FoundingOfferStatusDto,
                businessId: String,
            ): OwnerFoundingOffer? {
                val alreadyClaimed =
                    status.userBusinesses.orEmpty().any { it.businessUserId == businessId }
                val remaining = status.slotsRemaining ?: 0
                if (status.isOfferActive != true || alreadyClaimed || remaining <= 0) return null
                return OwnerFoundingOffer(slotsRemaining = remaining)
            }
        }
    }
