package app.pantopus.android.ui.screens.place.today

import android.app.KeyguardManager
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.analytics.PilotEvents
import app.pantopus.android.data.api.models.homes.MyHomesResponse
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
import app.pantopus.android.ui.screens.place.detail.RadonTodayMemory
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
import java.time.Instant
import java.time.ZoneId
import javax.inject.Inject
import kotlin.math.abs

private const val SAVED_ANCHOR_TOLERANCE = 0.000001

/** Contract §4, Today: inside this window coming back to the tab sends no request. */
internal const val TODAY_FRESH_MS = 10 * 60 * 1000L

/** Contract §4, Today: a copy older than this gets the quiet "Couldn't refresh" line when a refresh fails. */
internal const val TODAY_MAX_SHOWN_AGE_MS = 2 * 60 * 60 * 1000L

/** Contract §4, Today alerts: an alert check older than this is never shown as "no alerts". */
internal const val TODAY_ALERTS_MAX_SHOWN_AGE_MS = 30 * 60 * 1000L

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

        /** What the radon and first-use cards last knew per home, so coming back shows them at once. */
        val radonMemory = RadonTodayMemory()

        /** A read is running while content stays on screen; the pull indicator shows it only for a pull. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** The home this tab shows, once resolved. */
        var homeId: String? = null
            private set
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

        /**
         * Tab entry, including coming back after rotation or a dark-mode switch (contract §3): what's on screen
         * stays. A home's Today is read again only once it is out of date (10 minutes, or a new day); without a
         * home it is checked again quietly, so an address saved since the last visit takes over.
         */
        fun load() {
            when (val shown = _state.value) {
                is TodayTabUiState.Loaded -> if (shown.savedPlace != null || !shown.isFresh()) refresh(force = false)
                TodayTabUiState.Loading -> if (loadJob?.isActive != true) refresh(force = false)
                TodayTabUiState.NoPlace, is TodayTabUiState.Error -> refresh(force = false)
            }
        }

        /**
         * Reads Today through the screens' store: [force] reads now (pull to refresh, Retry, after a pickup edit);
         * otherwise a fresh stored copy answers without a request and an older one is revalidated with its ETag.
         * Content on screen stays while it is read again; only a first visit or an error waits on the network. A
         * failed read keeps the content and marks it, so the screen can say how old it is.
         */
        fun refresh(force: Boolean = true) {
            loadJob?.cancel()
            val version = ++loadVersion
            val shown = _state.value
            _preferenceBusy.value = false
            _preferenceError.value = null
            if (shown !is TodayTabUiState.Loaded && shown != TodayTabUiState.NoPlace) {
                promptAttempted = false
                promptConfirmed = false
                _showMorningCard.value = false
                homeId = null
                _state.value = TodayTabUiState.Loading
            }
            _refreshing.value = true
            loadJob =
                viewModelScope.launch {
                    try {
                        if (!current(version)) return@launch
                        val homes = homesRepository.myHomesStored(force)
                        if (!current(version)) return@launch
                        val homesList = homes.data
                        if (homesList == null) {
                            // A failed lookup isn't "no place": offer a retry instead of
                            // sending a resident off to claim an address they already have.
                            _state.value = _state.value.afterFailedRead(homes.failure.sentence("Couldn't load your place."))
                            return@launch
                        }
                        val id = primaryHomeId(homesList)
                        if (id == null) {
                            loadSavedPlace(version)
                            return@launch
                        }
                        homeId = id
                        val today = repo.todayStored(id, force)
                        if (!current(version)) return@launch
                        val data = today.data
                        val failure = today.failure
                        when {
                            data != null -> {
                                _state.value =
                                    TodayTabUiState.Loaded(
                                        data,
                                        calendarHomeId = id,
                                        fetchedAt = today.fetchedAt,
                                        refreshFailed = failure != null,
                                    )
                                if (failure == null && ::todayWidget.isInitialized) todayWidget.write(data.todayWidgetSnapshot())
                            }
                            // Access ended (contract §3): the store dropped the copy, and the server's answer shows.
                            failure is NetworkError.Forbidden || failure == NetworkError.NotFound ->
                                _state.value = TodayTabUiState.Error(failure.displayMessage("Couldn't load today."))
                            else -> {
                                val sameHome = _state.value.takeIf { (it as? TodayTabUiState.Loaded)?.calendarHomeId == id }
                                _state.value = sameHome.afterFailedRead(failure.sentence("Couldn't load today."))
                            }
                        }
                    } finally {
                        if (version == loadVersion) _refreshing.value = false
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
            homeId = null
            val saved = savedPlacesRepository.list()
            if (!current(version)) return
            val place =
                when (saved) {
                    is NetworkResult.Success -> saved.data.savedPlaces.firstOrNull()
                    is NetworkResult.Failure -> {
                        val shown = _state.value
                        val noHome = shown.takeIf { it == TodayTabUiState.NoPlace || (it as? TodayTabUiState.Loaded)?.savedPlace != null }
                        _state.value = noHome.afterFailedRead(saved.error.displayMessage("Couldn't load your place."))
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
                is NetworkResult.Failure -> {
                    val samePlace = _state.value.takeIf { (it as? TodayTabUiState.Loaded)?.savedPlace?.id == place.id }
                    _state.value = samePlace.afterFailedRead(result.error.displayMessage("Couldn't load today."))
                }
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
            val now = System.currentTimeMillis()
            _state.value = TodayTabUiState.Loaded(intelligence, savedPlace = place, savedAnchorMatches = matches, fetchedAt = now)
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

/** The home Today shows: the primary home, else the first shared one, else the newest private setup; null for none. */
private fun primaryHomeId(response: MyHomesResponse): String? {
    val homes = response.sharedHomes
    val privateHome =
        response.homes.filter { it.hasValidListContext && it.accessKind == "private_setup" }
            .sortedByDescending { it.createdAt.orEmpty() }.firstOrNull()
    return (homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull() ?: privateHome)?.id
}

/** The failure's sentence, or [fallback] when a read failed without one. */
private fun NetworkError?.sentence(fallback: String): String = this?.displayMessage(fallback) ?: fallback

/** After a failed read: content already shown for the same place stays, marked; otherwise the error shows. */
private fun TodayTabUiState?.afterFailedRead(message: String): TodayTabUiState =
    when (this) {
        is TodayTabUiState.Loaded -> copy(refreshFailed = true)
        TodayTabUiState.NoPlace -> this
        else -> TodayTabUiState.Error(message)
    }

sealed interface TodayTabUiState {
    data object Loading : TodayTabUiState

    /** No primary home yet — the tab is a claim prompt. */
    data object NoPlace : TodayTabUiState

    /**
     * @property fetchedAt when this copy arrived (wall clock), for Today's freshness windows.
     * @property refreshFailed the last read failed while this copy stayed on screen.
     */
    data class Loaded(
        val intelligence: PlaceIntelligence,
        val calendarHomeId: String? = null,
        val savedPlace: SavedPlaceDto? = null,
        val savedAnchorMatches: Boolean = false,
        val fetchedAt: Long = 0L,
        val refreshFailed: Boolean = false,
    ) : TodayTabUiState {
        /** Inside the 10-minute window and still the same day at the home: coming back reads nothing. */
        fun isFresh(now: Long = System.currentTimeMillis()): Boolean {
            if (now - fetchedAt !in 0 until TODAY_FRESH_MS) return false
            // Midnight in the home's time zone (contract §4); the phone's when the reply has none.
            val zone = intelligence.timeZone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()
            return Instant.ofEpochMilli(fetchedAt).atZone(zone).toLocalDate() == Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        }
    }

    data class Error(val message: String) : TodayTabUiState
}
