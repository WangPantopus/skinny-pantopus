package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** A place row in the switcher sheet. */
data class PlaceSwitcherRow(
    val id: String,
    val line1: String,
    val city: String,
    val isVerified: Boolean,
    val initials: String,
)

sealed interface PlaceSwitcherUiState {
    data object Loading : PlaceSwitcherUiState

    data class Loaded(val rows: List<PlaceSwitcherRow>) : PlaceSwitcherUiState

    data class Error(val message: String) : PlaceSwitcherUiState
}

/**
 * C2 — the multi-home switcher. Lists the resident's places with their
 * verified/claimed status. Mirrors the iOS `PlaceSwitcherViewModel`.
 */
@HiltViewModel
class PlaceSwitcherViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PlaceSwitcherUiState>(PlaceSwitcherUiState.Loading)
        val state: StateFlow<PlaceSwitcherUiState> = _state.asStateFlow()

        fun load() {
            if (_state.value is PlaceSwitcherUiState.Loaded) return
            _state.value = PlaceSwitcherUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val result = homesRepository.myHomes()) {
                        is NetworkResult.Success ->
                            PlaceSwitcherUiState.Loaded(result.data.homes.map(::rowFor))
                        is NetworkResult.Failure -> PlaceSwitcherUiState.Error(result.error.displayMessage("Couldn't load homes."))
                    }
            }
        }

        private fun rowFor(home: MyHome): PlaceSwitcherRow {
            val line1 = home.address ?: home.name ?: "A place"
            val city = listOfNotNull(home.city, home.state).filter { it.isNotBlank() }.joinToString(", ")
            return PlaceSwitcherRow(
                id = home.id,
                line1 = line1,
                city = city,
                isVerified = home.verificationTier?.lowercase() == "verified",
                initials = initials(line1),
            )
        }

        private fun initials(label: String): String {
            val letters =
                label
                    .split(' ', ',')
                    .filter { it.firstOrNull()?.isLetter() == true }
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.toString() }
            return if (letters.isEmpty()) "PL" else letters.joinToString("").uppercase()
        }
    }
