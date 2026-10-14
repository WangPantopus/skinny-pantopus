package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.PlacePendingStore
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.defaultHomeOf
import app.pantopus.android.data.api.models.notifications.personalBellCount
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject

/**
 * The Place tab's root (founder direction 2026-10-12): the tab is the person's place. Works out what the root shows
 * from My homes, the kept copy first and then the server, and, only when there are no Home entries at all, from the
 * saved places. Holds the session's current home, and the arrival step that keeps a looked-up address privately (a
 * preview carried through sign-in opens it over the root once). Saved places' "Save a place" runs the same arrival
 * step on an instance of its own. An unfinished preview requires explicit bookmark consent.
 */
@HiltViewModel
class HomeTabHostViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
        private val savedPlacesRepository: SavedPlacesRepository,
        private val placeRepository: PlaceRepository,
        private val authRepository: AuthRepository,
        private val notificationsRepository: NotificationsRepository,
    ) : ViewModel() {
        private val _landing = MutableStateFlow<HomeLanding>(HomeLanding.Loading)

        /** What the Place tab shows at its root. */
        val landing = _landing.asStateFlow()
        private val _arrival = MutableStateFlow(PlaceArrivalState())
        val arrival = _arrival.asStateFlow()
        private val _arrivalOpen = MutableStateFlow(false)

        /** The arrival step shows over the root until it is finished. */
        val arrivalOpen = _arrivalOpen.asStateFlow()
        private val _unreadCount = MutableStateFlow(0)
        val unreadCount = _unreadCount.asStateFlow()

        /** The Home chosen in this session (the homes sheet, Add Home, a link). Until one is, the landing rule picks. */
        private var currentHomeId: String? = null

        /** Homes whose Place stopped answering this session (left, removed): not landed on again unless chosen. */
        private val unreadableHomeIds = mutableSetOf<String>()

        /** A newer resolution (a switch, a link, a retry) wins over an older one still reading. */
        private var generation = 0L
        private var resolveJob: Job? = null

        /** The read in flight was forced: the kept list is known to be out of date (Add Home, a Home gone). */
        private var forcedRead = false
        private var previewJob: Job? = null
        private val userId: String? get() = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        init {
            // A preview kept through sign-in (bound to this account) opens its save step over the root.
            userId?.let { PlacePendingStore.bind(it) }?.let(::showArrival)
            resolve()
        }

        fun refreshUnread() {
            viewModelScope.launch {
                val unread = (notificationsRepository.unreadCount() as? NetworkResult.Success)?.data ?: return@launch
                _unreadCount.value = unread.personalBellCount
            }
        }

        /**
         * Works out the root again, quietly: the kept copies answer at once (also offline) and the server's lists
         * confirm them. Whatever is on screen stays while reading and when a read fails; only a root with nothing to
         * show yet shows the error, and a read that was dropped shows nothing.
         */
        fun resolve() = resolve(forceHomes = false)

        /** Try again on the error root: the skeleton shows while the lists are read. */
        fun retry() {
            if (_landing.value is HomeLanding.Error) _landing.value = HomeLanding.Loading
            resolve()
        }

        private fun resolve(forceHomes: Boolean) {
            // A forced read in flight answers with a fresher list than anything a quiet re-check could read now.
            if (!forceHomes && forcedRead && resolveJob?.isActive == true) return
            val current = ++generation
            resolveJob?.cancel()
            forcedRead = forceHomes
            // The kept copies answer at once, unless they are known to be out of date: then the server decides.
            if (!forceHomes) keptRoot()?.let { _landing.value = it }
            resolveJob =
                viewModelScope.launch {
                    val homes = homesRepository.myHomesStored(forceHomes)
                    if (current != generation) return@launch
                    val homesData = homes.data
                    if (homesData == null) {
                        showFailure(homes.failure)
                        return@launch
                    }
                    val root = rootFor(homesData)
                    if (root != null) {
                        _landing.value = root
                        return@launch
                    }
                    // No Home entries at all: the address they saved decides.
                    val saved = savedPlacesRepository.listStored()
                    if (current != generation) return@launch
                    val savedData = saved.data
                    if (savedData == null) showFailure(saved.failure) else _landing.value = savedRootFor(savedData.savedPlaces)
                }
        }

        /** The root the kept copies decide, or null while they can't (no copy yet). */
        private fun keptRoot(): HomeLanding? {
            val homes = homesRepository.myHomesCopy() ?: return null
            rootFor(homes)?.let { return it }
            val saved = savedPlacesRepository.listCopy() ?: return null
            return savedRootFor(saved.savedPlaces)
        }

        private fun showFailure(failure: NetworkError?) {
            // No data and no failure: the read was dropped (a wipe, an own edit). The next showing reads again.
            if (failure == null) return
            val landed = _landing.value
            if (landed is HomeLanding.Loading || landed is HomeLanding.Error) _landing.value = HomeLanding.Error(failure.landingMessage())
        }

        /**
         * The root My homes decides: the session's current home while it can still be opened, else the landing rule;
         * My homes when every entry still waits on verification; null when there are no Home entries at all.
         */
        private fun rootFor(response: MyHomesResponse): HomeLanding? {
            val openable = response.homes.filter { it.isOpenablePlace && it.id !in unreadableHomeIds }
            val homeId = currentHomeId?.takeIf { id -> openable.any { it.id == id } } ?: landingHome(openable)?.id
            return when {
                homeId != null -> HomeLanding.Home(homeId)
                response.homes.any { it.hasValidListContext } -> HomeLanding.Homes
                else -> null
            }
        }

        /**
         * Where Place lands: the person's default Home ([defaultHomeOf]; Today follows the same Home). A resident's own
         * private setup is their Place until a household shares it (as on the web).
         */
        private fun landingHome(openable: List<MyHome>): MyHome? = defaultHomeOf(openable)

        /** The newest address saved as a home, else the newest one looked up. Work and other spots aren't their place. */
        private fun savedRootFor(places: List<SavedPlaceDto>): HomeLanding {
            val place = places.firstOrNull { it.placeType == "home" } ?: places.firstOrNull { it.placeType == "searched" }
            return place?.let { HomeLanding.SavedPlace(it) } ?: HomeLanding.FirstRun
        }

        /** A Home chosen in the homes sheet, or by a link to a Home the person can open: it replaces the root. */
        fun switchHome(homeId: String) {
            currentHomeId = homeId
            unreadableHomeIds -= homeId
            _landing.value = HomeLanding.Home(homeId)
            resolve()
        }

        /**
         * Add Home finished with a new Home: it is the current home, and the root shows it once a fresh list (the kept
         * one doesn't have it yet) says it can be opened. Until then the root stays as it is.
         */
        fun landOnAddedHome(homeId: String) {
            currentHomeId = homeId
            unreadableHomeIds -= homeId
            resolve(forceHomes = true)
        }

        /**
         * A Home stopped being readable (left, removed, deleted): the root moves on to the next Home, or to the right
         * empty state, as a relaunch would.
         */
        fun replaceUnavailable(homeId: String) {
            unreadableHomeIds += homeId
            if (currentHomeId == homeId) currentHomeId = null
            resolve(forceHomes = true)
        }

        /** Whether a link's Home is one the Place tab can open, per the kept list, else the server's. */
        suspend fun isOpenable(homeId: String): Boolean {
            val kept = homesRepository.myHomesCopy()?.homes.orEmpty()
            if (kept.any { it.id == homeId && it.isOpenablePlace }) return true
            return homesRepository.myHomesStored().data?.homes.orEmpty().any { it.id == homeId && it.isOpenablePlace }
        }

        /** The root's Home once the root has an answer (null when it isn't a Home), for a bare link's section page. */
        suspend fun awaitRootHomeId(): String? {
            if (_landing.value is HomeLanding.Loading && resolveJob?.isActive != true) resolve()
            val settled = withTimeoutOrNull(ROOT_WAIT_MS) { landing.first { it !is HomeLanding.Loading } }
            return (settled as? HomeLanding.Home)?.homeId
        }

        /** The first-run root's Continue: the preview just kept for this account opens the arrival step. */
        fun openArrival() {
            userId?.let { PlacePendingStore.bind(it) }?.let(::showArrival)
        }

        private fun showArrival(draft: PlacePendingStore.Pending) {
            previewJob?.cancel()
            _arrival.value = PlaceArrivalState(draft = draft)
            _arrivalOpen.value = true
            loadPreview()
        }

        fun loadPreview() {
            if (previewJob?.isActive == true) return
            val draft = _arrival.value.draft ?: return
            _arrival.value = _arrival.value.copy(previewError = false, isLoadingPreview = true)
            previewJob =
                viewModelScope.launch {
                    val result = placeRepository.publicPreview(draft.label)
                    if (userId != draft.userId || _arrival.value.draft?.id != draft.id) return@launch
                    _arrival.value = _arrival.value.copy(isLoadingPreview = false)
                    when (result) {
                        is NetworkResult.Success -> _arrival.value = _arrival.value.copy(preview = result.data)
                        is NetworkResult.Failure -> _arrival.value = _arrival.value.copy(previewError = true)
                    }
                }
        }

        fun save() {
            val state = _arrival.value
            val draft = state.draft ?: return
            if (state.isSaving || state.saved != null) return
            val stored = PlacePendingStore.read()
            val belongsToCurrentUser = userId != null && userId == draft.userId
            val matchesStoredDraft = stored?.id == draft.id && stored.userId == userId
            if (!belongsToCurrentUser || !matchesStoredDraft) {
                _arrival.value = state.copy(error = "This preview expired or belongs to another session. Look up the address again.")
                return
            }
            _arrival.value = state.copy(isSaving = true, error = null)
            viewModelScope.launch {
                val result =
                    savedPlacesRepository.save(
                        SavePlaceBody(
                            label = draft.label,
                            placeType = "searched",
                            latitude = draft.latitude,
                            longitude = draft.longitude,
                            expectedUserId = draft.userId,
                        ),
                    )
                val saved = (result as? NetworkResult.Success)?.data?.savedPlace
                val belongsToDraft = saved?.userId == draft.userId && userId == draft.userId
                if (belongsToDraft && !saved?.id.isNullOrBlank()) {
                    PlacePendingStore.clear(id = draft.id)
                    _arrival.value = _arrival.value.copy(isSaving = false, saved = saved)
                } else {
                    _arrival.value =
                        _arrival.value.copy(
                            isSaving = false,
                            error = "We couldn’t confirm the save. Your preview is still here — please try again.",
                        )
                }
            }
        }

        /**
         * The arrival step is done ("Not now", "Continue exploring", or away to another screen): the root reads again.
         * Back passes [keepPreview]: the unfinished preview stays on this device (up to 24 hours, as the step says) and
         * opens again on the next launch.
         */
        fun finish(keepPreview: Boolean = false) {
            if (_arrival.value.isSaving) return
            previewJob?.cancel()
            if (!keepPreview) _arrival.value.draft?.let { PlacePendingStore.clear(id = it.id) }
            _arrivalOpen.value = false
            resolve()
        }

        private companion object {
            /** How long a bare link with a section waits for the root to have an answer. */
            const val ROOT_WAIT_MS = 15_000L
        }
    }

data class PlaceArrivalState(
    val draft: PlacePendingStore.Pending? = null,
    val saved: SavedPlaceDto? = null,
    val isSaving: Boolean = false,
    val error: String? = null,
    val preview: PlacePreview? = null,
    val previewError: Boolean = false,
    val isLoadingPreview: Boolean = false,
)

/** What the Place tab shows at its root. Nothing sits under Your Place. */
sealed interface HomeLanding {
    /** No answer yet and no kept copy: the Place dashboard skeleton. */
    data object Loading : HomeLanding

    /** The first read failed and there was no kept copy. */
    data class Error(val message: String) : HomeLanding

    /** Your Place for this Home. */
    data class Home(val homeId: String) : HomeLanding

    /** Entries that all still wait on verification (a claim or a residency request): My homes shows them. */
    data object Homes : HomeLanding

    /** No Home entries; the address they saved privately. */
    data class SavedPlace(val place: SavedPlaceDto) : HomeLanding

    /** No Home entries and no saved address: the address-first screen. */
    data object FirstRun : HomeLanding
}

private fun NetworkError?.landingMessage(): String =
    this?.displayMessage("Couldn't load your place. Please try again.") ?: "Couldn't load your place. Please try again."
