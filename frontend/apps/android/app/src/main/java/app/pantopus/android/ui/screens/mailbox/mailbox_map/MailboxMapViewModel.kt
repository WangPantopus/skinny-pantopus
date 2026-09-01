@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.MapPinDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridDetent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

/**
 * A11.4 Mailbox map view-model. Owns the sheet detent, the active
 * category-chip filter, and the pin↔detail selection link. Mirrors the iOS
 * `MailboxMapViewModel`.
 *
 * DOMAIN CAVEAT (BLOCK 3E): the *screen* is a venue directory (post offices /
 * drop boxes / lockers / carriers, with operating hours + services), but the
 * only backend "map" route is `GET /api/mailbox/v2/p3/map/pins`, which returns
 * `HomeMapPin` rows — household/neighborhood annotations (permits, deliveries,
 * notices, civic alerts). Those are a *different feature*; there is no
 * venue-directory backend. Per the explicit instruction to wire the named
 * endpoint, [load] fetches pins and projects them into [MailboxSpot] lossily
 * (no hours/services; synthetic pin positions).
 *
 * No pins → `Populated(emptyList())` (the sheet renders its inline empty
 * note); a transport failure → [MailboxMapUiState.Error] with Retry. The
 * [MailboxMapSampleData] directory is a preview / snapshot seam only — it used
 * to be the empty/failure fallback, which surfaced fixtures as if they were
 * live venues and left the Empty + Error frames unreachable. iOS
 * `MailboxMapViewModel` mirrors this exactly.
 *
 * The production seam is the [Inject] constructor (Hilt supplies the
 * repository); the `internal constructor(spots, seededState, todayWeekday)` is
 * the test / preview seam (no repository → the existing sample behavior,
 * synchronous so tests need no Main dispatcher).
 */
@HiltViewModel
class MailboxMapViewModel
    @Inject
    constructor(
        private val repository: MailboxRepository?,
    ) : ViewModel() {
        private var allSpots: List<MailboxSpot> = MailboxMapSampleData.spots
        private var seededState: MailboxMapUiState? = null

        /** Working set the screen filters / selects against — sample, or live pins. */
        private var workingSpots: List<MailboxSpot> = MailboxMapSampleData.spots

        /**
         * Current weekday (`Calendar` convention, 1 = Sun … 7 = Sat) used to
         * highlight the week-hour strip. Injected so previews + tests stay
         * deterministic.
         */
        var todayWeekday: Int = defaultWeekday()
            private set

        /** Test / preview seam (mirrors iOS `init(spots:seededState:todayWeekday:)`). */
        internal constructor(
            spots: List<MailboxSpot> = MailboxMapSampleData.spots,
            seededState: MailboxMapUiState? = null,
            todayWeekday: Int = defaultWeekday(),
        ) : this(null) {
            this.allSpots = spots
            this.seededState = seededState
            this.todayWeekday = todayWeekday
        }

        private val _state = MutableStateFlow<MailboxMapUiState>(MailboxMapUiState.Loading)

        /** Current render state. Mutated through [load] / [select] / [backToList]. */
        val state: StateFlow<MailboxMapUiState> = _state.asStateFlow()

        private val _detent = MutableStateFlow(MapListHybridDetent.Standard)

        /** Sheet detent for the populated rail (A11 archetype contract). */
        val detent: StateFlow<MapListHybridDetent> = _detent.asStateFlow()

        private val _activeKind = MutableStateFlow<MailboxSpotKind?>(null)

        /** Active category chip; `null` is the "All" sentinel. */
        val activeKind: StateFlow<MailboxSpotKind?> = _activeKind.asStateFlow()

        /**
         * Surface the spots. A seeded state wins (previews / error frames);
         * without a repository the seeded spots are projected synchronously;
         * with one, `/map/pins` is fetched and projected — an empty list stays
         * empty and a failure surfaces the Error frame.
         */
        fun load() {
            val seeded = seededState
            if (seeded != null) {
                workingSpots = allSpots
                _state.value = seeded
                return
            }
            val repo = repository
            if (repo == null) {
                workingSpots = allSpots
                _state.value = MailboxMapUiState.Populated(filtered(allSpots))
                return
            }
            _state.value = MailboxMapUiState.Loading
            viewModelScope.launch {
                when (val result = repo.mapPins()) {
                    is NetworkResult.Success -> {
                        val spots = result.data.pins.map { it.toSpot() }
                        workingSpots = spots
                        _state.value = MailboxMapUiState.Populated(filtered(spots))
                    }
                    is NetworkResult.Failure -> {
                        workingSpots = emptyList()
                        _state.value =
                            MailboxMapUiState.Error(
                                result.error.displayMessage("Couldn't load mailbox spots."),
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        /**
         * Tap a pin / rail card → pin-detail. The full spot list rides along so
         * the context strip can keep drawing dimmed pins. The category filter is
         * left untouched — the selected frame's chip highlight follows the
         * spot's kind purely in the view, so "Back to list" restores whatever
         * filter the user had.
         */
        fun select(id: String) {
            val spot = workingSpots.firstOrNull { it.id == id } ?: return
            _state.value = MailboxMapUiState.Selected(spot = spot, spots = workingSpots)
        }

        /** "Back to list" → restore the populated rail under the current filter. */
        fun backToList() {
            _state.value = MailboxMapUiState.Populated(filtered(workingSpots))
        }

        /**
         * Category-chip tap. Applies the filter and surfaces the populated rail
         * — also the way "back to list" works when a chip is tapped from an open
         * detail panel.
         */
        fun selectKind(kind: MailboxSpotKind?) {
            _activeKind.value = kind
            _state.value = MailboxMapUiState.Populated(filtered(workingSpots))
        }

        fun setDetent(detent: MapListHybridDetent) {
            _detent.value = detent
        }

        private fun filtered(spots: List<MailboxSpot>): List<MailboxSpot> {
            val kind = _activeKind.value ?: return spots
            return spots.filter { it.kind == kind }
        }

        private companion object {
            fun defaultWeekday(): Int = Calendar.getInstance().get(Calendar.DAY_OF_WEEK)
        }
    }

// ── HomeMapPin → MailboxSpot projection (lossy; see DOMAIN CAVEAT above) ──

private const val PIN_FRACTION_MIN = 0.15f
private const val PIN_FRACTION_SPAN = 70
private const val PIN_FRACTION_DENOM = 100f

/** Best-effort `pin_type` → venue kind. Only `civic` overlaps cleanly. */
private fun spotKindFor(pinType: String?): MailboxSpotKind =
    when (pinType) {
        "delivery" -> MailboxSpotKind.Carrier
        "civic", "permit", "notice", "utility_work", "community" -> MailboxSpotKind.Civic
        else -> MailboxSpotKind.Drop
    }

private fun MapPinDto.toSpot(): MailboxSpot =
    MailboxSpot(
        id = id,
        kind = spotKindFor(pinType),
        name = title ?: "Map pin",
        address = body ?: "",
        isOpen = true,
        hoursLabel = "",
        statusLabel = visibleTo ?: "",
        walkLabel = "",
        lastPickupLabel = null,
        services = emptyList(),
        weekHours = emptyList(),
        // No geo→canvas projection exists for this stylized map; spread pins
        // deterministically by id so they don't overlap.
        mapX = PIN_FRACTION_MIN + id.hashCode().mod(PIN_FRACTION_SPAN) / PIN_FRACTION_DENOM,
        mapY = PIN_FRACTION_MIN + (id + "y").hashCode().mod(PIN_FRACTION_SPAN) / PIN_FRACTION_DENOM,
    )
