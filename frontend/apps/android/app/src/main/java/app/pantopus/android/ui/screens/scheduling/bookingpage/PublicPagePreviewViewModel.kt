@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The public-page header projection the owner previews. */
data class PreviewHeader(
    val name: String,
    val headline: String,
    val blurb: String,
    val initials: String,
)

sealed interface PreviewUiState {
    data object Loading : PreviewUiState

    data class Rendered(val header: PreviewHeader, val eventTypes: List<PublicEventTypeView>) : PreviewUiState

    /** Calm notice — paused or not-yet-published (no red). */
    data class Notice(val title: String, val body: String) : PreviewUiState

    data class AllHidden(val header: PreviewHeader) : PreviewUiState

    data class Error(val message: String) : PreviewUiState
}

@HiltViewModel
class PublicPagePreviewViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        // Owner comes from the route's ownerKind/ownerId query args (survives
        // process death; Manage → Preview chaining keeps the owner); absent args
        // mean Personal.
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )

        /** The resolved pillar for UI accent — derived from owner at init time. */
        val pillar: SchedulingPillar = owner.pillar()

        private val _state = MutableStateFlow<PreviewUiState>(PreviewUiState.Loading)
        val state: StateFlow<PreviewUiState> = _state.asStateFlow()

        fun load() {
            _state.value = PreviewUiState.Loading
            viewModelScope.launch {
                val pageResult = repo.getBookingPage(owner)
                val page =
                    when (pageResult) {
                        is NetworkResult.Success -> pageResult.data.page
                        is NetworkResult.Failure -> {
                            _state.value = PreviewUiState.Error("We couldn't load your page.")
                            return@launch
                        }
                    }
                val slug = page.slug
                if (slug.isNullOrBlank() || !page.isLive) {
                    _state.value =
                        PreviewUiState.Notice(
                            title = "Your page is off",
                            body = "Publish it in Booking link, then people can book you.",
                        )
                    return@launch
                }
                when (val publicResult = repo.publicGetPage(slug)) {
                    is NetworkResult.Success -> {
                        val body = publicResult.data
                        val header =
                            PreviewHeader(
                                name = body.page?.title ?: page.title.orEmpty(),
                                headline = body.page?.tagline ?: page.tagline.orEmpty(),
                                blurb = body.page?.intro ?: page.intro.orEmpty(),
                                initials = initialsOf(body.page?.title ?: page.title.orEmpty()),
                            )
                        _state.value =
                            when {
                                body.status == STATUS_PAUSED || page.isPaused ->
                                    PreviewUiState.Notice("Your page is paused", "Turn it back on in Booking link to take bookings.")
                                body.eventTypes.isEmpty() -> PreviewUiState.AllHidden(header)
                                else -> PreviewUiState.Rendered(header, body.eventTypes)
                            }
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            when (errors.decode(publicResult.error, notFoundAs = SchedulingError.Paused)) {
                                is SchedulingError.Paused ->
                                    PreviewUiState.Notice(
                                        "Your page is paused",
                                        "Turn it back on in Booking link to take bookings.",
                                    )
                                else -> PreviewUiState.Error("We couldn't load your page.")
                            }
                    }
                }
            }
        }

        fun refresh() = load()

        private companion object {
            const val STATUS_PAUSED = "paused"
        }
    }
