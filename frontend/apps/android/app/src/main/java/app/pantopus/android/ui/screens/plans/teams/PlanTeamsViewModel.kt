package app.pantopus.android.ui.screens.plans.teams

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.feed.FeedPreferencesUpdateRequest
import app.pantopus.android.data.api.models.plans.PlanTeamDto
import app.pantopus.android.data.api.models.plans.SportsPreferencesDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.feed.FeedActionsRepository
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlanTeamsUi(
    val query: String = "",
    val preferences: SportsPreferencesDto = SportsPreferencesDto(),
    val suggested: List<PlanTeamDto> = emptyList(),
    val results: List<PlanTeamDto> = emptyList(),
    val known: Map<String, PlanTeamDto> = emptyMap(),
    val loaded: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    val revision: Int = 0,
)

@HiltViewModel
class PlanTeamsViewModel
    @Inject
    constructor(
        private val plans: PlansRepository,
        private val feed: FeedActionsRepository,
        scopes: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        private val scope = scopes.create(viewModelScope)
        private val _ui = MutableStateFlow(PlanTeamsUi())
        val ui = _ui.asStateFlow()
        private var searchJob: Job? = null
        private var preferencesGeneration = 0

        fun load() {
            if (_ui.value.saving) return
            val generation = ++preferencesGeneration
            viewModelScope.launch {
                _ui.update { it.copy(loaded = false) }
                if (!scope.confirmCurrent()) return@launch
                when (val reply = feed.feedPreferences(force = true)) {
                    is NetworkResult.Success ->
                        if (scope.confirmCurrent() && generation == preferencesGeneration) {
                            _ui.update {
                                it.copy(
                                    preferences = reply.data.preferences.sports ?: SportsPreferencesDto(),
                                    loaded = true,
                                    error = null,
                                )
                            }
                            search(_ui.value.query)
                        }
                    is NetworkResult.Failure ->
                        if (generation == preferencesGeneration) _ui.update { it.copy(error = "Couldn't load your teams. Try again.") }
                }
            }
        }

        fun search(query: String) {
            searchJob?.cancel()
            _ui.update { it.copy(query = query, results = emptyList()) }
            searchJob =
                viewModelScope.launch {
                    delay(SEARCH_DELAY_MS)
                    if (!scope.confirmCurrent()) return@launch
                    when (val reply = plans.teams(query)) {
                        is NetworkResult.Success ->
                            if (scope.confirmCurrent() && query == _ui.value.query) {
                                _ui.update {
                                    it.copy(
                                        suggested = reply.data.suggested, results = reply.data.results,
                                        known = it.known + (reply.data.suggested + reply.data.results).associateBy { team -> team.id },
                                    )
                                }
                            }
                        is NetworkResult.Failure -> _ui.update { it.copy(error = "Couldn't search teams. Try again.") }
                    }
                }
        }

        fun follow(id: String) {
            if (!_ui.value.loaded) return
            val teams = _ui.value.preferences.teams.orEmpty()
            save(SportsPreferencesDto(watch = "on", teams = if (id in teams) teams - id else teams + id))
        }

        fun unhide(id: String) {
            if (_ui.value.loaded) save(SportsPreferencesDto(hidden = _ui.value.preferences.hidden.orEmpty() - id))
        }

        fun toggleLeague(id: String) {
            if (!_ui.value.loaded) return
            val leagues = _ui.value.preferences.leagues.orEmpty()
            save(SportsPreferencesDto(watch = "on", leagues = if (id in leagues) leagues - id else leagues + id))
        }

        fun setOff(off: Boolean) = save(SportsPreferencesDto(watch = if (off) "off" else "on"))

        fun hide(id: String) {
            if (_ui.value.saving) return
            preferencesGeneration++
            viewModelScope.launch {
                _ui.update { it.copy(saving = true) }
                if (!scope.confirmCurrent()) return@launch
                val reply = feed.feedPreferences(force = true)
                if (reply is NetworkResult.Success && scope.confirmCurrent()) {
                    persist(
                        SportsPreferencesDto(hidden = (reply.data.preferences.sports?.hidden.orEmpty() + id).distinct()),
                        reply.data.preferences.sports ?: SportsPreferencesDto(),
                    )
                } else {
                    _ui.update { it.copy(saving = false, error = "Couldn't hide this team. Try again.") }
                }
            }
        }

        private fun save(patch: SportsPreferencesDto) {
            if (_ui.value.saving) return
            preferencesGeneration++
            _ui.update { it.copy(saving = true) }
            viewModelScope.launch { persist(patch) }
        }

        private suspend fun persist(
            patch: SportsPreferencesDto,
            expected: SportsPreferencesDto? = _ui.value.preferences.takeIf { _ui.value.loaded },
        ) {
            if (!scope.confirmCurrent()) return
            when (
                val reply =
                    feed.updateFeedPreferences(
                        FeedPreferencesUpdateRequest(sports = patch, expectedSports = expected),
                        AuthenticatedDispatchGuard { credentials -> scope.requireDispatchCredentials(credentials) },
                    )
            ) {
                is NetworkResult.Success ->
                    if (scope.confirmCurrent()) {
                        _ui.update {
                            it.copy(
                                preferences = reply.data.preferences.sports ?: SportsPreferencesDto(),
                                saving = false,
                                loaded = true,
                                error = null,
                                revision = it.revision + 1,
                            )
                        }
                    }
                is NetworkResult.Failure -> _ui.update { it.copy(saving = false, error = "Couldn't save your teams. Try again.") }
            }
        }
    }

internal val sportsLeagues = listOf("nfl", "nba", "wnba", "mlb", "nhl", "mls", "nwsl", "ncaaf")

internal fun leagueLabel(id: String): String = if (id == "ncaaf") "College football" else id.uppercase(java.util.Locale.US)

private const val SEARCH_DELAY_MS = 250L
