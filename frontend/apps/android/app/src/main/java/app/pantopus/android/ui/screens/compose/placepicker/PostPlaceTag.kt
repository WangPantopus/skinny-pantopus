package app.pantopus.android.ui.screens.compose.placepicker

import app.pantopus.android.data.api.models.geo.GeoPlace

/**
 * The venue a post is tagged with — the picker's selection, shared by the
 * Pulse composer (`POST /api/posts`) and the Beacon broadcast composer
 * (`POST /api/broadcast/channels/:id/messages`). Mirrors the iOS
 * `PostPlaceTag` 1:1.
 */
data class PostPlaceTag(
    val name: String,
    val address: String?,
    val latitude: Double,
    val longitude: Double,
    val placeId: String?,
    val kind: String?,
) {
    constructor(place: GeoPlace) : this(
        name = place.name,
        address = place.address ?: place.fullAddress,
        latitude = place.center.lat,
        longitude = place.center.lng,
        placeId = place.placeId,
        kind = place.kind,
    )
}
