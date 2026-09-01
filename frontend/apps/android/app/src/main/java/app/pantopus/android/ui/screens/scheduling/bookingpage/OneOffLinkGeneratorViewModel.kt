@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.OneOffLinkRequest
import app.pantopus.android.data.api.models.scheduling.OneOffLinkResponse
import app.pantopus.android.data.api.models.scheduling.OneOffSlotInput
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** A selectable event type in the one-off picker. */
data class EventTypeOption(
    val id: String,
    val name: String,
    val durations: List<Int>,
    val defaultDuration: Int,
    val locationMode: String?,
)

/** A concrete proposed time for a constrained one-off link. */
data class ProposedSlot(
    val startIso: String,
    val endIso: String,
    val weekday: String,
    val date: String,
    val timeRange: String,
)

enum class ExpiryOption(val label: String, val minutes: Int) {
    H24("24 hours", 1440),
    D7("7 days", 10080),
    D30("30 days", 43200),
    None("No expiry", 525600),
}

data class OneOffConfig(
    val eventTypes: List<EventTypeOption>,
    val selectedId: String,
    val selectedDuration: Int,
    val offerSpecificTimes: Boolean = false,
    val offeredSlots: List<ProposedSlot> = emptyList(),
    val expiry: ExpiryOption = ExpiryOption.D7,
    val singleUse: Boolean = true,
    val askIntake: Boolean = false,
    val creating: Boolean = false,
    val error: String? = null,
) {
    val selected: EventTypeOption?
        get() = eventTypes.firstOrNull { it.id == selectedId }
}

data class OneOffResult(
    val url: String,
    val expiryLabel: String,
    val singleUse: Boolean,
)

sealed interface OneOffUiState {
    data object Loading : OneOffUiState

    /** No event types yet — can't mint a link until one exists. */
    data object NeedsEventType : OneOffUiState

    data class Config(val data: OneOffConfig) : OneOffUiState

    data class Generated(val result: OneOffResult) : OneOffUiState

    data class Error(val message: String) : OneOffUiState
}

@HiltViewModel
class OneOffLinkGeneratorViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
    ) : ViewModel() {
        private val owner: SchedulingOwner = SchedulingOwner.Personal

        private val _state = MutableStateFlow<OneOffUiState>(OneOffUiState.Loading)
        val state: StateFlow<OneOffUiState> = _state.asStateFlow()

        fun load() {
            _state.value = OneOffUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getEventTypes(owner)) {
                    is NetworkResult.Success -> {
                        val options = result.data.eventTypes.map { it.toOption() }
                        if (options.isEmpty()) {
                            _state.value = OneOffUiState.NeedsEventType
                        } else {
                            val first = options.first()
                            _state.value = OneOffUiState.Config(OneOffConfig(options, first.id, first.defaultDuration))
                        }
                    }
                    is NetworkResult.Failure -> _state.value = OneOffUiState.Error("We couldn't load your event types.")
                }
            }
        }

        fun refresh() = load()

        private fun editConfig(transform: (OneOffConfig) -> OneOffConfig) {
            val cfg = (_state.value as? OneOffUiState.Config)?.data ?: return
            _state.value = OneOffUiState.Config(transform(cfg))
        }

        fun selectEventType(id: String) =
            editConfig { cfg ->
                val opt = cfg.eventTypes.firstOrNull { it.id == id } ?: return@editConfig cfg
                cfg.copy(selectedId = id, selectedDuration = opt.defaultDuration, offeredSlots = emptyList())
            }

        fun setDuration(min: Int) = editConfig { it.copy(selectedDuration = min, offeredSlots = emptyList()) }

        fun toggleOfferTimes() = editConfig { it.copy(offerSpecificTimes = !it.offerSpecificTimes) }

        fun addProposedSlot() =
            editConfig { cfg ->
                cfg.copy(offeredSlots = cfg.offeredSlots + buildSlot(cfg.offeredSlots.size, cfg.selectedDuration))
            }

        fun removeSlot(index: Int) =
            editConfig { cfg ->
                cfg.copy(offeredSlots = cfg.offeredSlots.filterIndexed { i, _ -> i != index })
            }

        fun setExpiry(option: ExpiryOption) = editConfig { it.copy(expiry = option) }

        fun toggleSingleUse() = editConfig { it.copy(singleUse = !it.singleUse) }

        fun toggleAskIntake() = editConfig { it.copy(askIntake = !it.askIntake) }

        fun generate() {
            val cfg = (_state.value as? OneOffUiState.Config)?.data ?: return
            if (cfg.creating) return
            _state.value = OneOffUiState.Config(cfg.copy(creating = true, error = null))
            viewModelScope.launch {
                val offered =
                    if (cfg.offerSpecificTimes && cfg.offeredSlots.isNotEmpty()) {
                        cfg.offeredSlots.map { OneOffSlotInput(start = it.startIso, end = it.endIso) }
                    } else {
                        null
                    }
                val body =
                    OneOffLinkRequest(
                        eventTypeId = cfg.selectedId,
                        expiresInMin = cfg.expiry.minutes,
                        singleUse = cfg.singleUse,
                        offeredSlots = offered,
                    )
                when (val result = repo.createOneOffLink(owner, body)) {
                    is NetworkResult.Success -> _state.value = OneOffUiState.Generated(result.data.toResult())
                    is NetworkResult.Failure ->
                        _state.value = OneOffUiState.Config(cfg.copy(creating = false, error = "Couldn't create the link. Try again"))
                }
            }
        }

        /** Return to the config form, keeping the previous event-type list. */
        fun createAnother() = load()

        private fun OneOffLinkResponse.toResult(): OneOffResult {
            val expiryLabel = expiresAt?.let { "Expires ${shortDate(it)}" } ?: "No expiry"
            return OneOffResult(
                url = BookingLinkUrls.shareableFromPath(path),
                expiryLabel = expiryLabel,
                singleUse = singleUse,
            )
        }

        private fun EventTypeDto.toOption(): EventTypeOption =
            EventTypeOption(
                id = id,
                name = name,
                durations = durations.ifEmpty { listOf(defaultDuration ?: DEFAULT_DURATION) },
                defaultDuration = defaultDuration ?: durations.firstOrNull() ?: DEFAULT_DURATION,
                locationMode = locationMode,
            )

        private fun buildSlot(
            index: Int,
            durationMin: Int,
        ): ProposedSlot {
            val start =
                ZonedDateTime
                    .now(ZoneId.systemDefault())
                    .plusDays((index + 1).toLong())
                    .withHour(9)
                    .withMinute(0)
                    .withSecond(0)
                    .withNano(0)
            val end = start.plusMinutes(durationMin.toLong())
            return ProposedSlot(
                startIso = start.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                endIso = end.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                weekday = start.format(WEEKDAY),
                date = start.format(DATE),
                timeRange = "${start.format(TIME)} – ${end.format(TIME)}",
            )
        }

        private fun shortDate(iso: String): String =
            runCatching {
                ZonedDateTime.parse(iso).withZoneSameInstant(ZoneId.systemDefault()).format(DATE)
            }.getOrDefault("soon")

        private companion object {
            const val DEFAULT_DURATION = 30
            val WEEKDAY: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE", Locale.US)
            val DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
            val TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
        }
    }
