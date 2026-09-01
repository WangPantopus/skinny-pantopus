@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PropertyHomeDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

const val PROPERTY_DETAILS_HOME_ID_KEY = "homeId"

/**
 * ViewModel for the read-mostly Property Details screen. Reads the home's
 * property fields from `GET /api/homes/:id/property-details` (route
 * `backend/routes/home.js:2991`) and projects them into the clean state.
 * Only the property facts + address are backed; the Records (ATTOM) and
 * Verification (provenance) sections + the mismatch banner have no clean
 * backend source. An injectable [loader] seam (non-null) bypasses the
 * network for previews + tests.
 */
@HiltViewModel
class PropertyDetailsViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val homesRepository: HomesRepository,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[PROPERTY_DETAILS_HOME_ID_KEY]) {
                "PropertyDetailsViewModel requires a '$PROPERTY_DETAILS_HOME_ID_KEY' nav arg."
            }

        private var loader: ((String) -> PropertyDetailsContent)? = null
        private val _state = MutableStateFlow<PropertyDetailsUiState>(PropertyDetailsUiState.Loading)

        /** Observed state. */
        val state: StateFlow<PropertyDetailsUiState> = _state.asStateFlow()

        /** Preview/test constructor — injects a synchronous loader seam. */
        internal constructor(
            savedStateHandle: SavedStateHandle,
            homesRepository: HomesRepository,
            loader: (String) -> PropertyDetailsContent,
        ) : this(savedStateHandle, homesRepository) {
            this.loader = loader
        }

        /** Initial load; no-op after content resolves. */
        fun load() {
            if (_state.value !is PropertyDetailsUiState.Loading) return
            apply()
        }

        /** Retry after an error. */
        fun refresh() {
            apply()
        }

        private fun apply() {
            val seam = loader
            if (seam != null) {
                _state.value =
                    try {
                        projection(seam(homeId))
                    } catch (_: Exception) {
                        PropertyDetailsUiState.Error("Couldn't load property details. Pull to retry.")
                    }
                return
            }
            viewModelScope.launch {
                _state.value =
                    when (val result = homesRepository.propertyDetails(homeId)) {
                        is NetworkResult.Success -> projection(contentFrom(result.data.home))
                        is NetworkResult.Failure ->
                            PropertyDetailsUiState.Error("Couldn't load property details. Pull to retry.")
                    }
            }
        }

        private fun projection(content: PropertyDetailsContent): PropertyDetailsUiState =
            if (content.banner == null) {
                PropertyDetailsUiState.Clean(content)
            } else {
                PropertyDetailsUiState.Mismatch(content)
            }

        companion object {
            /**
             * Map the backend `home` onto the screen's projection. Records +
             * Verification stay empty (no clean source) and the banner is
             * never raised from the backend, so this always yields the clean
             * state. Mirrors iOS `PropertyDetailsViewModel.content(from:)`.
             */
            fun contentFrom(home: PropertyHomeDto): PropertyDetailsContent {
                val line1 =
                    listOfNotNull(home.address?.nonBlank(), home.unitNumber?.nonBlank())
                        .joinToString(" · ")
                val stateZip =
                    listOfNotNull(home.state?.nonBlank(), (home.zipcode ?: home.zipCode)?.nonBlank())
                        .joinToString(" ")
                val line2 =
                    listOfNotNull(home.city?.nonBlank(), stateZip.nonBlank())
                        .joinToString(", ")

                val facts =
                    buildList {
                        home.homeType?.nonBlank()?.let {
                            add(PropertyFactRow(id = "type", label = "Type", value = humanize(it)))
                        }
                        home.yearBuilt?.let {
                            add(PropertyFactRow(id = "year", label = "Year built", value = it.toString(), mono = true))
                        }
                        home.bedrooms?.let {
                            add(PropertyFactRow(id = "beds", label = "Bedrooms", value = it.toString(), mono = true))
                        }
                        home.bathrooms?.let {
                            add(PropertyFactRow(id = "baths", label = "Bathrooms", value = formatBaths(it), mono = true))
                        }
                        home.sqFt?.let {
                            add(PropertyFactRow(id = "interior", label = "Interior", value = "$it sq ft", mono = true))
                        }
                        home.lotSqFt?.let {
                            add(PropertyFactRow(id = "lot", label = "Lot", value = "$it sq ft", mono = true))
                        }
                    }

                return PropertyDetailsContent(
                    address =
                        PropertyAddress(
                            line1 = line1.ifEmpty { "Address unavailable" },
                            line2 = line2,
                            latitude = home.location?.latitude ?: 0.0,
                            longitude = home.location?.longitude ?: 0.0,
                        ),
                    propertyFacts = facts,
                    records = emptyList(),
                    verification = emptyList(),
                    banner = null,
                )
            }

            private fun humanize(raw: String): String =
                raw.replace('_', ' ')
                    .replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() }

            private fun formatBaths(value: Double): String = if (value % 1.0 == 0.0) value.toInt().toString() else value.toString()

            private fun String.nonBlank(): String? = trim().ifEmpty { null }
        }
    }
