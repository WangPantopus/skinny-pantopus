@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * E2 Booking detail. Loads `GET /bookings/:id` for the owner stashed by the
 * inbox ([BookingsOwnerRelay], persisted in `SavedStateHandle` so it survives
 * process death), renders the lifecycle (confirmed/pending/cancelled/no-show),
 * and drives the local E3 Approve/Decline sheet. Reschedule (E4) and Cancel
 * (E5) are their own view-models, opened from this screen with the loaded
 * owner + booking facts; on commit the screen calls [refresh].
 */
@HiltViewModel
class BookingDetailViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        ownerRelay: BookingsOwnerRelay,
        private val savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val bookingId: String =
            savedStateHandle.get<String>(
                SchedulingRoutes.ARG_BOOKING_ID,
            ).orEmpty()

        private val owner: SchedulingOwner =
            run {
                val persisted = savedStateHandle.get<String>(OWNER_TOKEN_KEY)
                val resolved =
                    if (persisted != null) {
                        ownerFromToken(
                            persisted,
                        )
                    } else {
                        (ownerRelay.consume() ?: SchedulingOwner.Personal)
                    }
                savedStateHandle[OWNER_TOKEN_KEY] = resolved.toToken()
                resolved
            }

        private val _state = MutableStateFlow<BookingDetailUiState>(BookingDetailUiState.Loading)
        val state: StateFlow<BookingDetailUiState> = _state.asStateFlow()

        private val _approveDecline = MutableStateFlow<ApproveDeclineSheetState?>(null)
        val approveDecline: StateFlow<ApproveDeclineSheetState?> = _approveDecline.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

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
            _state.value = BookingDetailUiState.Loading
            fetch()
        }

        fun refresh() = fetch()

        private fun fetch() {
            if (bookingId.isBlank()) {
                _state.value = BookingDetailUiState.Error("We couldn't find this booking.")
                return
            }
            viewModelScope.launch {
                when (val result = repo.getBooking(owner, bookingId)) {
                    is NetworkResult.Success ->
                        _state.value =
                            BookingDetailUiState.Loaded(
                                result.data.toDetailData(owner),
                            )
                    is NetworkResult.Failure ->
                        _state.value =
                            when (errors.decode(result.error)) {
                                is SchedulingError.Secret ->
                                    BookingDetailUiState.Error(
                                        "Only the owner can view this booking.",
                                    )
                                else ->
                                    BookingDetailUiState.Error(
                                        "We couldn't load this booking. Check your connection and try again.",
                                    )
                            }
                }
            }
        }

        fun toastConsumed() {
            _toast.value = null
        }

        /** The resolved owner + the loaded booking, for opening the reschedule / cancel sheets. */
        fun loaded(): BookingDetailData? = (_state.value as? BookingDetailUiState.Loaded)?.data

        // ─── E3 Approve / Decline sheet ───────────────────────────────────────

        fun openApprove() {
            sheetFor()?.let { _approveDecline.value = it.copy(declineExpanded = false) }
        }

        fun openDecline() {
            sheetFor()?.let { _approveDecline.value = it.copy(declineExpanded = true) }
        }

        private fun sheetFor(): ApproveDeclineSheetState? {
            val data = loaded() ?: return null
            return ApproveDeclineSheetState(
                pillar = data.pillar,
                requesterName = data.requesterName,
                requesterInitials = data.requesterInitials,
                requesterSub = data.requesterSub,
                slotLabel = data.whenRange,
                intakeCount = data.intakeAnswers.size,
                hasConflict = data.hasConflict,
            )
        }

        fun expandDecline() {
            _approveDecline.update { it?.copy(declineExpanded = true) }
        }

        fun selectReason(reason: String) {
            _approveDecline.update { it?.copy(selectedReason = reason) }
        }

        fun setNote(value: String) {
            _approveDecline.update { it?.copy(note = value) }
        }

        fun dismissApproveDecline() {
            _approveDecline.value = null
        }

        fun approve() {
            _approveDecline.update {
                it?.copy(
                    approving = true,
                    submitting = true,
                    errorMessage = null,
                )
            }
            viewModelScope.launch {
                when (repo.approveBooking(owner, bookingId)) {
                    is NetworkResult.Success -> {
                        _approveDecline.value = null
                        refresh()
                    }
                    is NetworkResult.Failure ->
                        _approveDecline.update {
                            it?.copy(
                                approving = false,
                                submitting = false,
                                errorMessage = "Couldn't approve — try again.",
                            )
                        }
                }
            }
        }

        fun declineConfirm() {
            val sheet = _approveDecline.value ?: return
            val reason = sheet.note.ifBlank { sheet.selectedReason }
            _approveDecline.update { it?.copy(submitting = true, errorMessage = null) }
            viewModelScope.launch {
                when (repo.declineBooking(owner, bookingId, reason)) {
                    is NetworkResult.Success -> {
                        _approveDecline.value = null
                        refresh()
                    }
                    is NetworkResult.Failure ->
                        _approveDecline.update {
                            it?.copy(
                                submitting = false,
                                errorMessage = "Couldn't decline — try again.",
                            )
                        }
                }
            }
        }

        private companion object {
            const val OWNER_TOKEN_KEY = "bookingDetailOwnerToken"
        }
    }
