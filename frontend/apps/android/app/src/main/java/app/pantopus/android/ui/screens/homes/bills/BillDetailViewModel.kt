@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.bills

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.BillSplitDto
import app.pantopus.android.data.api.models.homes.UpdateBillRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** Nav-arg keys for the Bill detail route. */
const val BILL_DETAIL_HOME_ID_KEY = "homeId"
const val BILL_DETAIL_BILL_ID_KEY = "billId"

/** UI state for the Bill Detail screen. */
sealed interface BillDetailUiState {
    data object Loading : BillDetailUiState

    data class Loaded(
        val bill: BillDto,
        val splits: List<BillSplitDto>,
        val saving: Boolean = false,
        val saveError: String? = null,
    ) : BillDetailUiState

    data class Error(val message: String) : BillDetailUiState
}

/** ViewModel backing [BillDetailScreen]. */
@HiltViewModel
class BillDetailViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle[BILL_DETAIL_HOME_ID_KEY]) {
                "BillDetailViewModel requires a $BILL_DETAIL_HOME_ID_KEY nav argument"
            }
        private val billId: String =
            checkNotNull(savedStateHandle[BILL_DETAIL_BILL_ID_KEY]) {
                "BillDetailViewModel requires a $BILL_DETAIL_BILL_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<BillDetailUiState>(BillDetailUiState.Loading)
        val state: StateFlow<BillDetailUiState> = _state.asStateFlow()

        private var onChanged: () -> Unit = {}
        private var onClose: () -> Unit = {}

        fun configureNavigation(
            onChanged: () -> Unit = {},
            onClose: () -> Unit = {},
        ) {
            this.onChanged = onChanged
            this.onClose = onClose
        }

        fun load() {
            _state.value = BillDetailUiState.Loading
            viewModelScope.launch {
                // Backend has no GET-by-id for bills today (see parity
                // audit). Fall back to the list endpoint + a parallel
                // splits fetch. Lists are small.
                val billsDeferred = async { repo.getHomeBills(homeId) }
                val splitsDeferred = async { repo.getHomeBillSplits(homeId, billId) }
                val billsResult = billsDeferred.await()
                val splitsResult = splitsDeferred.await()

                when (billsResult) {
                    is NetworkResult.Failure ->
                        _state.value = BillDetailUiState.Error(billsResult.error.message)
                    is NetworkResult.Success -> {
                        val bill = billsResult.data.bills.firstOrNull { it.id == billId }
                        if (bill == null) {
                            _state.value = BillDetailUiState.Error("This bill is no longer available.")
                        } else {
                            val splits =
                                (splitsResult as? NetworkResult.Success)?.data?.splits.orEmpty()
                            _state.value = BillDetailUiState.Loaded(bill, splits)
                        }
                    }
                }
            }
        }

        fun markPaid() {
            update(
                UpdateBillRequest(
                    status = "paid",
                    paidAt = Instant.now().toString(),
                ),
                dismissOnSuccess = false,
            )
        }

        /** Soft-delete — backend has no DELETE for bills. */
        fun remove() {
            update(
                UpdateBillRequest(status = "cancelled"),
                dismissOnSuccess = true,
            )
        }

        private fun update(
            request: UpdateBillRequest,
            dismissOnSuccess: Boolean,
        ) {
            val current = _state.value as? BillDetailUiState.Loaded ?: return
            if (current.saving) return
            _state.value = current.copy(saving = true, saveError = null)
            viewModelScope.launch {
                when (val result = repo.updateHomeBill(homeId, billId, request)) {
                    is NetworkResult.Success -> {
                        onChanged()
                        _state.value =
                            current.copy(
                                bill = result.data.bill,
                                saving = false,
                                saveError = null,
                            )
                        if (dismissOnSuccess) onClose()
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            current.copy(saving = false, saveError = result.error.message)
                }
            }
        }
    }
