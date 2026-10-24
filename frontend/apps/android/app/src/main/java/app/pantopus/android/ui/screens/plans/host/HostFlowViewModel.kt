@file:Suppress("TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.plans.host

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.CreatePlanBody
import app.pantopus.android.data.api.models.plans.PlanDetailsDto
import app.pantopus.android.data.api.models.plans.PlanGameDto
import app.pantopus.android.data.api.models.plans.PlanGameRefDto
import app.pantopus.android.data.api.models.plans.PlanGpsInput
import app.pantopus.android.data.api.models.plans.PlanNearbyPlaceDto
import app.pantopus.android.data.api.models.plans.PlanPlaceInput
import app.pantopus.android.data.api.models.plans.PlanPlaceSuggestBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.location.ViewingLocationRepository
import app.pantopus.android.data.plans.PlanAutoRule
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.plans.PlanPlaceQuery
import app.pantopus.android.data.plans.PlanStudyStyle
import app.pantopus.android.data.plans.PlansEvents
import app.pantopus.android.data.plans.PlansFeature
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.planCode
import app.pantopus.android.data.plans.planMessage
import app.pantopus.android.ui.screens.place.HubVerificationTarget
import app.pantopus.android.ui.screens.plans.PlansRoutes
import app.pantopus.android.ui.screens.plans.plansVerificationTarget
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/** The host flow's steps (boards H1, H2 to H5, H7) and the place picker (H6) over them. */
enum class HostStep { Type, Details, Place, Preview }

/** A public place picked on H6 (or found by "You're here now" for a pickup game). */
data class PickedPlace(
    val name: String,
    val address: String?,
    val latitude: Double,
    val longitude: Double,
    val category: String?,
    val distanceMeters: Double?,
    /** H6's row words ("Court · tennis"); the first is [category]. */
    val categories: List<String> = emptyList(),
    /** Found by "You're here now": H4 says so under the place's name. */
    val hereNow: Boolean = false,
)

/** What H6's "You're here now" row says while it looks, or after it found nothing. */
enum class HereNowState { Idle, Locating, NoPlace, NoLocation }

/** The host's home, for "My place" (H2) and "My porch" (H5). */
data class HostHome(
    val id: String,
    val name: String?,
    val city: String?,
    val latitude: Double?,
    val longitude: Double?,
)

/** Everything the host is filling in. */
data class HostDraft(
    val kind: PlanKind? = null,
    val title: String = "",
    val titleEdited: Boolean = false,
    val about: String = "",
    val start: LocalDateTime? = null,
    val end: LocalDateTime? = null,
    val gameId: String? = null,
    val atHome: Boolean = false,
    val place: PickedPlace? = null,
    val spots: Int = 6,
    val approveEach: Boolean = true,
    val autoRule: String? = null,
    val hostedBefore: Boolean = false,
    val note: String = "",
    val sport: String = "pickleball",
    val level: String = "any",
    val extraGear: Boolean = false,
    val kidsAgeBands: Set<String> = emptySet(),
    val walkKind: String = "walk",
    val pace: String = "easy",
    val dogsWelcome: Boolean = false,
    val pickupNow: Boolean = true,
    /** A study group's subject (required) and how it studies. */
    val subject: String = "",
    val studyStyle: PlanStudyStyle = PlanStudyStyle.QUIET,
)

/** H1 to H8. */
data class HostUi(
    val step: HostStep = HostStep.Type,
    val draft: HostDraft = HostDraft(),
    val zone: ZoneId = ZoneId.systemDefault(),
    val games: List<PlanGameDto> = emptyList(),
    val home: HostHome? = null,
    val places: List<PlanNearbyPlaceDto> = emptyList(),
    val placesLoading: Boolean = false,
    /** The server is still gathering the area's places (a first look can take up to a minute). */
    val placesGathering: Boolean = false,
    /** Why H6's places couldn't load, shown with "Try again". */
    val placesError: String? = null,
    val placesQuery: String = "",
    /** The places' credit, shown under the list ("© OpenStreetMap contributors"). */
    val placesAttribution: String? = null,
    /** H6's "Suggest places" (or "Ask Pantopus" for the search text). */
    val suggestions: PlaceSuggestions = PlaceSuggestions.Idle,
    val placeCandidate: PickedPlace? = null,
    val hereNow: HereNowState = HereNowState.Idle,
    /** Every home of the host's with a point: "You're here now" never picks a place right at one. */
    val homePoints: List<Pair<Double, Double>> = emptyList(),
    val origin: Pair<Double, Double>? = null,
    val playdatesOn: Boolean = false,
    /** False without a verified address: H1's playdate card leads to verification instead of the form. */
    val canHostPlaydates: Boolean = true,
    val hostName: String = "You",
    val hostAvatar: String? = null,
    val posting: Boolean = false,
    val error: String? = null,
    val postedId: String? = null,
    /** H7's "Near Camas": the city of the plan's place (or home), looked up when the preview opens (as on iOS). */
    val previewArea: String? = null,
)

/**
 * Host a plan (boards H1 to H8). The rules come from the brief: hosting needs a home or GPS within 3 miles (the
 * fix proves you're nearby and never becomes the pin); playdates meet in public places with a verified address
 * and the host approves each family; study groups meet in public places too; at home the host approves each person,
 * with "people I've hosted" the only rule allowed; anyone nearby is only for pickup games and walks.
 */
@HiltViewModel
class HostFlowViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: PlansRepository,
        private val locations: PlanLocationResolver,
        private val viewing: ViewingLocationRepository,
        private val events: PlansEvents,
        private val homes: HomesRepository,
        private val geo: GeoApi,
        feature: PlansFeature,
    ) : ViewModel() {
        /** The plan "Host again" copies (A5), sent as `hosted_again_from`. */
        private var againFrom: String? = null

        private var placesSearch: Job? = null
        private var placesRead: Job? = null
        private var suggestJob: Job? = null

        private val _ui =
            MutableStateFlow(
                HostUi(
                    playdatesOn = feature.flags.value.playdatesOn,
                    hostName = shortName(feature.viewer?.displayName),
                    hostAvatar = feature.viewer?.avatarUrl,
                ),
            )
        val ui: StateFlow<HostUi> = _ui.asStateFlow()

        init {
            val kind = PlanKind.from(savedStateHandle.get<String>(PlansRoutes.KIND_KEY))
            val gameId = savedStateHandle.get<String>(PlansRoutes.GAME_KEY)?.takeIf(String::isNotBlank)
            val again = savedStateHandle.get<String>(PlansRoutes.AGAIN_KEY)?.takeIf(String::isNotBlank)
            viewModelScope.launch {
                loadContext(gameId)
                if (again != null) copyFrom(again)
            }
            if (kind != null && (kind != PlanKind.PLAYDATE || _ui.value.playdatesOn)) choose(kind)
        }

        /** "Host again" (A5): the same plan a week later, ready to preview. */
        private suspend fun copyFrom(planId: String) {
            val plan = (repository.plan(planId) as? NetworkResult.Success)?.data ?: return
            againFrom = planId
            val kind = PlanKind.from(plan.kind) ?: return
            val zone = PlanFormat.zone(plan.timezone)
            var start = PlanFormat.instant(plan.startsAt)?.atZone(zone)?.toLocalDateTime() ?: return
            var end = PlanFormat.instant(plan.endsAt)?.atZone(zone)?.toLocalDateTime() ?: start.plusHours(1)
            val now = LocalDateTime.now(zone)
            while (!start.isAfter(now)) {
                start = start.plusWeeks(1)
                end = end.plusWeeks(1)
            }
            val place =
                plan.place?.takeIf { plan.placeKind != "home" }?.let { p ->
                    val lat = p.latitude
                    val lng = p.longitude
                    if (lat != null && lng != null) PickedPlace(p.name ?: "The same place", p.address, lat, lng, null, null) else null
                }
            val rules = plan.autoRules.orEmpty()
            val d = plan.details
            _ui.update {
                it.copy(
                    zone = zone,
                    step = HostStep.Details,
                    draft =
                        HostDraft(
                            kind = kind,
                            title = plan.title,
                            titleEdited = true,
                            about = plan.about.orEmpty(),
                            start = start,
                            end = end,
                            atHome = plan.placeKind == "home",
                            place = place,
                            spots = plan.spots.coerceIn(1, 30),
                            approveEach = rules.none { r -> r == PlanAutoRule.VERIFIED || r == PlanAutoRule.ANYONE_NEARBY },
                            autoRule = rules.firstOrNull { r -> r == PlanAutoRule.VERIFIED || r == PlanAutoRule.ANYONE_NEARBY },
                            hostedBefore = PlanAutoRule.HOSTED_BEFORE in rules,
                            note = plan.place?.note.orEmpty(),
                            sport = d?.sport ?: "pickleball",
                            level = d?.level ?: "any",
                            extraGear = d?.extraGear == true,
                            kidsAgeBands = d?.kidsAgeBands.orEmpty().toSet(),
                            walkKind = d?.walkKind ?: "walk",
                            pace = d?.pace ?: "easy",
                            dogsWelcome = d?.dogsWelcome == true,
                            pickupNow = false,
                            subject = d?.subject.orEmpty(),
                            studyStyle = PlanStudyStyle.from(d?.studyStyle),
                        ),
                )
            }
            // "Host again" opens the preview (board A5 → H7, as on iOS); a copy that needs a fix opens its details.
            if (validate(_ui.value.draft) == null) {
                _ui.update { it.copy(step = HostStep.Preview) }
                loadPreviewArea()
            }
        }

        private suspend fun loadContext(gameId: String?) {
            val payload = (viewing.current() as? NetworkResult.Success)?.data ?: viewing.currentCopy()
            val home = payload?.homes?.firstOrNull()?.let { HostHome(it.id, it.name, it.city, it.latitude, it.longitude) }
            val homePoints = payload?.homes.orEmpty().mapNotNull { h -> h.latitude?.let { lat -> h.longitude?.let { lat to it } } }
            val games = (repository.games() as? NetworkResult.Success)?.data.orEmpty()
            // Hosting a playdate needs a verified address (`/mine` says where the person stands; unknown means yes).
            val verified = (repository.mineCopy() ?: repository.mine().data)?.viewer?.verifiedAddress ?: true
            _ui.update { it.copy(home = home, homePoints = homePoints, games = games, canHostPlaydates = verified) }
            warmPlaces(home)
            val draft = _ui.value.draft
            when {
                gameId != null -> games.firstOrNull { it.id == gameId }?.let(::pickGame)
                // A watch party chosen before the games came back starts on the soonest one (see choose).
                draft.kind == PlanKind.WATCH_PARTY && draft.gameId == null && !draft.titleEdited -> games.firstOrNull()?.let(::pickGame)
            }
        }

        /** "Verify your address" from H1's playdate card. */
        suspend fun verificationTarget(): HubVerificationTarget = plansVerificationTarget(homes)

        // ---- H1 ----

        fun choose(kind: PlanKind) {
            val now = LocalDateTime.now(_ui.value.zone)
            val start = sensibleStart(kind, now)
            val draft =
                when (kind) {
                    PlanKind.WATCH_PARTY -> HostDraft(kind = kind, spots = 8, atHome = _ui.value.home != null)
                    PlanKind.PLAYDATE -> HostDraft(kind = kind, spots = 4, title = "Playground morning")
                    PlanKind.PICKUP_GAME ->
                        HostDraft(
                            kind = kind,
                            spots = 2,
                            approveEach = false,
                            autoRule = PlanAutoRule.ANYONE_NEARBY,
                            title = "Pickleball, need 2",
                        )
                    PlanKind.WALK_COFFEE ->
                        HostDraft(kind = kind, spots = 6, approveEach = false, autoRule = PlanAutoRule.VERIFIED, title = "Coffee walk")
                    // A watch party's defaults (as on iOS), always at a public place.
                    PlanKind.STUDY_GROUP -> HostDraft(kind = kind, spots = 8)
                }
            val hours = if (kind == PlanKind.WATCH_PARTY || kind == PlanKind.STUDY_GROUP) 3L else 1L
            val timed =
                if (kind == PlanKind.PICKUP_GAME) {
                    draft.copy(start = now.plusMinutes(PICKUP_LEAD_MINUTES), end = now.plusHours(2))
                } else {
                    draft.copy(start = start, end = start.plusHours(hours))
                }
            _ui.update { it.copy(step = HostStep.Details, draft = timed, error = null) }
            // A watch party starts on the soonest game, its chip checked and its title and time filled in (board H2, as on iOS).
            if (kind == PlanKind.WATCH_PARTY) _ui.value.games.firstOrNull()?.let(::pickGame)
        }

        /**
         * Two hours from now on the hour, unless that falls at night (or, for a playdate, outside the daytime): then
         * the next sensible time, a playdate at 10 AM, a walk at 8 AM, a watch party at 7 PM.
         */
        private fun sensibleStart(
            kind: PlanKind,
            now: LocalDateTime,
        ): LocalDateTime {
            val soon = now.plusHours(2).truncatedTo(ChronoUnit.HOURS)
            val (earliest, latest, preferred) =
                when (kind) {
                    PlanKind.PLAYDATE -> Triple(DAY_START, PLAYDATE_LATEST, PLAYDATE_HOUR)
                    PlanKind.WALK_COFFEE -> Triple(WALK_EARLIEST, NIGHT_START, WALK_HOUR)
                    else -> Triple(DAY_START, NIGHT_START, EVENING_HOUR)
                }
            if (soon.hour in earliest until latest) return soon
            val day = if (soon.hour >= latest) soon.toLocalDate().plusDays(1) else soon.toLocalDate()
            return day.atTime(preferred, 0)
        }

        // ---- H2 to H5 ----

        fun edit(transform: (HostDraft) -> HostDraft) {
            _ui.update { it.copy(draft = transform(it.draft), error = null) }
        }

        fun setTitle(value: String) = edit { it.copy(title = value.take(TITLE_MAX), titleEdited = true) }

        /** A study group's subject: at most 60 characters, as the server allows. */
        fun setSubject(value: String) = edit { it.copy(subject = value.take(SUBJECT_MAX)) }

        /** A game fills in the title and the time (H2). */
        fun pickGame(game: PlanGameDto?) {
            if (game == null) {
                edit { it.copy(gameId = null) }
                return
            }
            val zone = _ui.value.zone
            val now = LocalDateTime.now(zone)
            val gameStart = PlanFormat.instant(game.startsAt)?.atZone(zone)?.toLocalDateTime()
            val gameEnd = PlanFormat.instant(game.endsAt)?.atZone(zone)?.toLocalDateTime() ?: gameStart?.plusHours(3)
            // A plan can't start in the past: a game already on starts at the next quarter hour at least 5 minutes away
            // (time to choose the place), until the game ends.
            val soon = now.plusMinutes(GAME_ON_LEAD_MINUTES).truncatedTo(ChronoUnit.MINUTES)
            val start =
                if (gameStart != null && gameStart.isBefore(now)) {
                    soon.truncatedTo(ChronoUnit.HOURS).plusMinutes((soon.minute + QUARTER_HOUR - 1) / QUARTER_HOUR * QUARTER_HOUR)
                } else {
                    gameStart
                }
            val end = if (start != null && gameEnd != null) maxOf(gameEnd, start.plusMinutes(MIN_MINUTES)) else gameEnd
            edit { draft ->
                draft.copy(
                    gameId = game.id,
                    title = if (draft.titleEdited) draft.title else "${game.label} game on the big screen",
                    start = start ?: draft.start,
                    end = end ?: draft.end,
                )
            }
        }

        fun setStart(value: LocalDateTime) =
            edit { draft ->
                val length = if (draft.start != null && draft.end != null) Duration.between(draft.start, draft.end) else Duration.ofHours(1)
                draft.copy(start = value, end = value.plus(length))
            }

        fun setEnd(value: LocalDateTime) = edit { it.copy(end = value) }

        /** "A public place" or "My place" / "My porch". At home the host always approves each person (D6, D7). */
        fun setAtHome(atHome: Boolean) =
            edit { draft ->
                if (atHome) {
                    draft.copy(atHome = true, approveEach = true, autoRule = null)
                } else {
                    draft.copy(atHome = false)
                }
            }

        /** Now or later, for a pickup game (H4). */
        fun setPickupNow(now: Boolean) {
            val zone = _ui.value.zone
            val clock = LocalDateTime.now(zone)
            edit { draft ->
                if (now) {
                    draft.copy(pickupNow = true, start = clock.plusMinutes(PICKUP_LEAD_MINUTES), end = clock.plusHours(2))
                } else {
                    val start = clock.plusHours(3).truncatedTo(ChronoUnit.HOURS)
                    draft.copy(pickupNow = false, start = start, end = start.plusHours(2))
                }
            }
        }

        // ---- H6 ----

        fun openPlaces() {
            suggestJob?.cancel()
            _ui.update {
                it.copy(
                    step = HostStep.Place,
                    placeCandidate = it.draft.place,
                    hereNow = HereNowState.Idle,
                    placesError = null,
                    suggestions = PlaceSuggestions.Idle,
                )
            }
            placesRead?.cancel()
            placesRead = viewModelScope.launch { loadPlaces() }
        }

        /** "Try again" under H6's list: the same read again (the search's, while searching). */
        fun retryPlaces() {
            val origin = _ui.value.origin
            val query = _ui.value.placesQuery.trim().takeIf(String::isNotEmpty)
            placesRead?.cancel()
            placesRead = viewModelScope.launch { if (origin == null) loadPlaces() else fetchPlaces(origin, query) }
        }

        /**
         * Starts the server gathering the public places around the host when the flow opens, so H6 usually opens on a
         * full list: a new area can take the map servers up to a minute (as on iOS). Nothing is shown from it.
         */
        private fun warmPlaces(home: HostHome?) {
            viewModelScope.launch {
                val point =
                    locations.gpsFix()?.let { it.latitude to it.longitude }
                        ?: home?.let { h -> if (h.latitude != null && h.longitude != null) h.latitude to h.longitude else null }
                        ?: return@launch
                repository.nearbyPlaces(point.first, point.second, wait = false)
            }
        }

        private suspend fun loadPlaces() {
            val gps = locations.gpsFix()
            val home = _ui.value.home
            val origin =
                gps?.let { it.latitude to it.longitude }
                    ?: home?.let { h -> if (h.latitude != null && h.longitude != null) h.latitude to h.longitude else null }
                    ?: locations.resolve()?.let { it.latitude to it.longitude }
            if (origin == null) {
                _ui.update { it.copy(placesError = "Share your location or add your home to find places nearby.") }
                return
            }
            _ui.update { it.copy(origin = origin) }
            fetchPlaces(origin, query = null)
        }

        /** What H6's list and suggestions are for: the draft's kind, a pickup game's sport, and its time. */
        private fun planPlaceQuery(): PlanPlaceQuery? {
            val ui = _ui.value
            val kind = ui.draft.kind ?: return null
            val start = ui.draft.start ?: return null
            return placeQuery(kind, ui.draft.sport, start, ui.draft.end, ui.zone)
        }

        /**
         * One places read, ordered for the plan. A first ask for an area may come back `loading` while OpenStreetMap is
         * slow: the list keeps its skeleton (saying why after the first such answer) and the read asks again.
         */
        private suspend fun fetchPlaces(
            origin: Pair<Double, Double>,
            query: String?,
        ) {
            val stillAsked = { query == _ui.value.placesQuery.trim().takeIf(String::isNotEmpty) }
            _ui.update { it.copy(placesLoading = true, placesGathering = false, placesError = null) }
            val result =
                repository.nearbyPlacesWhenReady(origin.first, origin.second, query, planPlaceQuery()) { reply ->
                    if (stillAsked()) {
                        _ui.update { it.copy(placesGathering = true, placesAttribution = reply.attribution ?: it.placesAttribution) }
                    }
                }
            if (!stillAsked()) return
            _ui.update {
                when (result) {
                    is NetworkResult.Success ->
                        if (result.data.loading) {
                            it.copy(placesLoading = false, placesGathering = false, placesError = PLACES_SLOW)
                        } else {
                            it.copy(
                                placesLoading = false,
                                placesGathering = false,
                                places = result.data.places,
                                placesAttribution = result.data.attribution ?: it.placesAttribution,
                            )
                        }
                    is NetworkResult.Failure ->
                        it.copy(placesLoading = false, placesGathering = false, placesError = placesFailure(result.error))
                }
            }
        }

        /** Search by name: the list filters at once, and the server looks further than the nearest 40. */
        fun searchPlaces(query: String) {
            if (query.trim() != _ui.value.placesQuery.trim()) {
                // Suggestions answer the words they were asked with (as on iOS).
                suggestJob?.cancel()
                _ui.update { it.copy(suggestions = PlaceSuggestions.Idle) }
            }
            _ui.update { it.copy(placesQuery = query) }
            placesSearch?.cancel()
            val origin = _ui.value.origin ?: return
            placesSearch =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    fetchPlaces(origin, query.trim().takeIf(String::isNotEmpty))
                }
        }

        /** H6's "Suggest places" ([ask] null), or "Ask Pantopus" for what the host typed in the search box. */
        fun suggestPlaces(ask: String?) {
            val ui = _ui.value
            val origin = ui.origin ?: return
            val draft = ui.draft
            val kind = draft.kind ?: return
            val plan = planPlaceQuery() ?: return
            val body =
                PlanPlaceSuggestBody(
                    latitude = origin.first,
                    longitude = origin.second,
                    kind = kind.wire,
                    title = draft.title.trim().takeIf(String::isNotEmpty),
                    about = draft.about.trim().takeIf(String::isNotEmpty),
                    startsAt = plan.startsAt,
                    endsAt = plan.endsAt,
                    spots = draft.spots,
                    details = details(kind, draft, ui.games.firstOrNull { it.id == draft.gameId }),
                    ask = ask,
                )
            suggestJob?.cancel()
            _ui.update { it.copy(suggestions = PlaceSuggestions.Loading(gathering = false)) }
            suggestJob =
                viewModelScope.launch {
                    val result =
                        repository.suggestPlacesWhenReady(body) {
                            _ui.update { it.copy(suggestions = PlaceSuggestions.Loading(gathering = true)) }
                        }
                    _ui.update { it.copy(suggestions = PlaceSuggestions.from(result, ask)) }
                }
        }

        fun pickPlaceCandidate(place: PickedPlace) {
            _ui.update { it.copy(placeCandidate = place, hereNow = HereNowState.Idle) }
        }

        /**
         * "You're here now" (board H4): a fresh fix, then the nearest named public place within about 150 m of it from
         * H6's own list, never the fix itself (decision D2). A place right at one of the host's homes doesn't count:
         * the server refuses a public place that close to a home (HOME_GUARD_METERS in planRules.js).
         */
        fun pickHereNow() {
            if (_ui.value.hereNow == HereNowState.Locating) return
            _ui.update { it.copy(hereNow = HereNowState.Locating, error = null) }
            viewModelScope.launch {
                val fix = locations.newFix()
                if (fix == null) {
                    _ui.update { it.copy(hereNow = HereNowState.NoLocation) }
                    return@launch
                }
                val homes = _ui.value.homePoints
                val spot =
                    placesAround(fix.latitude to fix.longitude)
                        .mapNotNull { it.toPicked() }
                        .map { it to (it.distanceMeters ?: metersBetween(fix.latitude, fix.longitude, it.latitude, it.longitude)) }
                        .filter { (place, meters) -> meters <= HERE_NOW_METERS && !atHome(place, homes) }
                        .minByOrNull { (_, meters) -> meters }
                        ?.first
                _ui.update {
                    if (spot == null) {
                        it.copy(hereNow = HereNowState.NoPlace)
                    } else {
                        it.copy(hereNow = HereNowState.Idle, placeCandidate = spot.copy(hereNow = true))
                    }
                }
            }
        }

        private fun atHome(
            place: PickedPlace,
            homes: List<Pair<Double, Double>>,
        ): Boolean = homes.any { (lat, lng) -> metersBetween(lat, lng, place.latitude, place.longitude) <= HOME_GUARD_METERS }

        /** The public places around a point, nearest first; a first ask for an area may answer `loading` (as on H6). */
        private suspend fun placesAround(point: Pair<Double, Double>): List<PlanNearbyPlaceDto> {
            repeat(PLACES_ATTEMPTS) { attempt ->
                val reply = (repository.nearbyPlaces(point.first, point.second) as? NetworkResult.Success)?.data ?: return emptyList()
                if (!reply.loading || attempt == PLACES_ATTEMPTS - 1) return reply.places
                delay(PLACES_RETRY_MS)
            }
            return emptyList()
        }

        fun usePlace() {
            val place = _ui.value.placeCandidate ?: return
            _ui.update { it.copy(step = HostStep.Details, draft = it.draft.copy(place = place, atHome = false)) }
        }

        fun closePlaces() {
            _ui.update { it.copy(step = HostStep.Details) }
        }

        // ---- H7 ----

        fun preview() {
            val problem = validate(_ui.value.draft)
            if (problem != null) {
                _ui.update { it.copy(error = problem) }
                return
            }
            _ui.update { it.copy(step = HostStep.Preview, error = null) }
            loadPreviewArea()
        }

        /** The city the place is in, for the preview's "Near Camas" (iOS reverse-geocodes the same point). */
        private fun loadPreviewArea() {
            val ui = _ui.value
            val point =
                if (ui.draft.atHome) {
                    ui.home?.let { h -> if (h.latitude != null && h.longitude != null) h.latitude to h.longitude else null }
                } else {
                    ui.draft.place?.let { it.latitude to it.longitude }
                }
            _ui.update { it.copy(previewArea = null) }
            point ?: return
            viewModelScope.launch {
                val city =
                    when (val reply = safeApiCall { geo.reverse(point.first, point.second) }) {
                        is NetworkResult.Success -> reply.data.normalized.city?.trim()
                        is NetworkResult.Failure -> null
                    }
                if (!city.isNullOrEmpty()) _ui.update { it.copy(previewArea = "Near $city") }
            }
        }

        fun back(): Boolean {
            val step = _ui.value.step
            val previous =
                when (step) {
                    HostStep.Type -> return false
                    HostStep.Details -> HostStep.Type
                    HostStep.Place -> HostStep.Details
                    HostStep.Preview -> HostStep.Details
                }
            _ui.update { it.copy(step = previous, error = null) }
            return true
        }

        fun post() {
            val ui = _ui.value
            val draft = ui.draft
            val kind = draft.kind ?: return
            validate(draft)?.let { problem ->
                _ui.update { it.copy(error = problem) }
                return
            }
            _ui.update { it.copy(posting = true, error = null) }
            viewModelScope.launch {
                val fix = locations.gpsFix()
                val body = buildBody(kind, draft, ui, fix?.let { PlanGpsInput(it.latitude, it.longitude, it.at.toString()) })
                when (val result = repository.create(body)) {
                    is NetworkResult.Success -> {
                        events.posted(result.data.id)
                        _ui.update { it.copy(posting = false, postedId = result.data.id) }
                    }
                    is NetworkResult.Failure ->
                        _ui.update {
                            it.copy(
                                posting = false,
                                error =
                                    when (result.error.planCode) {
                                        "not_near" -> "You can host within 3 miles of where you live or where you are now."
                                        "needs_verified_address" -> "Playdates are for neighbors with a verified address."
                                        else -> result.error.planMessage
                                    },
                            )
                        }
                }
            }
        }

        private fun buildBody(
            kind: PlanKind,
            draft: HostDraft,
            ui: HostUi,
            gps: PlanGpsInput?,
        ): CreatePlanBody {
            val zone = ui.zone
            val home = ui.home
            val place =
                if (draft.atHome && home != null) {
                    PlanPlaceInput(kind = "home", name = "${ui.hostName.substringBefore(' ')}'s place", homeId = home.id)
                } else {
                    val picked = draft.place
                    PlanPlaceInput(
                        kind = "public",
                        name = picked?.name,
                        address = picked?.address,
                        latitude = picked?.latitude,
                        longitude = picked?.longitude,
                    )
                }
            val rules =
                buildList {
                    if (kind != PlanKind.PLAYDATE) {
                        if (!draft.approveEach && !draft.atHome) draft.autoRule?.let(::add)
                        // Not for a pickup game: its form has no such box (board H4), as on iOS.
                        if (draft.hostedBefore && kind != PlanKind.PICKUP_GAME) add(PlanAutoRule.HOSTED_BEFORE)
                    }
                }.distinct()
            val game = ui.games.firstOrNull { it.id == draft.gameId }
            return CreatePlanBody(
                kind = kind.wire,
                title = draft.title.trim(),
                about = draft.about.trim().takeIf(String::isNotEmpty),
                startsAt = draft.start!!.atZone(zone).toInstant().toString(),
                endsAt = draft.end!!.atZone(zone).toInstant().toString(),
                place = place,
                spots = draft.spots,
                autoRules = rules,
                // Who can ask (decision D5, as on iOS): anyone nearby, or only verified neighbors for a playdate.
                // "Verified neighbors get in right away" is the `verified` rule above; others still ask.
                joinRequirement = if (kind == PlanKind.PLAYDATE) "verified" else "located",
                details = details(kind, draft, game),
                guestNote = draft.note.trim().takeIf(String::isNotEmpty),
                gps = gps,
                hostedAgainFrom = againFrom,
            )
        }

        private fun details(
            kind: PlanKind,
            draft: HostDraft,
            game: PlanGameDto?,
        ): PlanDetailsDto =
            when (kind) {
                PlanKind.WATCH_PARTY -> PlanDetailsDto(game = game?.let { PlanGameRefDto(it.label, it.startsAt) })
                PlanKind.PLAYDATE -> PlanDetailsDto(kidsAgeBands = draft.kidsAgeBands.toList())
                PlanKind.PICKUP_GAME -> PlanDetailsDto(sport = draft.sport, level = draft.level, extraGear = draft.extraGear)
                PlanKind.WALK_COFFEE -> PlanDetailsDto(walkKind = draft.walkKind, pace = draft.pace, dogsWelcome = draft.dogsWelcome)
                PlanKind.STUDY_GROUP -> PlanDetailsDto(subject = draft.subject.cleanSubject(), studyStyle = draft.studyStyle.wire)
            }

        private fun validate(draft: HostDraft): String? {
            val now = LocalDateTime.now(_ui.value.zone)
            val start = draft.start
            val end = draft.end
            val minutes = if (start != null && end != null) Duration.between(start, end).toMinutes() else 0
            val kindProblem = kindProblem(draft)
            return when {
                draft.title.isBlank() -> "Give your plan a title."
                start == null || end == null -> "Pick when it starts and ends."
                start.isBefore(now.minusMinutes(1)) -> "Pick a time that hasn't passed."
                start.isAfter(now.plusDays(MAX_DAYS_AHEAD)) -> "Plans can start up to 14 days from now."
                minutes < MIN_MINUTES -> "A plan lasts at least 15 minutes."
                minutes > MAX_MINUTES -> "A plan lasts at most 8 hours."
                kindProblem != null -> kindProblem
                draft.atHome && _ui.value.home == null -> "Add your home to host there, or choose a public place."
                !draft.atHome && draft.place == null -> "Choose a place."
                else -> null
            }
        }

        /** What the chosen kind still needs: a playdate's kids' ages, a study group's subject; null when nothing. */
        private fun kindProblem(draft: HostDraft): String? =
            when (draft.kind) {
                PlanKind.PLAYDATE -> "Pick the kids' ages.".takeIf { draft.kidsAgeBands.isEmpty() }
                PlanKind.STUDY_GROUP -> "Add what you're studying.".takeIf { draft.subject.cleanSubject().isEmpty() }
                else -> null
            }

        private companion object {
            const val TITLE_MAX = 80
            const val SUBJECT_MAX = 60
            const val PICKUP_LEAD_MINUTES = 15L
            const val DAY_START = 8
            const val WALK_EARLIEST = 7
            const val NIGHT_START = 21
            const val PLAYDATE_LATEST = 18
            const val PLAYDATE_HOUR = 10
            const val WALK_HOUR = 8
            const val EVENING_HOUR = 19
            const val MAX_DAYS_AHEAD = 14L
            const val MIN_MINUTES = 15L
            const val QUARTER_HOUR = 15L
            const val GAME_ON_LEAD_MINUTES = 5L
            const val MAX_MINUTES = 8 * 60L
            const val PLACES_ATTEMPTS = 8
            const val PLACES_RETRY_MS = 3_000L
            const val SEARCH_DEBOUNCE_MS = 350L

            /** How close a public place must be to the host's fix to be "here" (about a city block). */
            const val HERE_NOW_METERS = 150.0

            /** The server refuses a public place this close to one of the host's homes. */
            const val HOME_GUARD_METERS = 50.0
            const val EARTH_RADIUS_METERS = 6_371_000.0

            fun metersBetween(
                fromLat: Double,
                fromLng: Double,
                toLat: Double,
                toLng: Double,
            ): Double {
                val dLat = Math.toRadians(toLat - fromLat)
                val dLng = Math.toRadians(toLng - fromLng)
                val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(fromLat)) * cos(Math.toRadians(toLat)) * sin(dLng / 2).pow(2)
                return EARTH_RADIUS_METERS * 2 * atan2(sqrt(a), sqrt(1 - a))
            }

            /** The subject as the server keeps it: trimmed, with runs of spaces made one. */
            fun String.cleanSubject(): String = trim().replace(Regex("\\s+"), " ")

            /** "Sam Rivera" → "Sam R." (first name and last initial, as everyone sees a host). */
            fun shortName(name: String?): String {
                val parts = name?.trim()?.split(Regex("\\s+")).orEmpty().filter(String::isNotBlank)
                return when {
                    parts.isEmpty() -> "You"
                    parts.size == 1 -> parts[0]
                    else -> "${parts.first()} ${parts.last().first()}."
                }
            }
        }
    }
