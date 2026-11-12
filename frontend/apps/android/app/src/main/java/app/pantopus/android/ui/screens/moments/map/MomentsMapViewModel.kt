@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.map

import android.content.Context
import android.location.Geocoder
import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.moments.MomentPosting
import app.pantopus.android.data.moments.MomentPostingOutcome
import app.pantopus.android.data.moments.MomentsFeature
import app.pantopus.android.data.moments.MomentsPlayback
import app.pantopus.android.data.moments.MomentsPosting
import app.pantopus.android.data.moments.MomentsRepository
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.plans.PlanLocationResolver
import com.google.android.gms.maps.model.CameraPosition
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.util.Locale
import javax.inject.Inject
import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/** A ring as the map and the strip draw it: the server's ring, each Moment's watched state here, and how far it is. */
@Immutable
data class MomentRingUi(
    val ring: MomentRingDto,
    /** Each Moment watched (by the server's word or here since), oldest first; never for your own ring. */
    val seen: List<Boolean>,
    /** From the middle of the map. */
    val distanceMeters: Double,
) {
    val id: String get() = ring.id
    val author: MomentAuthorDto get() = ring.author
    val latitude: Double get() = ring.latitude
    val longitude: Double get() = ring.longitude
    val placeLabel: String? get() = ring.placeLabel
    val anyNew: Boolean get() = seen.any { !it }
    val mine: Boolean get() = ring.mine

    /** The strip's line under the face: your own ring is "You", others go by first name. */
    val stripLabel: String
        get() = if (mine) "You" else author.firstName?.takeIf { it.isNotBlank() } ?: author.name?.substringBefore(' ') ?: ""

    /** "Aisha M., 1 Moment, new, at Esther Short Park, verified resident" (board M1). */
    val spoken: String
        get() {
            val count = if (seen.size == 1) "1 Moment" else "${seen.size} Moments"
            val name = if (mine) "Your Moments" else author.name ?: author.firstName ?: "Someone"
            return listOfNotNull(
                name,
                count,
                if (anyNew) "new" else "watched",
                placeLabel?.let { "at $it" },
                if (author.verified) "verified resident" else null,
            ).joinToString(", ")
        }
}

/**
 * One face in the strip: a person, with every spot they have a Moment at in view, nearest first (the order they play
 * in). Someone at three spots is one face, not three; the face's segments and its "new" count every spot.
 */
@Immutable
data class MomentStripPerson(
    val rings: List<MomentRingUi>,
) {
    /** Their nearest spot: the strip's test id and what plays first. */
    val first: MomentRingUi get() = rings.first()
    val author: MomentAuthorDto get() = first.author
    val seen: List<Boolean> get() = rings.flatMap { it.seen }
    val stripLabel: String get() = first.stripLabel

    /** As a ring reads, but someone at several spots reads "at 3 places" (as on iPhone). */
    val spoken: String
        get() {
            if (rings.size == 1) return first.spoken
            val count = seen.size
            val name = if (first.mine) "Your Moments" else author.name ?: author.firstName ?: "Someone"
            return listOfNotNull(
                name,
                if (count == 1) "1 Moment" else "$count Moments",
                if (seen.any { !it }) "new" else "watched",
                "at ${rings.size} places",
                if (author.verified) "verified resident" else null,
            ).joinToString(", ")
        }
}

/** The strip's faces, one per person, in [shown]'s order (you first, then new ones, then nearest). */
fun stripPeople(shown: List<MomentRingUi>): List<MomentStripPerson> =
    shown
        .groupBy { it.author.id }
        .values
        .map { rings -> MomentStripPerson(rings.sortedBy { it.distanceMeters }) }

/** Where the map opens and recenters: the person (a fresh fix) or, with location off, their home. */
data class MomentsCenter(
    val latitude: Double,
    val longitude: Double,
    val fromGps: Boolean,
)

/** A crowded spot zoomed into (board M2): the strip shows only its rings, and Back returns to the area. */
data class MomentsSpot(
    val ringIds: Set<String>,
    val label: String?,
    val returnTo: CameraPosition?,
    /** The zoom the tap left the map at: zoomed in past it until the bubble has split, the spot closes. */
    val openedZoom: Float? = null,
)

data class MomentsMapUiState(
    val center: MomentsCenter? = null,
    /** True until the map knows where to open (a fix or the home). */
    val locating: Boolean = true,
    /** No fix and no home: the map asks for location. */
    val locationMissing: Boolean = false,
    val rings: List<MomentRingDto> = emptyList(),
    /** The first read for the area in view is in (the strip or M3's card can show). */
    val loaded: Boolean = false,
    val failed: Boolean = false,
    /** The area pill ("Downtown Vancouver"). */
    val areaLabel: String? = null,
    /** M3's "Share what's happening at <place>": where you'd post from. */
    val emptyPlace: String? = null,
    val spot: MomentsSpot? = null,
)

/**
 * The Moments map (boards M1 to M3, P5): rings for the area in view, read again when the map settles, when something
 * changes (a Moment posted or deleted, a person muted or blocked) and each minute while the tab shows, so a Moment
 * leaves the map when its time is up.
 */
@HiltViewModel
class MomentsMapViewModel
    @Inject
    constructor(
        private val repository: MomentsRepository,
        private val posting: MomentsPosting,
        private val locations: PlanLocationResolver,
        private val auth: AuthRepository,
        private val feature: MomentsFeature,
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        private val _state = MutableStateFlow(MomentsMapUiState())
        val state: StateFlow<MomentsMapUiState> = _state.asStateFlow()

        /** Moments posting now (board P5). */
        val posts: StateFlow<List<MomentPosting>> = posting.posts

        /** Your photo, for your posting ring. */
        val avatarUrl: String? get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.avatarUrl

        private val viewCenter = MutableStateFlow<Pair<Double, Double>?>(null)

        /** The rings with what's been watched here, nearest the middle of the map first. */
        val rings: StateFlow<List<MomentRingUi>> =
            combine(_state.map { it.rings }, repository.watched, repository.reported, viewCenter) { rings, watched, reported, center ->
                val now = Instant.now()
                rings.mapNotNull { ring ->
                    // A Moment leaves the moment its time is up, before the next read, and one you reported at once.
                    val live =
                        ring.moments.filter { brief ->
                            brief.id !in reported && brief.expiresAt?.let { parseInstant(it)?.isAfter(now) } ?: true
                        }
                    if (live.isEmpty()) return@mapNotNull null
                    MomentRingUi(
                        ring = ring.copy(moments = live),
                        // Your own ring keeps its color (the server says your Moments are "seen"; `mine` styles it).
                        seen = live.map { !ring.mine && (it.seen || it.id in watched) },
                        distanceMeters =
                            center
                                ?.takeIf { !ring.noLocation }
                                ?.let { (lat, lng) -> metersBetween(lat, lng, ring.latitude, ring.longitude) } ?: 0.0,
                    )
                }
            }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

        private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 2)

        /** One-line notices for the map's toast ("Your Moment is live. It shows for 24 hours."). */
        val messages: SharedFlow<String> = _messages.asSharedFlow()

        /** Notes from outside the map ("This Moment has ended." after a push for one), each shown once. */
        val outsideNotes: Flow<String> = repository.mapNote.filterNotNull().onEach { repository.mapNoteShown() }

        private val _wentLive = MutableSharedFlow<Unit>(extraBufferCapacity = 2)

        private val _liveSpot = MutableStateFlow<Pair<Double, Double>?>(null)

        /** Where your Moment that just went live is, until the map has made sure it's in view (it moves there if not). */
        val liveSpot: StateFlow<Pair<Double, Double>?> = _liveSpot.asStateFlow()

        /** A Moment of yours just went live: the map marks it with a tap you can feel. */
        val wentLive: SharedFlow<Unit> = _wentLive.asSharedFlow()

        private var viewport: Viewport? = null
        private var fetching: Job? = null
        private var labeledAt: Pair<Double, Double>? = null
        private var labeling: Job? = null

        init {
            viewModelScope.launch { repository.changes.collect { refresh() } }
            viewModelScope.launch {
                posting.outcomes.collect { outcome ->
                    when (outcome) {
                        is MomentPostingOutcome.Held -> _messages.tryEmit("Your Moment is waiting for a quick review before it shows.")
                        is MomentPostingOutcome.Live -> {
                            val hours = outcome.moment.hours
                            _messages.tryEmit("Your Moment is live. It shows for ${if (hours == 1) "1 hour" else "$hours hours"}.")
                            _wentLive.tryEmit(Unit)
                            val moment = outcome.moment
                            if (moment.latitude != null && moment.longitude != null) _liveSpot.value = moment.latitude to moment.longitude
                        }
                    }
                    refresh()
                }
            }
        }

        /** Finds where the map opens: a fresh fix, else the home. Called when the tab appears. */
        fun locate(waitForFix: Boolean = false) {
            viewModelScope.launch {
                val fix = if (locations.hasLocationPermission()) locations.gpsFix() else null
                val center =
                    fix?.let { MomentsCenter(it.latitude, it.longitude, fromGps = true) }
                        ?: locations.home()?.let { MomentsCenter(it.latitude, it.longitude, fromGps = false) }
                if (center == null && waitForFix && locations.hasLocationPermission()) {
                    locations.newFix()?.let { fresh ->
                        val here = MomentsCenter(fresh.latitude, fresh.longitude, fromGps = true)
                        _state.update { it.copy(center = here, locating = false, locationMissing = false) }
                        return@launch
                    }
                }
                _state.update {
                    it.copy(center = center ?: it.center, locating = false, locationMissing = center == null && it.center == null)
                }
                // "Show my location" is also "look again".
                refresh()
            }
        }

        /** "Use my home" from the area pill. */
        fun useHome() {
            viewModelScope.launch {
                val home = locations.home() ?: return@launch
                _state.update { it.copy(center = MomentsCenter(home.latitude, home.longitude, fromGps = false), locationMissing = false) }
            }
        }

        /** The map settled on a new area: read its rings (and its name) once it has been still a moment. */
        fun setViewport(
            south: Double,
            west: Double,
            north: Double,
            east: Double,
            zoom: Float,
        ) {
            val next = Viewport(south, west, north, east, zoom)
            viewCenter.value = next.centerLatitude to next.centerLongitude
            if (next == viewport && _state.value.loaded) return
            viewport = next
            fetch(next)
            label(next)
        }

        /** Reads the area in view again. */
        fun refresh() {
            viewport?.let(::fetch)
        }

        private fun fetch(area: Viewport) {
            fetching?.cancel()
            fetching =
                viewModelScope.launch {
                    when (
                        val result =
                            repository.map(area.south, area.west, area.north, area.east, area.zoom.toInt().coerceIn(1, MAX_ZOOM))
                    ) {
                        is NetworkResult.Success -> {
                            _state.update { it.copy(rings = result.data, loaded = true, failed = false) }
                            if (result.data.all { it.noLocation }) emptyPlace()
                        }
                        is NetworkResult.Failure -> {
                            // Moments was turned off while the app was open (every route then answers 404
                            // `MOMENTS_UNAVAILABLE`): read the flag now, so the tab leaves at once.
                            if (result.error == NetworkError.NotFound || result.error.serverCode == "MOMENTS_UNAVAILABLE") {
                                feature.refresh()
                            }
                            _state.update { it.copy(loaded = true, failed = it.rings.isEmpty()) }
                        }
                    }
                }
        }

        /** M3's line names where you'd post from: the place at your location, else the area in view. */
        private fun emptyPlace() {
            if (_state.value.emptyPlace != null) return
            val center = _state.value.center?.takeIf { it.fromGps } ?: return
            viewModelScope.launch {
                val preview = repository.placePreview(center.latitude, center.longitude)
                (preview as? NetworkResult.Success)?.data?.placeLabel?.let { place -> _state.update { it.copy(emptyPlace = place) } }
            }
        }

        /** Names the area in view for the pill: the neighborhood when zoomed in, the town when zoomed out. */
        private fun label(area: Viewport) {
            val center = area.centerLatitude to area.centerLongitude
            val last = labeledAt
            if (last != null && metersBetween(last.first, last.second, center.first, center.second) < RELABEL_METERS) return
            labeling?.cancel()
            labeling =
                viewModelScope.launch {
                    delay(LABEL_SETTLE_MS)
                    val name = withContext(Dispatchers.IO) { areaName(center.first, center.second, area.zoom) }
                    labeledAt = center
                    if (name != null) {
                        _state.update { it.copy(areaLabel = name) }
                    } else if (_state.value.areaLabel == null) {
                        locations.home()?.label?.let { town -> _state.update { it.copy(areaLabel = town) } }
                    }
                }
        }

        @Suppress("DEPRECATION")
        private fun areaName(
            latitude: Double,
            longitude: Double,
            zoom: Float,
        ): String? =
            runCatching {
                if (!Geocoder.isPresent()) return@runCatching null
                val address = Geocoder(context, Locale.getDefault()).getFromLocation(latitude, longitude, 1)?.firstOrNull()
                val town = address?.locality ?: address?.subAdminArea
                if (zoom >= NEIGHBORHOOD_ZOOM) address?.subLocality ?: town else town
            }.getOrNull()

        /** M2: a crowded spot was tapped; the strip shows only its rings until Back. */
        fun openSpot(
            rings: List<MomentRingUi>,
            returnTo: CameraPosition?,
            openedZoom: Float? = null,
        ) {
            val label = rings.groupingBy { it.placeLabel }.eachCount().maxByOrNull { it.value }?.key
            _state.update { it.copy(spot = MomentsSpot(rings.map { ring -> ring.id }.toSet(), label, returnTo, openedZoom)) }
        }

        fun closeSpot() {
            _state.update { it.copy(spot = null) }
        }

        /** A spot the viewer asked to see (the place under a Moment's name, tapped), until the map has moved there. */
        val placeToShow: StateFlow<Pair<Double, Double>?> = repository.placeToShow

        fun placeShown() = repository.placeShown()

        /**
         * Hands the viewer its queue: [start] and then the other rings shown, nearest to it first, new ones before
         * watched ones (swiping left moves to the next ring nearby).
         */
        fun watch(
            start: MomentRingUi,
            shown: List<MomentRingUi>,
        ) {
            val rest = othersAfter(start, shown.filter { it.id != start.id })
            repository.playback = MomentsPlayback(rings = (listOf(start) + rest).map { it.ring }, startIndex = 0, newOnly = false)
        }

        /** What plays after [start]: [others], new ones before watched ones, nearest to [start] first. */
        private fun othersAfter(
            start: MomentRingUi,
            others: List<MomentRingUi>,
        ): List<MomentRingUi> =
            others.sortedWith(
                compareByDescending<MomentRingUi> { it.anyNew }
                    .thenBy { metersBetween(start.latitude, start.longitude, it.latitude, it.longitude) },
            )

        /** Play all: every ring shown with something new, nearest first, playing only the new Moments. */
        fun playAll(shown: List<MomentRingUi>): Boolean {
            val fresh = shown.filter { it.anyNew && !it.mine }
            val queue = fresh.ifEmpty { shown }
            if (queue.isEmpty()) return false
            repository.playback = MomentsPlayback(rings = queue.map { it.ring }, startIndex = 0, newOnly = fresh.isNotEmpty())
            return true
        }

        /** The map has your new ring in view (it was there, or the map moved to it). */
        fun liveSpotShown() {
            _liveSpot.value = null
        }

        /**
         * A face in the strip: that person's spots one after another, nearest first, then the other rings shown as after
         * a tapped ring.
         */
        fun watchPerson(
            person: MomentStripPerson,
            shown: List<MomentRingUi>,
        ) {
            val theirs = person.rings.map { it.id }.toSet()
            val rest = othersAfter(person.first, shown.filter { it.id !in theirs })
            repository.playback = MomentsPlayback(rings = (person.rings + rest).map { it.ring }, startIndex = 0, newOnly = false)
        }

        fun retryPosting(momentId: String) = posting.retry(momentId)

        fun discardPosting(momentId: String) = posting.discard(momentId)

        private data class Viewport(
            val south: Double,
            val west: Double,
            val north: Double,
            val east: Double,
            val zoom: Float,
        ) {
            val centerLatitude: Double get() = (south + north) / 2
            val centerLongitude: Double get() = (west + east) / 2
        }

        private companion object {
            const val MAX_ZOOM = 21
            const val RELABEL_METERS = 400.0
            const val LABEL_SETTLE_MS = 600L
            const val NEIGHBORHOOD_ZOOM = 14f
        }
    }

private fun parseInstant(value: String): Instant? = runCatching { Instant.parse(value.replace("+00:00", "Z")) }.getOrNull()

/** Great-circle distance in meters. */
internal fun metersBetween(
    lat1: Double,
    lng1: Double,
    lat2: Double,
    lng2: Double,
): Double {
    val radians = PI / 180
    val dLat = (lat2 - lat1) * radians
    val dLng = (lng2 - lng1) * radians
    val a = sin(dLat / 2).pow(2) + cos(lat1 * radians) * cos(lat2 * radians) * sin(dLng / 2).pow(2)
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))
}

private const val EARTH_RADIUS_M = 6_371_000.0
