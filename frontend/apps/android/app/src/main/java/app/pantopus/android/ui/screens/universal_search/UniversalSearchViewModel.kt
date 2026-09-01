@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.universal_search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchBusinessDto
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchGigDto
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchHomeDto
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchPersonDto
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchProfileDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.universalsearch.UniversalSearchRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.roundToInt

/**
 * Render state for the universal-search surface. Mirrors the iOS
 * `UniversalSearchState`.
 */
sealed interface UniversalSearchUiState {
    /** No query yet (or under the 2-character threshold). */
    data object Idle : UniversalSearchUiState

    /** A fetch is in flight. */
    data object Loading : UniversalSearchUiState

    /**
     * At least one section came back with rows. [failedSources] lists
     * the "All"-tab sources that failed while others succeeded — they
     * render as inline notices instead of blanking the screen.
     */
    data class Loaded(
        val sections: List<UniversalSearchSection>,
        val failedSources: List<UniversalSearchKind> = emptyList(),
    ) : UniversalSearchUiState

    /**
     * Every source answered, none matched. [beaconsUnavailable] is true
     * when the Beacons source 404'd because the Identity Firewall gate
     * is off on this deployment.
     */
    data class Empty(
        val beaconsUnavailable: Boolean = false,
    ) : UniversalSearchUiState

    /** Every reachable source failed. */
    data class Error(
        val message: String,
    ) : UniversalSearchUiState
}

/**
 * S2 — Universal search across five backend surfaces. Mirrors RN
 * `src/app/discover.tsx:93-294`:
 *
 * - the query is debounced 300ms and the in-flight fetch is cancelled
 *   on every keystroke,
 * - a query shorter than 2 characters returns to the idle prompt and
 *   issues no request (the backend 400s below 2 characters anyway),
 * - the "All" tab fans out to all five sources concurrently with
 *   `limit=5` and each source fails independently (RN uses
 *   `Promise.allSettled`); a single-kind tab hits one source with
 *   `limit=20`.
 *
 * The Beacons source (`GET api/identity/search`) sits behind the
 * Identity Firewall feature gate in `backend/app.js:357`. A 404 there
 * means "not mounted on this deployment", which must not blank the
 * screen — it is reported as unavailable, not as a failure.
 */
@HiltViewModel
class UniversalSearchViewModel
    @Inject
    constructor(
        private val repo: UniversalSearchRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<UniversalSearchUiState>(UniversalSearchUiState.Idle)
        val state: StateFlow<UniversalSearchUiState> = _state.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _activeTab = MutableStateFlow(UniversalSearchTab.All)
        val activeTab: StateFlow<UniversalSearchTab> = _activeTab.asStateFlow()

        private var searchJob: Job? = null

        /**
         * Debounced search kicked on every keystroke. Cancels the
         * in-flight request first so a stale response can never
         * overwrite a newer one.
         */
        fun onQueryChange(text: String) {
            _query.value = text
            searchJob?.cancel()
            val trimmed = text.trim()
            if (trimmed.length < MIN_QUERY_LENGTH) {
                _state.value = UniversalSearchUiState.Idle
                return
            }
            _state.value = UniversalSearchUiState.Loading
            val tab = _activeTab.value
            searchJob =
                viewModelScope.launch {
                    delay(DEBOUNCE_MS)
                    search(trimmed, tab)
                }
        }

        /**
         * Tab chip tap. Re-issues immediately (no debounce) when the
         * query already clears the threshold, matching RN's
         * `handleTabChange`.
         */
        fun selectTab(tab: UniversalSearchTab) {
            if (_activeTab.value == tab) return
            searchJob?.cancel()
            _activeTab.value = tab
            val trimmed = _query.value.trim()
            if (trimmed.length < MIN_QUERY_LENGTH) {
                _state.value = UniversalSearchUiState.Idle
                return
            }
            _state.value = UniversalSearchUiState.Loading
            searchJob = viewModelScope.launch { search(trimmed, tab) }
        }

        /** Clear button — empties the field and returns to the idle prompt. */
        fun clearQuery() {
            searchJob?.cancel()
            _query.value = ""
            _state.value = UniversalSearchUiState.Idle
        }

        /** Retry wired to the error state's CTA and the inline notices. */
        fun refresh() {
            searchJob?.cancel()
            val trimmed = _query.value.trim()
            if (trimmed.length < MIN_QUERY_LENGTH) {
                _state.value = UniversalSearchUiState.Idle
                return
            }
            _state.value = UniversalSearchUiState.Loading
            val tab = _activeTab.value
            searchJob = viewModelScope.launch { search(trimmed, tab) }
        }

        /**
         * Immediate (non-debounced) fetch. The screen drives the
         * debounced [onQueryChange]; this is the seam tests exercise
         * directly.
         */
        suspend fun search(
            trimmed: String,
            tab: UniversalSearchTab,
        ) {
            val kind = tab.kind
            if (kind != null) {
                searchSingleKind(trimmed, kind)
            } else {
                searchAll(trimmed)
            }
        }

        private suspend fun searchSingleKind(
            trimmed: String,
            kind: UniversalSearchKind,
        ) {
            _state.value =
                when (val outcome = fetch(kind, trimmed, SINGLE_TAB_LIMIT)) {
                    is SourceOutcome.Results ->
                        if (outcome.rows.isEmpty()) {
                            UniversalSearchUiState.Empty()
                        } else {
                            UniversalSearchUiState.Loaded(
                                sections = listOf(UniversalSearchSection(kind, outcome.rows)),
                            )
                        }
                    SourceOutcome.Unavailable ->
                        UniversalSearchUiState.Empty(
                            beaconsUnavailable = kind == UniversalSearchKind.Beacon,
                        )
                    is SourceOutcome.Failed -> UniversalSearchUiState.Error(outcome.message)
                }
        }

        private suspend fun searchAll(trimmed: String) {
            val outcomes = fanOut(trimmed)

            val sections = mutableListOf<UniversalSearchSection>()
            val failed = mutableListOf<UniversalSearchKind>()
            val unavailable = mutableListOf<UniversalSearchKind>()
            var lastFailureMessage: String? = null

            outcomes.forEach { (kind, outcome) ->
                when (outcome) {
                    is SourceOutcome.Results ->
                        if (outcome.rows.isNotEmpty()) {
                            sections += UniversalSearchSection(kind, outcome.rows)
                        }
                    is SourceOutcome.Failed -> {
                        failed += kind
                        lastFailureMessage = outcome.message
                    }
                    SourceOutcome.Unavailable -> unavailable += kind
                }
            }

            // Every reachable source failed → the screen is genuinely broken.
            val reachable = outcomes.size - unavailable.size
            if (sections.isEmpty() && failed.isNotEmpty() && failed.size == reachable) {
                _state.value = UniversalSearchUiState.Error(lastFailureMessage ?: FALLBACK_ERROR)
                return
            }

            _state.value =
                if (sections.isEmpty()) {
                    UniversalSearchUiState.Empty(
                        beaconsUnavailable = unavailable.contains(UniversalSearchKind.Beacon),
                    )
                } else {
                    UniversalSearchUiState.Loaded(sections = sections, failedSources = failed)
                }
        }

        /**
         * Fire all five sources concurrently and collect their outcomes
         * in section order. Explicit `async { … }.await()` pairs (the
         * house style) rather than `awaitAll` over heterogeneous types.
         */
        private suspend fun fanOut(trimmed: String): List<Pair<UniversalSearchKind, SourceOutcome>> =
            coroutineScope {
                val tasks = async { fetch(UniversalSearchKind.Task, trimmed, FAN_OUT_LIMIT) }
                val people = async { fetch(UniversalSearchKind.Person, trimmed, FAN_OUT_LIMIT) }
                val beacons = async { fetch(UniversalSearchKind.Beacon, trimmed, FAN_OUT_LIMIT) }
                val businesses = async { fetch(UniversalSearchKind.Business, trimmed, FAN_OUT_LIMIT) }
                val homes = async { fetch(UniversalSearchKind.Home, trimmed, FAN_OUT_LIMIT) }
                listOf(
                    UniversalSearchKind.Task to tasks.await(),
                    UniversalSearchKind.Person to people.await(),
                    UniversalSearchKind.Beacon to beacons.await(),
                    UniversalSearchKind.Business to businesses.await(),
                    UniversalSearchKind.Home to homes.await(),
                )
            }

        private suspend fun fetch(
            kind: UniversalSearchKind,
            trimmed: String,
            limit: Int,
        ): SourceOutcome =
            when (kind) {
                UniversalSearchKind.Task ->
                    repo.gigs(trimmed, limit).fold { body -> body.gigs.map { row -> projectTask(row) } }
                UniversalSearchKind.Person ->
                    repo.people(trimmed, limit).fold { body -> body.users.map { row -> projectPerson(row) } }
                UniversalSearchKind.Beacon ->
                    repo.profiles(trimmed, limit).fold { body ->
                        body.results
                            // RN `src/app/discover.tsx:151` drops non-Beacon rows.
                            .filter { row -> row.type == PUBLIC_PROFILE_TYPE }
                            .map { row -> projectBeacon(row) }
                    }
                UniversalSearchKind.Business ->
                    repo.businesses(trimmed, limit).fold { body ->
                        body.businesses.map { row -> projectBusiness(row) }
                    }
                UniversalSearchKind.Home ->
                    repo.homes(trimmed, limit).fold { body -> body.homes.map { row -> projectHome(row) } }
            }

        /**
         * Map one repository result onto a [SourceOutcome]. A 404 on a
         * feature-gated route means "not mounted here" — never surface
         * that as an error banner over the sources that did answer.
         */
        private fun <T> NetworkResult<T>.fold(project: (T) -> List<UniversalSearchResult>): SourceOutcome =
            when (this) {
                is NetworkResult.Success -> SourceOutcome.Results(project(data))
                is NetworkResult.Failure ->
                    if (error is NetworkError.NotFound) {
                        SourceOutcome.Unavailable
                    } else {
                        SourceOutcome.Failed(error.displayMessage(FALLBACK_ERROR))
                    }
            }

        /** Outcome of one source. */
        private sealed interface SourceOutcome {
            data class Results(
                val rows: List<UniversalSearchResult>,
            ) : SourceOutcome

            data class Failed(
                val message: String,
            ) : SourceOutcome

            data object Unavailable : SourceOutcome
        }

        companion object {
            /**
             * Minimum characters before a request is issued. The backend
             * handlers reject anything shorter with a 400.
             */
            const val MIN_QUERY_LENGTH = 2

            /** Debounce window — matches RN `src/app/discover.tsx:270`. */
            const val DEBOUNCE_MS = 300L

            /** Per-source cap on the "All" tab, matching RN's `limit: 5`. */
            const val FAN_OUT_LIMIT = 5

            /** Per-source cap on a single-kind tab, matching RN's `limit: 20`. */
            const val SINGLE_TAB_LIMIT = 20

            private const val PUBLIC_PROFILE_TYPE = "public_profile"
            private const val FALLBACK_ERROR = "Couldn't search right now."

            /**
             * "Type N more characters to search." — mirrors RN's
             * `formatThresholdHint` (`src/utils/inputThreshold.ts`).
             * Null once the threshold is met, and while the field is
             * untouched.
             */
            fun thresholdHint(text: String): String? {
                val count = text.trim().length
                if (count <= 0 || count >= MIN_QUERY_LENGTH) return null
                val remaining = MIN_QUERY_LENGTH - count
                val unit = if (remaining == 1) "character" else "characters"
                return "Type $remaining more $unit to search."
            }

            /** `"City, ST"` — null when neither half is present. */
            fun locality(
                city: String?,
                state: String?,
            ): String? =
                listOfNotNull(city?.nonBlank(), state?.nonBlank())
                    .joinToString(", ")
                    .nonBlank()

            /** `$80` — RN renders `$` plus `Number(price).toFixed(0)`. */
            fun priceLabel(price: Double?): String? = price?.let { "$${it.roundToInt()}" }

            /**
             * Pull the Beacon handle out of the profile row's `href`,
             * falling back to the `@handle` subtitle then the row id.
             * Mirrors RN `beaconRouteFromProfile`
             * (`src/app/discover.tsx:44`).
             */
            fun beaconHandle(profile: UniversalSearchProfileDto): String {
                val href = profile.href.orEmpty()
                val fromHref =
                    when {
                        href.startsWith("/@") -> href.removePrefix("/@")
                        href.startsWith("/persona/") -> href.removePrefix("/persona/")
                        else -> ""
                    }.takeWhile { it != '/' && it != '?' && it != '#' }
                if (fromHref.isNotEmpty()) return fromHref
                val fromSubtitle = profile.subtitle.orEmpty().removePrefix("@")
                if (fromSubtitle.isNotEmpty()) return fromSubtitle
                return profile.id
            }

            /** Task row projection — RN `src/app/discover.tsx:119`. */
            fun projectTask(gig: UniversalSearchGigDto): UniversalSearchResult =
                UniversalSearchResult(
                    id = gig.id,
                    kind = UniversalSearchKind.Task,
                    title = gig.title?.nonBlank() ?: "Untitled Task",
                    subtitle = gig.category?.nonBlank(),
                    meta = priceLabel(gig.price),
                    imageUrl = gig.posterProfilePictureUrl?.nonBlank(),
                    destination = UniversalSearchDestination.Task(gig.id),
                )

            /** Person row projection — RN `src/app/discover.tsx:134`. */
            fun projectPerson(user: UniversalSearchPersonDto): UniversalSearchResult =
                UniversalSearchResult(
                    id = user.id,
                    kind = UniversalSearchKind.Person,
                    title = user.name?.nonBlank() ?: user.username?.nonBlank() ?: "Neighbor",
                    subtitle = user.username?.nonBlank()?.let { "@$it" },
                    meta = locality(user.city, user.state),
                    imageUrl = user.profilePicture?.nonBlank(),
                    destination = UniversalSearchDestination.Person(user.id),
                )

            /** Beacon row projection — RN `src/app/discover.tsx:53`. */
            fun projectBeacon(profile: UniversalSearchProfileDto): UniversalSearchResult =
                UniversalSearchResult(
                    id = profile.id,
                    kind = UniversalSearchKind.Beacon,
                    title = profile.title?.nonBlank() ?: "Beacon",
                    subtitle = profile.subtitle?.nonBlank(),
                    meta = profile.meta?.nonBlank(),
                    imageUrl = profile.imageUrl?.nonBlank(),
                    destination = UniversalSearchDestination.Beacon(beaconHandle(profile)),
                )

            /** Business row projection — RN `src/app/discover.tsx:158`. */
            fun projectBusiness(business: UniversalSearchBusinessDto): UniversalSearchResult =
                UniversalSearchResult(
                    id = business.id,
                    kind = UniversalSearchKind.Business,
                    title = business.name?.nonBlank() ?: business.username?.nonBlank() ?: "Business",
                    subtitle = business.businessType?.nonBlank(),
                    meta = locality(business.city, business.state),
                    imageUrl = business.profilePictureUrl?.nonBlank(),
                    destination = UniversalSearchDestination.Business(business.id),
                )

            /** Home row projection — RN `src/app/discover.tsx:173`. */
            fun projectHome(home: UniversalSearchHomeDto): UniversalSearchResult =
                UniversalSearchResult(
                    id = home.id,
                    kind = UniversalSearchKind.Home,
                    title = home.name?.nonBlank() ?: home.address?.nonBlank() ?: "Home",
                    subtitle = home.homeType?.nonBlank(),
                    meta = locality(home.city, home.state),
                    imageUrl = home.owner?.profilePictureUrl?.nonBlank(),
                    destination = UniversalSearchDestination.Home(home.id),
                )

            private fun String.nonBlank(): String? = trim().takeIf { it.isNotEmpty() }
        }
    }
