@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.business_profile

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessHoursDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessPagesRepository
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.screens.businesses.page_blocks.BusinessPageBlock
import app.pantopus.android.ui.screens.contentdetail.GigOpenChatEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
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
    ) : ViewModel() {
        private val businessId: String =
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

        private val _showOverflow = MutableStateFlow(false)
        val showOverflow: StateFlow<Boolean> = _showOverflow.asStateFlow()

        private val _openChatEvents = MutableSharedFlow<GigOpenChatEvent>(extraBufferCapacity = 1)
        val openChatEvents: SharedFlow<GigOpenChatEvent> = _openChatEvents.asSharedFlow()

        private var isStartingInquiry = false

        fun load() {
            if (_state.value is BusinessProfileUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = BusinessProfileUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun dismissToast() {
            _toastMessage.value = null
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

        private suspend fun fetch() {
            when (val detail = businesses.business(businessId)) {
                is NetworkResult.Success -> {
                    val payload = detail.data
                    coroutineScope {
                        val publicDeferred =
                            async {
                                payload.business.username
                                    ?.takeIf { it.isNotEmpty() }
                                    ?.let { username ->
                                        (businesses.publicBusiness(username) as? NetworkResult.Success)?.data
                                    }
                            }
                        val reviewsDeferred =
                            async {
                                (profiles.publicProfile(businessId) as? NetworkResult.Success)?.data
                            }
                        val publicResponse = publicDeferred.await()
                        val reviewsResponse = reviewsDeferred.await()
                        _state.value =
                            BusinessProfileUiState.Loaded(
                                BusinessProfileMapper.build(payload, publicResponse, reviewsResponse),
                            )
                        loadNamedPage(payload.business.username)
                    }
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
