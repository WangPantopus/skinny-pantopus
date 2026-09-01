@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "LongMethod", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.explore

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.postsmap.PostsMapMarkerDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.postsmap.PostsMapLayer
import app.pantopus.android.data.postsmap.PostsMapRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Backs the A11.2 Explore map / P1-F.
 *
 * The production path fetches live discovery results for the viewport around
 * the user from three routes and fans them into a homogeneous
 * `List<ExploreEntity>`:
 *  - `GET /api/gigs/in-bounds` → Task (carries price + bid count)
 *  - `GET /api/listings/in-bounds` → Item
 *  - `GET /api/posts/map` with `layers=posts,businesses,homes` → Post / Spot /
 *    Home (route `backend/routes/posts.js:1646`)
 *
 * Tasks stay on the gigs route rather than the map route's `tasks` layer
 * because only the former carries price + bid count for the rail card.
 * Filtering, sort, and clustering run locally over the fetched window (mirrors
 * `ExploreMapViewModel.swift`). Previews / snapshots / tests seed deterministic
 * content via `load(scenario)`.
 */
@HiltViewModel
class ExploreMapViewModel
    @Inject
    constructor(
        private val gigsRepository: GigsRepository,
        private val listingsRepository: ListingsRepository,
        private val postsMapRepository: PostsMapRepository,
        private val locationProvider: LocationProvider,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ExploreMapUiState>(ExploreMapUiState.Loading)
        val state: StateFlow<ExploreMapUiState> = _state.asStateFlow()

        private val _activeKind = MutableStateFlow<ExploreKind?>(null)
        val activeKind: StateFlow<ExploreKind?> = _activeKind.asStateFlow()

        private val _activeSort = MutableStateFlow(ExploreSort.Closest)
        val activeSort: StateFlow<ExploreSort> = _activeSort.asStateFlow()

        private val _sheetStop = MutableStateFlow(ExploreSheetStop.Standard)
        val sheetStop: StateFlow<ExploreSheetStop> = _sheetStop.asStateFlow()

        private val _userCoordinate = MutableStateFlow<UserCoordinate?>(null)
        val userCoordinate: StateFlow<UserCoordinate?> = _userCoordinate.asStateFlow()

        private val _filters = MutableStateFlow(ExploreFilterCriteria())
        val filters: StateFlow<ExploreFilterCriteria> = _filters.asStateFlow()

        private var liveMode: Boolean = true
        private var scenario: ExploreScenario = ExploreScenario.Populated
        private var allEntities: List<ExploreEntity> = emptyList()
        private var clusterRadiusDegrees: Double = 0.005

        /** Live (production) load — fetch the viewport around the user. */
        fun load() {
            liveMode = true
            if (_userCoordinate.value == null) {
                _userCoordinate.value = locationProvider.cachedCoordinate()
            }
            _state.value = ExploreMapUiState.Loading
            viewModelScope.launch { fetchAroundUser() }
        }

        /** Sample/preview load — local sample entities, no network. */
        fun load(scenario: ExploreScenario) {
            liveMode = false
            this.scenario = scenario
            allEntities = ExploreMapSampleData.entities(scenario)
            _filters.value = ExploreMapSampleData.filters(scenario)
            _userCoordinate.value = ExploreMapSampleData.center
            when (scenario) {
                ExploreScenario.Loading -> _state.value = ExploreMapUiState.Loading
                ExploreScenario.Error -> _state.value = ExploreMapUiState.Error("Couldn't load the map.")
                else -> rebuild(selectedId = null)
            }
        }

        fun refresh() {
            if (liveMode) load() else load(scenario)
        }

        private suspend fun fetchAroundUser() {
            if (_userCoordinate.value == null) {
                _userCoordinate.value = locationProvider.requestCurrent()
            }
            val center = _userCoordinate.value ?: UserCoordinate(40.7484, -73.9857, 100.0)
            val minLat = center.latitude - 0.012
            val maxLat = center.latitude + 0.012
            val minLon = center.longitude - 0.016
            val maxLon = center.longitude + 0.016

            val gigsDeferred =
                viewModelScope.async {
                    gigsRepository.inBounds(minLat = minLat, minLon = minLon, maxLat = maxLat, maxLon = maxLon)
                }
            val listingsDeferred =
                viewModelScope.async {
                    listingsRepository.inBounds(south = minLat, west = minLon, north = maxLat, east = maxLon)
                }
            val markersDeferred =
                viewModelScope.async {
                    postsMapRepository.markers(
                        south = minLat,
                        west = minLon,
                        north = maxLat,
                        east = maxLon,
                        layers = listOf(PostsMapLayer.Posts, PostsMapLayer.Businesses, PostsMapLayer.Homes),
                    )
                }
            val gigsResult = gigsDeferred.await()
            val listingsResult = listingsDeferred.await()
            val markersResult = markersDeferred.await()
            val gigs = if (gigsResult is NetworkResult.Success) gigsResult.data.gigs else null
            val listings = if (listingsResult is NetworkResult.Success) listingsResult.data.listings else null
            val markers = if (markersResult is NetworkResult.Success) markersResult.data.markers else null
            if (gigs == null && listings == null && markers == null) {
                _state.value = ExploreMapUiState.Error("Couldn't load the map.")
                return
            }
            allEntities = project(gigs ?: emptyList(), listings ?: emptyList(), markers ?: emptyList(), center)
            rebuild(selectedId = null)
        }

        // MARK: Type toggle

        fun selectKind(kind: ExploreKind?) {
            if (_activeKind.value == kind) return
            _activeKind.value = kind
            rebuild(selectedId = keptSelection())
        }

        // MARK: Sort

        fun selectSort(sort: ExploreSort) {
            if (_activeSort.value == sort) return
            _activeSort.value = sort
            rebuild(selectedId = currentSelectedId())
        }

        // MARK: Filters

        fun applyFilters(criteria: ExploreFilterCriteria) {
            _filters.value = criteria
            rebuild(selectedId = keptSelection())
        }

        /** Empty-state "Clear filters" — reset every dimension. */
        fun clearFilters() {
            _filters.value = ExploreFilterCriteria()
            _activeKind.value = null
            rebuild(selectedId = null)
        }

        /** Empty-state "Widen area" — open the radius to the widest stop. */
        fun widenArea() {
            _filters.value = _filters.value.copy(distanceUpper = ExploreFilterCriteria.DISTANCE_STOPS.last())
            rebuild(selectedId = currentSelectedId())
        }

        // MARK: Selection / sheet

        fun selectEntity(id: String?) {
            val current = _state.value as? ExploreMapUiState.Loaded ?: return
            _state.value = current.copy(selectedId = id)
        }

        fun setSheetStop(stop: ExploreSheetStop) {
            _sheetStop.value = stop
        }

        fun setClusterRadius(radiusDegrees: Double) {
            val clamped = radiusDegrees.coerceIn(0.0005, 0.05)
            if (kotlin.math.abs(clamped - clusterRadiusDegrees) < 1e-6) return
            clusterRadiusDegrees = clamped
            val current = _state.value as? ExploreMapUiState.Loaded ?: return
            rebuild(selectedId = current.selectedId)
        }

        // MARK: Projection

        private fun currentSelectedId(): String? = (_state.value as? ExploreMapUiState.Loaded)?.selectedId

        private fun keptSelection(): String? {
            val prior = currentSelectedId()
            return if (filtered().any { it.id == prior }) prior else null
        }

        private fun filtered(): List<ExploreEntity> =
            allEntities.filter { entity ->
                val kind = _activeKind.value
                (kind == null || entity.kind == kind) && _filters.value.matches(entity)
            }

        private fun sortFor(source: List<ExploreEntity>): List<ExploreEntity> =
            when (_activeSort.value) {
                ExploreSort.Closest -> source.sortedBy { it.distanceMiles }
                ExploreSort.Newest -> source
            }

        private fun rebuild(selectedId: String?) {
            val sorted = sortFor(filtered())
            _state.value =
                ExploreMapUiState.Loaded(
                    entities = sorted,
                    markers = cluster(sorted, clusterRadiusDegrees),
                    userCoordinate = _userCoordinate.value,
                    selectedId = selectedId,
                )
        }

        companion object {
            /**
             * Map live gigs + listings + `/api/posts/map` markers into the
             * unified entity vocabulary.
             */
            fun project(
                gigs: List<GigDto>,
                listings: List<ListingDto>,
                markers: List<PostsMapMarkerDto> = emptyList(),
                anchor: UserCoordinate,
            ): List<ExploreEntity> {
                val out = mutableListOf<ExploreEntity>()
                gigs.forEach { gig ->
                    val coord = coordinate(gig) ?: return@forEach
                    val miles = distanceMiles(anchor, coord.first, coord.second)
                    val bids = gig.bidCount ?: 0
                    out.add(
                        ExploreEntity(
                            id = gig.id,
                            kind = ExploreKind.Task,
                            state =
                                if (gig.status == "pending" || gig.status == "draft") {
                                    ExploreEntityState.Pending
                                } else {
                                    ExploreEntityState.Confirmed
                                },
                            latitude = coord.first,
                            longitude = coord.second,
                            title = gig.title,
                            metaLead = priceLabel(gig.price) ?: "Open",
                            distanceLabel = distanceLabel(miles),
                            distanceMiles = miles,
                            badge = if (bids > 0) ExploreBadge("$bids bids", ExploreBadgeTone.Bids) else null,
                            city = gig.approxLocation?.label,
                            sourceId = gig.id,
                            verified = false,
                            openNow = gig.status == "open",
                        ),
                    )
                }
                listings.forEach { listing ->
                    val coord = coordinate(listing) ?: return@forEach
                    val miles = distanceMiles(anchor, coord.first, coord.second)
                    out.add(
                        ExploreEntity(
                            id = listing.id,
                            kind = ExploreKind.Item,
                            state = ExploreEntityState.Confirmed,
                            latitude = coord.first,
                            longitude = coord.second,
                            title = listing.title ?: "Listing",
                            metaLead = priceLabel(listing.price) ?: "Free",
                            distanceLabel = distanceLabel(miles),
                            distanceMiles = miles,
                            badge = null,
                            city = listing.locationName ?: listing.approxLocation?.label,
                            sourceId = listing.id,
                            verified = false,
                            openNow = true,
                        ),
                    )
                }
                out += projectMarkers(markers, anchor)
                return out
            }

            /**
             * Fan `/api/posts/map` markers onto the entity vocabulary. Task /
             * offer layers are skipped here — the gigs in-bounds route already
             * supplies richer task rows and double-projecting would duplicate
             * pins.
             */
            fun projectMarkers(
                markers: List<PostsMapMarkerDto>,
                anchor: UserCoordinate,
            ): List<ExploreEntity> {
                val out = mutableListOf<ExploreEntity>()
                markers.forEach { marker ->
                    val lat = marker.latitude ?: return@forEach
                    val lon = marker.longitude ?: return@forEach
                    val miles = distanceMiles(anchor, lat, lon)
                    when (marker.layerType) {
                        "post" -> {
                            val replies = marker.commentCount ?: 0
                            out.add(
                                ExploreEntity(
                                    id = marker.id,
                                    kind = ExploreKind.Post,
                                    state = ExploreEntityState.Confirmed,
                                    latitude = lat,
                                    longitude = lon,
                                    title = marker.title ?: marker.content ?: "Neighborhood post",
                                    metaLead = postMetaLead(marker),
                                    distanceLabel = distanceLabel(miles),
                                    distanceMiles = miles,
                                    badge =
                                        if (replies > 0) {
                                            ExploreBadge("$replies replies", ExploreBadgeTone.Replies)
                                        } else {
                                            null
                                        },
                                    city = marker.locationName,
                                    sourceId = marker.id,
                                    verified = false,
                                    openNow = true,
                                ),
                            )
                        }
                        "business" -> {
                            out.add(
                                ExploreEntity(
                                    id = marker.id,
                                    kind = ExploreKind.Spot,
                                    state = ExploreEntityState.Confirmed,
                                    latitude = lat,
                                    longitude = lon,
                                    title = marker.businessName ?: "Local business",
                                    metaLead = marker.category ?: "Open",
                                    distanceLabel = distanceLabel(miles),
                                    distanceMiles = miles,
                                    badge =
                                        if (marker.isVerified == true) {
                                            ExploreBadge("Verified", ExploreBadgeTone.Rating)
                                        } else {
                                            null
                                        },
                                    city = marker.address,
                                    sourceId = marker.id,
                                    verified = marker.isVerified == true,
                                    openNow = true,
                                ),
                            )
                        }
                        "home" -> {
                            val locality =
                                listOfNotNull(marker.city, marker.state)
                                    .filter { it.isNotBlank() }
                                    .joinToString(", ")
                            out.add(
                                ExploreEntity(
                                    id = marker.id,
                                    kind = ExploreKind.Home,
                                    state = ExploreEntityState.Confirmed,
                                    latitude = lat,
                                    longitude = lon,
                                    title = marker.address ?: "Home",
                                    metaLead =
                                        marker.homeType
                                            ?.replace('_', ' ')
                                            ?.replaceFirstChar { it.uppercase() }
                                            ?: "Home",
                                    distanceLabel = distanceLabel(miles),
                                    distanceMiles = miles,
                                    badge = null,
                                    city = locality.ifBlank { null },
                                    stateName = marker.state,
                                    sourceId = marker.id,
                                    verified = false,
                                    openNow = true,
                                ),
                            )
                        }
                        else -> Unit
                    }
                }
                return out
            }

            /**
             * Post rail-card lead — "Question · 2h ago" style, falling back to
             * the post type when the timestamp is unusable.
             */
            private fun postMetaLead(marker: PostsMapMarkerDto): String {
                val kind =
                    (marker.postType ?: "post")
                        .replace('_', ' ')
                        .replaceFirstChar { it.uppercase() }
                val createdAt = marker.createdAt ?: return kind
                val instant =
                    runCatching { java.time.Instant.parse(createdAt) }.getOrNull() ?: return kind
                val minutes = java.time.Duration.between(instant, java.time.Instant.now()).toMinutes()
                val ago =
                    when {
                        minutes < 1L -> "just now"
                        minutes < 60L -> "${minutes}m ago"
                        minutes < 60L * 24L -> "${minutes / 60L}h ago"
                        else -> "${minutes / (60L * 24L)}d ago"
                    }
                return "$kind · $ago"
            }

            fun distanceMiles(
                origin: UserCoordinate,
                latitude: Double,
                longitude: Double,
            ): Double {
                val earthRadiusMiles = 3958.8
                val dLat = Math.toRadians(latitude - origin.latitude)
                val dLon = Math.toRadians(longitude - origin.longitude)
                val lat1 = Math.toRadians(origin.latitude)
                val lat2 = Math.toRadians(latitude)
                val a = sin(dLat / 2).pow(2) + sin(dLon / 2).pow(2) * cos(lat1) * cos(lat2)
                return earthRadiusMiles * 2 * atan2(sqrt(a), sqrt(1 - a))
            }

            private fun coordinate(gig: GigDto): Pair<Double, Double>? {
                if (gig.latitude != null && gig.longitude != null) return gig.latitude to gig.longitude
                val approx = gig.approxLocation
                if (approx?.latitude != null && approx.longitude != null) return approx.latitude to approx.longitude
                return null
            }

            private fun coordinate(listing: ListingDto): Pair<Double, Double>? {
                if (listing.latitude != null && listing.longitude != null) return listing.latitude to listing.longitude
                val approx = listing.approxLocation
                if (approx?.latitude != null && approx.longitude != null) return approx.latitude to approx.longitude
                return null
            }

            private fun distanceLabel(miles: Double): String =
                when {
                    miles < 0.1 -> "< 0.1 mi"
                    miles < 10 -> String.format(Locale.US, "%.1f mi", miles)
                    else -> "${miles.toInt()} mi"
                }

            private fun priceLabel(price: Double?): String? {
                if (price == null || price <= 0) return null
                return if (price % 1.0 == 0.0) "$${price.toInt()}" else String.format(Locale.US, "$%.2f", price)
            }

            /** Grid-bucket clusterer — buckets of ≥2 collapse into a cluster. */
            fun cluster(
                entities: List<ExploreEntity>,
                radiusDegrees: Double,
            ): List<ExploreMarker> {
                if (radiusDegrees <= 0) return entities.map { ExploreMarker.Entity(it) }
                val buckets = linkedMapOf<String, MutableList<ExploreEntity>>()
                entities.forEach { entity ->
                    val key = bucketKey(entity.latitude, entity.longitude, radiusDegrees)
                    buckets.getOrPut(key) { mutableListOf() }.add(entity)
                }
                return buckets.entries.sortedBy { it.key }.map { (key, group) ->
                    if (group.size == 1) {
                        ExploreMarker.Entity(group[0])
                    } else {
                        val lats = group.map { it.latitude }
                        val lons = group.map { it.longitude }
                        val representative =
                            group.groupingBy { it.kind }.eachCount().maxByOrNull { it.value }?.key ?: group[0].kind
                        ExploreMarker.Cluster(
                            ExploreCluster(
                                id = key,
                                latitude = lats.average(),
                                longitude = lons.average(),
                                kind = representative,
                                count = group.size,
                                entityIds = group.map { it.id },
                                minLatitude = lats.min(),
                                maxLatitude = lats.max(),
                                minLongitude = lons.min(),
                                maxLongitude = lons.max(),
                            ),
                        )
                    }
                }
            }

            private fun bucketKey(
                latitude: Double,
                longitude: Double,
                radius: Double,
            ): String {
                val latBucket = kotlin.math.floor(latitude / radius).toInt()
                val lonBucket = kotlin.math.floor(longitude / radius).toInt()
                return "${latBucket}_$lonBucket"
            }
        }
    }
