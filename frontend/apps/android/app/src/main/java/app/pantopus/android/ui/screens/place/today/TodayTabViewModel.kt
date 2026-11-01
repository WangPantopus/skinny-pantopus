package app.pantopus.android.ui.screens.place.today

import android.app.KeyguardManager
import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.ai.PickupFlyerReader
import app.pantopus.android.data.ai.PickupFlyerReading
import app.pantopus.android.data.ai.RadonReportReader
import app.pantopus.android.data.ai.RadonReportReading
import app.pantopus.android.data.analytics.PilotEvents
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.models.homes.showsCopyBeforeRecheck
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.data.hub.NotificationPreferencesRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.data.store.Stored
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
// Today owns the existing calendar/preferences actions as well as its copy lifecycle.
@Suppress("TooManyFunctions")
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

        /**
         * The last read was a pull or Retry and it failed while the copy stayed: the screen says so whatever the
         * copy's age. A read the person didn't ask for stays quiet until the copy is past its max shown age (§3).
         */
        private val _pullFailed = MutableStateFlow(false)
        val pullFailed: StateFlow<Boolean> = _pullFailed.asStateFlow()

        /** The home this tab shows, once resolved. */
        var homeId: String? = null
            private set
        override val calendarHomeId: String? get() = homeId

        /** The Home on screen: the person's, or the claimed one (the assistant and the ballot card open its public view). */
        val shownHomeId: String? get() = homeId ?: (_state.value as? TodayTabUiState.Loaded)?.claim?.homeId

        /**
         * The radon card's guard: Today still shows this home to this session, with the app and phone unlocked. It
         * binds to the home, not to one read of it: Today keeps its content while it reads again (pull to refresh,
         * coming back after its window), and a card built before that read stays usable for the same home.
         */
        val radonContext: suspend () -> Unit
            get() {
                val id = homeId
                return { check(id != null && pickupCurrent(id, loadVersion)) }
            }
        private var loadJob: Job? = null
        private var loadVersion = 0L
        private var active = true
        private val sessionScope = sessionScopes.create(viewModelScope)
        private val keyguard = context.getSystemService(KeyguardManager::class.java)
        private val _pickupPrimerHomeId = MutableStateFlow<String?>(null)
        override val pickupPrimerHomeId = _pickupPrimerHomeId.asStateFlow()

        override fun dismissPickupPrimer() {
            _pickupPrimerHomeId.value = null
        }

        /** "Read a flyer" in the pickup editor (unit tests build this without Hilt). */
        @Inject lateinit var flyerReader: PickupFlyerReader

        override val readsPickupFlyers: Boolean get() = ::flyerReader.isInitialized

        override suspend fun readPickupFlyer(photo: Uri): PickupFlyerReading? {
            val id = homeId ?: return null
            val version = loadVersion
            if (!pickupCurrent(id, version)) return null
            val reading = flyerReader.read(photo)
            return reading.takeIf { pickupCurrent(id, version) }
        }

        /** "Read a lab report" in the radon sheet (unit tests build this without Hilt). */
        @Inject lateinit var radonReader: RadonReportReader

        override val readsRadonReports: Boolean get() = ::radonReader.isInitialized

        override suspend fun readRadonReport(report: Uri): RadonReportReading? {
            val id = homeId ?: return null
            val version = loadVersion
            if (!pickupCurrent(id, version)) return null
            val reading = radonReader.read(report)
            return reading.takeIf { pickupCurrent(id, version) }
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
         * stays. A home's Today is read again only once the store says it is out of date (10 minutes, or a topic
         * marked it) or the day turned over at the home; without a home it is checked again quietly, so an address
         * saved since the last visit takes over.
         */
        fun load() {
            active = true
            homeId?.takeUnless(::mayKeepHome)?.let(::clearHomeCopy)
            when (val shown = _state.value) {
                is TodayTabUiState.Loaded ->
                    when {
                        // The shared bookmark and Today copies decide whether this visit needs a request.
                        shown.savedPlace != null -> refresh(force = !shown.isSameDay())
                        // Midnight in the home's time zone (contract §4) ends the copy even inside its window.
                        !shown.isSameDay() -> refresh(force = true)
                        shown.calendarHomeId?.let(repo::todayIsCurrent) == true -> Unit
                        else -> refresh(force = false)
                    }
                TodayTabUiState.Loading -> {
                    showStoredToday()
                    if (loadJob?.isActive != true) refresh(force = false)
                }
                TodayTabUiState.NoPlace, is TodayTabUiState.ClaimInReview, is TodayTabUiState.Error -> refresh(force = false)
            }
        }

        private fun mayKeepHome(id: String): Boolean =
            homesRepository.myHomesCopy()?.homes?.firstOrNull { it.id == id }?.showsCopyBeforeRecheck == true

        /** Only open-ended household access may keep a home-linked Today between visits. */
        fun suspendContent() {
            if (!active) return
            active = false
            loadVersion++
            loadJob?.cancel()
            _refreshing.value = false
            homeId?.takeUnless(::mayKeepHome)?.let(::clearHomeCopy)
            // A claim's public view is read again on return, like any Home Today this account can't keep.
            (_state.value as? TodayTabUiState.Loaded)?.claim?.let { clearHomeCopy(it.homeId) }
        }

        private fun clearHomeCopy(id: String) {
            repo.forgetToday(id)
            _state.value = TodayTabUiState.Loading
            _pickupPrimerHomeId.value = null
            if (::todayWidget.isInitialized) todayWidget.clear()
        }

        /** A first entry (a cold start too) shows the stored Today of the primary home at once; the read revalidates it. */
        private fun showStoredToday() {
            val homes = homesRepository.myHomesCopy() ?: return
            val id = primaryHomeId(homes)
            if (id == null) {
                val saved = savedPlacesRepository.listCopy()?.savedPlaces?.firstOrNull() ?: return
                val copy = savedPlacesRepository.todayCopy(saved.id)
                copy.data?.let {
                    _state.value =
                        TodayTabUiState.Loaded(
                            it, savedPlace = saved, fetchedAt = copy.fetchedAt, refreshFailed = copy.failure != null,
                        )
                }
                return
            }
            if (homes.homes.firstOrNull { it.id == id }?.showsCopyBeforeRecheck != true) {
                clearHomeCopy(id)
                return
            }
            val copy = repo.todayCopy(id)
            copy.data?.let { data ->
                homeId = id
                _state.value =
                    TodayTabUiState.Loaded(
                        data, calendarHomeId = id, fetchedAt = copy.fetchedAt, refreshFailed = copy.failure != null,
                    )
            }
        }

        /**
         * Reads Today through the screens' store: [force] reads now (pull to refresh, Retry, after a pickup edit);
         * otherwise a fresh stored copy answers without a request and an older one is revalidated with its ETag.
         * Content on screen stays while it is read again; only a first visit or an error waits on the network. A
         * failed read keeps the content and marks it, so the screen can say how old it is.
         */
        fun refresh(
            force: Boolean = true,
            asked: Boolean = false,
        ) {
            if (!active) return
            loadJob?.cancel()
            val version = ++loadVersion
            val shown = _state.value
            if (shown !is TodayTabUiState.Loaded && shown != TodayTabUiState.NoPlace && shown !is TodayTabUiState.ClaimInReview) {
                homeId = null
                _state.value = TodayTabUiState.Loading
            }
            _refreshing.value = true
            if (force) radonMemory.readAgain()
            loadJob =
                viewModelScope.launch {
                    try {
                        if (!current(version)) return@launch
                        val homes = homesRepository.myHomesStored(force || homeId?.let { !mayKeepHome(it) } == true)
                        if (!current(version)) return@launch
                        val homesList = homes.data
                        if (homesList == null) {
                            // A failed lookup isn't "no place": offer a retry instead of
                            // sending a resident off to claim an address they already have.
                            if (homes.failure.refusesStoredCopy) {
                                homeId?.let(::clearHomeCopy)
                            }
                            _state.value = _state.value.afterFailedRead(homes.failure.sentence("Couldn't load your place."))
                            return@launch
                        }
                        val id = primaryHomeId(homesList)
                        if (id == null) {
                            loadSavedPlace(version, force)
                            return@launch
                        }
                        loadHomeToday(homes, id, version, force)
                    } finally {
                        if (version == loadVersion) {
                            _refreshing.value = false
                            _pullFailed.value = asked && (_state.value as? TodayTabUiState.Loaded)?.refreshFailed == true
                        }
                    }
                }
        }

        /** Pull to refresh and Retry: [refresh] now, saying so if it fails (the iPhone shows a toast). */
        fun pull() = refresh(force = true, asked = true)

        private suspend fun loadHomeToday(
            homes: Stored<MyHomesResponse>,
            id: String,
            version: Long,
            force: Boolean,
        ) {
            val keep = homes.data?.homes?.firstOrNull { it.id == id }?.showsCopyBeforeRecheck == true
            homeId?.takeIf { it != id }?.let(::clearHomeCopy)
            homeId = id
            if (!keep) clearHomeCopy(id)
            if (!keep && homes.failure != null) {
                _state.value = TodayTabUiState.Error(homes.failure.sentence("Couldn't check your access."))
                return
            }
            val today = repo.todayStored(id, force || !keep, persist = keep)
            if (!current(version)) return
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
                    if (keep && failure == null && ::todayWidget.isInitialized) todayWidget.write(data.todayWidgetSnapshot())
                }
                // Access ended (contract §3): the store dropped the copy, and the server's answer shows.
                failure.refusesStoredCopy ->
                    _state.value = TodayTabUiState.Error(failure.sentence("Couldn't load today."))
                else -> {
                    val sameHome = _state.value.takeIf { (it as? TodayTabUiState.Loaded)?.calendarHomeId == id }
                    _state.value = sameHome.afterFailedRead(failure.sentence("Couldn't load today."))
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
            if (calendar != null && loaded != null) {
                if (mayKeepHome(id) && ::todayWidget.isInitialized) {
                    todayWidget.write(loaded.intelligence.todayWidgetSnapshot(calendar))
                }
            }
            return calendar
        }

        /**
         * No place yet: a claim in review shows the claimed address's public Today under the claim's status (a claim
         * makes its Home theirs only once it's approved); without one, the claim prompt.
         */
        private suspend fun loadClaims(
            version: Long,
            force: Boolean,
        ) {
            val claims = homesRepository.myClaimsStored(force)
            if (!current(version)) return
            val claimsData = claims.data
            val claim = claimsData?.claims?.firstOrNull { it.isInReview }
            when {
                claimsData == null -> _state.value = _state.value.afterFailedRead(claims.failure.sentence("Couldn't load your place."))
                claim == null -> _state.value = TodayTabUiState.NoPlace
                else -> loadClaimToday(claim, version)
            }
        }

        /**
         * The claimed address's public Today (the server's view for an open claim), never kept on the phone. Its
         * household calendar and radon stay out (no [homeId]). A refusal (an older server, a closed Home) shows the
         * claim's card instead.
         */
        private suspend fun loadClaimToday(
            claim: OwnershipClaimDto,
            version: Long,
        ) {
            val today = repo.todayStored(claim.homeId, force = true, persist = false)
            if (!current(version)) return
            val data = today.data
            _state.value =
                when {
                    data != null ->
                        TodayTabUiState.Loaded(data, claim = claim, fetchedAt = today.fetchedAt, refreshFailed = today.failure != null)
                    today.failure.refusesStoredCopy -> TodayTabUiState.ClaimInReview(claim)
                    else ->
                        _state.value
                            .takeIf { (it as? TodayTabUiState.Loaded)?.claim?.homeId == claim.homeId }
                            .afterFailedRead(today.failure.sentence("Couldn't load today."))
                }
        }

        private suspend fun current(version: Long): Boolean {
            currentCoroutineContext().ensureActive()
            val allowed = sessionScope.confirmCurrent()
            if (!allowed && version == loadVersion) {
                _state.value = TodayTabUiState.Error("Your session changed. Reopen Today to continue.")
            }
            return active && allowed && version == loadVersion
        }

        private suspend fun loadSavedPlace(
            version: Long,
            force: Boolean,
        ) {
            homeId = null
            val saved = savedPlacesRepository.listStored(force)
            if (!current(version)) return
            val places = saved.data
            if (places == null) {
                val samePlace =
                    _state.value.takeIf {
                        it == TodayTabUiState.NoPlace ||
                            it is TodayTabUiState.ClaimInReview ||
                            (it as? TodayTabUiState.Loaded)?.savedPlace != null
                    }
                _state.value =
                    if (saved.failure.refusesStoredCopy) {
                        TodayTabUiState.Error(saved.failure.sentence("Couldn't load your place."))
                    } else {
                        samePlace.afterFailedRead(saved.failure.sentence("Couldn't load your place."))
                    }
                return
            }
            val place = places.savedPlaces.firstOrNull()
            if (place == null) {
                loadClaims(version, force)
                return
            }
            val copy = savedPlacesRepository.todayCopy(place.id)
            copy.data?.let {
                _state.value =
                    TodayTabUiState.Loaded(
                        it,
                        savedPlace = place,
                        savedAnchorMatches = shownAnchor(place),
                        fetchedAt = copy.fetchedAt,
                        refreshFailed = copy.failure != null,
                    )
            }
            val result = savedPlacesRepository.todayStored(place.id, force)
            if (!current(version)) return
            val intelligence = result.data
            if (intelligence == null) {
                val samePlace = _state.value.takeIf { (it as? TodayTabUiState.Loaded)?.savedPlace?.id == place.id }
                _state.value =
                    if (result.failure.refusesStoredCopy) {
                        TodayTabUiState.Error(result.failure.sentence("Couldn't load today."))
                    } else {
                        samePlace.afterFailedRead(result.failure.sentence("Couldn't load today."))
                    }
            } else {
                loadSavedToday(version, place, result)
            }
        }

        private suspend fun loadSavedToday(
            version: Long,
            place: SavedPlaceDto,
            copy: Stored<PlaceIntelligence>,
        ) {
            val intelligence = copy.data ?: return
            // The copy is visible before checking the saved-place anchor.
            val shown =
                TodayTabUiState.Loaded(
                    intelligence,
                    savedPlace = place,
                    savedAnchorMatches = shownAnchor(place),
                    fetchedAt = copy.fetchedAt,
                    refreshFailed = copy.failure != null,
                )
            _state.value = shown
            val matches = checkSavedAnchor(place)
            if (!current(version)) return
            _state.value = shown.copy(savedAnchorMatches = matches)
            if (copy.failure == null && ::todayWidget.isInitialized) todayWidget.write(intelligence.todayWidgetSnapshot())
        }

        /** A match already on screen for [place] keeps its chip while the anchor is checked again. */
        private fun shownAnchor(place: SavedPlaceDto): Boolean =
            (_state.value as? TodayTabUiState.Loaded)?.takeIf { it.savedPlace?.id == place.id }?.savedAnchorMatches == true

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

/** The home Today shows: the person's default Home, as Place lands on it ([MyHomesResponse.defaultHomeId]). */
internal fun primaryHomeId(response: MyHomesResponse): String? = response.defaultHomeId

/** The failure's sentence, or [fallback] when a read failed without one. */
private fun NetworkError?.sentence(fallback: String): String = this?.displayMessage(fallback) ?: fallback

/** After a failed read: content already shown for the same place stays, marked; otherwise the error shows. */
private fun TodayTabUiState?.afterFailedRead(message: String): TodayTabUiState =
    when (this) {
        is TodayTabUiState.Loaded -> copy(refreshFailed = true)
        TodayTabUiState.NoPlace, is TodayTabUiState.ClaimInReview -> this
        else -> TodayTabUiState.Error(message)
    }

sealed interface TodayTabUiState {
    data object Loading : TodayTabUiState

    /** No primary home yet — the tab is a claim prompt. */
    data object NoPlace : TodayTabUiState

    /** No place yet and [claim]'s address can't be read: the tab says it's in review and when Today fills in. */
    data class ClaimInReview(val claim: OwnershipClaimDto) : TodayTabUiState

    /**
     * @property claim a claim in review: [intelligence] is the claimed address's public view, its status on top.
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
        val claim: OwnershipClaimDto? = null,
    ) : TodayTabUiState {
        /** Still the day this copy was read on, at the home: Today turns over at the home's midnight. */
        fun isSameDay(now: Long = System.currentTimeMillis()): Boolean {
            // Midnight in the home's time zone (contract §4); the phone's when the reply has none.
            val zone = intelligence.homeZone ?: ZoneId.systemDefault()
            return Instant.ofEpochMilli(fetchedAt).atZone(zone).toLocalDate() == Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        }
    }

    data class Error(val message: String) : TodayTabUiState
}
