package app.pantopus.android.ui.screens.place.today

import android.app.KeyguardManager
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.analytics.PilotEvents
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.data.hub.NotificationPreferencesRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.data.widget.TodayWidgetStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskCreationFactory
import app.pantopus.android.ui.screens.place.detail.AddressCalendarActions
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.net.HttpURLConnection.HTTP_CONFLICT
import java.time.ZoneId
import javax.inject.Inject
import kotlin.math.abs

private const val SAVED_ANCHOR_TOLERANCE = 0.000001

/**
 * The Today tab (Wedge v2 D2): the primary home's Today group — weather,
 * air, alerts, sun, and the address calendar — as a tab root instead of
 * a detail page. Resolves the primary home the same way the Place tab
 * does (`/api/homes/my-homes`, `is_primary_owner` first). Mirrors the
 * iOS `TodayTabRoot`.
 */
@HiltViewModel
class TodayTabViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
        private val repo: PlaceRepository,
        private val savedPlacesRepository: SavedPlacesRepository,
        private val hubRepository: HubRepository,
        private val preferencesRepository: NotificationPreferencesRepository,
        sessionScopes: HomeClaimSessionScopeFactory,
        private val appLock: AppLockManager,
        @ApplicationContext context: Context,
        val radonFactory: HomeTaskCreationFactory,
    ) : ViewModel(),
        AddressCalendarActions {
        @Inject lateinit var pilotEvents: PilotEvents

        /** The home-screen widget shows what Today last showed (unit tests build this without Hilt). */
        @Inject lateinit var todayWidget: TodayWidgetStore

        private val _state = MutableStateFlow<TodayTabUiState>(TodayTabUiState.Loading)
        val state: StateFlow<TodayTabUiState> = _state.asStateFlow()
        private var homeId: String? = null
        override val calendarHomeId: String? get() = homeId
        val radonContext: suspend () -> Unit
            get() {
                val id = homeId
                val version = loadVersion
                return { check(id != null && pickupCurrent(id, version)) }
            }
        private var loadJob: Job? = null
        private var loadVersion = 0L
        private val sessionScope = sessionScopes.create(viewModelScope)
        private val keyguard = context.getSystemService(KeyguardManager::class.java)
        private var promptAttempted = false
        private var promptConfirmed = false
        private val _showMorningCard = MutableStateFlow(false)
        val showMorningCard = _showMorningCard.asStateFlow()
        private val _preferenceBusy = MutableStateFlow(false)
        val preferenceBusy = _preferenceBusy.asStateFlow()
        private val _preferenceError = MutableStateFlow<String?>(null)
        val preferenceError = _preferenceError.asStateFlow()

        private val _pickupPrimerHomeId = MutableStateFlow<String?>(null)
        override val pickupPrimerHomeId = _pickupPrimerHomeId.asStateFlow()

        override fun dismissPickupPrimer() {
            _pickupPrimerHomeId.value = null
        }

        override suspend fun enablePickupReminders(
            homeId: String,
            timezone: String,
        ): String? {
            val version = loadVersion
            if (!pickupCurrent(homeId, version)) return "Your session changed. Reopen Today to continue."
            val calendar = loadAddressCalendar()
            if (calendar == null || calendar.needsPickupDay) return "Confirm your pickup schedule before turning on reminders."
            val result =
                preferencesRepository.updatePreferences(
                    NotificationPreferencesPatch(eveningBriefingEnabled = true, dailyBriefingTimezone = timezone),
                    dispatchGuard = todayDispatchGuard(homeId, version),
                )
            if (!pickupCurrent(homeId, version)) return "Your session changed. Reopen Today to continue."
            return when (result) {
                is NetworkResult.Success -> if (result.data.eveningBriefingEnabled) null else "Couldn't enable pickup reminders. Try again."
                is NetworkResult.Failure -> result.error.displayMessage("Couldn't enable pickup reminders.")
            }
        }

        private suspend fun pickupCurrent(
            id: String,
            version: Long,
        ): Boolean = current(version) && homeId == id && !appLock.isLocked.value && keyguard?.isDeviceLocked == false

        private fun todayDispatchGuard(
            id: String?,
            version: Long,
        ): AuthenticatedDispatchGuard =
            AuthenticatedDispatchGuard { credentials ->
                viewModelScope.coroutineContext.ensureActive()
                sessionScope.requireCurrent()
                sessionScope.requireDispatchCredentials(credentials)
                viewModelScope.coroutineContext.ensureActive()
                check(loadVersion == version && homeId == id)
                check(!appLock.isLocked.value && keyguard?.isDeviceLocked == false)
            }

        private val _calendarBusy = MutableStateFlow(false)
        override val calendarBusy: StateFlow<Boolean> = _calendarBusy.asStateFlow()
        private val _calendarError = MutableStateFlow<String?>(null)
        override val calendarError: StateFlow<String?> = _calendarError.asStateFlow()

        /** Re-resolve on tab entry, including an address saved since the last visit. */
        fun load() {
            refresh()
        }

        fun refresh() {
            loadJob?.cancel()
            val version = ++loadVersion
            promptAttempted = false
            promptConfirmed = false
            _showMorningCard.value = false
            _preferenceBusy.value = false
            _preferenceError.value = null
            homeId = null
            _state.value = TodayTabUiState.Loading
            loadJob =
                viewModelScope.launch {
                    if (!current(version)) return@launch
                    val id =
                        when (val homes = resolvePrimaryHome()) {
                            is NetworkResult.Success -> homes.data
                            is NetworkResult.Failure -> {
                                // A failed lookup isn't "no place": offer a retry instead of
                                // sending a resident off to claim an address they already have.
                                _state.value = TodayTabUiState.Error(homes.error.displayMessage("Couldn't load your place."))
                                return@launch
                            }
                        }
                    val result =
                        if (id != null) {
                            homeId = id
                            repo.intelligence(id)
                        } else {
                            loadSavedPlace(version)
                            return@launch
                        }
                    if (!current(version)) return@launch
                    _state.value =
                        when (result) {
                            is NetworkResult.Success -> TodayTabUiState.Loaded(result.data, calendarHomeId = id)
                            is NetworkResult.Failure -> TodayTabUiState.Error(result.error.displayMessage("Couldn't load today."))
                        }
                    if (result is NetworkResult.Success && ::todayWidget.isInitialized) {
                        todayWidget.write(result.data.todayWidgetSnapshot())
                    }
                }
        }

        override suspend fun loadAddressCalendar(): app.pantopus.android.data.api.models.place.PlaceAddressCalendarData? {
            val id = homeId ?: return null
            val version = loadVersion
            if (!current(version)) return null
            val result = repo.addressCalendar(id)
            if (!current(version) || homeId != id) return null
            val calendar = (result as? NetworkResult.Success)?.data?.calendar
            // The calendar section was down: the widget gets the dates Today now shows.
            val loaded = _state.value as? TodayTabUiState.Loaded
            if (calendar != null && loaded != null && ::todayWidget.isInitialized) {
                todayWidget.write(loaded.intelligence.todayWidgetSnapshot(calendar))
            }
            return calendar
        }

        private suspend fun current(version: Long): Boolean {
            currentCoroutineContext().ensureActive()
            val allowed = sessionScope.confirmCurrent()
            if (!allowed && version == loadVersion) {
                _state.value = TodayTabUiState.Error("Your session changed. Reopen Today to continue.")
                _showMorningCard.value = false
                _preferenceBusy.value = false
            }
            return allowed && version == loadVersion
        }

        private suspend fun loadSavedPlace(version: Long) {
            val saved = savedPlacesRepository.list()
            if (!current(version)) return
            val place =
                when (saved) {
                    is NetworkResult.Success -> saved.data.savedPlaces.firstOrNull()
                    is NetworkResult.Failure -> {
                        _state.value = TodayTabUiState.Error(saved.error.displayMessage("Couldn't load your place."))
                        return
                    }
                }
            if (place == null) {
                _state.value = TodayTabUiState.NoPlace
                return
            }
            val result = savedPlacesRepository.today(place.id)
            if (!current(version)) return
            when (result) {
                is NetworkResult.Failure -> _state.value = TodayTabUiState.Error(result.error.displayMessage("Couldn't load today."))
                is NetworkResult.Success -> loadSavedToday(version, place, result.data)
            }
        }

        private suspend fun loadSavedToday(
            version: Long,
            place: SavedPlaceDto,
            intelligence: PlaceIntelligence,
        ) {
            val matches = checkSavedAnchor(place)
            if (!current(version)) return
            _state.value = TodayTabUiState.Loaded(intelligence, savedPlace = place, savedAnchorMatches = matches)
            if (::todayWidget.isInitialized) todayWidget.write(intelligence.todayWidgetSnapshot())
            if (!matches) return
            val preferences = preferencesRepository.preferences()
            if (!current(version)) return
            if (preferences is NetworkResult.Success) {
                promptConfirmed = !preferences.data.dailyBriefingPromptedAt.isNullOrBlank()
                _showMorningCard.value = preferences.data.dailyBriefingPromptedAt == null
            }
        }

        private suspend fun checkSavedAnchor(place: SavedPlaceDto): Boolean {
            if (!sessionScope.confirmCurrent()) return false
            val today = hubRepository.todayDetail()
            if (!sessionScope.confirmCurrent()) return false
            val payload = (today as? NetworkResult.Success)?.data ?: return false
            val location = payload.location
            val latitude = location?.latitude
            val longitude = location?.longitude
            return payload.isRenderable && location?.source == "saved_place" && latitude != null && longitude != null &&
                abs(latitude - place.latitude) < SAVED_ANCHOR_TOLERANCE && abs(longitude - place.longitude) < SAVED_ANCHOR_TOLERANCE
        }

        fun markPromptDisplayed(dismissAfterSave: Boolean = false) {
            if (!_showMorningCard.value || _preferenceBusy.value) return
            if (promptAttempted && !dismissAfterSave) return
            val version = loadVersion
            promptAttempted = true
            _preferenceBusy.value = true
            _preferenceError.value = null
            viewModelScope.launch {
                if (!current(version)) return@launch
                val result =
                    preferencesRepository.updatePreferences(
                        NotificationPreferencesPatch(dailyBriefingPrompted = true),
                        dispatchGuard = todayDispatchGuard(null, version),
                    )
                if (!current(version)) return@launch
                if (result is NetworkResult.Success && !result.data.dailyBriefingPromptedAt.isNullOrBlank()) {
                    promptConfirmed = true
                    if (dismissAfterSave) _showMorningCard.value = false
                } else {
                    _preferenceError.value = "Couldn't save your choice. Try again."
                }
                _preferenceBusy.value = false
            }
        }

        fun hideMorningCard() {
            if (!_showMorningCard.value || _preferenceBusy.value) return
            // Keep the prompt available when its display stamp failed, so a
            // retry can persist the choice instead of asking again on reentry.
            if (promptConfirmed) {
                _showMorningCard.value = false
            } else {
                markPromptDisplayed(dismissAfterSave = true)
            }
        }

        fun turnOnMorning() {
            if (_preferenceBusy.value) return
            val loaded = _state.value as? TodayTabUiState.Loaded ?: return
            val place = loaded.savedPlace ?: return
            val version = loadVersion
            _preferenceBusy.value = true
            _preferenceError.value = null
            viewModelScope.launch {
                if (!current(version)) return@launch
                val matches = checkSavedAnchor(place)
                if (!current(version)) return@launch
                if (!matches) {
                    _state.value = loaded.copy(savedAnchorMatches = false)
                    _showMorningCard.value = false
                    _preferenceBusy.value = false
                    return@launch
                }
                val timezone = ZoneId.systemDefault().id
                if (timezone !in ZoneId.getAvailableZoneIds()) {
                    _preferenceError.value = "Couldn't read your time zone. Try again."
                    _preferenceBusy.value = false
                    return@launch
                }
                val result =
                    preferencesRepository.updatePreferences(
                        NotificationPreferencesPatch(
                            dailyBriefingEnabled = true,
                            dailyBriefingTimezone = timezone,
                            dailyBriefingPrompted = true,
                        ),
                        dispatchGuard = todayDispatchGuard(null, version),
                    )
                if (!current(version)) return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        if (result.data.dailyBriefingEnabled) {
                            _showMorningCard.value = false
                        } else {
                            _preferenceError.value = "Couldn't turn on your morning briefing. Try again."
                        }
                    }
                    is NetworkResult.Failure ->
                        _preferenceError.value = result.error.displayMessage("Couldn't turn on your morning briefing.")
                }
                _preferenceBusy.value = false
            }
        }

        /** The primary home's id (null when there is none), or the failure. */
        private suspend fun resolvePrimaryHome(): NetworkResult<String?> =
            when (val result = homesRepository.myHomes()) {
                is NetworkResult.Success -> {
                    val homes = result.data.sharedHomes
                    val privateHome =
                        result.data.homes.filter { it.hasValidListContext && it.accessKind == "private_setup" }
                            .sortedByDescending { it.createdAt.orEmpty() }.firstOrNull()
                    NetworkResult.Success((homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull() ?: privateHome)?.id)
                }
                is NetworkResult.Failure -> result
            }

        override fun setPickupDay(
            request: app.pantopus.android.data.api.models.place.SetPickupDayRequest,
            offerPrimer: Boolean,
        ) {
            val id = homeId ?: return
            if (_calendarBusy.value) return
            val version = loadVersion
            _calendarBusy.value = true
            viewModelScope.launch {
                if (!pickupCurrent(id, version)) {
                    _calendarBusy.value = false
                    return@launch
                }
                _calendarError.value = null
                val r = repo.setPickupDay(id, request, dispatchGuard = todayDispatchGuard(id, version))
                if (!pickupCurrent(id, version)) {
                    _calendarBusy.value = false
                    return@launch
                }
                when (r) {
                    is NetworkResult.Success -> pickupSaved(r.data.calendar, id, version, offerPrimer)
                    is NetworkResult.Failure -> pickupFailed(r.error, "Couldn't save your pickup day.")
                }
                _calendarBusy.value = false
            }
        }

        private suspend fun pickupSaved(
            calendar: app.pantopus.android.data.api.models.place.PlaceAddressCalendarData,
            id: String,
            version: Long,
            offerPrimer: Boolean,
        ) {
            if (!pickupCurrent(id, version)) return
            if (offerPrimer && !calendar.needsPickupDay) _pickupPrimerHomeId.value = id
            refresh()
        }

        override fun clearPickupDay(expectedVersion: String?) {
            val id = homeId ?: return
            if (_calendarBusy.value) return
            val version = loadVersion
            _calendarBusy.value = true
            viewModelScope.launch {
                if (!pickupCurrent(id, version)) {
                    _calendarBusy.value = false
                    return@launch
                }
                _calendarError.value = null
                val r = repo.clearPickupDay(id, expectedVersion, dispatchGuard = todayDispatchGuard(id, version))
                if (!pickupCurrent(id, version)) {
                    _calendarBusy.value = false
                    return@launch
                }
                when (r) {
                    is NetworkResult.Success -> refresh()
                    is NetworkResult.Failure -> pickupFailed(r.error, "Couldn't reset your pickup day.")
                }
                _calendarBusy.value = false
            }
        }

        /**
         * Changed meanwhile (409): nothing was saved. Reload so the card shows the current schedule, with the
         * reason kept on the card. Any other failure keeps the editor as it was.
         */
        private fun pickupFailed(
            error: NetworkError,
            fallback: String,
        ) {
            if ((error as? NetworkError.ClientError)?.code == HTTP_CONFLICT) {
                _calendarError.value = "The pickup schedule changed since you opened it. Review the current schedule and try again."
                refresh()
            } else {
                _calendarError.value = error.displayMessage(fallback)
            }
        }
    }

sealed interface TodayTabUiState {
    data object Loading : TodayTabUiState

    /** No primary home yet — the tab is a claim prompt. */
    data object NoPlace : TodayTabUiState

    data class Loaded(
        val intelligence: PlaceIntelligence,
        val calendarHomeId: String? = null,
        val savedPlace: SavedPlaceDto? = null,
        val savedAnchorMatches: Boolean = false,
    ) : TodayTabUiState

    data class Error(val message: String) : TodayTabUiState
}
