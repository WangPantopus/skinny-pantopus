package app.pantopus.android.ui.screens.compose.pulse

import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId

/**
 * A Pantopus AI post draft's fields beyond its text and headline (AI assistant phase 1 contract, section 8): the
 * exact post type and the event, deal, lost-and-found and heads-up fields. The composer opens with all of them
 * filled in. They travel to it as one route argument ([encode]). Dates are the server's ISO-8601 strings.
 */
data class PulseComposeDraftFields(
    /** The backend `post_type` (`event`, `deal`, `alert`, …); it picks the composer's purpose exactly. */
    val postType: String? = null,
    val eventDate: String? = null,
    val eventEndDate: String? = null,
    val eventVenue: String? = null,
    val dealExpiresAt: String? = null,
    /** `lost` or `found`. */
    val lostFoundType: String? = null,
    /** A heads-up's kind (`road_hazard`, `power_outage`, …). */
    val safetyAlertKind: String? = null,
) {
    fun encode(): String =
        JSONObject()
            .apply {
                postType?.let { put(KEY_POST_TYPE, it) }
                eventDate?.let { put(KEY_EVENT_DATE, it) }
                eventEndDate?.let { put(KEY_EVENT_END_DATE, it) }
                eventVenue?.let { put(KEY_EVENT_VENUE, it) }
                dealExpiresAt?.let { put(KEY_DEAL_EXPIRES_AT, it) }
                lostFoundType?.let { put(KEY_LOST_FOUND_TYPE, it) }
                safetyAlertKind?.let { put(KEY_SAFETY_ALERT_KIND, it) }
            }.toString()

    /** The composer purpose the draft's post type names, when the posting target allows it. */
    fun purposeFor(target: PulsePostingTarget): PulseComposePurpose? {
        val type = postType ?: return null
        return PulseComposePurpose.entries
            .firstOrNull { it.postType == type }
            ?.takeIf { PulseComposePurpose.allowedFor(target).contains(it) }
    }

    companion object {
        private const val KEY_POST_TYPE = "postType"
        private const val KEY_EVENT_DATE = "eventDate"
        private const val KEY_EVENT_END_DATE = "eventEndDate"
        private const val KEY_EVENT_VENUE = "eventVenue"
        private const val KEY_DEAL_EXPIRES_AT = "dealExpiresAt"
        private const val KEY_LOST_FOUND_TYPE = "lostFoundType"
        private const val KEY_SAFETY_ALERT_KIND = "safetyAlertKind"

        /** A route argument written by [encode]; null when it is empty or unreadable. */
        fun decode(raw: String?): PulseComposeDraftFields? {
            if (raw.isNullOrBlank()) return null
            val json = runCatching { JSONObject(raw) }.getOrNull() ?: return null

            fun text(key: String): String? = if (json.isNull(key)) null else json.optString(key).trim().ifEmpty { null }
            return PulseComposeDraftFields(
                postType = text(KEY_POST_TYPE),
                eventDate = text(KEY_EVENT_DATE),
                eventEndDate = text(KEY_EVENT_END_DATE),
                eventVenue = text(KEY_EVENT_VENUE),
                dealExpiresAt = text(KEY_DEAL_EXPIRES_AT),
                lostFoundType = text(KEY_LOST_FOUND_TYPE),
                safetyAlertKind = text(KEY_SAFETY_ALERT_KIND),
            )
        }

        /**
         * A draft date as this phone's wall clock: an instant (`…Z` or with an offset) moves into [zone], a time
         * without a zone is already local, and a plain date has no time. Null when unreadable.
         */
        fun localTime(
            raw: String,
            zone: ZoneId = ZoneId.systemDefault(),
        ): DraftTime? {
            val instant =
                runCatching { Instant.parse(raw) }.getOrNull()
                    ?: runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
            return when {
                instant != null -> DraftTime(instant.atZone(zone).toLocalDateTime(), instant)
                else ->
                    runCatching { LocalDateTime.parse(raw) }.getOrNull()?.let { DraftTime(it, it.atZone(zone).toInstant()) }
                        ?: runCatching { LocalDate.parse(raw) }.getOrNull()?.let { DraftTime(it.atStartOfDay(), null) }
            }
        }

        /** A draft end on this phone's clock, like [localTime], except that a plain date lasts through that day. */
        fun localEnd(
            raw: String,
            zone: ZoneId = ZoneId.systemDefault(),
        ): LocalDateTime? =
            localTime(raw, zone)?.let { time ->
                if (time.instant == null) time.local.toLocalDate().atTime(LAST_MINUTE) else time.local
            }

        private val LAST_MINUTE: LocalTime = LocalTime.of(23, 59)
    }

    /** A draft date on the local clock; [instant] is null for a date without a time. */
    data class DraftTime(
        val local: LocalDateTime,
        val instant: Instant?,
    )
}
