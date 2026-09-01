@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Shared value types for the A5 invitee-discovery flow (C5 landing → C6 slot
 * picker → C7 timezone → C8 no-availability). The flow is **public and
 * unauthenticated**; everything here is derived from `SchedulingPublicApi`
 * reads via `SchedulingRepository`. Render `startLocal`, store/compare UTC
 * `start` (per the global wiring contract).
 */

/** A single bookable event type rendered as a row on the booking landing (C5). */
data class EventTypeRowUi(
    val slug: String,
    val name: String,
    val durationLabel: String,
    val locationLabel: String,
    val locationIcon: PantopusIcon,
    val durationMin: Int?,
)

/**
 * Everything the slot picker (C6) needs to fetch + render. Carried from the
 * landing on event-type pick (slug flow) or straight from a one-off link.
 * Exactly one of [slug]/[oneOffToken] is non-null.
 */
data class SlotPickerArgs(
    val slug: String?,
    val oneOffToken: String?,
    val eventTypeSlug: String?,
    val eventTypeName: String,
    val hostName: String?,
    val durationMin: Int?,
    val locationIcon: PantopusIcon,
    val pageTimezone: String?,
    val detectedTimezone: String,
    val pillar: SchedulingPillar,
)

/**
 * The terminal hand-off A5 produces: the chosen slot + the context A6
 * (invitee confirm/checkout) needs. A5 **stops here**; A6 owns the booking
 * POST and the manageToken handoff.
 */
data class SlotSelection(
    val slug: String?,
    val oneOffToken: String?,
    val eventTypeSlug: String?,
    val eventTypeName: String,
    val startAtUtc: String,
    val startLocalLabel: String,
    val dayLabel: String,
    val durationMin: Int?,
    val timezone: String,
)

/** Map a public page `owner_type` to its identity pillar (accent source). */
fun pillarForOwnerType(ownerType: String?): SchedulingPillar =
    when (ownerType?.lowercase()) {
        "home" -> SchedulingPillar.Home
        "business" -> SchedulingPillar.Business
        else -> SchedulingPillar.Personal
    }

private const val MINUTES_PER_HOUR = 60

/** "30 min" / "1 hour" / "1 hr 30 min" — the duration label shown on rows + the picker header. */
fun durationLabel(minutes: Int?): String {
    val m = minutes ?: return "—"
    return when {
        m < MINUTES_PER_HOUR -> "$m min"
        m % MINUTES_PER_HOUR == 0 -> {
            val hours = m / MINUTES_PER_HOUR
            if (hours == 1) "1 hour" else "$hours hours"
        }
        else -> "${m / MINUTES_PER_HOUR} hr ${m % MINUTES_PER_HOUR} min"
    }
}

/** Pull the booking duration for an event type (default, else first offered). */
fun PublicEventTypeView.bookingDuration(): Int? = defaultDuration ?: durations.firstOrNull()

/** The leading/location icon + label for an event type's location mode. */
fun locationIconFor(mode: String?): PantopusIcon =
    when (mode?.lowercase()) {
        "in_person", "in-person", "inperson" -> PantopusIcon.MapPin
        "phone" -> PantopusIcon.Phone
        "custom", "link", "online", "video", "google_meet", "zoom" -> PantopusIcon.Video
        else -> PantopusIcon.Video
    }

/** The human label for an event type's location mode (shown in the row chip). */
fun locationLabelFor(mode: String?): String =
    when (mode?.lowercase()) {
        "in_person", "in-person", "inperson" -> "In person"
        "phone" -> "Phone"
        "google_meet" -> "Google Meet"
        "zoom" -> "Zoom"
        "custom", "link" -> "Online"
        else -> "Video call"
    }

/** Map a public event type to its landing row model. */
fun PublicEventTypeView.toRowUi(): EventTypeRowUi {
    val minutes = bookingDuration()
    return EventTypeRowUi(
        slug = slug.orEmpty(),
        name = name.orEmpty().ifBlank { "Book a time" },
        durationLabel = durationLabel(minutes),
        locationLabel = locationLabelFor(locationMode),
        locationIcon = locationIconFor(locationMode),
        durationMin = minutes,
    )
}
