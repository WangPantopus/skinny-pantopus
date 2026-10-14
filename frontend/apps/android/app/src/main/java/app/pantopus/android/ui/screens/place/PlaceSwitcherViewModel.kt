package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** A row in the "Your homes" sheet. */
data class PlaceSwitcherRow(
    val id: String,
    val line1: String,
    val subtitle: String,
    val kind: Kind,
) {
    /** [HOME] opens Your Place for it; [PENDING] (a claim or residency request in review) opens My homes. */
    enum class Kind { HOME, PENDING }
}

sealed interface PlaceSwitcherUiState {
    data object Loading : PlaceSwitcherUiState

    data class Loaded(val rows: List<PlaceSwitcherRow>) : PlaceSwitcherUiState

    data class Error(val message: String) : PlaceSwitcherUiState
}

/**
 * C2 — "Your homes", the sheet behind the address on Your Place: every Home the person can open (shared, or their
 * private setup), then the entries still waiting on verification. Mirrors the iOS `PlaceSwitcherViewModel`.
 */
@HiltViewModel
class PlaceSwitcherViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PlaceSwitcherUiState>(PlaceSwitcherUiState.Loading)
        val state: StateFlow<PlaceSwitcherUiState> = _state.asStateFlow()

        /**
         * Shows the shared My Homes copy at once (Instant Screens) and reads it again when it is out of date, so a
         * home added or left elsewhere still shows.
         */
        fun load() {
            homesRepository.myHomesCopy()?.let { _state.value = PlaceSwitcherUiState.Loaded(placeSwitcherRows(it)) }
            if (_state.value !is PlaceSwitcherUiState.Loaded) _state.value = PlaceSwitcherUiState.Loading
            viewModelScope.launch {
                val homes = homesRepository.myHomesStored()
                val data = homes.data
                when {
                    data != null -> _state.value = PlaceSwitcherUiState.Loaded(placeSwitcherRows(data))
                    _state.value !is PlaceSwitcherUiState.Loaded -> {
                        val message = homes.failure?.displayMessage(LOAD_FAILED) ?: LOAD_FAILED
                        _state.value = PlaceSwitcherUiState.Error(message)
                    }
                }
            }
        }

        private companion object {
            const val LOAD_FAILED = "Couldn't load your homes."
        }
    }

/** Homes the person can open, by address, then the entries still waiting on verification. */
internal fun placeSwitcherRows(response: MyHomesResponse): List<PlaceSwitcherRow> {
    val openable =
        response.homes
            .filter { it.isOpenablePlace }
            .map { PlaceSwitcherRow(it.id, line1For(it), subtitleFor(it), PlaceSwitcherRow.Kind.HOME) }
            .sortedWith { a, b -> compareAddresses(a.line1, b.line1) }
    val pending =
        response.homes
            .filter { it.hasValidListContext && it.accessKind == "verification" }
            .map { PlaceSwitcherRow(it.id, line1For(it), subtitleFor(it), PlaceSwitcherRow.Kind.PENDING) }
    return openable + pending
}

private fun line1For(home: MyHome): String =
    home.address?.trim()?.takeIf { it.isNotEmpty() } ?: home.name?.trim()?.takeIf { it.isNotEmpty() } ?: "Home"

/**
 * "Camas, WA · Verified" / "· Claimed" / "· Private setup"; an entry in review says where it stands instead. Verified
 * is the ownership or the residency, never `verification_tier` (that is the evidence strength).
 */
private fun subtitleFor(home: MyHome): String {
    if (home.accessKind == "verification") {
        return if (home.pendingClaimId != null) "Ownership in review" else "Verification in progress"
    }
    val verified =
        home.ownershipStatus.equals("verified", ignoreCase = true) ||
            home.occupancy?.verificationStatus.equals("verified", ignoreCase = true)
    val status =
        when {
            home.accessKind == "private_setup" -> "Private setup"
            verified -> "Verified"
            else -> "Claimed"
        }
    val city = listOfNotNull(home.city, home.state).map { it.trim() }.filter { it.isNotEmpty() }.joinToString(", ")
    return if (city.isEmpty()) status else "$city · $status"
}

/**
 * Addresses in reading order, numbers by value ("9 Elm St" before "412 Birch Ln"), letters ignoring case: the order
 * iOS's `localizedStandardCompare` gives.
 */
private fun compareAddresses(
    a: String,
    b: String,
): Int {
    val left = addressChunks.findAll(a).map { it.value }.toList()
    val right = addressChunks.findAll(b).map { it.value }.toList()
    for (index in 0 until minOf(left.size, right.size)) {
        val x = left[index]
        val y = right[index]
        val order = if (x.first().isDigit() && y.first().isDigit()) compareNumbers(x, y) else x.compareTo(y, ignoreCase = true)
        if (order != 0) return order
    }
    return left.size.compareTo(right.size)
}

/** Two runs of digits by value, without parsing (a house number can be longer than a Long). */
private fun compareNumbers(
    x: String,
    y: String,
): Int {
    val a = x.trimStart('0')
    val b = y.trimStart('0')
    return if (a.length != b.length) a.length.compareTo(b.length) else a.compareTo(b)
}

private val addressChunks = Regex("\\d+|\\D+")
