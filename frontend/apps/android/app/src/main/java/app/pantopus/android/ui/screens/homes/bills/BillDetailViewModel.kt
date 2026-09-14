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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
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
        val splitError: String? = null,
    ) : BillDetailUiState

    data class Error(val message: String) : BillDetailUiState
}

/** ViewModel backing [BillDetailScreen]. */
@HiltViewModel
class BillDetailViewModel
    internal constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
        createAccess: (String, CoroutineScope) -> HomeFinanceAccess,
    ) : ViewModel() {
        @Inject
        constructor(repo: HomesRepository, savedStateHandle: SavedStateHandle, finance: HomeFinanceAccessFactory) :
            this(repo, savedStateHandle, finance::create)

        private val homeId: String =
            checkNotNull(savedStateHandle[BILL_DETAIL_HOME_ID_KEY]) {
                "BillDetailViewModel requires a $BILL_DETAIL_HOME_ID_KEY nav argument"
            }
        private val billId: String =
            checkNotNull(savedStateHandle[BILL_DETAIL_BILL_ID_KEY]) {
                "BillDetailViewModel requires a $BILL_DETAIL_BILL_ID_KEY nav argument"
            }

        private val finance = createAccess(homeId, viewModelScope)
        val financeRights = finance.rights
        private var generation = 0

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

        init {
            viewModelScope.launch {
                financeRights.collect { rights ->
                    if (rights.invalidated) {
                        generation++
                        _state.value = BillDetailUiState.Error(FINANCE_SESSION_CHANGED)
                    }
                }
            }
        }

        fun load() {
            val revision = ++generation
            _state.value = BillDetailUiState.Loading
            viewModelScope.launch {
                try {
                    finance.refresh()
                    val billsDeferred = async { repo.getHomeBills(homeId) }
                    val splitsDeferred = async { repo.getHomeBillSplits(homeId, billId) }
                    val billsResult = billsDeferred.await()
                    val splitsResult = splitsDeferred.await()
                    finance.require()
                    if (revision != generation) return@launch
                    when (billsResult) {
                        is NetworkResult.Failure -> error(billsResult.error.message)
                        is NetworkResult.Success -> {
                            check(billsResult.data.bills.all { it.homeId == homeId }) { "Bill response could not be verified." }
                            val bill = billsResult.data.bills.singleOrNull { it.id == billId && it.homeId == homeId }
                            checkNotNull(bill) { "This bill is no longer available." }
                            val splits = (splitsResult as? NetworkResult.Success)?.data?.splits.orEmpty()
                            check(splits.all { it.billId == billId }) { "Bill split response could not be verified." }
                            val splitError = (splitsResult as? NetworkResult.Failure)?.error?.message
                            _state.value = BillDetailUiState.Loaded(bill, splits, splitError = splitError)
                        }
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: IllegalStateException) {
                    if (revision == generation) _state.value = BillDetailUiState.Error(error.message ?: "Couldn't load this bill.")
                }
            }
        }

        fun edit(action: () -> Unit) {
            val current = _state.value as? BillDetailUiState.Loaded ?: return
            if (current.saving) return
            viewModelScope.launch {
                try {
                    finance.require(managing = true)
                    action()
                } catch (error: CancellationException) {
                    throw error
                } catch (_: Exception) {
                    // Permission loss keeps editing closed.
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
            val revision = ++generation
            _state.value = current.copy(saving = true, saveError = null)
            viewModelScope.launch {
                try {
                    finance.refresh(managing = true)
                    if (revision != generation) return@launch
                    val result = repo.updateHomeBill(homeId, billId, request)
                    finance.require(managing = true)
                    if (revision != generation) return@launch
                    when (result) {
                        is NetworkResult.Success -> {
                            check(
                                result.data.bill.id == billId && result.data.bill.homeId == homeId &&
                                    (request.status == null || result.data.bill.status == request.status),
                            ) { "Bill change could not be verified." }
                            _state.value = current.copy(bill = result.data.bill, saving = false, saveError = null)
                            onChanged()
                            if (dismissOnSuccess) onClose()
                        }
                        is NetworkResult.Failure -> error(result.error.message)
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: IllegalStateException) {
                    if (revision == generation) {
                        val message = error.message ?: "Couldn't update this bill."
                        _state.value =
                            if (financeRights.value.canView) {
                                current.copy(saving = false, saveError = message)
                            } else {
                                BillDetailUiState.Error(message)
                            }
                    }
                }
            }
        }
    }
