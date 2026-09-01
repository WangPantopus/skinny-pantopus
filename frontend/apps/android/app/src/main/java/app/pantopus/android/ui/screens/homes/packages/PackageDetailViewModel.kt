@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.packages

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PackageDto
import app.pantopus.android.data.api.models.homes.UpdatePackageRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg keys for the Package detail route. */
const val PACKAGE_DETAIL_HOME_ID_KEY = "homeId"
const val PACKAGE_DETAIL_PACKAGE_ID_KEY = "packageId"

/** UI state for the Package Detail screen. */
sealed interface PackageDetailUiState {
    data object Loading : PackageDetailUiState

    data class Loaded(
        val pkg: PackageDto,
        val saving: Boolean = false,
        val saveError: String? = null,
    ) : PackageDetailUiState

    data class Error(val message: String) : PackageDetailUiState
}

/** ViewModel backing [PackageDetailScreen]. */
@HiltViewModel
class PackageDetailViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle[PACKAGE_DETAIL_HOME_ID_KEY]) {
                "PackageDetailViewModel requires a $PACKAGE_DETAIL_HOME_ID_KEY nav argument"
            }
        private val packageId: String =
            checkNotNull(savedStateHandle[PACKAGE_DETAIL_PACKAGE_ID_KEY]) {
                "PackageDetailViewModel requires a $PACKAGE_DETAIL_PACKAGE_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<PackageDetailUiState>(PackageDetailUiState.Loading)
        val state: StateFlow<PackageDetailUiState> = _state.asStateFlow()

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
            _state.value = PackageDetailUiState.Loading
            viewModelScope.launch {
                // Backend has no GET-by-id for packages — fetch the
                // parent list and find by id (lists are small).
                when (val result = repo.getHomePackages(homeId)) {
                    is NetworkResult.Failure ->
                        _state.value = PackageDetailUiState.Error(result.error.displayMessage("Couldn't load this package."))
                    is NetworkResult.Success -> {
                        val pkg = result.data.packages.firstOrNull { it.id == packageId }
                        if (pkg == null) {
                            _state.value =
                                PackageDetailUiState.Error("This package is no longer available.")
                        } else {
                            _state.value = PackageDetailUiState.Loaded(pkg)
                        }
                    }
                }
            }
        }

        fun markPickedUp() {
            update(UpdatePackageRequest(status = "picked_up"))
        }

        fun markMissing() {
            update(UpdatePackageRequest(status = "lost"))
        }

        /** Soft-remove — backend has no DELETE handler today. */
        fun remove() {
            update(UpdatePackageRequest(status = "returned"), closeOnSuccess = true)
        }

        private fun update(
            request: UpdatePackageRequest,
            closeOnSuccess: Boolean = false,
        ) {
            val current = _state.value as? PackageDetailUiState.Loaded ?: return
            if (current.saving) return
            _state.value = current.copy(saving = true, saveError = null)
            viewModelScope.launch {
                when (val result = repo.updateHomePackage(homeId, packageId, request)) {
                    is NetworkResult.Success -> {
                        onChanged()
                        _state.value = current.copy(pkg = result.data.`package`, saving = false)
                        if (closeOnSuccess) onClose()
                    }
                    is NetworkResult.Failure ->
                        _state.value = current.copy(saving = false, saveError = result.error.message)
                }
            }
        }
    }
