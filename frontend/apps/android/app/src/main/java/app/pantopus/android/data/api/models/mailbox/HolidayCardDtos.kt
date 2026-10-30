package app.pantopus.android.data.api.models.mailbox

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/mailbox/cards` (launch keys `holiday_cards` + `mailbox`; 404 while either is off): what sending a Christmas
 * card needs. The season's pictures (the app carries the pictures themselves, by [HolidayCardDesign.id]), whether
 * sending is open (until December 31 ends where the sender lives), the arrivals open now, and today's card once it's
 * sent (one a day).
 */
@JsonClass(generateAdapter = true)
data class HolidayCardsResponse(
    val open: Boolean = false,
    val holiday: String? = null,
    val year: Int = 2026,
    @Json(name = "closes_on") val closesOn: String? = null,
    /** The note on the back: up to this many letters. */
    @Json(name = "message_limit") val messageLimit: Int = 300,
    val designs: List<HolidayCardDesign> = emptyList(),
    val arrivals: HolidayCardArrivals = HolidayCardArrivals(),
    /** The sender's next 7 a.m. round, where they live: when the carrier picks today's card up. */
    @Json(name = "next_round_at") val nextRoundAt: String? = null,
    /** 7 a.m. on Christmas morning, where the sender lives. */
    @Json(name = "christmas_morning_at") val christmasMorningAt: String? = null,
    /** The sender's own time zone (IANA). */
    @Json(name = "time_zone") val timeZone: String? = null,
    /** Today's card; null until it's sent. */
    val today: SentHolidayCard? = null,
)

/** One of the season's pictures: the caption printed under it and the colour of its paper. */
@JsonClass(generateAdapter = true)
data class HolidayCardDesign(
    val id: String,
    val number: Int? = null,
    val caption: String = "",
    val paper: String? = null,
)

/**
 * The arrivals open now. To a person: `next_morning`, `sealed_christmas`, `christmas_morning`. By email: `now`,
 * `sealed_christmas`. After December 24 only the first of each is left.
 */
@JsonClass(generateAdapter = true)
data class HolidayCardArrivals(
    val person: List<String> = emptyList(),
    val email: List<String> = emptyList(),
)

/** `GET /api/mailbox/cards/arrivals?to=`: when a card to one person can come, by their clock rather than the sender's. */
@JsonClass(generateAdapter = true)
data class HolidayCardArrivalsFor(
    /** The arrivals open to them now. */
    val arrivals: List<String> = emptyList(),
    /** The day of their next 7 a.m. mail where they live ("2026-10-31"). */
    @Json(name = "next_round_on") val nextRoundOn: String? = null,
)

/** A card as its sender sees it: today's card, and the answer to sending one. */
@JsonClass(generateAdapter = true)
data class SentHolidayCard(
    val id: String,
    val design: String? = null,
    /** Their name as they show it, or the masked email address. */
    @Json(name = "to_name") val toName: String? = null,
    @Json(name = "by_email") val byEmail: Boolean = false,
    val arrival: String? = null,
    /** When it goes into their mailbox (their 7 a.m. mail); null by email. */
    @Json(name = "arrives_at") val arrivesAt: String? = null,
    /** The day it goes into their mailbox by their clock ("2026-10-31"); null by email. */
    @Json(name = "arrives_on") val arrivesOn: String? = null,
    /** Sealed until then. */
    @Json(name = "opens_at") val opensAt: String? = null,
    /** The carrier's 7 a.m. pickup; null by email (until they open it). */
    @Json(name = "take_back_until") val takeBackUntil: String? = null,
    @Json(name = "can_take_back") val canTakeBack: Boolean = false,
    /** `waiting`, `delivered`, `claimed`, `expired` or `withdrawn`. */
    val status: String? = null,
    @Json(name = "sent_at") val sentAt: String? = null,
)

/** `POST /api/mailbox/cards`: today's card, to one person found by name or by email to someone not on Pantopus. */
@JsonClass(generateAdapter = true)
data class SendHolidayCardBody(
    val design: String,
    val message: String,
    val arrival: String,
    val to: HolidayCardRecipient,
)

/** Exactly one of the two. */
@JsonClass(generateAdapter = true)
data class HolidayCardRecipient(
    @Json(name = "user_id") val userId: String? = null,
    val email: String? = null,
)

@JsonClass(generateAdapter = true)
data class SendHolidayCardResponse(
    val card: SentHolidayCard,
)

/** `POST /api/mailbox/cards/:id/take-back`. */
@JsonClass(generateAdapter = true)
data class TakeBackHolidayCardResponse(
    @Json(name = "taken_back") val takenBack: Boolean = false,
)
