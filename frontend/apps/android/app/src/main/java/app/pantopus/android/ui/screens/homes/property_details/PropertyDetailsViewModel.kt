@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PropertyDetailsResponse
import app.pantopus.android.data.api.models.homes.PropertyHomeDto
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
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
        gates: HomeCopyGateFactory,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[PROPERTY_DETAILS_HOME_ID_KEY]) {
                "PropertyDetailsViewModel requires a '$PROPERTY_DETAILS_HOME_ID_KEY' nav arg."
            }

        private var loader: ((String) -> PropertyDetailsContent)? = null
        private val _state = MutableStateFlow<PropertyDetailsUiState>(PropertyDetailsUiState.Loading)

        /** Observed state. */
        val state: StateFlow<PropertyDetailsUiState> = _state.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate = gates.create(homeId, listOf(StoreKeys.homePropertyDetails(homeId)))
        private var readGeneration = 0L

        /** Preview/test constructor — injects a synchronous loader seam. */
        internal constructor(
            savedStateHandle: SavedStateHandle,
            homesRepository: HomesRepository,
            gates: HomeCopyGateFactory,
            loader: (String) -> PropertyDetailsContent,
        ) : this(savedStateHandle, homesRepository, gates) {
            this.loader = loader
        }

        /**
         * Screen entry and every return (Instant Screens): owners and household roles see the stored facts at once,
         * and the store answers a fresh copy without a request or revalidates an older one quietly.
         */
        fun load() {
            if (loader != null) {
                if (_state.value is PropertyDetailsUiState.Loading) apply()
                return
            }
            if (_state.value is PropertyDetailsUiState.Loading && gate.showsCopy) {
                homesRepository.storedPropertyDetails(homeId)?.let { _state.value = projection(contentFrom(it.home)) }
            }
            read(force = false)
        }

        /** Retry after an error: read now. */
        fun refresh() {
            if (loader != null) apply() else read(force = true)
        }

        override fun onCleared() {
            gate.leave()
        }

        private fun apply() {
            val seam = loader ?: return
            _state.value =
                try {
                    projection(seam(homeId))
                } catch (_: Exception) {
                    PropertyDetailsUiState.Error("Couldn't load property details. Pull to retry.")
                }
        }

        private fun read(force: Boolean) {
            val generation = ++readGeneration
            if (_state.value is PropertyDetailsUiState.Error) _state.value = PropertyDetailsUiState.Loading
            viewModelScope.launch {
                val fromCopy = gate.showsCopy && !force
                var stored = readDetails(force = !fromCopy)
                // Household access ended meanwhile: whatever came from a copy is read again now.
                if (fromCopy && !gate.showsCopy) stored = readDetails(force = true)
                if (generation != readGeneration) return@launch
                _state.value =
                    stored.data?.let { projection(contentFrom(it.home)) }
                        ?: PropertyDetailsUiState.Error("Couldn't load property details. Pull to retry.")
                _refreshNotice.value = RefreshNotice(stored.fetchedAt, ::refresh).takeIf { stored.showsRefreshFailure(StoreKind.HOMES) }
            }
        }

        private suspend fun readDetails(force: Boolean): Stored<PropertyDetailsResponse> =
            coroutineScope {
                val recheck = async { gate.recheck(force) }
                val details = async { homesRepository.propertyDetailsStored(homeId, force) }
                recheck.await()
                details.await()
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
                            add(PropertyFactRow(id = "interior", label = "Interior", value = sqFtText(it), mono = true))
                        }
                        home.lotSqFt?.let {
                            add(PropertyFactRow(id = "lot", label = "Lot", value = sqFtText(it), mono = true))
                        }
                    }

                return PropertyDetailsContent(
                    address =
                        PropertyAddress(
                            line1 = line1.ifEmpty { "Address unavailable" },
                            line2 = line2,
                            latitude = home.location?.latitude,
                            longitude = home.location?.longitude,
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

/** "45000 sq ft" with the locale's digit grouping ("45,000 sq ft"). */
private fun sqFtText(value: Number): String = "${NumberFormat.getIntegerInstance().format(value)} sq ft"
