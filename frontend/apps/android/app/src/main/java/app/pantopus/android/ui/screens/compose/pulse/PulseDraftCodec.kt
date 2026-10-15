package app.pantopus.android.ui.screens.compose.pulse

import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag

sealed interface PulseDraftLoadState {
    data object Loading : PulseDraftLoadState

    data object Ready : PulseDraftLoadState

    data class Error(val message: String) : PulseDraftLoadState
}

/** Explicit keys keep private draft values independent of Kotlin enum names and R8. */
internal object PulseDraftCodec {
    fun targetValues(target: PulsePostingTarget): Map<String, String> =
        buildMap {
            put("target.label", target.displayLabel)
            when (target) {
                PulsePostingTarget.Connections -> put("target.kind", "connections")
                is PulsePostingTarget.Home -> {
                    put("target.kind", "home")
                    put("target.home", target.homeId)
                    put("target.latitude", target.lat.toString())
                    put("target.longitude", target.lng.toString())
                }
                is PulsePostingTarget.CurrentLocation -> {
                    put("target.kind", "location")
                    put("target.latitude", target.lat.toString())
                    put("target.longitude", target.lng.toString())
                }
            }
        }

    fun target(values: Map<String, String>): PulsePostingTarget? =
        when (values["target.kind"]) {
            null -> null
            "connections" -> PulsePostingTarget.Connections
            "home" ->
                PulsePostingTarget.Home(
                    values.getValue("target.home"),
                    coordinate(values, "target.latitude"),
                    coordinate(values, "target.longitude"),
                    values.getValue("target.label"),
                )
            "location" ->
                PulsePostingTarget.CurrentLocation(
                    coordinate(values, "target.latitude"),
                    coordinate(values, "target.longitude"),
                    values.getValue("target.label"),
                )
            else -> error("Unknown saved destination")
        }

    fun placeValues(place: PostPlaceTag): Map<String, String> =
        buildMap {
            put("place.name", place.name)
            put("place.latitude", place.latitude.toString())
            put("place.longitude", place.longitude.toString())
            place.address?.let { put("place.address", it) }
            place.placeId?.let { put("place.id", it) }
            place.kind?.let { put("place.kind", it) }
        }

    fun place(values: Map<String, String>): PostPlaceTag? {
        val name = values["place.name"] ?: return null
        return PostPlaceTag(
            name,
            values["place.address"],
            coordinate(values, "place.latitude"),
            coordinate(values, "place.longitude"),
            values["place.id"],
            values["place.kind"],
        )
    }

    fun <T> option(
        values: Map<String, String>,
        key: String,
        options: List<T>,
        value: (T) -> String,
    ): T = options.firstOrNull { value(it) == values[key] } ?: error("Unknown saved option")

    private fun coordinate(
        values: Map<String, String>,
        key: String,
    ): Double = values.getValue(key).toDouble().also { check(it.isFinite()) }
}
