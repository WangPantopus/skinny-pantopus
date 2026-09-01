@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.OneOffLinkRequest
import app.pantopus.android.data.api.net.NetworkResult
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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The outcome chips; each pre-fills a smart-default template. */
enum class FollowUpOutcome(val label: String, val template: String) {
    Completed("Completed", "Thanks for the time today — good to connect. Want to book again?"),
    NoShow("No-show", "Sorry we missed each other today. Here's a link to grab another time whenever works for you."),
    RebookNeeded("Rebook needed", "Let's find another time that works better — grab a slot here whenever you're ready."),
}

data class FollowUpUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val inviteeName: String = "there",
    val headerSubtitle: String = "",
    val pillar: SchedulingPillar = SchedulingPillar.Personal,
    val outcome: FollowUpOutcome? = null,
    val message: String = "",
    val privateNote: String = "",
    val pushOn: Boolean = true,
    val sending: Boolean = false,
    val sendError: String? = null,
    val didSend: Boolean = false,
    val canAppendRebookLink: Boolean = false,
    val appendingLink: Boolean = false,
) {
    val isSaveNoteOnly: Boolean get() = outcome == null && message.isBlank() && privateNote.isNotBlank()
    val canSubmit: Boolean get() = (message.isNotBlank() || privateNote.isNotBlank() || outcome != null) && !sending
}

/**
 * E7 Post-Meeting Follow-up. After a past booking, send a thank-you/recap (wired
 * to `POST /bookings/:id/nudge`), append a one-off rebook link, or jot a private
 * outcome note. Outcome chips swap a smart-default template into the composer.
 */
@HiltViewModel
class PostMeetingFollowupViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val bookingId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_BOOKING_ID).orEmpty()

        private val _state = MutableStateFlow(FollowUpUiState())
        val state: StateFlow<FollowUpUiState> = _state.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var eventTypeId: String? = null
        private var started = false

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            viewModelScope.launch {
                _state.update { it.copy(loading = true, loadError = null) }
                when (val r = repo.getBooking(SchedulingOwner.Personal, bookingId)) {
                    is NetworkResult.Success -> {
                        val booking = r.data.booking
                        owner = BookingsExtrasOwner.fromBooking(booking)
                        eventTypeId = booking.eventTypeId
                        val invitee = booking.inviteeName?.takeIf { n -> n.isNotBlank() } ?: "there"
                        // Header subtitle "Event · Invitee · Jun 9" from loaded
                        // booking data (event-type name + invitee + start day).
                        val subtitle =
                            listOfNotNull(
                                r.data.eventType?.name?.takeIf { n -> n.isNotBlank() },
                                booking.inviteeName?.takeIf { n -> n.isNotBlank() },
                                BookingsExtrasFormatting.shortDay(booking.startAt).takeIf { d -> d.isNotBlank() },
                            ).joinToString(" · ")
                        _state.update {
                            it.copy(
                                loading = false,
                                inviteeName = invitee,
                                headerSubtitle = subtitle,
                                pillar = owner.pillar(),
                                canAppendRebookLink = booking.eventTypeId != null,
                            )
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.update { it.copy(loading = false, loadError = "Couldn't load this booking.") }
                }
            }
        }

        fun selectOutcome(outcome: FollowUpOutcome) {
            _state.update {
                val next = if (it.outcome == outcome) null else outcome
                it.copy(outcome = next, message = next?.template ?: "")
            }
        }

        fun setMessage(message: String) {
            _state.update { it.copy(message = message) }
        }

        fun setPrivateNote(note: String) {
            _state.update { it.copy(privateNote = note) }
        }

        fun setPush(on: Boolean) {
            _state.update { it.copy(pushOn = on) }
        }

        fun appendRebookLink() {
            val etId = eventTypeId ?: return
            if (_state.value.appendingLink) return
            _state.update { it.copy(appendingLink = true) }
            viewModelScope.launch {
                when (val r = repo.createOneOffLink(owner, OneOffLinkRequest(eventTypeId = etId))) {
                    is NetworkResult.Success -> {
                        val url = "https://pantopus.com${r.data.path}"
                        _state.update {
                            val joined = if (it.message.isBlank()) url else "${it.message}\n\n$url"
                            it.copy(message = joined, appendingLink = false)
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.update { it.copy(appendingLink = false, sendError = "Couldn't create a rebook link.") }
                }
            }
        }

        fun submit() {
            val current = _state.value
            if (!current.canSubmit) return
            // Private-note-only: nothing to send (the note is host-local; backend has no store yet).
            if (current.isSaveNoteOnly) {
                _state.update { it.copy(didSend = true) }
                return
            }
            _state.update { it.copy(sending = true, sendError = null) }
            viewModelScope.launch {
                when (repo.nudgeBooking(owner, bookingId, current.message)) {
                    is NetworkResult.Success -> _state.update { it.copy(sending = false, didSend = true) }
                    is NetworkResult.Failure -> _state.update { it.copy(sending = false, sendError = "Couldn't send — try again.") }
                }
            }
        }
    }
