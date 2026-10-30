package app.pantopus.android.data.api.models.mailbox

import app.pantopus.android.data.api.models.mailbox.v2.MailCard
import app.pantopus.android.data.api.models.mailbox.v2.MailPostmark
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

/**
 * `POST /api/mailbox/cards/preview` (the body of sending one): exactly what the other person will see, from the same
 * checks and lookups as sending it. Nothing is stored or sent. A person's card: the piece as their Mailbox draws it and
 * when it comes; by email: the email they get and the page its link opens.
 */
@JsonClass(generateAdapter = true)
data class HolidayCardPreview(
    val piece: HolidayCardPreviewPiece,
    /** The day it goes into their mailbox by their clock ("2026-12-11"); null by email. */
    @Json(name = "arrives_on") val arrivesOn: String? = null,
    /** The day a sealed card opens ("2026-12-25"); null when it isn't sealed. */
    @Json(name = "opens_on") val opensOn: String? = null,
    /** How many days it stays sealed once it's in their mailbox. */
    @Json(name = "sealed_days") val sealedDays: Int? = null,
    @Json(name = "take_back_until") val takeBackUntil: String? = null,
    /** The email they get, for a card sent to an email address. */
    val email: HolidayCardPreviewEmail? = null,
    /** The page the email's link opens, for a card sent to an email address. */
    @Json(name = "link_page") val linkPage: HolidayCardPreviewLinkPage? = null,
)

/** The card as a piece in their Mailbox: the name it really carries, its postmark and the card. */
@JsonClass(generateAdapter = true)
data class HolidayCardPreviewPiece(
    val id: String = "preview",
    val kind: String? = null,
    @Json(name = "sender_display") val senderDisplay: String = "",
    @Json(name = "sender_trust") val senderTrust: String = "pantopus_user",
    @Json(name = "sender_business_name") val senderBusinessName: String? = null,
    val subject: String? = null,
    /** The note on the back, trimmed. */
    val content: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    /** When it goes into their mailbox; null by email. */
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    val postmark: MailPostmark? = null,
    val card: MailCard? = null,
)

/**
 * The email a card to an email address sends: its subject, the heading, two sentences, the button, the footnote and the
 * footer's lines.
 */
@JsonClass(generateAdapter = true)
data class HolidayCardPreviewEmail(
    val subject: String = "",
    val heading: String = "",
    val lines: List<String> = emptyList(),
    val button: String = "",
    val footnote: String = "",
    val footer: List<String> = emptyList(),
)

/** `GET /api/mailbox/sent` (launch key `mailbox`): what the person has sent, newest first, 25 at a time. */
@JsonClass(generateAdapter = true)
data class SentMailResponse(
    val items: List<SentCard> = emptyList(),
    /** Where the next page starts; null at the end. */
    val next: String? = null,
)

/** `GET /api/mailbox/sent/:id`: one card the person sent, with their own note and its trail. */
@JsonClass(generateAdapter = true)
data class SentCardResponse(
    val item: SentCard,
)

/**
 * A card the person sent, as Sent shows it: who it went to and how it's doing, never anything they did with it (opened,
 * filed, shredded) nor where they live. `status`: `waiting` (to a person, before the 7 a.m. pickup), `picked_up` (it
 * comes on Christmas morning), `delivered` (in their mailbox), `email_waiting`, `claimed` or `expired` (by email).
 */
@JsonClass(generateAdapter = true)
data class SentCard(
    val id: String,
    val kind: String? = null,
    @Json(name = "sent_at") val sentAt: String? = null,
    /** Their name when it was sent; by email the masked address, or the name of whoever claimed it. */
    @Json(name = "to_name") val toName: String? = null,
    @Json(name = "by_email") val byEmail: Boolean = false,
    val arrival: String? = null,
    val status: String? = null,
    @Json(name = "arrives_at") val arrivesAt: String? = null,
    /** The day it goes (or went) into their mailbox, by their clock ("2026-12-11"). */
    @Json(name = "arrives_on") val arrivesOn: String? = null,
    /** The day a sealed card opens ("2026-12-25"). */
    @Json(name = "opens_on") val opensOn: String? = null,
    /** Sealed until Christmas morning. */
    val sealed: Boolean = false,
    @Json(name = "can_take_back") val canTakeBack: Boolean = false,
    @Json(name = "take_back_until") val takeBackUntil: String? = null,
    val envelope: SentCardEnvelope? = null,
    val card: SentCardFace? = null,
    /** The sender's own note (the card's page only). */
    val note: String? = null,
    /** Where it's been, in order (the card's page only). */
    val trail: List<SentCardStep> = emptyList(),
)

/** The envelope as they got it: who it's from, and the day it was postmarked by their clock (null before the pickup). */
@JsonClass(generateAdapter = true)
data class SentCardEnvelope(
    val from: String? = null,
    @Json(name = "postmarked_on") val postmarkedOn: String? = null,
)

/** The card's picture and its printing. */
@JsonClass(generateAdapter = true)
data class SentCardFace(
    val design: String,
    val number: Int? = null,
    val caption: String? = null,
    val paper: String? = null,
    val year: Int? = null,
)

/**
 * One step of a sent card's trail: `sealed`, `picked_up`, `delivered`, `opens`, `emailed`, `joined` or `returned`, when
 * (a time, [at], or a day by their clock, [on]) and whether it has happened.
 */
@JsonClass(generateAdapter = true)
data class SentCardStep(
    val step: String,
    val at: String? = null,
    val on: String? = null,
    val done: Boolean = false,
)

/** The page the email's link opens: who it's from, whether it's sealed, and the address it went to (masked). */
@JsonClass(generateAdapter = true)
data class HolidayCardPreviewLinkPage(
    @Json(name = "sender_name") val senderName: String = "",
    @Json(name = "sender_verified") val senderVerified: Boolean = false,
    val sealed: Boolean = false,
    @Json(name = "sent_to") val sentTo: String = "",
    @Json(name = "sent_on") val sentOn: String? = null,
)
