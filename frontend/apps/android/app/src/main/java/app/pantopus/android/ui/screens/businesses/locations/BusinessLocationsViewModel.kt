@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.locations

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessLocationDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg key for the business UUID. */
const val BUSINESS_LOCATIONS_BUSINESS_ID_KEY = "businessId"

/**
 * Owner/staff Locations & Hours list MVP. Reads
 * `GET /api/businesses/:businessId/locations`. Add-location form is a
 * follow-up.
 */
@HiltViewModel
class BusinessLocationsViewModel
    @Inject
    constructor(
        private val businesses: BusinessesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String =
            requireNotNull(savedStateHandle[BUSINESS_LOCATIONS_BUSINESS_ID_KEY]) {
                "BusinessLocationsViewModel requires a '$BUSINESS_LOCATIONS_BUSINESS_ID_KEY' nav arg."
            }

        val title: String = "Locations & Hours"

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        fun load() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun refresh() = load()

        private suspend fun fetch() {
            when (val result = businesses.locations(businessId)) {
                is NetworkResult.Success -> rebuild(result.data.locations)
                is NetworkResult.Failure -> {
                    _state.value = ListOfRowsUiState.Error("Couldn't load locations. Pull to retry.")
                }
            }
        }

        private fun rebuild(locations: List<BusinessLocationDto>) {
            if (locations.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.MapPin,
                        headline = "No locations yet",
                        subcopy =
                            "Add a storefront or service area so neighbors know where to find you.",
                        tint = PantopusColors.businessBg,
                        accent = PantopusColors.business,
                    )
                return
            }
            val rows =
                locations.map { location ->
                    val isPrimary = location.isPrimary == true
                    RowModel(
                        id = location.id,
                        title = displayTitle(location),
                        subtitle = subtitle(location),
                        template = if (isPrimary) RowTemplate.StatusChip else RowTemplate.FileChevron,
                        leading =
                            RowLeading.TypeIcon(
                                icon = PantopusIcon.MapPin,
                                background = PantopusColors.businessBg,
                                foreground = PantopusColors.business,
                            ),
                        trailing =
                            if (isPrimary) {
                                RowTrailing.Status(text = "Primary", variant = StatusChipVariant.Business)
                            } else {
                                RowTrailing.Chevron
                            },
                    )
                }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections =
                        listOf(
                            RowSection(
                                id = "locations",
                                header = "Locations · ${locations.size}",
                                rows = rows,
                            ),
                        ),
                    hasMore = false,
                )
        }

        private fun displayTitle(location: BusinessLocationDto): String =
            location.label?.trimmedNonEmpty()
                ?: location.city?.trimmedNonEmpty()
                ?: location.address?.trimmedNonEmpty()
                ?: "Location"

        private fun subtitle(location: BusinessLocationDto): String? {
            val parts = mutableListOf<String>()
            location.address?.trimmedNonEmpty()?.let(parts::add)
            val locality =
                listOfNotNull(location.city?.trimmedNonEmpty(), location.state?.trimmedNonEmpty())
                    .joinToString(", ")
            if (locality.isNotEmpty()) parts.add(locality)
            location.zipcode?.trimmedNonEmpty()?.let(parts::add)
            return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
        }

        private fun String.trimmedNonEmpty(): String? = trim().takeIf { it.isNotEmpty() }
    }
