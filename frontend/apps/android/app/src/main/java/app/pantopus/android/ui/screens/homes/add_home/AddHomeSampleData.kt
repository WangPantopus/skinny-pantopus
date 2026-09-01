@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import app.pantopus.android.data.api.models.homes.CheckAddressResponse

/**
 * Deterministic address fixtures for the Add Home wizard's search-first
 * entry step. These mirror the API shape the rest of the wizard consumes
 * while keeping previews and snapshots network-free.
 */
data class AddHomeAddressCandidate(
    val id: String,
    val street: String,
    val unit: String,
    val city: String,
    val state: String,
    val zipCode: String,
    val distance: String?,
    val status: AddHomeAddressStatus,
) {
    val line1: String
        get() = if (unit.isBlank()) street else "$street, $unit"

    val line2: String
        get() = "$city, $state"

    val secondaryLine: String
        get() = "$city, $state $zipCode"

    val isClaimed: Boolean
        get() = status == AddHomeAddressStatus.Claimed

    val addressFields: AddHomeAddressFields
        get() =
            AddHomeAddressFields(
                street = street,
                unit = unit,
                city = city,
                state = state,
                zipCode = zipCode,
            )
}

enum class AddHomeAddressStatus(
    val label: String,
) {
    Available("Available"),
    Claimed("Claimed"),
}

object AddHomeSampleData {
    val nearbyHomes =
        listOf(
            AddHomeAddressCandidate(
                id = "elm-412-3b",
                street = "412 Elm St",
                unit = "Apt 3B",
                city = "Brooklyn",
                state = "NY",
                zipCode = "11211",
                distance = "12 ft",
                status = AddHomeAddressStatus.Available,
            ),
            AddHomeAddressCandidate(
                id = "elm-412-3a",
                street = "412 Elm St",
                unit = "Apt 3A",
                city = "Brooklyn",
                state = "NY",
                zipCode = "11211",
                distance = "14 ft",
                status = AddHomeAddressStatus.Available,
            ),
            AddHomeAddressCandidate(
                id = "elm-412-4b",
                street = "412 Elm St",
                unit = "Apt 4B",
                city = "Brooklyn",
                state = "NY",
                zipCode = "11211",
                distance = "18 ft",
                status = AddHomeAddressStatus.Claimed,
            ),
            AddHomeAddressCandidate(
                id = "elm-414",
                street = "414 Elm St",
                unit = "",
                city = "Brooklyn",
                state = "NY",
                zipCode = "11211",
                distance = "42 ft",
                status = AddHomeAddressStatus.Available,
            ),
            AddHomeAddressCandidate(
                id = "elm-410",
                street = "410 Elm St",
                unit = "",
                city = "Brooklyn",
                state = "NY",
                zipCode = "11211",
                distance = "48 ft",
                status = AddHomeAddressStatus.Available,
            ),
        )

    val autocompleteHomes =
        listOf(
            nearbyHomes[0],
            nearbyHomes[1],
            AddHomeAddressCandidate(
                id = "cambridge-412-elm",
                street = "412 Elm Street",
                unit = "",
                city = "Cambridge",
                state = "MA",
                zipCode = "02139",
                distance = null,
                status = AddHomeAddressStatus.Available,
            ),
            AddHomeAddressCandidate(
                id = "buffalo-412-elmwood",
                street = "412 Elmwood Ave",
                unit = "",
                city = "Buffalo",
                state = "NY",
                zipCode = "14222",
                distance = null,
                status = AddHomeAddressStatus.Available,
            ),
            AddHomeAddressCandidate(
                id = "sacramento-4120-elm-ridge",
                street = "4120 Elm Ridge Rd",
                unit = "",
                city = "Sacramento",
                state = "CA",
                zipCode = "95821",
                distance = null,
                status = AddHomeAddressStatus.Available,
            ),
        )

    fun autocompleteResults(query: String): List<AddHomeAddressCandidate> {
        val needle = query.trim().lowercase()
        if (needle.isEmpty()) return emptyList()
        val terms = needle.split(" ").filter { it.isNotBlank() }
        return autocompleteHomes.filter { candidate ->
            val haystack = "${candidate.line1} ${candidate.secondaryLine}".lowercase()
            haystack.contains(needle) || terms.all { haystack.contains(it) }
        }
    }

    fun candidateFor(address: AddHomeAddressFields): AddHomeAddressCandidate? =
        nearbyHomes.firstOrNull { it.addressFields == address }
            ?: autocompleteHomes.firstOrNull { it.addressFields == address }

    private val geocodedAddress =
        AddHomeGeocodedAddress(
            street = "412 Elm Street",
            unit = "3B",
            city = "Brooklyn",
            state = "NY",
            zipCode = "11211",
            latitude = 40.7138,
            longitude = -73.9527,
            isMultiUnit = true,
        )

    private val addressCheck =
        CheckAddressResponse(
            status = CheckAddressResponse.STATUS_NOT_FOUND,
        )

    fun geocodedReadyState(): AddHomeUiState =
        AddHomeUiState(
            form =
                AddHomeFormState(
                    step = AddHomeStep.Confirm.ordinal0,
                    address =
                        AddHomeAddressFields(
                            street = "412 Elm Street",
                            unit = "3B",
                            city = "Brooklyn",
                            state = "NY",
                            zipCode = "11211",
                        ),
                ),
            homeSearchQuery = "412 Elm Street, 3B",
            addressCheck = addressCheck,
            geocodedAddress = geocodedAddress,
        )

    fun zipMismatchState(): AddHomeUiState =
        AddHomeUiState(
            form =
                AddHomeFormState(
                    step = AddHomeStep.Confirm.ordinal0,
                    address =
                        AddHomeAddressFields(
                            street = "412 Elm Street",
                            unit = "3B",
                            city = "Brooklyn",
                            state = "NY",
                            zipCode = "11201",
                        ),
                ),
            homeSearchQuery = "412 Elm Street, 3B",
            addressCheck = addressCheck,
            geocodedAddress = geocodedAddress,
        )
}
