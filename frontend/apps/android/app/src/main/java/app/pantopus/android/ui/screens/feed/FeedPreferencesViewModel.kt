@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.feed.FeedPreferencesDto
import app.pantopus.android.data.api.models.feed.FeedPreferencesUpdateRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.feed.FeedActionsRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.RefreshNotice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Render state for the Pulse preferences sheet. */
sealed interface FeedPreferencesUiState {
    data object Loading : FeedPreferencesUiState

    data class Loaded(
        val preferences: FeedPreferencesDto,
    ) : FeedPreferencesUiState

    data class Error(
        val message: String,
    ) : FeedPreferencesUiState
}

/**
 * Loads + patches the signed-in user's feed preferences. Mirrors RN
 * `src/components/feed/FeedPreferencesSheet.tsx` and the iOS
 * `FeedPreferencesViewModel`, backed by
 * `GET`/`PUT /api/posts/feed-preferences`.
 */
@HiltViewModel
class FeedPreferencesViewModel
    @Inject
    constructor(
        private val repo: FeedActionsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<FeedPreferencesUiState>(FeedPreferencesUiState.Loading)
        val state: StateFlow<FeedPreferencesUiState> = _state.asStateFlow()

        /** True while a `PUT` is in flight — disables the rows. */
        private val _isSaving = MutableStateFlow(false)
        val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

        /** Transient error banner text. */
        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private var loading = false
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        fun load() = read(force = false)

        fun refresh() = read(force = true)

        private fun read(force: Boolean) {
            if (loading || _isSaving.value) return
            loading = true
            if (_state.value !is FeedPreferencesUiState.Loaded) {
                _state.value = repo.feedPreferencesCopy().data?.let { FeedPreferencesUiState.Loaded(it.preferences) }
                    ?: FeedPreferencesUiState.Loading
            }
            viewModelScope.launch {
                try {
                    val result = repo.feedPreferences(force)
                    val copy = repo.feedPreferencesCopy()
                    _refreshNotice.value = if (copy.showsRefreshFailure(StoreKind.YOU)) RefreshNotice(copy.fetchedAt, ::refresh) else null
                    // A preference tap while this quiet read ran owns the newer local value.
                    if (_isSaving.value) return@launch
                    when (result) {
                        is NetworkResult.Success -> _state.value = FeedPreferencesUiState.Loaded(result.data.preferences)
                        is NetworkResult.Failure -> {
                            val refused =
                                result.error is NetworkError.Forbidden ||
                                    result.error == NetworkError.NotFound ||
                                    result.error == NetworkError.Unauthorized
                            if (refused || _state.value !is FeedPreferencesUiState.Loaded) {
                                _state.value = FeedPreferencesUiState.Error(result.error.displayMessage("Couldn't load preferences."))
                            }
                        }
                    }
                } finally {
                    loading = false
                }
            }
        }

        fun dismissToast() {
            _toastMessage.value = null
        }

        /**
         * Show / hide local business deals on the Place surface. The backend
         * column is `hide_deals_place`, so the switch is inverted.
         */
        fun setShowDeals(show: Boolean) = update(FeedPreferencesUpdateRequest(hideDealsPlace = !show))

        /** Show / hide safety alerts on the Place surface. */
        fun setShowAlerts(show: Boolean) = update(FeedPreferencesUpdateRequest(hideAlertsPlace = !show))

        /**
         * One switch writes both political-content columns — RN does the
         * same (`FeedPreferencesSheet.tsx:112-115`).
         */
        fun setShowPolitics(show: Boolean) =
            update(
                FeedPreferencesUpdateRequest(
                    showPoliticsConnections = show,
                    showPoliticsPlace = show,
                ),
            )

        private fun update(body: FeedPreferencesUpdateRequest) {
            val current = (_state.value as? FeedPreferencesUiState.Loaded)?.preferences ?: return
            if (_isSaving.value) return
            _isSaving.value = true
            // Optimistic — the row reflects the tap straight away.
            _state.value = FeedPreferencesUiState.Loaded(merged(current, body))
            viewModelScope.launch {
                try {
                    when (val result = repo.updateFeedPreferences(body)) {
                        is NetworkResult.Success ->
                            _state.value = FeedPreferencesUiState.Loaded(result.data.preferences)
                        is NetworkResult.Failure -> {
                            _state.value = FeedPreferencesUiState.Loaded(current)
                            _toastMessage.value = "Couldn't save that preference."
                        }
                    }
                } finally {
                    _isSaving.value = false
                }
            }
        }

        private fun merged(
            current: FeedPreferencesDto,
            patch: FeedPreferencesUpdateRequest,
        ): FeedPreferencesDto =
            current.copy(
                hideDealsPlace = patch.hideDealsPlace ?: current.hideDealsPlace,
                hideAlertsPlace = patch.hideAlertsPlace ?: current.hideAlertsPlace,
                showPoliticsConnections = patch.showPoliticsConnections ?: current.showPoliticsConnections,
                showPoliticsPlace = patch.showPoliticsPlace ?: current.showPoliticsPlace,
            )
    }
