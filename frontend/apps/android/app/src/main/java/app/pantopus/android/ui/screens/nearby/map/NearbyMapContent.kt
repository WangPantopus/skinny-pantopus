@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.nearby.map

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.screens.gigs.GigsCategory

/** Entity kind discriminator — drives detail-screen routing. */
enum class MapEntityKind { Gig, Listing }

/** Per-pin lifecycle state. Drives the visual treatment. */
enum class MapEntityState { Confirmed, Pending }

/** One pin / one card / one row, all rolled up. */
@Immutable
data class MapEntity(
    val id: String,
    val kind: MapEntityKind,
    val category: GigsCategory,
    val state: MapEntityState,
    val latitude: Double,
    val longitude: Double,
    val title: String,
    val summary: String?,
    val price: String?,
    val distanceLabel: String?,
    val bidCount: Int,
)

/**
 * Bottom-sheet snap stop. Three positions per design: collapsed (20%
 * — header + prompt), default (40% — header + card rail), expanded
 * (70% — full vertical list).
 */
enum class SheetStop(val heightFraction: Float) {
    Collapsed(0.20f),
    Standard(0.40f),
    Expanded(0.70f),
}

/** Sort applied locally to the sheet body (no re-fetch). */
enum class NearbySort(val key: String, val label: String) {
    Newest("newest", "Newest"),
    Closest("closest", "Closest"),
    HighestPay("highest_pay", "Highest pay"),
    FewestBids("fewest_bids", "Fewest bids"),
}

/**
 * One drawable marker on the map. Either a single entity pin or a
 * cluster glyph standing in for ≥2 entities that fall inside the
 * current cluster radius.
 */
sealed interface MapMarker {
    val id: String
    val latitude: Double
    val longitude: Double

    @Immutable
    data class Entity(val entity: MapEntity) : MapMarker {
        override val id: String get() = "entity_${entity.id}"
        override val latitude: Double get() = entity.latitude
        override val longitude: Double get() = entity.longitude
    }

    @Immutable
    data class Cluster(val cluster: MapCluster) : MapMarker {
        override val id: String get() = "cluster_${cluster.id}"
        override val latitude: Double get() = cluster.latitude
        override val longitude: Double get() = cluster.longitude
    }
}

/**
 * A clustered group of ≥2 entities. Tap zooms the camera to the
 * cluster's bounding box.
 */
@Immutable
data class MapCluster(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val category: GigsCategory,
    val count: Int,
    val entityIds: List<String>,
    val minLatitude: Double,
    val maxLatitude: Double,
    val minLongitude: Double,
    val maxLongitude: Double,
)

/** Render state for the Nearby map screen. */
sealed interface NearbyMapUiState {
    data object Loading : NearbyMapUiState

    data class Loaded(
        val entities: List<MapEntity>,
        val markers: List<MapMarker>,
        val userCoordinate: UserCoordinate?,
        val selectedId: String?,
    ) : NearbyMapUiState

    data class Error(val message: String) : NearbyMapUiState
}
