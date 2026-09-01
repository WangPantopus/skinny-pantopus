@file:Suppress("LargeClass", "MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.gigs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigSavedSearchDto
import app.pantopus.android.data.api.models.gigs.GigsBrowseResponse
import app.pantopus.android.data.api.models.gigs.GigsFeedNearbyTrainDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.gigs.GigDraftQueue
import app.pantopus.android.data.gigs.GigSavedSearchesRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.gigs.GigsV2Repository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.widget.WidgetSnapshotStore
import app.pantopus.android.data.widget.WidgetTaskSnapshot
import app.pantopus.android.ui.screens.compose.gig.GigComposeViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.util.Locale
import javax.inject.Inject

/**
 * Backs the Gigs feed (Hub → Gigs pillar).
 *
 * Two modes (P1.F): with no category scope and no structured filters the
 * feed renders the sectioned **browse** surface from `GET /api/gigs/browse`;
 * any category selection, filter, sort change, or "See all" drops to the
 * **flat** list from `GET /api/gigs`. Re-selecting the "All" chip returns
 * to browse.
 *
 * Also owns the radius suggestion ladder (P1.B), "Not interested" dismiss +
 * hide-category with undo (P1.D), and the realtime `gig:new` counter (P1.E).
 */
@HiltViewModel
class GigsFeedViewModel
    @Inject
    constructor(
        private val repo: GigsRepository,
        private val socket: SocketManager,
        private val authRepo: AuthRepository,
        private val location: LocationProvider,
        private val savedSearchesRepo: GigSavedSearchesRepository,
        private val draftQueue: GigDraftQueue,
        private val widgetSnapshots: WidgetSnapshotStore,
        private val networkMonitor: NetworkMonitor,
        /** Nearby Support Trains for the All / Support Trains scopes. */
        private val gigsV2Repo: GigsV2Repository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<GigsFeedUiState>(GigsFeedUiState.Loading)
        val state: StateFlow<GigsFeedUiState> = _state.asStateFlow()

        private val _activeCategory = MutableStateFlow(GigsCategory.All)
        val activeCategory: StateFlow<GigsCategory> = _activeCategory.asStateFlow()

        /**
         * Feed-scope segment (All / Tasks / Support Trains). Defaults to
         * `Tasks` so the sectioned browse surface stays the landing frame;
         * `All` mixes nearby Support Trains into the flat list and
         * `SupportTrains` shows them alone (RN `gigs.tsx:126`).
         */
        private val _feedScope = MutableStateFlow(GigsFeedScope.Tasks)
        val feedScope: StateFlow<GigsFeedScope> = _feedScope.asStateFlow()

        /**
         * Merged, newest-first render rows: gig cards plus (in the scopes
         * that include them) nearby Support Train rows.
         */
        private val _feedRows = MutableStateFlow<List<GigsFeedRow>>(emptyList())
        val feedRows: StateFlow<List<GigsFeedRow>> = _feedRows.asStateFlow()

        private val _activeSort = MutableStateFlow(GigsSort.Newest)
        val activeSort: StateFlow<GigsSort> = _activeSort.asStateFlow()

        private val _activeFilterCount = MutableStateFlow(0)
        val activeFilterCount: StateFlow<Int> = _activeFilterCount.asStateFlow()

        private val _filters = MutableStateFlow(GigFilterCriteria())
        val filters: StateFlow<GigFilterCriteria> = _filters.asStateFlow()

        /** P1.B — non-null when the slim "Search Y mi" banner should show. */
        private val _radiusSuggestion = MutableStateFlow<GigsRadiusSuggestion?>(null)
        val radiusSuggestion: StateFlow<GigsRadiusSuggestion?> = _radiusSuggestion.asStateFlow()

        /** P1.E — count of `gig:new` events from other users since the last load. */
        private val _newTaskCount = MutableStateFlow(0)
        val newTaskCount: StateFlow<Int> = _newTaskCount.asStateFlow()

        /** P1.D — transient toast (auto-dismissed by the screen after ~5s). */
        private val _toast = MutableStateFlow<GigsFeedToast?>(null)
        val toast: StateFlow<GigsFeedToast?> = _toast.asStateFlow()

        /** P6a — render state for the "Saved searches" manage sheet. */
        private val _savedSearches = MutableStateFlow<GigSavedSearchesUiState>(GigSavedSearchesUiState.Loading)
        val savedSearches: StateFlow<GigSavedSearchesUiState> = _savedSearches.asStateFlow()

        /** P6c — slim "N drafts waiting" banner; null while offline / queue empty. */
        private val _draftBanner = MutableStateFlow<GigsDraftBanner?>(null)
        val draftBanner: StateFlow<GigsDraftBanner?> = _draftBanner.asStateFlow()

        /**
         * Flat-list pagination — true when `GET /api/gigs` says another
         * page exists after the loaded window. Derived from the server
         * response (`pagination.hasMore` / `total`), never guessed when
         * the backend told us. Always false in browse mode.
         */
        private val _hasMore = MutableStateFlow(false)
        val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

        /** Flat-list pagination — true while the next page is in flight. */
        private val _loadingMore = MutableStateFlow(false)
        val loadingMore: StateFlow<Boolean> = _loadingMore.asStateFlow()

        /** P6c — serialises banner "Post now" taps. */
        private var draftPosting = false

        init {
            // P6c — the banner appears only when back online with queued drafts.
            viewModelScope.launch {
                combine(draftQueue.drafts, networkMonitor.isOnline) { drafts, online ->
                    drafts
                        .takeIf { online && it.isNotEmpty() }
                        ?.let { GigsDraftBanner(count = it.size, title = it.first().title) }
                }.collect { _draftBanner.value = it }
            }
        }

        /** P6a — raw saved-search rows backing optimistic PATCH/DELETE + revert. */
        private var savedSearchDtos: List<GigSavedSearchDto> = emptyList()

        private var latitude: Double? = null
        private var longitude: Double? = null
        private var radiusMiles: Double = RADIUS_LADDER_MILES.first()
        private var loading = false

        /** Offset the next [loadMore] page starts at (rows already loaded). */
        private var nextOffset = 0

        /** P1.B — banner dismissed for this session (VM lifetime). */
        private var radiusSuggestionDismissed = false

        /** P1.F — sticky flat-list override after "See all" / sort change. */
        private var browseExited = false

        private var socketJob: Job? = null

        /** Last fetched gigs, kept so a filter change re-derives the
         * visible rows client-side without a refetch. */
        private var loadedGigs: List<GigDto> = emptyList()

        /** Last fetched nearby Support Trains (All / Support Trains scopes). */
        private var loadedTrains: List<SupportTrainRowContent> = emptyList()

        /** `published_at` epoch seconds per train id, for the merged sort. */
        private var trainSortKeys: Map<String, Long> = emptyMap()

        /** P1.D — original index + row of in-flight dismissals, for undo. */
        private val pendingDismissals = mutableMapOf<String, Pair<Int, GigDto>>()

        /** P1.D — rows removed per hidden category, for undo. */
        private val pendingCategoryHides = mutableMapOf<GigsCategory, List<IndexedValue<GigDto>>>()

        /** Wire location coordinates + radius before the first load. */
        fun configureLocation(
            latitude: Double?,
            longitude: Double?,
            radiusMiles: Double = RADIUS_LADDER_MILES.first(),
        ) {
            this.latitude = latitude
            this.longitude = longitude
            this.radiusMiles = radiusMiles
        }

        fun load() {
            subscribeToSocket()
            if (_state.value is GigsFeedUiState.Loaded || _state.value is GigsFeedUiState.BrowseLoaded) return
            fetch()
        }

        fun refresh() = fetch()

        /** Feed-scope chip tap. Re-selecting the active scope is a no-op. */
        fun selectScope(scope: GigsFeedScope) {
            if (_feedScope.value == scope) return
            _feedScope.value = scope
            if (!scope.includesGigs) {
                loadedGigs = emptyList()
                _hasMore.value = false
                nextOffset = 0
            }
            if (!scope.includesSupportTrains) {
                loadedTrains = emptyList()
                trainSortKeys = emptyMap()
            }
            fetch()
        }

        fun selectCategory(category: GigsCategory) {
            val reEntersBrowse = category == GigsCategory.All && browseExited
            if (_activeCategory.value == category && !reEntersBrowse) return
            _activeCategory.value = category
            // Tapping "All" again is the explicit path back into browse mode.
            if (category == GigsCategory.All) browseExited = false
            fetch()
        }

        fun selectSort(sort: GigsSort) {
            if (_activeSort.value == sort) return
            _activeSort.value = sort
            // Sort is a flat-list concept — choosing one exits browse mode
            // (same semantics as a section "See all").
            if (isBrowseMode()) browseExited = true
            fetch()
        }

        /**
         * P1.F — "See all" on a browse section / the "See all N tasks"
         * footer. Switches to the flat list with the section's sort.
         */
        fun exitBrowse(sort: GigsSort = _activeSort.value) {
            browseExited = true
            _activeSort.value = sort
            fetch()
        }

        /**
         * P0.4 — apply structured filters from the sheet. Server-expressible
         * dimensions (budget → `minPrice`/`maxPrice`, open-to-bids →
         * `pay_type=offers`, exactly-one schedule → `schedule_type`) ride
         * the refetch as query params; [rebuild] keeps only what the server
         * can't express client-side.
         */
        fun applyFilters(criteria: GigFilterCriteria) {
            _filters.value = criteria
            _activeFilterCount.value = criteria.activeCount
            fetch()
        }

        /** P1.F — Quick jobs "See all": exit browse into the flat list
         * filtered to the section's ≤ $100 budget band (mirrors iOS). */
        fun seeAllQuickJobs() {
            applyFilters(GigFilterCriteria(budgetUpper = QUICK_JOBS_BUDGET_CAP))
        }

        // MARK: - P1.B Radius suggestion

        /** Accept the suggestion: bump the radius to the next step + refetch. */
        fun acceptRadiusSuggestion() {
            val suggestion = _radiusSuggestion.value ?: return
            radiusMiles = suggestion.suggestedRadiusMiles
            _radiusSuggestion.value = null
            fetch()
        }

        /** Dismiss the banner for the rest of this session. */
        fun dismissRadiusSuggestion() {
            radiusSuggestionDismissed = true
            _radiusSuggestion.value = null
        }

        // MARK: - P1.D Dismiss / hide

        /**
         * "Not interested": optimistically drop the row, POST the
         * dismissal, and surface an undo toast. A failed POST restores the
         * row and flips the toast to an error.
         */
        fun dismissGig(gigId: String) {
            val index = loadedGigs.indexOfFirst { it.id == gigId }
            if (index < 0) return
            val gig = loadedGigs[index]
            pendingDismissals[gigId] = index to gig
            loadedGigs = loadedGigs.filterNot { it.id == gigId }
            rebuild()
            _toast.value =
                GigsFeedToast(
                    text = "Not interested — we'll show fewer like this.",
                    undo = GigsFeedUndo.Dismiss(gigId),
                )
            viewModelScope.launch {
                when (val result = repo.dismissGig(gigId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        restoreDismissedGig(gigId)
                        _toast.value = GigsFeedToast(text = result.error.message, isError = true)
                    }
                }
            }
        }

        /** Undo a dismissal: DELETE the record + reinsert the row. */
        fun undoDismissGig(gigId: String) {
            if (pendingDismissals[gigId] == null) return
            restoreDismissedGig(gigId)
            _toast.value = null
            viewModelScope.launch { repo.undoDismissGig(gigId) }
        }

        /**
         * "Hide all <Category>": optimistically remove every row of the
         * category, POST hidden-categories, undo restores via DELETE.
         */
        fun hideCategory(category: GigsCategory) {
            if (category == GigsCategory.All) return
            val removed =
                loadedGigs
                    .withIndex()
                    .filter { GigsCategory.fromBackendKey(it.value.category) == category }
            if (removed.isEmpty()) return
            pendingCategoryHides[category] = removed
            val removedIds = removed.map { it.value.id }.toSet()
            loadedGigs = loadedGigs.filterNot { it.id in removedIds }
            rebuild()
            _toast.value =
                GigsFeedToast(
                    text = "All ${category.label} tasks hidden.",
                    undo = GigsFeedUndo.HideCategory(category),
                )
            viewModelScope.launch {
                when (val result = repo.hideCategory(category.key)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        restoreHiddenCategory(category)
                        _toast.value = GigsFeedToast(text = result.error.message, isError = true)
                    }
                }
            }
        }

        /** Undo a category hide: DELETE hidden-categories/{category} + reinsert. */
        fun undoHideCategory(category: GigsCategory) {
            if (pendingCategoryHides[category] == null) return
            restoreHiddenCategory(category)
            _toast.value = null
            viewModelScope.launch { repo.unhideCategory(category.key) }
        }

        /** Route a toast's undo action. */
        fun undo(undo: GigsFeedUndo) {
            when (undo) {
                is GigsFeedUndo.Dismiss -> undoDismissGig(undo.gigId)
                is GigsFeedUndo.HideCategory -> undoHideCategory(undo.category)
            }
        }

        fun dismissToast() {
            _toast.value = null
        }

        // MARK: - P6a Saved searches + alerts

        /**
         * "Save this search": apply [criteria] (the sheet's working state)
         * and POST it with the active category chip, the viewing
         * coordinate, and the current radius. The backend dedupes
         * identical criteria onto the existing row (re-enabling notify) —
         * both outcomes surface through the feed toast.
         */
        fun saveSearch(criteria: GigFilterCriteria) {
            if (criteria != _filters.value) applyFilters(criteria)
            val lat = latitude
            val lng = longitude
            if (lat == null || lng == null) {
                _toast.value = GigsFeedToast(text = "Turn on location to save searches.", isError = true)
                return
            }
            val body =
                criteria.toSavedSearchBody(
                    category = _activeCategory.value,
                    // The feed's search field opens the separate Gig Search
                    // surface, so there is no inline query to carry here.
                    search = null,
                    latitude = lat,
                    longitude = lng,
                    radiusMiles = radiusMiles,
                )
            viewModelScope.launch {
                when (val result = savedSearchesRepo.create(body)) {
                    is NetworkResult.Success -> {
                        _toast.value =
                            GigsFeedToast(
                                text =
                                    if (result.data.deduped == true) {
                                        "Already saved — alerts re-enabled"
                                    } else {
                                        "Search saved — we'll alert you"
                                    },
                            )
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = GigsFeedToast(text = result.error.message, isError = true)
                    }
                }
            }
        }

        /** Manage sheet open / retry: fetch the caller's saved searches. */
        fun loadSavedSearches() {
            _savedSearches.value = GigSavedSearchesUiState.Loading
            viewModelScope.launch {
                when (val result = savedSearchesRepo.list()) {
                    is NetworkResult.Success -> {
                        savedSearchDtos = result.data.searches
                        rebuildSavedSearches()
                    }
                    is NetworkResult.Failure -> {
                        _savedSearches.value = GigSavedSearchesUiState.Error(result.error.displayMessage("Couldn't load saved searches."))
                    }
                }
            }
        }

        /** Notify switch: optimistic flip, PATCH, revert on failure. */
        fun setSavedSearchNotify(
            id: String,
            notify: Boolean,
        ) {
            val previous = savedSearchDtos
            if (previous.none { it.id == id }) return
            savedSearchDtos = previous.map { if (it.id == id) it.copy(notify = notify) else it }
            rebuildSavedSearches()
            viewModelScope.launch {
                when (val result = savedSearchesRepo.update(id, notify = notify)) {
                    is NetworkResult.Success -> {
                        savedSearchDtos = savedSearchDtos.map { if (it.id == id) result.data.search else it }
                        rebuildSavedSearches()
                    }
                    is NetworkResult.Failure -> {
                        savedSearchDtos = previous
                        rebuildSavedSearches()
                        _toast.value = GigsFeedToast(text = result.error.message, isError = true)
                    }
                }
            }
        }

        /** Trash tap: optimistic removal, DELETE, reinsert on failure. */
        fun deleteSavedSearch(id: String) {
            val previous = savedSearchDtos
            if (previous.none { it.id == id }) return
            savedSearchDtos = previous.filterNot { it.id == id }
            rebuildSavedSearches()
            viewModelScope.launch {
                when (val result = savedSearchesRepo.delete(id)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        savedSearchDtos = previous
                        rebuildSavedSearches()
                        _toast.value = GigsFeedToast(text = result.error.message, isError = true)
                    }
                }
            }
        }

        private fun rebuildSavedSearches() {
            _savedSearches.value =
                if (savedSearchDtos.isEmpty()) {
                    GigSavedSearchesUiState.Empty
                } else {
                    GigSavedSearchesUiState.Loaded(savedSearchDtos.map { projectSavedSearch(it) })
                }
        }

        // MARK: - P6c Offline draft queue

        /**
         * Banner "Post now": re-submit the oldest queued draft through
         * the same magic-post path the composer uses. Success removes it
         * (+ toast + refetch so the new task shows); failure keeps it.
         */
        fun postPendingDraft() {
            if (draftPosting) return
            val draft = draftQueue.drafts.value.firstOrNull() ?: return
            val body = GigComposeViewModel.bodyFromQueuedDraft(draft)
            if (body == null) {
                // Stale snapshot (e.g. scheduled start passed) — keep it
                // so the user can discard deliberately.
                _toast.value =
                    GigsFeedToast(text = "Draft can't be posted — its schedule may have passed.", isError = true)
                return
            }
            draftPosting = true
            viewModelScope.launch {
                when (val result = repo.magicPost(body)) {
                    is NetworkResult.Success -> {
                        draftQueue.remove(draft.id)
                        _toast.value = GigsFeedToast(text = "Draft posted — helpers nearby were notified.")
                        fetch()
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = GigsFeedToast(text = result.error.message, isError = true)
                    }
                }
                draftPosting = false
            }
        }

        /** Banner "Discard": drop the oldest queued draft. */
        fun discardPendingDraft() {
            val draft = draftQueue.drafts.value.firstOrNull() ?: return
            draftQueue.remove(draft.id)
        }

        private fun restoreDismissedGig(gigId: String) {
            val (index, gig) = pendingDismissals.remove(gigId) ?: return
            loadedGigs =
                loadedGigs.toMutableList().also {
                    it.add(index.coerceAtMost(it.size), gig)
                }
            rebuild()
        }

        private fun restoreHiddenCategory(category: GigsCategory) {
            val removed = pendingCategoryHides.remove(category) ?: return
            loadedGigs =
                loadedGigs.toMutableList().also { list ->
                    removed.forEach { (index, gig) -> list.add(index.coerceAtMost(list.size), gig) }
                }
            rebuild()
        }

        // MARK: - P1.E Realtime new-task counter

        /** Banner tap: clear the counter + refetch. */
        fun refreshFromNewTasksBanner() {
            _newTaskCount.value = 0
            fetch()
        }

        private fun subscribeToSocket() {
            if (socketJob != null) return
            socketJob =
                viewModelScope.launch {
                    socket.eventsOf(GIG_NEW_EVENT).collect { json ->
                        onGigNewEvent(posterId = json.optString("userId").takeIf { it.isNotEmpty() })
                    }
                }
        }

        /** Count a broadcast unless the viewer posted the gig themselves. */
        internal fun onGigNewEvent(posterId: String?) {
            if (posterId != null && posterId == currentUserId()) return
            _newTaskCount.value += 1
        }

        private fun currentUserId(): String? = (authRepo.state.value as? AuthRepository.State.SignedIn)?.user?.id

        // MARK: - Fetch

        /**
         * Browse mode: the Tasks-only feed scope, "All" category, no
         * structured filters, no See-all override. RN gates the section
         * feed the same way (`gigs.tsx:292-298`).
         */
        private fun isBrowseMode(): Boolean =
            _feedScope.value == GigsFeedScope.Tasks &&
                _activeCategory.value == GigsCategory.All &&
                _activeFilterCount.value == 0 &&
                !browseExited

        private fun fetch() {
            if (loading) return
            loading = true
            _newTaskCount.value = 0
            val browse = isBrowseMode()
            val keepsContent =
                (browse && _state.value is GigsFeedUiState.BrowseLoaded) ||
                    (!browse && _state.value is GigsFeedUiState.Loaded)
            if (!keepsContent) {
                _state.value = if (browse) GigsFeedUiState.BrowseLoading else GigsFeedUiState.Loading
            }
            viewModelScope.launch {
                try {
                    ensureLocation()
                    fetchNearbySupportTrains()
                    when {
                        browse && latitude != null && longitude != null -> fetchBrowse()
                        _feedScope.value.includesGigs -> fetchFlat()
                        else -> {
                            // Support-Trains-only scope: no gig request at all.
                            _hasMore.value = false
                            nextOffset = 0
                            rebuild()
                        }
                    }
                } finally {
                    loading = false
                }
            }
        }

        /**
         * Nearby Support Trains for the scopes that show them. Best-effort:
         * a failure just leaves the train rows empty (RN swallows it too,
         * `gigs.tsx:234-238`).
         */
        private suspend fun fetchNearbySupportTrains() {
            val lat = latitude
            val lng = longitude
            if (!_feedScope.value.includesSupportTrains || lat == null || lng == null) {
                loadedTrains = emptyList()
                trainSortKeys = emptyMap()
                return
            }
            when (
                val result =
                    gigsV2Repo.nearbySupportTrains(
                        latitude = lat,
                        longitude = lng,
                        radiusMeters = radiusMiles * METERS_PER_MILE,
                        limit = GigsV2Repository.DEFAULT_NEARBY_LIMIT,
                    )
            ) {
                is NetworkResult.Success -> {
                    val trains = result.data.supportTrains
                    loadedTrains = trains.map { projectSupportTrain(it) }
                    trainSortKeys = trains.associate { it.supportTrainId to epochSeconds(it.publishedAt) }
                }
                is NetworkResult.Failure -> {
                    loadedTrains = emptyList()
                    trainSortKeys = emptyMap()
                }
            }
        }

        /** Resolve a coordinate once (cached → fresh); [configureLocation] overrides. */
        private suspend fun ensureLocation() {
            if (latitude != null && longitude != null) return
            val coordinate = location.cachedCoordinate() ?: location.requestCurrent()
            if (coordinate != null) {
                latitude = coordinate.latitude
                longitude = coordinate.longitude
            }
        }

        /** P1.F — sectioned browse fetch. Radius omitted ⇒ server default (~100 mi). */
        private suspend fun fetchBrowse() {
            val lat = latitude ?: return fetchFlat()
            val lng = longitude ?: return fetchFlat()
            // The radius ladder is a flat-list concept — drop any stale banner.
            _radiusSuggestion.value = null
            // The sectioned frame renders its own rows.
            _feedRows.value = emptyList()
            // Browse is a fixed sectioned surface — the backend caps each
            // section server-side, so there is nothing to page through.
            _hasMore.value = false
            nextOffset = 0
            when (val result = repo.browse(lat, lng)) {
                is NetworkResult.Success -> {
                    val content = projectBrowse(result.data)
                    _state.value =
                        if (content.isEmpty) {
                            GigsFeedUiState.Empty(radiusMiles = radiusMiles)
                        } else {
                            GigsFeedUiState.BrowseLoaded(content)
                        }
                    // P6c — refresh the home-screen widget snapshot.
                    writeWidgetSnapshot(
                        with(result.data.sections) { bestMatches + newToday + urgent + highPaying + quickJobs },
                    )
                }
                is NetworkResult.Failure -> {
                    _state.value = GigsFeedUiState.Error(result.error.displayMessage("Couldn't load Gigs."))
                }
            }
        }

        /**
         * One page of `GET /api/gigs`. [append] `false` replaces the loaded
         * window (first page / refresh); `true` is the infinite-scroll
         * continuation and never downgrades the screen to `Error`.
         */
        private suspend fun fetchFlat(
            offset: Int = 0,
            append: Boolean = false,
        ) {
            val category = _activeCategory.value
            val sort = _activeSort.value
            val criteria = _filters.value
            when (
                val result =
                    repo.list(
                        category = category.key.takeIf { category != GigsCategory.All },
                        sort = sort.key,
                        latitude = latitude,
                        longitude = longitude,
                        radiusMiles = radiusMiles,
                        limit = PAGE_SIZE,
                        offset = offset,
                        minPrice =
                            criteria.budgetLower
                                .toDouble()
                                .takeIf { criteria.budgetLower > GigFilterCriteria.BUDGET_MIN },
                        maxPrice =
                            criteria.budgetUpper
                                .toDouble()
                                // BUDGET_MAX is the "$500+" no-ceiling handle.
                                .takeIf { criteria.budgetUpper < GigFilterCriteria.BUDGET_MAX },
                        scheduleType = criteria.schedules.singleOrNull()?.backendValue,
                        payType = if (criteria.openToBids) OFFERS_PAY_TYPE else null,
                        includeRemote = criteria.serverIncludeRemote,
                        deadline = criteria.serverDeadline,
                        maxDistanceMeters = criteria.serverMaxDistanceMeters,
                        taskArchetype = criteria.serverTaskArchetype,
                    )
            ) {
                is NetworkResult.Success -> {
                    loadedGigs =
                        if (append) {
                            val seen = loadedGigs.mapTo(mutableSetOf()) { it.id }
                            loadedGigs + result.data.gigs.filterNot { it.id in seen }
                        } else {
                            result.data.gigs
                        }
                    if (!append) {
                        pendingDismissals.clear()
                        pendingCategoryHides.clear()
                    }
                    _hasMore.value = result.data.hasMorePages(offset = offset, limit = PAGE_SIZE)
                    nextOffset = offset + result.data.gigs.size
                    rebuild()
                    // The radius ladder reacts to the first page only — a
                    // thin page 3 says nothing about the search width.
                    if (!append) updateRadiusSuggestion()
                    // P6c — refresh the home-screen widget snapshot.
                    writeWidgetSnapshot(loadedGigs)
                }
                is NetworkResult.Failure -> {
                    if (append) {
                        // Keep the rows already on screen; stop the footer
                        // retrying in a loop and surface what happened.
                        _hasMore.value = false
                        _toast.value =
                            GigsFeedToast(
                                text = result.error.displayMessage("Couldn't load more tasks."),
                                isError = true,
                            )
                    } else {
                        _state.value = GigsFeedUiState.Error(result.error.displayMessage("Couldn't load Gigs."))
                    }
                }
            }
        }

        /**
         * Infinite scroll — appends the next [PAGE_SIZE] window once the
         * list footer scrolls into view. No-op in browse mode, while
         * another fetch is running, or once the server says there is
         * nothing left.
         */
        fun loadMore() {
            if (loading || _loadingMore.value || !_hasMore.value) return
            if (_state.value !is GigsFeedUiState.Loaded) return
            _loadingMore.value = true
            viewModelScope.launch {
                try {
                    fetchFlat(offset = nextOffset, append = true)
                } finally {
                    _loadingMore.value = false
                }
            }
        }

        /**
         * P6c — project the fetched gigs into the "Tasks near me" widget
         * snapshot (max 10, deduped). The store broadcasts the widget
         * update itself; failures must never break the feed.
         */
        private fun writeWidgetSnapshot(gigs: List<GigDto>) {
            runCatching {
                widgetSnapshots.write(
                    gigs
                        .distinctBy { it.id }
                        .take(WidgetSnapshotStore.MAX_TASKS)
                        .map { gig ->
                            val card = projectCard(gig)
                            WidgetTaskSnapshot(
                                id = card.id,
                                title = card.title,
                                price = card.price,
                                distance = card.distanceLabel,
                                categoryKey = card.category.key,
                            )
                        },
                )
            }
        }

        /**
         * Client-side residual filtering over the fetched page: multi-
         * category, multi-schedule intersection, and posted-within (the
         * backend has no posted-within param). The server-applied
         * dimensions re-check harmlessly.
         */
        private fun rebuild() {
            val now = Instant.now().epochSecond
            val visible = loadedGigs.filter { _filters.value.matches(it, now) }
            val rows =
                (
                    visible.map { gig ->
                        GigsFeedRow.Gig(projectCard(gig), epochSeconds(gig.createdAt))
                    } +
                        loadedTrains.map { train ->
                            GigsFeedRow.SupportTrain(train, trainSortKeys[train.id] ?: 0L)
                        }
                ).sortedByDescending { it.sortKey }
            _feedRows.value = rows
            _state.value =
                if (rows.isEmpty()) {
                    GigsFeedUiState.Empty(radiusMiles = radiusMiles)
                } else {
                    GigsFeedUiState.Loaded(rows = visible.map { projectCard(it) })
                }
        }

        /**
         * P1.B — after a flat load: fewer than [RADIUS_SUGGESTION_THRESHOLD]
         * visible rows with no active filters suggests the next radius
         * ladder step (1 → 3 → 5 → 10 mi cap).
         */
        private fun updateRadiusSuggestion() {
            val visibleCount =
                when (val current = _state.value) {
                    is GigsFeedUiState.Loaded -> current.rows.size
                    is GigsFeedUiState.Empty -> 0
                    else -> return
                }
            val nextRadius = RADIUS_LADDER_MILES.firstOrNull { it > radiusMiles }
            val shouldSuggest =
                nextRadius != null &&
                    visibleCount < RADIUS_SUGGESTION_THRESHOLD &&
                    _activeFilterCount.value == 0 &&
                    !radiusSuggestionDismissed
            _radiusSuggestion.value =
                if (shouldSuggest && nextRadius != null) {
                    GigsRadiusSuggestion(
                        visibleCount = visibleCount,
                        currentRadiusMiles = radiusMiles,
                        suggestedRadiusMiles = nextRadius,
                    )
                } else {
                    null
                }
        }

        // MARK: - Projection

        /** P1.F — DTO sections → render-only [GigsBrowseContent]. */
        internal fun projectBrowse(response: GigsBrowseResponse): GigsBrowseContent =
            GigsBrowseContent(
                bestMatches = response.sections.bestMatches.take(VERTICAL_SECTION_LIMIT).map { projectCard(it) },
                urgent = response.sections.urgent.map { projectRailCard(it) },
                newToday = response.sections.newToday.take(VERTICAL_SECTION_LIMIT).map { projectCard(it) },
                highPaying = response.sections.highPaying.map { projectRailCard(it) },
                quickJobs = response.sections.quickJobs.take(VERTICAL_SECTION_LIMIT).map { projectCard(it) },
                clusters =
                    response.sections.clusters.mapNotNull { cluster ->
                        val count = cluster.count ?: 0
                        if (cluster.category.isNullOrEmpty() || count <= 0) {
                            null
                        } else {
                            GigsBrowseClusterChip(
                                category = GigsCategory.fromBackendKey(cluster.category),
                                count = count,
                            )
                        }
                    },
                totalActive = response.totalActive ?: 0,
            )

        companion object {
            /** P0.4 — `pay_type` wire value for the open-to-bids filter. */
            private const val OFFERS_PAY_TYPE = "offers"

            /** P1.E — global broadcast emitted on gig creation (`backend/routes/gigs.js:1080`). */
            internal const val GIG_NEW_EVENT = "gig:new"

            /** P1.B — radius ladder; the last entry is the cap. */
            internal val RADIUS_LADDER_MILES = listOf(1.0, 3.0, 5.0, 10.0)

            /** P1.B — suggest widening when fewer rows than this load. */
            internal const val RADIUS_SUGGESTION_THRESHOLD = 3

            /** P1.F — vertical sections cap at three rows. */
            internal const val VERTICAL_SECTION_LIMIT = 3

            /**
             * Rows requested per `GET /api/gigs` page. Mirrors iOS
             * `GigsFeedViewModel.pageSize`.
             */
            internal const val PAGE_SIZE = 20

            private const val METERS_PER_MILE = 1_609.344

            /** Metres in a mile as RN's SupportTrainRow rounds it. */
            private const val SUPPORT_TRAIN_METERS_PER_MILE = 1609.0

            /**
             * ISO-8601 timestamp → epoch seconds for the merged-row sort.
             * Rows without a parseable timestamp sink to the bottom.
             */
            internal fun epochSeconds(timestamp: String?): Long {
                if (timestamp.isNullOrBlank()) return 0L
                return runCatching { Instant.parse(timestamp).epochSecond }.getOrElse { 0L }
            }

            /**
             * Nearby-RPC row → render content. Mirrors RN
             * `components/gig-browse/SupportTrainRow.tsx`.
             */
            internal fun projectSupportTrain(dto: GigsFeedNearbyTrainDto): SupportTrainRowContent {
                val distance = dto.distanceMeters?.let { supportTrainDistanceLabel(it) }
                val age = ageLabel(dto.publishedAt)?.let { "$it ago" }
                val city = dto.city?.takeIf { it.isNotBlank() }
                val state = dto.state?.takeIf { it.isNotBlank() }
                val area =
                    when {
                        city != null && state != null -> "$city, $state"
                        else -> city ?: state
                    }
                val open = dto.openSlotsCount ?: 0
                val slots = if (open > 0) "$open open slot${if (open == 1) "" else "s"}" else "View schedule"
                return SupportTrainRowContent(
                    id = dto.supportTrainId,
                    title = dto.title?.trim()?.takeIf { it.isNotEmpty() } ?: "Support Train",
                    metaLine = listOfNotNull(distance, age).joinToString(" · "),
                    subtitle = area?.let { "$it · $slots" } ?: slots,
                )
            }

            /** Metres → "820m" / "1.2mi" (RN `formatDistanceMeters`). */
            internal fun supportTrainDistanceLabel(meters: Double): String? {
                if (!meters.isFinite()) return null
                if (meters < SUPPORT_TRAIN_METERS_PER_MILE) return "${kotlin.math.round(meters).toInt()}m"
                return String.format(Locale.US, "%.1fmi", meters / SUPPORT_TRAIN_METERS_PER_MILE)
            }

            /**
             * `GigDto` → render-only [GigCardContent]. Exposed on the
             * companion so the Gig Search surface projects identical rows
             * without duplicating the meta / price / distance formatting.
             */
            fun projectCard(gig: GigDto): GigCardContent {
                val category = GigsCategory.fromBackendKey(gig.category)
                val distance = distanceLabel(resolvedDistanceMiles(gig))
                val age = ageLabel(gig.createdAt)?.let { "$it ago" }
                val meta = listOfNotNull(distance, age).joinToString(" · ")
                return GigCardContent(
                    id = gig.id,
                    category = category,
                    metaLine = meta,
                    title = gig.title,
                    body = gig.description.orEmpty(),
                    price = priceLabel(gig.price, gig.payType),
                    bidCount = gig.bidCount ?: 0,
                    distanceLabel = distance,
                    isUrgent = gig.isUrgent == true,
                )
            }

            /** P1.F — Quick jobs section budget ceiling (matches the
             * backend's quick-jobs banding). */
            const val QUICK_JOBS_BUDGET_CAP = 100f

            /**
             * P6a — `GigSavedSearchDto` → manage-sheet row. The stored
             * name wins; the derived [savedSearchLabel] is the fallback
             * title and the summary when it adds information.
             */
            fun projectSavedSearch(dto: GigSavedSearchDto): GigSavedSearchRowContent {
                val derived =
                    savedSearchLabel(
                        categoryLabel =
                            dto.category
                                ?.takeIf { it.isNotBlank() }
                                ?.let { GigsCategory.fromBackendKey(it).label },
                        search = dto.search,
                        minPrice = dto.minPrice,
                        maxPrice = dto.maxPrice,
                        scheduleLabel = savedScheduleLabel(dto.scheduleType),
                        openToBids = dto.payType == OFFERS_PAY_TYPE,
                        radiusMiles = dto.radiusMiles,
                    )
                val title = dto.name?.takeIf { it.isNotBlank() } ?: derived
                return GigSavedSearchRowContent(
                    id = dto.id,
                    title = title,
                    summary = derived.takeIf { it != title },
                    savedAgo = ageLabel(dto.createdAt)?.let { if (it == "now") "Saved just now" else "Saved $it ago" },
                    notify = dto.notify != false,
                )
            }

            /** Stored `schedule_type` → display label ("asap" / "today" have no feed bucket). */
            private fun savedScheduleLabel(raw: String?): String? {
                if (raw.isNullOrBlank()) return null
                return when (raw.lowercase(Locale.US)) {
                    "asap" -> "ASAP"
                    else ->
                        GigScheduleFilter.fromBackendKey(raw)?.label
                            ?: raw.replaceFirstChar { it.uppercase(Locale.US) }
                }
            }

            /** P1.F — `GigDto` → horizontal rail card (urgent / high paying). */
            fun projectRailCard(gig: GigDto): GigRailCardContent =
                GigRailCardContent(
                    id = gig.id,
                    category = GigsCategory.fromBackendKey(gig.category),
                    title = gig.title,
                    price = priceLabel(gig.price, gig.payType),
                    distanceLabel = distanceLabel(resolvedDistanceMiles(gig)),
                    bidCount = gig.bidCount ?: 0,
                    imageUrl = gig.firstImage,
                )

            /** Spatial-RPC rows carry `distance_meters`; list rows `distance_miles`. */
            private fun resolvedDistanceMiles(gig: GigDto): Double? = gig.distanceMiles ?: gig.distanceMeters?.let { it / METERS_PER_MILE }

            private fun priceLabel(
                price: Double?,
                payType: String?,
            ): String {
                if (price == null) return "—"
                val base =
                    if (price % 1.0 == 0.0) {
                        "$${price.toInt()}"
                    } else {
                        String.format(Locale.US, "$%.2f", price)
                    }
                return when (payType) {
                    "hourly" -> "$base / hr"
                    "per_session" -> "$base / session"
                    "per_walk" -> "$base / walk"
                    "per_visit" -> "$base / visit"
                    else -> base
                }
            }

            private fun distanceLabel(miles: Double?): String? {
                if (miles == null) return null
                return when {
                    miles < 0.1 -> "< 0.1mi"
                    miles < 10 -> String.format(Locale.US, "%.1fmi", miles)
                    else -> "${miles.toInt()}mi"
                }
            }

            private fun ageLabel(iso: String?): String? {
                if (iso.isNullOrEmpty()) return null
                return runCatching {
                    val instant = Instant.parse(iso)
                    val seconds = Duration.between(instant, Instant.now()).seconds
                    when {
                        seconds < 60 -> "now"
                        seconds < 3_600 -> "${seconds / 60}m"
                        seconds < 86_400 -> "${seconds / 3_600}h"
                        seconds < 604_800 -> "${seconds / 86_400}d"
                        else -> "${seconds / 604_800}w"
                    }
                }.getOrNull()
            }
        }
    }
