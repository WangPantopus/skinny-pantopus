package app.pantopus.android.ui.screens.crewday

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.businesses.BusinessesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Whether the side menu shows its Business section (Crew Day's crew row): the person is an owner or a team seat on
 * at least one business. Reads the stored `GET /api/businesses/my-businesses` each time the menu opens; never while
 * the `crew_day` key is off.
 */
@HiltViewModel
class CrewDayMenuViewModel
    @Inject
    constructor(
        private val businesses: BusinessesRepository,
    ) : ViewModel() {
        private val _hasBusiness = MutableStateFlow(false)
        val hasBusiness: StateFlow<Boolean> = _hasBusiness.asStateFlow()

        fun refresh() {
            if (!LaunchFeatures.crewDay) return
            businesses.myBusinessesCopy()?.let { _hasBusiness.value = it.businesses.isNotEmpty() }
            viewModelScope.launch {
                businesses.myBusinessesStored().data?.let { _hasBusiness.value = it.businesses.isNotEmpty() }
            }
        }
    }
