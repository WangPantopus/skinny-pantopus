package app.pantopus.android.data.api.models.hub

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * T2 — hub notification / briefing preferences.
 *
 * Shape mirrors the `UserNotificationPreferences` row the backend
 * returns from `GET /api/hub/preferences` (route
 * `backend/routes/hub.js:648`) and echoes back from
 * `PUT /api/hub/preferences` (route `backend/routes/hub.js:716`).
 *
 * Every field is nullable on the wire: the handler returns the raw DB
 * row when one exists (columns can be null) and a hand-built default
 * object when it doesn't. The defaults below are byte-for-byte the
 * handler's own (`hub.js:666-684`).
 */
@JsonClass(generateAdapter = true)
data class NotificationPreferencesResponse(
    @Json(name = "preferences") val preferences: NotificationPreferencesDto,
)

@JsonClass(generateAdapter = true)
data class NotificationPreferencesDto(
    /**
     * Morning briefing — the backend never renamed the `daily_*`
     * columns when the evening briefing was added.
     */
    @Json(name = "daily_briefing_enabled") val dailyBriefingEnabled: Boolean? = null,
    /** `HH:mm`, 24-hour. Joi rejects anything else (`hub.js:699`). */
    @Json(name = "daily_briefing_time_local") val dailyBriefingTimeLocal: String? = null,
    /** IANA zone the briefing times are interpreted in. */
    @Json(name = "daily_briefing_timezone") val dailyBriefingTimezone: String? = null,
    @Json(name = "evening_briefing_enabled") val eveningBriefingEnabled: Boolean? = null,
    @Json(name = "evening_briefing_time_local") val eveningBriefingTimeLocal: String? = null,
    @Json(name = "weather_alerts_enabled") val weatherAlertsEnabled: Boolean? = null,
    @Json(name = "aqi_alerts_enabled") val aqiAlertsEnabled: Boolean? = null,
    @Json(name = "mail_summary_enabled") val mailSummaryEnabled: Boolean? = null,
    @Json(name = "gig_updates_enabled") val gigUpdatesEnabled: Boolean? = null,
    @Json(name = "home_reminders_enabled") val homeRemindersEnabled: Boolean? = null,
    /** `HH:mm` or null. A null start means quiet hours are off. */
    @Json(name = "quiet_hours_start_local") val quietHoursStartLocal: String? = null,
    @Json(name = "quiet_hours_end_local") val quietHoursEndLocal: String? = null,
    /** `primary_home | viewing_location | device_location | custom`. */
    @Json(name = "location_mode") val locationMode: String? = null,
)

/**
 * View-facing projection with the server defaults already resolved, so
 * the view-model never has to repeat the elvis chain.
 */
data class NotificationPreferences(
    val dailyBriefingEnabled: Boolean,
    val dailyBriefingTimeLocal: String,
    val dailyBriefingTimezone: String?,
    val eveningBriefingEnabled: Boolean,
    val eveningBriefingTimeLocal: String,
    val weatherAlertsEnabled: Boolean,
    val aqiAlertsEnabled: Boolean,
    val mailSummaryEnabled: Boolean,
    val gigUpdatesEnabled: Boolean,
    val homeRemindersEnabled: Boolean,
    val quietHoursStartLocal: String?,
    val quietHoursEndLocal: String?,
    val locationMode: String,
) {
    /** Mirrors RN (`notification-preferences.tsx:205`). */
    val quietHoursEnabled: Boolean get() = quietHoursStartLocal != null

    companion object {
        const val DEFAULT_DAILY_TIME = "07:30"
        const val DEFAULT_EVENING_TIME = "18:00"
        const val MODE_PRIMARY_HOME = "primary_home"
        const val MODE_VIEWING_LOCATION = "viewing_location"
        const val MODE_DEVICE_LOCATION = "device_location"

        fun from(dto: NotificationPreferencesDto): NotificationPreferences =
            NotificationPreferences(
                dailyBriefingEnabled = dto.dailyBriefingEnabled ?: false,
                dailyBriefingTimeLocal = dto.dailyBriefingTimeLocal ?: DEFAULT_DAILY_TIME,
                dailyBriefingTimezone = dto.dailyBriefingTimezone,
                eveningBriefingEnabled = dto.eveningBriefingEnabled ?: true,
                eveningBriefingTimeLocal = dto.eveningBriefingTimeLocal ?: DEFAULT_EVENING_TIME,
                weatherAlertsEnabled = dto.weatherAlertsEnabled ?: true,
                aqiAlertsEnabled = dto.aqiAlertsEnabled ?: true,
                mailSummaryEnabled = dto.mailSummaryEnabled ?: true,
                gigUpdatesEnabled = dto.gigUpdatesEnabled ?: true,
                homeRemindersEnabled = dto.homeRemindersEnabled ?: true,
                quietHoursStartLocal = dto.quietHoursStartLocal,
                quietHoursEndLocal = dto.quietHoursEndLocal,
                locationMode = dto.locationMode ?: MODE_PRIMARY_HOME,
            )
    }
}

/**
 * Partial `PUT` body. Joi validates the exact key set at
 * `hub.js:697-714` with `.min(1)`, so only the keys that actually
 * changed go on the wire.
 *
 * [quietHours] is tri-state: `null` leaves both quiet-hours columns
 * alone, a [QuietHoursPatch] writes them — including the explicit JSON
 * `null` that clears them (the schema allows null at `hub.js:708-709`).
 */
data class NotificationPreferencesPatch(
    val dailyBriefingEnabled: Boolean? = null,
    val dailyBriefingTimeLocal: String? = null,
    val eveningBriefingEnabled: Boolean? = null,
    val eveningBriefingTimeLocal: String? = null,
    val weatherAlertsEnabled: Boolean? = null,
    val aqiAlertsEnabled: Boolean? = null,
    val mailSummaryEnabled: Boolean? = null,
    val gigUpdatesEnabled: Boolean? = null,
    val homeRemindersEnabled: Boolean? = null,
    val quietHours: QuietHoursPatch? = null,
    val locationMode: String? = null,
) {
    /** Last write wins per key; untouched keys survive the merge. */
    fun mergedWith(newer: NotificationPreferencesPatch): NotificationPreferencesPatch =
        NotificationPreferencesPatch(
            dailyBriefingEnabled = newer.dailyBriefingEnabled ?: dailyBriefingEnabled,
            dailyBriefingTimeLocal = newer.dailyBriefingTimeLocal ?: dailyBriefingTimeLocal,
            eveningBriefingEnabled = newer.eveningBriefingEnabled ?: eveningBriefingEnabled,
            eveningBriefingTimeLocal = newer.eveningBriefingTimeLocal ?: eveningBriefingTimeLocal,
            weatherAlertsEnabled = newer.weatherAlertsEnabled ?: weatherAlertsEnabled,
            aqiAlertsEnabled = newer.aqiAlertsEnabled ?: aqiAlertsEnabled,
            mailSummaryEnabled = newer.mailSummaryEnabled ?: mailSummaryEnabled,
            gigUpdatesEnabled = newer.gigUpdatesEnabled ?: gigUpdatesEnabled,
            homeRemindersEnabled = newer.homeRemindersEnabled ?: homeRemindersEnabled,
            quietHours = newer.quietHours ?: quietHours,
            locationMode = newer.locationMode ?: locationMode,
        )

    /** Nothing to send — Joi's `.min(1)` would 400 on an empty body. */
    val isEmpty: Boolean get() = this == NotificationPreferencesPatch()
}

/** Both `null` clears quiet hours; both set writes the window. */
data class QuietHoursPatch(
    val startLocal: String?,
    val endLocal: String?,
)

/**
 * Hand-written serializer: a generated adapter would drop the keys we
 * deliberately want to send as JSON `null` (Moshi omits nulls unless
 * `serializeNulls` is on), and would emit every unset key instead of
 * only the changed ones.
 */
class NotificationPreferencesPatchJsonAdapter {
    @ToJson
    @Suppress("CyclomaticComplexMethod")
    fun toJson(
        writer: JsonWriter,
        value: NotificationPreferencesPatch,
    ) {
        writer.beginObject()
        value.dailyBriefingEnabled?.let { writer.name("daily_briefing_enabled").value(it) }
        value.dailyBriefingTimeLocal?.let { writer.name("daily_briefing_time_local").value(it) }
        value.eveningBriefingEnabled?.let { writer.name("evening_briefing_enabled").value(it) }
        value.eveningBriefingTimeLocal?.let { writer.name("evening_briefing_time_local").value(it) }
        value.weatherAlertsEnabled?.let { writer.name("weather_alerts_enabled").value(it) }
        value.aqiAlertsEnabled?.let { writer.name("aqi_alerts_enabled").value(it) }
        value.mailSummaryEnabled?.let { writer.name("mail_summary_enabled").value(it) }
        value.gigUpdatesEnabled?.let { writer.name("gig_updates_enabled").value(it) }
        value.homeRemindersEnabled?.let { writer.name("home_reminders_enabled").value(it) }
        value.quietHours?.let { quiet ->
            val previous = writer.serializeNulls
            writer.serializeNulls = true
            writer.name("quiet_hours_start_local").value(quiet.startLocal)
            writer.name("quiet_hours_end_local").value(quiet.endLocal)
            writer.serializeNulls = previous
        }
        value.locationMode?.let { writer.name("location_mode").value(it) }
        writer.endObject()
    }

    /**
     * Deserialization isn't supported — this DTO is request-only, so a
     * future round-trip fails loudly instead of producing a half-blank
     * patch.
     */
    @FromJson
    fun fromJson(reader: JsonReader): NotificationPreferencesPatch =
        error("NotificationPreferencesPatch is request-only; deserialization is not supported. reader=$reader")
}
