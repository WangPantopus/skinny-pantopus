package app.pantopus.android.ui.screens.crewday.crew

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayBusinessResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import javax.inject.Inject

/** A business the person can run Crew Days for (owner or team seat). */
data class CrewBusiness(
    val id: String,
    val name: String,
)

sealed interface CrewDaysCrewUiState {
    data object Loading : CrewDaysCrewUiState

    /** The person is on no business's team: nothing to show here. */
    data object NoBusiness : CrewDaysCrewUiState

    data class Loaded(
        val businesses: List<CrewBusiness>,
        val businessId: String,
        val data: CrewDayBusinessResponse,
    ) : CrewDaysCrewUiState {
        val isEmpty: Boolean
            get() = listOf(data.today, data.upcoming, data.pending, data.drafts, data.past).all { it.isEmpty() }

        /** The business can start a street day: published and payouts on (documents are optional). */
        val isReady: Boolean get() = data.readiness.published && data.readiness.payoutsEnabled
    }

    data class Error(val message: String) : CrewDaysCrewUiState
}

/**
 * The crew's Crew Days (screen 13): `GET /api/crew-days/business/:businessId` for the business the menu or a link
 * named, else the person's first business (`GET /api/businesses/my-businesses`), with a picker when there are
 * several. Reads again after any Crew Day write (a new day, an approval answered elsewhere comes with a push).
 */
@HiltViewModel
class CrewDaysCrewViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        private val businessesRepository: BusinessesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val requested = savedStateHandle.get<String>(CrewDayRoutes.BUSINESS_ID_KEY).orEmpty()
        private val _state = MutableStateFlow<CrewDaysCrewUiState>(CrewDaysCrewUiState.Loading)
        val state: StateFlow<CrewDaysCrewUiState> = _state.asStateFlow()
        private var businesses: List<CrewBusiness> = emptyList()
        private var selected: String? = requested.takeIf { it.isNotBlank() }

        init {
            viewModelScope.launch { repository.changes.drop(1).collect { refresh() } }
        }

        fun load() {
            if (_state.value is CrewDaysCrewUiState.Loaded) refresh() else start()
        }

        private fun start() {
            _state.value = CrewDaysCrewUiState.Loading
            viewModelScope.launch {
                val mine = businessesRepository.myBusinessesStored().data?.businesses.orEmpty()
                businesses = mine.map { CrewBusiness(it.businessUserId, it.business.name ?: it.business.username ?: "Your business") }
                val id = selected ?: businesses.firstOrNull()?.id
                if (id == null) {
                    _state.value = CrewDaysCrewUiState.NoBusiness
                    return@launch
                }
                // A link can name a business the menu's list doesn't have yet (a seat accepted a moment ago).
                if (businesses.none { it.id == id }) businesses = businesses + CrewBusiness(id, "Your business")
                selected = id
                read(id)
            }
        }

        fun refresh() {
            val id = selected ?: return start()
            viewModelScope.launch { read(id) }
        }

        fun select(businessId: String) {
            if (businessId == selected) return
            selected = businessId
            _state.value = CrewDaysCrewUiState.Loading
            viewModelScope.launch { read(businessId) }
        }

        private suspend fun read(businessId: String) {
            when (val result = repository.business(businessId)) {
                is NetworkResult.Success ->
                    if (businessId == selected) _state.value = CrewDaysCrewUiState.Loaded(businesses, businessId, result.data)
                is NetworkResult.Failure ->
                    // A failed refresh keeps what is on screen; only a first read shows the error.
                    if ((_state.value as? CrewDaysCrewUiState.Loaded)?.businessId != businessId) {
                        _state.value = CrewDaysCrewUiState.Error(result.error.crewDayMessage)
                    }
            }
        }
    }
