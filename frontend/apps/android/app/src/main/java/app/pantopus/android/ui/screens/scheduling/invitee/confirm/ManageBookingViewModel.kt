@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.ManageActions
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * A6 — D4 Manage your booking. Loads the token-authed manage view (status +
 * actions + payment), then offers reschedule / cancel as local sheets gated by
 * the server-computed `actions` (cutoff/policy). Token not-found / expired
 * surfaces the TokenAccept-style error state; mutations refetch on success and
 * route a 409 reschedule conflict through the shared `ConflictAlternativesSheet`.
 */
@HiltViewModel
class ManageBookingViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val token: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_MANAGE_TOKEN).orEmpty()

        private val _state = MutableStateFlow<ManageBookingUiState>(ManageBookingUiState.Loading)
        val state: StateFlow<ManageBookingUiState> = _state.asStateFlow()

        /** Reschedule sheet — null when closed; non-null carries its slot/loading/conflict state. */
        private val _reschedule = MutableStateFlow<RescheduleSheetState?>(null)
        val reschedule: StateFlow<RescheduleSheetState?> = _reschedule.asStateFlow()

        /** Cancel sheet visibility + in-flight flag. */
        private val _cancel = MutableStateFlow<CancelSheetState?>(null)
        val cancel: StateFlow<CancelSheetState?> = _cancel.asStateFlow()

        private var started = false

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() {
            _state.value = ManageBookingUiState.Loading
            fetch()
        }

        fun refresh() {
            fetch()
        }

        private fun fetch() {
            if (token.isBlank()) {
                _state.value = ManageBookingUiState.Expired
                return
            }
            viewModelScope.launch {
                when (val result = repo.publicGetManageBooking(token)) {
                    is NetworkResult.Success -> _state.value = ManageBookingUiState.Loaded(map(result.data))
                    is NetworkResult.Failure -> {
                        when (errors.decode(result.error, notFoundAs = SchedulingError.Expired)) {
                            is SchedulingError.Expired, is SchedulingError.Unavailable -> _state.value = ManageBookingUiState.Expired
                            is SchedulingError.Generic ->
                                _state.value = ManageBookingUiState.Error("We couldn't load this booking. Please try again.")
                            else -> _state.value = ManageBookingUiState.Expired
                        }
                    }
                }
            }
        }

        // ─── Reschedule ───────────────────────────────────────────────────────

        fun openReschedule() {
            val loaded = _state.value as? ManageBookingUiState.Loaded ?: return
            if (!loaded.data.canReschedule) return
            _reschedule.value = RescheduleSheetState(loading = true)
            viewModelScope.launch {
                val tz = ConfirmUtils.deviceTimezone()
                val from = Instant.now().toString()
                val to = Instant.now().plusSeconds(SLOT_WINDOW_SECONDS).toString()
                when (val r = repo.publicGetManageSlots(token, from = from, to = to, tz = tz)) {
                    is NetworkResult.Success -> _reschedule.update { it?.copy(loading = false, slots = r.data.slots, tz = tz) }
                    is NetworkResult.Failure -> _reschedule.update { it?.copy(loading = false, slots = emptyList(), tz = tz) }
                }
            }
        }

        fun dismissReschedule() {
            _reschedule.value = null
        }

        fun confirmReschedule(startUtc: String) {
            val current = _reschedule.value ?: return
            _reschedule.value = current.copy(submitting = true, conflict = null)
            viewModelScope.launch {
                when (val r = repo.publicReschedule(token, startUtc)) {
                    is NetworkResult.Success -> {
                        _reschedule.value = null
                        refresh()
                    }
                    is NetworkResult.Failure ->
                        when (val decoded = errors.decode(r.error)) {
                            is SchedulingError.Conflict -> _reschedule.update { it?.copy(submitting = false, conflict = decoded) }
                            is SchedulingError.Generic ->
                                _reschedule.update {
                                    it?.copy(
                                        submitting = false,
                                        errorMessage = decoded.message,
                                    )
                                }
                            else ->
                                _reschedule.update {
                                    it?.copy(
                                        submitting = false,
                                        errorMessage = "Couldn't reschedule. Please try again.",
                                    )
                                }
                        }
                }
            }
        }

        fun dismissRescheduleConflict() {
            _reschedule.update { it?.copy(conflict = null) }
        }

        // ─── Cancel ─────────────────────────────────────────────────────────--

        fun openCancel() {
            val loaded = _state.value as? ManageBookingUiState.Loaded ?: return
            if (!loaded.data.canCancel) return
            _cancel.value = CancelSheetState()
        }

        fun dismissCancel() {
            _cancel.value = null
        }

        fun confirmCancel(reason: String?) {
            val current = _cancel.value ?: return
            _cancel.value = current.copy(submitting = true)
            viewModelScope.launch {
                when (val r = repo.publicCancel(token, reason?.ifBlank { null })) {
                    is NetworkResult.Success -> {
                        _cancel.value = null
                        refresh()
                    }
                    is NetworkResult.Failure ->
                        _cancel.update { it?.copy(submitting = false, errorMessage = "Couldn't cancel. Please try again.") }
                }
            }
        }

        // ─── Mapping ────────────────────────────────────────────────────────--

        private fun map(response: ManageBookingResponse): ManageBookingData {
            val booking = response.booking
            val et = response.eventType
            val page = response.page
            val actions = response.actions ?: ManageActions()
            val tz =
                booking.inviteeTimezone?.takeIf { it.isNotBlank() }
                    ?: page?.timezone?.takeIf { it.isNotBlank() }
                    ?: ConfirmUtils.deviceTimezone()
            val status = resolveStatus(booking.status, booking.endAt)
            val isActive = status == ManageStatus.Confirmed || status == ManageStatus.Pending
            val canReschedule = isActive && (actions.canReschedule == true) && (actions.inviteeRescheduleAllowed != false)
            val canCancel = isActive && (actions.canCancel == true) && (actions.inviteeCancelAllowed != false)
            val location =
                ConfirmUtils.locationLabel(
                    booking.locationMode ?: et?.locationMode,
                    booking.locationDetail ?: et?.locationDetail,
                )
            return ManageBookingData(
                token = token,
                status = status,
                eventName = et?.name ?: "Your booking",
                hostName = page?.title?.takeIf { it.isNotBlank() } ?: "your host",
                ownerType = page?.ownerType ?: booking.policySnapshot?.get("owner_type") as? String,
                startUtc = booking.startAt,
                endUtc = booking.endAt,
                whenLabel = ConfirmUtils.formatSlotRange(booking.startAt.orEmpty(), booking.endAt, tz),
                tzLabel = ConfirmUtils.tzChipLabel(tz, booking.startAt),
                locationLabel = location.label,
                locationSub = location.sub,
                inviteeName = booking.inviteeName,
                cancelledOnLabel = if (status == ManageStatus.Cancelled) cancelledOn(booking.startAt) else null,
                cancellationPolicy = page?.cancellationPolicy,
                pageSlug = page?.slug,
                canReschedule = canReschedule,
                canCancel = canCancel,
                windowClosed = isActive && !canReschedule && !canCancel,
                refundEstimateCents = actions.refundEstimateCents,
                currency = response.payment?.currency,
            )
        }

        private fun resolveStatus(
            status: String?,
            endUtc: String?,
        ): ManageStatus =
            when {
                status == "cancelled" || status == "declined" -> ManageStatus.Cancelled
                ConfirmUtils.isPastBooking(status, endUtc) -> ManageStatus.Past
                status == "pending" -> ManageStatus.Pending
                else -> ManageStatus.Confirmed
            }

        private fun cancelledOn(startUtc: String?): String? {
            val instant =
                runCatching { Instant.parse(startUtc) }.recoverCatching { OffsetDateTime.parse(startUtc).toInstant() }.getOrNull()
                    ?: return null
            return runCatching { ZonedDateTime.ofInstant(instant, ZoneId.systemDefault()).format(CANCELLED_FMT) }.getOrNull()
        }

        private companion object {
            const val SLOT_WINDOW_SECONDS = 60L * 60 * 24 * 30
            val CANCELLED_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
        }
    }

/** Local reschedule-sheet state (slots + selection + 409 conflict). */
data class RescheduleSheetState(
    val loading: Boolean = false,
    val submitting: Boolean = false,
    val slots: List<SlotDto> = emptyList(),
    val tz: String = "UTC",
    val conflict: SchedulingError.Conflict? = null,
    val errorMessage: String? = null,
)

/** Local cancel-sheet state. */
data class CancelSheetState(
    val submitting: Boolean = false,
    val errorMessage: String? = null,
)
