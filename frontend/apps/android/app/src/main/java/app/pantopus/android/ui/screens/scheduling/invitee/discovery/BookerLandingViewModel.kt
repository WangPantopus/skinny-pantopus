@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PublicBookingPageResponse
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTerminalState
import app.pantopus.android.ui.screens.scheduling._shared.toTerminalState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/**
 * C5 Booking landing / booker profile — the public page an invitee lands on at
 * `/book/:slug` (and the one-off `/book/o/:token` entry, which skips straight
 * to the picker). Loads `GET /api/public/book/:slug` (or the one-off view) with
 * **no auth header**, surfaces `status:'active'|'paused'` and the bookable
 * event types, and routes 404 (`unavailable`/`expired`) + 403 (`secret`) to the
 * shared terminal state. This stream **stops at slot selection** — A6 owns
 * confirm/checkout.
 */
@HiltViewModel
class BookerLandingViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val slug: String? = savedStateHandle.get<String>(SchedulingRoutes.ARG_SLUG)?.takeIf { it.isNotBlank() }
        private val oneOffToken: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_ONEOFF_TOKEN)?.takeIf { it.isNotBlank() }

        /** The invitee's own device zone — the default the picker renders times in. */
        val detectedTimezone: String = runCatching { ZoneId.systemDefault().id }.getOrDefault("UTC")

        val isOneOff: Boolean get() = oneOffToken != null

        private val _state = MutableStateFlow<BookerLandingUiState>(BookerLandingUiState.Loading)
        val state: StateFlow<BookerLandingUiState> = _state.asStateFlow()

        private var started = false
        private var fetchJob: Job? = null

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            fetchJob?.cancel()
            fetchJob =
                viewModelScope.launch {
                    _state.value = BookerLandingUiState.Loading
                    if (isOneOff) fetchOneOff() else fetchPage()
                }
        }

        fun refresh() = load()

        private suspend fun fetchPage() {
            val s = slug
            if (s == null) {
                _state.value = BookerLandingUiState.Terminal(SchedulingTerminalState.NotFound)
                return
            }
            when (val result = repo.publicGetPage(s)) {
                is NetworkResult.Success -> _state.value = result.data.toLanding(s)
                is NetworkResult.Failure -> _state.value = result.error.toLandingError()
            }
        }

        private suspend fun fetchOneOff() {
            val token = oneOffToken ?: return
            when (val result = repo.publicGetOneOff(token, detectedTimezone)) {
                is NetworkResult.Success -> {
                    val eventType = result.data.eventType
                    if (eventType == null) {
                        _state.value = BookerLandingUiState.Terminal(SchedulingTerminalState.Expired)
                    } else {
                        _state.value = BookerLandingUiState.DirectPicker(eventType)
                    }
                }
                // A bare 404 on the one-off entry means the link expired or was already used.
                is NetworkResult.Failure ->
                    _state.value = result.error.toLandingError(notFoundAs = SchedulingError.Expired)
            }
        }

        private fun PublicBookingPageResponse.toLanding(pageSlug: String): BookerLandingUiState {
            val page = page
            val pillar = pillarForOwnerType(page?.ownerType)
            val title = page?.title.orEmpty().ifBlank { "Book a time" }
            return BookerLandingUiState.Landing(
                pillar = pillar,
                hostName = title,
                initials = initialsOf(title),
                headline = page?.tagline?.takeIf { it.isNotBlank() },
                blurb = page?.intro?.takeIf { it.isNotBlank() },
                isPaused = status == STATUS_PAUSED,
                eventTypes = eventTypes.map { it.toRowUi() },
                shareUrl = "https://pantopus.com/book/$pageSlug",
                pageTimezone = page?.timezone,
            )
        }

        private fun NetworkError.toLandingError(notFoundAs: SchedulingError = SchedulingError.Unavailable): BookerLandingUiState {
            val decoded = errors.decode(this, notFoundAs = notFoundAs)
            return decoded.toTerminalState()?.let { BookerLandingUiState.Terminal(it) }
                ?: BookerLandingUiState.Error(decoded.landingMessage())
        }

        /** Build the picker args once the invitee picks an event type (slug flow). */
        fun pickerArgsFor(
            row: EventTypeRowUi,
            landing: BookerLandingUiState.Landing,
        ): SlotPickerArgs =
            SlotPickerArgs(
                slug = slug,
                oneOffToken = null,
                eventTypeSlug = row.slug,
                eventTypeName = row.name,
                hostName = landing.hostName,
                durationMin = row.durationMin,
                locationIcon = row.locationIcon,
                pageTimezone = landing.pageTimezone,
                detectedTimezone = detectedTimezone,
                pillar = landing.pillar,
            )

        /** Build the picker args for a one-off link (single event type, no landing list). */
        fun oneOffPickerArgs(eventType: PublicEventTypeView): SlotPickerArgs =
            SlotPickerArgs(
                slug = null,
                oneOffToken = oneOffToken,
                eventTypeSlug = eventType.slug,
                eventTypeName = eventType.name.orEmpty().ifBlank { "Book a time" },
                hostName = null,
                durationMin = eventType.bookingDuration(),
                locationIcon = locationIconFor(eventType.locationMode),
                pageTimezone = null,
                detectedTimezone = detectedTimezone,
                pillar = SchedulingPillar.Personal,
            )

        private companion object {
            const val STATUS_PAUSED = "paused"
        }
    }

/** The first two characters of the host's name, for the avatar disc. */
internal fun initialsOf(name: String): String = name.trim().take(2).uppercase()

/** A friendly, retryable message for a non-terminal landing failure. */
private fun SchedulingError.landingMessage(): String =
    when (this) {
        is SchedulingError.Generic -> message
        else -> "We couldn't load this booking page. Check your connection and try again."
    }

/**
 * C5 render states. [Landing] mirrors the design's header + event-type list
 * (with in-context paused/empty cards); [DirectPicker] is the one-off
 * fast-path; [Terminal] hands off to the shared paused/expired/unavailable/
 * secret surface; [Error] is the retryable fallback.
 */
sealed interface BookerLandingUiState {
    data object Loading : BookerLandingUiState

    data class Landing(
        val pillar: SchedulingPillar,
        val hostName: String,
        val initials: String,
        val headline: String?,
        val blurb: String?,
        val isPaused: Boolean,
        val eventTypes: List<EventTypeRowUi>,
        val shareUrl: String,
        val pageTimezone: String?,
    ) : BookerLandingUiState

    data class DirectPicker(
        val eventType: PublicEventTypeView,
    ) : BookerLandingUiState

    data class Terminal(
        val state: SchedulingTerminalState,
    ) : BookerLandingUiState

    data class Error(
        val message: String,
    ) : BookerLandingUiState
}
