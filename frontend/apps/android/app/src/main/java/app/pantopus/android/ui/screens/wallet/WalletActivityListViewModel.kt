@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.wallet.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** WS5.1 — full wallet transaction history. */
sealed interface WalletActivityListUiState {
    data object Loading : WalletActivityListUiState

    data class Loaded(val items: List<WalletActivityItem>) : WalletActivityListUiState

    data object Empty : WalletActivityListUiState

    data class Error(val message: String) : WalletActivityListUiState
}

@HiltViewModel
class WalletActivityListViewModel
    @Inject
    constructor(
        private val repository: WalletRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<WalletActivityListUiState>(WalletActivityListUiState.Loading)
        val state: StateFlow<WalletActivityListUiState> = _state.asStateFlow()

        val title: String = "Activity"

        private var offset = 0
        private var hasMore = true
        private var isFetching = false

        /**
         * Bumped on every reset fetch. An in-flight page fetch whose
         * generation no longer matches is stale — its rows are dropped so a
         * refresh overlapping a page load can't corrupt [offset].
         */
        private var generation = 0
        private val items = mutableListOf<WalletActivityItem>()

        fun load() {
            if (_state.value is WalletActivityListUiState.Loaded) return
            fetch(reset = true)
        }

        fun refresh() {
            fetch(reset = true)
        }

        fun loadMoreIfNeeded(currentItemId: String?) {
            if (!hasMore || isFetching || currentItemId == null) return
            if (items.lastOrNull()?.id != currentItemId) return
            fetch(reset = false)
        }

        private fun fetch(reset: Boolean) {
            if (reset) {
                generation += 1
                offset = 0
                hasMore = true
                items.clear()
                _state.value = WalletActivityListUiState.Loading
            }
            val fetchGeneration = generation
            isFetching = true
            viewModelScope.launch {
                val result = repository.transactions(limit = PAGE_SIZE, offset = offset)
                if (fetchGeneration != generation) return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        val mapped = result.data.transactions.map { WalletMapper.activityItem(it) }
                        if (reset) {
                            items.clear()
                        }
                        items.addAll(mapped)
                        offset += mapped.size
                        hasMore = mapped.size >= PAGE_SIZE
                        _state.value =
                            if (items.isEmpty()) {
                                WalletActivityListUiState.Empty
                            } else {
                                WalletActivityListUiState.Loaded(items.toList())
                            }
                    }
                    is NetworkResult.Failure -> {
                        val message = result.error.displayMessage("Couldn't load activity.")
                        _state.value =
                            if (reset && items.isEmpty()) {
                                WalletActivityListUiState.Error(message)
                            } else {
                                _state.value
                            }
                    }
                }
                isFetching = false
            }
        }

        companion object {
            /** Transactions requested per page — mirrors iOS `WalletActivityListViewModel`. */
            private const val PAGE_SIZE = 50
        }
    }
