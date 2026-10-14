package app.pantopus.android.ui.screens.pulse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.pulse.PulseAreaDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.pulse.PulseRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface PulseAreaPickerState {
    data object Loading : PulseAreaPickerState

    data object Empty : PulseAreaPickerState

    data class Loaded(val choices: List<PulseAreaChoice>) : PulseAreaPickerState

    data class Error(val message: String) : PulseAreaPickerState
}

/** Reads only the coarse areas published by PB; no GPS lookup or inferred home eligibility. */
@HiltViewModel
class PulseAreaPickerViewModel
    @Inject
    constructor(private val repository: PulseRepository) : ViewModel() {
        private val _state = MutableStateFlow<PulseAreaPickerState>(PulseAreaPickerState.Loading)
        val state = _state.asStateFlow()
        private val _searching = MutableStateFlow(false)
        val searching = _searching.asStateFlow()
        private val _query = MutableStateFlow("")
        val query = _query.asStateFlow()
        private var request: Job? = null
        private var generation = 0
        private var homeTownId: String? = null

        fun open() {
            _searching.value = false
            _query.value = ""
            homeTownId = null
            refresh()
        }

        fun browseTowns() {
            _searching.value = true
            _query.value = ""
            refresh()
        }

        fun search(text: String) {
            val next = text.take(MAX_QUERY_LENGTH)
            if (next == _query.value) return
            _query.value = next
            read(debounce = true)
        }

        fun refresh() = read(debounce = false)

        fun dismiss() {
            generation++
            request?.cancel()
        }

        private fun read(debounce: Boolean) {
            request?.cancel()
            val ticket = ++generation
            val towns = _searching.value
            val query = _query.value.trim()
            _state.value = PulseAreaPickerState.Loading
            request =
                viewModelScope.launch {
                    if (debounce) delay(SEARCH_DELAY_MS)
                    val next = if (towns) readTowns(query) else readMine()
                    if (ticket == generation) _state.value = next
                }
        }

        private suspend fun readMine(): PulseAreaPickerState =
            when (val result = repository.myAreas()) {
                is NetworkResult.Success -> {
                    homeTownId = result.data.town?.id
                    // Smaller areas are private. A partial/missing verification response cannot grant access.
                    val smaller =
                        if (result.data.homeVerified == true) {
                            listOfNotNull(
                                result.data.neighborhood,
                                result.data.street,
                            )
                        } else {
                            emptyList()
                        }
                    choices(listOfNotNull(result.data.town) + smaller)
                }
                is NetworkResult.Failure -> PulseAreaPickerState.Error(result.error.displayMessage("Couldn't load your areas."))
            }

        private suspend fun readTowns(query: String): PulseAreaPickerState =
            when (val result = repository.searchAreas(query)) {
                is NetworkResult.Success -> choices(result.data.areas.orEmpty().filter { it.kind == "town" })
                is NetworkResult.Failure -> PulseAreaPickerState.Error(result.error.displayMessage("Couldn't find towns."))
            }

        private fun choices(areas: List<PulseAreaDto>): PulseAreaPickerState {
            val rows =
                areas.mapNotNull { area ->
                    val id = area.id?.takeIf(String::isNotBlank) ?: return@mapNotNull null
                    val name =
                        area.title?.takeIf(String::isNotBlank)
                            ?: area.name?.takeIf(String::isNotBlank)
                            ?: return@mapNotNull null
                    PulseAreaChoice(id.takeUnless { it == homeTownId }, name)
                }.distinctBy { it.id }
            return if (rows.isEmpty()) PulseAreaPickerState.Empty else PulseAreaPickerState.Loaded(rows)
        }

        private companion object {
            const val MAX_QUERY_LENGTH = 80
            const val SEARCH_DELAY_MS = 300L
        }
    }
