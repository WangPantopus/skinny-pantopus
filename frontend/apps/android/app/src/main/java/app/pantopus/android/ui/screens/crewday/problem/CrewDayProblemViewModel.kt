package app.pantopus.android.ui.screens.crewday.problem

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.api.models.crewday.CrewDayProblemBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.screens.compose.listing.ListingPhotoProcessor
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/** A photo picked for the report: its bytes now, its storage path once uploaded. */
data class CrewDayProblemPhoto(
    val id: String,
    val bytes: ByteArray,
    val path: String? = null,
) {
    override fun equals(other: Any?): Boolean = other is CrewDayProblemPhoto && other.id == id

    override fun hashCode(): Int = id.hashCode()
}

data class CrewDayProblemState(
    val booking: CrewDayBookingDto? = null,
    val kind: String? = null,
    val note: String = "",
    val photos: List<CrewDayProblemPhoto> = emptyList(),
    val sending: Boolean = false,
    val error: String? = null,
    val sent: Boolean = false,
) {
    /** A case is already open: this adds a note or photos to it. */
    val adding: Boolean get() = booking?.problem?.status == "open"

    val canSend: Boolean get() = !sending && note.isNotBlank() && note.length <= MAX_NOTE && (adding || kind != null)

    companion object {
        const val MAX_NOTE = 1000
        const val MAX_PHOTOS = 4
    }
}

/**
 * Something needs attention (screen 7): what went wrong, what happened (required), up to four photos (uploaded
 * through `POST /api/crew-days/uploads`, re-encoded first so no location or camera data leaves the phone), then
 * `POST /bookings/:id/problem`. The charge waits; Pantopus support owns the case. A second report adds to it.
 */
@HiltViewModel
class CrewDayProblemViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val bookingId: String = savedStateHandle.get<String>(CrewDayRoutes.BOOKING_ID_KEY).orEmpty()
        private val _state = MutableStateFlow(CrewDayProblemState())
        val state: StateFlow<CrewDayProblemState> = _state.asStateFlow()

        fun load() {
            if (_state.value.booking != null) return
            viewModelScope.launch {
                val booking = (repository.booking(bookingId) as? NetworkResult.Success)?.data ?: return@launch
                _state.update { it.copy(booking = booking) }
            }
        }

        fun setKind(kind: String) = _state.update { it.copy(kind = kind, error = null) }

        fun setNote(text: String) = _state.update { it.copy(note = text.take(CrewDayProblemState.MAX_NOTE), error = null) }

        /** Adds a picked photo, re-encoded as a JPEG without its metadata; an unreadable one is skipped. */
        fun addPhoto(raw: ByteArray) {
            val bytes = ListingPhotoProcessor.uploadData(raw) ?: return
            _state.update {
                if (it.photos.size >= CrewDayProblemState.MAX_PHOTOS) {
                    it
                } else {
                    it.copy(photos = it.photos + CrewDayProblemPhoto(UUID.randomUUID().toString(), bytes))
                }
            }
        }

        fun removePhoto(id: String) = _state.update { s -> s.copy(photos = s.photos.filterNot { it.id == id }) }

        fun send() {
            val s = _state.value
            if (!s.canSend) return
            _state.update { it.copy(sending = true, error = null) }
            viewModelScope.launch {
                val paths = mutableListOf<String>()
                for (photo in _state.value.photos) {
                    paths += photo.path ?: upload(photo) ?: return@launch
                }
                val body = CrewDayProblemBody(kind = s.kind.takeUnless { s.adding }, note = s.note.trim(), photoPaths = paths)
                when (val result = repository.reportProblem(bookingId, body)) {
                    is NetworkResult.Success -> _state.update { it.copy(sending = false, sent = true, booking = result.data) }
                    is NetworkResult.Failure -> _state.update { it.copy(sending = false, error = result.error.crewDayMessage) }
                }
            }
        }

        /** Uploads one photo and keeps its path, so a retry doesn't upload it again; null (with the error shown) if it fails. */
        private suspend fun upload(photo: CrewDayProblemPhoto): String? =
            when (val result = repository.upload(bookingId, photo.bytes, JPEG, "problem-${photo.id.take(8)}.jpg")) {
                is NetworkResult.Success -> {
                    val path = result.data.path
                    _state.update { s -> s.copy(photos = s.photos.map { if (it.id == photo.id) it.copy(path = path) else it }) }
                    path
                }
                is NetworkResult.Failure -> {
                    _state.update { it.copy(sending = false, error = "A photo didn't upload. ${result.error.crewDayMessage}") }
                    null
                }
            }

        private companion object {
            const val JPEG = "image/jpeg"
        }
    }
