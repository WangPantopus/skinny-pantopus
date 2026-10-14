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
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.location.ViewingLocationRepository
import app.pantopus.android.data.plans.PlanAutoRule
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanLocationResolver
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

/** The host flow's steps (boards H1, H2 to H5, H7) and the place picker (H6) over them. */
enum class HostStep { Type, Details, Place, Preview }

/** A public place picked on H6 (or "You're here now" for a pickup game). */
data class PickedPlace(
    val name: String,
    val address: String?,
    val latitude: Double,
    val longitude: Double,
    val category: String?,
    val distanceMeters: Double?,
    /** H6's row words ("Court · tennis"); the first is [category]. */
    val categories: List<String> = emptyList(),
)

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
    val placesQuery: String = "",
    /** The places' credit, shown under the list ("© OpenStreetMap contributors"). */
    val placesAttribution: String? = null,
    val placeCandidate: PickedPlace? = null,
    val origin: Pair<Double, Double>? = null,
    val playdatesOn: Boolean = false,
    /** False without a verified address: H1's playdate card leads to verification instead of the form. */
    val canHostPlaydates: Boolean = true,
    val hostName: String = "You",
    val hostAvatar: String? = null,
    val posting: Boolean = false,
    val error: String? = null,
    val postedId: String? = null,
)

/**
 * Host a plan (boards H1 to H8). The rules come from the brief: hosting needs a home or GPS within 3 miles (the
 * fix proves you're nearby and never becomes the pin); playdates meet in public places with a verified address
 * and the host approves each family; at home the host approves each person, with "people I've hosted" the only
 * rule allowed; anyone nearby is only for pickup games and walks.
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
        feature: PlansFeature,
    ) : ViewModel() {
        /** The plan "Host again" copies (A5), sent as `hosted_again_from`. */
        private var againFrom: String? = null

        private var placesSearch: Job? = null

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
                        ),
                )
            }
        }

        private suspend fun loadContext(gameId: String?) {
            val payload = (viewing.current() as? NetworkResult.Success)?.data ?: viewing.currentCopy()
            val home = payload?.homes?.firstOrNull()?.let { HostHome(it.id, it.name, it.city, it.latitude, it.longitude) }
            val games = (repository.games() as? NetworkResult.Success)?.data.orEmpty()
            // Hosting a playdate needs a verified address (`/mine` says where the person stands; unknown means yes).
            val verified = (repository.mineCopy() ?: repository.mine().data)?.viewer?.verifiedAddress ?: true
            _ui.update { it.copy(home = home, games = games, canHostPlaydates = verified) }
            if (gameId != null) games.firstOrNull { it.id == gameId }?.let(::pickGame)
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
                }
            val timed =
                if (kind == PlanKind.PICKUP_GAME) {
                    draft.copy(start = now.plusMinutes(PICKUP_LEAD_MINUTES), end = now.plusHours(2))
                } else {
                    draft.copy(start = start, end = start.plusHours(if (kind == PlanKind.WATCH_PARTY) 3 else 1))
                }
            _ui.update { it.copy(step = HostStep.Details, draft = timed, error = null) }
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

        /** A game fills in the title and the time (H2). */
        fun pickGame(game: PlanGameDto?) {
            if (game == null) {
                edit { it.copy(gameId = null) }
                return
            }
            val zone = _ui.value.zone
            val start = PlanFormat.instant(game.startsAt)?.atZone(zone)?.toLocalDateTime()
            val end = PlanFormat.instant(game.endsAt)?.atZone(zone)?.toLocalDateTime() ?: start?.plusHours(3)
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
            _ui.update { it.copy(step = HostStep.Place, placeCandidate = it.draft.place) }
            viewModelScope.launch { loadPlaces() }
        }

        private suspend fun loadPlaces() {
            val gps = locations.gpsFix()
            val home = _ui.value.home
            val origin =
                gps?.let { it.latitude to it.longitude }
                    ?: home?.let { h -> if (h.latitude != null && h.longitude != null) h.latitude to h.longitude else null }
                    ?: locations.resolve()?.let { it.latitude to it.longitude }
            if (origin == null) {
                _ui.update { it.copy(error = "Share your location or add your home to find places nearby.") }
                return
            }
            _ui.update { it.copy(origin = origin, placesLoading = true) }
            fetchPlaces(origin, query = null)
        }

        /**
         * One places read. The first ask for an area may come back `loading` while OpenStreetMap is slow: the list
         * keeps its skeleton and asks again a few seconds later.
         */
        private suspend fun fetchPlaces(
            origin: Pair<Double, Double>,
            query: String?,
        ) {
            repeat(PLACES_ATTEMPTS) { attempt ->
                val result = repository.nearbyPlaces(origin.first, origin.second, query)
                if (query != _ui.value.placesQuery.trim().takeIf(String::isNotEmpty)) return
                when (result) {
                    is NetworkResult.Success -> {
                        val reply = result.data
                        val waiting = reply.loading && reply.places.isEmpty() && attempt < PLACES_ATTEMPTS - 1
                        _ui.update {
                            it.copy(
                                placesLoading = waiting,
                                places = if (waiting) it.places else reply.places,
                                placesAttribution = reply.attribution ?: it.placesAttribution,
                                error = null,
                            )
                        }
                        if (!waiting) return
                        delay(PLACES_RETRY_MS)
                    }
                    is NetworkResult.Failure -> {
                        _ui.update { it.copy(placesLoading = false, error = result.error.planMessage) }
                        return
                    }
                }
            }
        }

        /** Search by name: the list filters at once, and the server looks further than the nearest 40. */
        fun searchPlaces(query: String) {
            _ui.update { it.copy(placesQuery = query) }
            placesSearch?.cancel()
            val origin = _ui.value.origin ?: return
            placesSearch =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    _ui.update { it.copy(placesLoading = true) }
                    fetchPlaces(origin, query.trim().takeIf(String::isNotEmpty))
                }
        }

        fun pickPlaceCandidate(place: PickedPlace) {
            _ui.update { it.copy(placeCandidate = place) }
        }

        /** "You're here now" (H4): the pin shows the area around the person's fix, never the fix itself. */
        fun pickHereNow() {
            viewModelScope.launch {
                val fix = locations.gpsFix()
                if (fix == null) {
                    _ui.update { it.copy(error = "Turn on location to use where you are.") }
                    return@launch
                }
                _ui.update { it.copy(placeCandidate = PickedPlace("Where I am now", null, fix.latitude, fix.longitude, null, 0.0)) }
            }
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
                        if (draft.hostedBefore) add(PlanAutoRule.HOSTED_BEFORE)
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
                joinRequirement = if (kind == PlanKind.PLAYDATE || draft.autoRule == PlanAutoRule.VERIFIED) "verified" else "located",
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
            }

        private fun validate(draft: HostDraft): String? {
            val now = LocalDateTime.now(_ui.value.zone)
            val start = draft.start
            val end = draft.end
            val minutes = if (start != null && end != null) Duration.between(start, end).toMinutes() else 0
            return when {
                draft.title.isBlank() -> "Give your plan a title."
                start == null || end == null -> "Pick when it starts and ends."
                start.isBefore(now.minusMinutes(1)) -> "Pick a time that hasn't passed."
                start.isAfter(now.plusDays(MAX_DAYS_AHEAD)) -> "Plans can start up to 14 days from now."
                minutes < MIN_MINUTES -> "A plan lasts at least 15 minutes."
                minutes > MAX_MINUTES -> "A plan lasts at most 8 hours."
                draft.kind == PlanKind.PLAYDATE && draft.kidsAgeBands.isEmpty() -> "Pick the kids' ages."
                draft.atHome && _ui.value.home == null -> "Add your home to host there, or choose a public place."
                !draft.atHome && draft.place == null -> "Choose a place."
                else -> null
            }
        }

        private companion object {
            const val TITLE_MAX = 80
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
            const val MAX_MINUTES = 8 * 60L
            const val PLACES_ATTEMPTS = 4
            const val PLACES_RETRY_MS = 3_000L
            const val SEARCH_DEBOUNCE_MS = 350L

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
