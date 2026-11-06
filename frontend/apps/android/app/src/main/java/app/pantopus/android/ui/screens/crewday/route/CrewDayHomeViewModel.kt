@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.crewday.route

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.api.models.crewday.CrewDayRouteDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDayFormat
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

/** A completion photo: its bytes, its storage path once uploaded. */
data class CrewDayDonePhoto(
    val id: String,
    val bytes: ByteArray,
    val path: String? = null,
) {
    override fun equals(other: Any?): Boolean = other is CrewDayDonePhoto && other.id == id

    override fun hashCode(): Int = id.hashCode()
}

data class CrewDayHomeState(
    val route: CrewDayRouteDto? = null,
    val home: CrewDayHomeDto? = null,
    val position: Int = 0,
    val loadError: String? = null,
    /** The day's included items and whether it's outside only (from the crew's read of the day). */
    val included: List<String> = emptyList(),
    val outsideOnly: Boolean = false,
    val photos: List<CrewDayDonePhoto> = emptyList(),
    val note: String = "",
    val saving: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
) {
    val isDone: Boolean get() = home?.status in setOf("done", "paid", "payment_failed")

    val canMarkDone: Boolean get() = !saving && !isDone && photos.isNotEmpty()

    /** The home's own date has come (in the Crew Day's zone): before it the server refuses Mark done. */
    val onTheDay: Boolean
        get() =
            CrewDayFormat.date(home?.serviceDate ?: route?.date)?.let { date ->
                !date.isAfter(java.time.LocalDate.now(CrewDayFormat.zone(route?.timezone)))
            } ?: true

    companion object {
        const val MAX_PHOTOS = 8
        const val MAX_NOTE = 500
    }
}

/**
 * One home on the route (screen 17): the job, access, photos (camera or library, up to eight, re-encoded so no location
 * leaves the phone, uploaded as `done`), the note for the household, Mark done (`POST /bookings/:id/done`, which makes
 * the invoice) and Can't get in (`POST /bookings/:id/cant-get-in`, which tells the household).
 */
@HiltViewModel
class CrewDayHomeViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val crewDayId: String = savedStateHandle.get<String>(CrewDayRoutes.CREW_DAY_ID_KEY).orEmpty()
        val bookingId: String = savedStateHandle.get<String>(CrewDayRoutes.BOOKING_ID_KEY).orEmpty()
        private val date: String? = savedStateHandle.get<String>(CrewDayRoutes.DATE_KEY)?.takeIf { it.isNotBlank() }
        private val _state = MutableStateFlow(CrewDayHomeState())
        val state: StateFlow<CrewDayHomeState> = _state.asStateFlow()

        fun load() {
            viewModelScope.launch {
                (repository.crewDay(crewDayId) as? NetworkResult.Success)?.data?.let { day ->
                    _state.update { it.copy(included = day.included, outsideOnly = day.outsideOnly) }
                }
            }
            viewModelScope.launch {
                when (val result = repository.route(crewDayId, date)) {
                    is NetworkResult.Success -> {
                        val index = result.data.homes.indexOfFirst { it.id == bookingId }
                        _state.update {
                            it.copy(
                                route = result.data,
                                home = result.data.homes.getOrNull(index),
                                position = index + 1,
                                loadError = if (index < 0) "This home isn't on the route for this date." else null,
                            )
                        }
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(loadError = result.error.crewDayMessage) }
                }
            }
        }

        fun addPhoto(raw: ByteArray) {
            val bytes = ListingPhotoProcessor.uploadData(raw) ?: return
            _state.update {
                if (it.photos.size >= CrewDayHomeState.MAX_PHOTOS) {
                    it
                } else {
                    it.copy(photos = it.photos + CrewDayDonePhoto(UUID.randomUUID().toString(), bytes), error = null)
                }
            }
        }

        fun removePhoto(id: String) = _state.update { s -> s.copy(photos = s.photos.filterNot { it.id == id }) }

        fun setNote(text: String) = _state.update { it.copy(note = text.take(CrewDayHomeState.MAX_NOTE)) }

        fun markDone() {
            if (!_state.value.canMarkDone) return
            _state.update { it.copy(saving = true, error = null) }
            viewModelScope.launch {
                val paths = mutableListOf<String>()
                for (photo in _state.value.photos) {
                    paths += photo.path ?: upload(photo) ?: return@launch
                }
                when (val result = repository.markDone(bookingId, paths, _state.value.note.trim().ifEmpty { null })) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(saving = false, home = result.data, photos = emptyList(), notice = "Done. We told the household.")
                        }
                    is NetworkResult.Failure -> _state.update { it.copy(saving = false, error = result.error.crewDayMessage) }
                }
            }
        }

        fun cantGetIn(note: String) {
            if (_state.value.saving) return
            _state.update { it.copy(saving = true, error = null) }
            viewModelScope.launch {
                when (val result = repository.cantGetIn(bookingId, note.trim())) {
                    is NetworkResult.Success -> {
                        _state.update { it.copy(saving = false, home = result.data, notice = "We told the household you can't get in.") }
                        result.data.householdUserId?.let { id -> _chat.value = id to (result.data.firstName ?: "The household") }
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(saving = false, error = result.error.crewDayMessage) }
                }
            }
        }

        fun noticeShown() = _state.update { it.copy(notice = null) }

        /** After Can't get in: the conversation with the household, once (null when the server doesn't say who). */
        private val _chat = MutableStateFlow<Pair<String, String>?>(null)
        val chat: StateFlow<Pair<String, String>?> = _chat.asStateFlow()

        fun chatOpened() {
            _chat.value = null
        }

        /** Uploads one photo and keeps its path; null (with the error shown) if it fails. */
        private suspend fun upload(photo: CrewDayDonePhoto): String? =
            when (val result = repository.upload(bookingId, "done", photo.bytes, JPEG, "done-${photo.id.take(8)}.jpg")) {
                is NetworkResult.Success -> {
                    val path = result.data.path
                    _state.update { s -> s.copy(photos = s.photos.map { if (it.id == photo.id) it.copy(path = path) else it }) }
                    path
                }
                is NetworkResult.Failure -> {
                    _state.update { it.copy(saving = false, error = "A photo didn't upload. ${result.error.crewDayMessage}") }
                    null
                }
            }

        private companion object {
            const val JPEG = "image/jpeg"
        }
    }
