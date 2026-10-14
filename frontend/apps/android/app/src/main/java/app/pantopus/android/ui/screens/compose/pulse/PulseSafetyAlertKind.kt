package app.pantopus.android.ui.screens.compose.pulse

/**
 * Backend `safetyAlertKind` values a neighbor may pick for a Heads-up (`RESIDENT_ALERT_KINDS`,
 * `backend/routes/posts.js`). Heads-ups about crime and suspicion (theft, vandalism, suspicious, scam) can no longer be
 * written; the server refuses them (`ALERT_KIND_NOT_ALLOWED`) and only Official or curator accounts post sourced
 * public-safety notices.
 */
enum class PulseSafetyAlertKind(val key: String, val label: String) {
    RoadHazard("road_hazard", "Road hazard"),
    PowerOutage("power_outage", "Power outage"),
    WeatherDamage("weather_damage", "Weather damage"),
    MissingPet("missing_pet", "Missing pet"),
    Hazard("hazard", "Hazard"),
    Other("other", "Other"),
    ;

    companion object {
        fun fromKey(key: String): PulseSafetyAlertKind? = entries.firstOrNull { it.key == key }
    }
}
