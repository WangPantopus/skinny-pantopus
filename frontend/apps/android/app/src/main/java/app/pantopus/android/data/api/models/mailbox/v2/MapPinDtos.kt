package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Map pin endpoints in `backend/routes/mailboxV2Phase3.js`.
 *
 * NOTE ON DOMAIN: these model `HomeMapPin` rows — household / neighborhood
 * annotations linked to a home (and optionally a mail item): permits,
 * deliveries, notices, civic alerts, utility work, community events. This is a
 * *different* feature from the A11.4 "Mailbox map" venue directory the screen
 * renders (post offices / drop boxes / lockers / carriers with operating hours
 * and services). The screen has no venue-directory backend; this pin API is
 * wired per the BLOCK 3E instruction to wire `GET /map/pins + pin CRUD`, and
 * the view-model projects pins into `MailboxSpot` lossily, falling back to the
 * sample directory when there are no pins.
 */

/** One `HomeMapPin` row. Route `backend/routes/mailboxV2Phase3.js:431`. */
@JsonClass(generateAdapter = true)
data class MapPinDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "mail_id") val mailId: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    /** `permit / delivery / notice / civic / utility_work / community`. */
    @Json(name = "pin_type") val pinType: String? = null,
    val title: String? = null,
    val body: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    @Json(name = "radius_meters") val radiusMeters: Double? = null,
    /** `personal / household / neighborhood / public`. */
    @Json(name = "visible_to") val visibleTo: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** Envelope for `GET /api/mailbox/v2/p3/map/pins` — `{ pins }`. */
@JsonClass(generateAdapter = true)
data class MapPinsResponse(
    val pins: List<MapPinDto> = emptyList(),
)

/**
 * Envelope for `GET /api/mailbox/v2/p3/map/pin/:id` — `{ pin }` (the detail
 * route folds an optional `linked_mail` into the pin object).
 */
@JsonClass(generateAdapter = true)
data class MapPinDetailResponse(
    val pin: MapPinDto,
)

/**
 * Body for `POST /api/mailbox/v2/p3/map/pin` — route
 * `backend/routes/mailboxV2Phase3.js:472` (`createPinSchema`). camelCase keys
 * (Joi validates camelCase); Moshi omits null optionals.
 */
@JsonClass(generateAdapter = true)
data class CreateMapPinRequest(
    val homeId: String,
    val pinType: String,
    val title: String,
    val lat: Double,
    val lng: Double,
    val mailId: String? = null,
    val body: String? = null,
    val radiusMeters: Double? = null,
    val visibleTo: String? = null,
    val expiresAt: String? = null,
)

/** Envelope for `POST /api/mailbox/v2/p3/map/pin` — `{ pin }`. */
@JsonClass(generateAdapter = true)
data class CreateMapPinResponse(
    val pin: MapPinDto,
)

/** Envelope for `DELETE /api/mailbox/v2/p3/map/pin/:id` — `{ message }`. */
@JsonClass(generateAdapter = true)
data class DeleteMapPinResponse(
    val message: String? = null,
)
