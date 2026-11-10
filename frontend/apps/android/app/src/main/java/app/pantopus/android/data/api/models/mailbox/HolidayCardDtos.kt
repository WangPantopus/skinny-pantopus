package app.pantopus.android.data.api.models.mailbox

import app.pantopus.android.data.api.models.mailbox.v2.MailCard
import app.pantopus.android.data.api.models.mailbox.v2.MailPostmark
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/mailbox/cards` (launch keys `holiday_cards` + `mailbox`; 404 while either is off): what sending a Christmas
 * card needs. The season's pictures (the app carries the first 17 itself and loads any other from the website, by
 * [HolidayCardDesign.id]) and the collections they're shown in, whether sending is open (until December 31 ends where
 * the sender lives), the arrivals open now, and today's card once it's sent (one a day).
 */
@JsonClass(generateAdapter = true)
data class HolidayCardsResponse(
    @Json(name = "postage_enabled") val postageEnabled: Boolean = false,
    /** Digital stamps left (postage on; null when they couldn't be read). */
    val stamps: HolidayCardStamps? = null,
    val open: Boolean = false,
    val holiday: String? = null,
    val year: Int = 2026,
    @Json(name = "closes_on") val closesOn: String? = null,
    /** The note on the back: up to this many letters. */
    @Json(name = "message_limit") val messageLimit: Int = 300,
    /** Every picture, in number order. */
    val designs: List<HolidayCardDesign> = emptyList(),
    /** The collections "Pick a card" shows, in order; none from an older server (one grid of every picture then). */
    val collections: List<HolidayCardCollection> = emptyList(),
    val arrivals: HolidayCardArrivals = HolidayCardArrivals(),
    /** The sender's next 7 a.m. round, where they live: when the carrier picks today's card up. */
    @Json(name = "next_round_at") val nextRoundAt: String? = null,
    /** 7 a.m. on Christmas morning, where the sender lives. */
    @Json(name = "christmas_morning_at") val christmasMorningAt: String? = null,
    /** The sender's own time zone (IANA). */
    @Json(name = "time_zone") val timeZone: String? = null,
    /** Today's card; null until it's sent. */
    val today: SentHolidayCard? = null,
    /** How many one card can go to at once: 20 with digital stamps on (a list, `POST /api/mailbox/cards/batch`), else 1. */
    @Json(name = "max_recipients") val maxRecipients: Int = 1,
)

/** The digital stamps left, with `GET /api/mailbox/cards` while postage is on (the Mailbox row's line). */
@JsonClass(generateAdapter = true)
data class HolidayCardStamps(
    val available: Int = 0,
    @Json(name = "free_remaining") val freeRemaining: Int = 0,
    @Json(name = "paid_remaining") val paidRemaining: Int = 0,
)

/** One of the season's pictures: the caption printed under it, the colour of its paper and the collection it's in. */
@JsonClass(generateAdapter = true)
data class HolidayCardDesign(
    val id: String,
    val number: Int? = null,
    val caption: String = "",
    val paper: String? = null,
    /** The id of the collection it's shown in. */
    val collection: String? = null,
    /** The picture's height at 960 pixels wide, so it keeps its shape before it loads. */
    val height: Int? = null,
    /** The picture's name on its public page (launch key `card_table`). */
    val slug: String? = null,
    /** The picture's table colour, a colour like `#3b4c6e` (launch key `card_table`). */
    val table: String? = null,
    /** The whole verse printed on a Christmas with Jesus Christ picture (59-67), shown under the card; others have none. */
    val verse: String? = null,
)

/** A collection on "Pick a card" (Christmas as a Kid …): its name, who it's for, and its pictures in order. */
@JsonClass(generateAdapter = true)
data class HolidayCardCollection(
    val id: String,
    val name: String = "",
    /** Who it's for, in a line under the row of names. */
    val line: String = "",
    /** Its pictures' ids, in the order the grid shows them. */
    val designs: List<String> = emptyList(),
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
    /** Sent by a link: [byEmail] stays true as well, so older apps still show something sensible. */
    @Json(name = "by_link") val byLink: Boolean = false,
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
    /** The link to send on, right after sending a card by link (the answer's own `link`, kept with the card here). */
    @Transient val link: String? = null,
)

/** `POST /api/mailbox/cards`: today's card, to one person found by name or by email to someone not on Pantopus. */
@JsonClass(generateAdapter = true)
data class SendHolidayCardBody(
    val design: String,
    val message: String,
    val arrival: String,
    val to: HolidayCardRecipient,
    /**
     * One per card draft, sent with every look and retry of it (OkHttp's own resend included): the server answers a
     * repeat with the card it stored, never a second one.
     */
    @Json(name = "request_id") val requestId: String? = null,
    @Json(name = "use_stamp") val useStamp: Boolean? = null,
)

/** `POST /api/mailbox/cards/shared` (launch key `card_table`): what was shared, for the counts; never the note or a name. */
@JsonClass(generateAdapter = true)
data class HolidayCardSharedBody(
    val design: String,
    /** `instagram`, `facebook`, `email`, `link`, `save` or `more`. */
    val kind: String,
    /** `story`, `post` or `link`. */
    val format: String,
    @Json(name = "with_note") val withNote: Boolean,
)

/** Exactly one of these. */
@JsonClass(generateAdapter = true)
data class HolidayCardRecipient(
    @Json(name = "user_id") val userId: String? = null,
    val email: String? = null,
    /** By a link: the first person to open it keeps the card (launch key `card_table`). */
    val link: Boolean? = null,
)

/**
 * `POST /api/mailbox/cards/batch` (and its look) body: one card to a list of people and addresses (digital stamps on),
 * each its own card under its own request ID, kept for every look and retry of the list. One choice of arrival: an
 * address reads the morning mail as right away and Christmas morning as sealed until Christmas.
 */
@JsonClass(generateAdapter = true)
data class SendHolidayCardListBody(
    val design: String,
    val message: String,
    val arrival: String,
    val recipients: List<HolidayCardListRecipient>,
    @Json(name = "use_stamp") val useStamp: Boolean = true,
)

/** A person or an address on a list, and its card's request ID. */
@JsonClass(generateAdapter = true)
data class HolidayCardListRecipient(
    val to: HolidayCardRecipient,
    @Json(name = "request_id") val requestId: String,
)

/** One card on a list's look: `ready` (and when it comes), `already_sent` (by an earlier try), or `refused` (and why). */
@JsonClass(generateAdapter = true)
data class HolidayCardListLine(
    @Json(name = "request_id") val requestId: String,
    val status: String,
    @Json(name = "to_name") val toName: String? = null,
    @Json(name = "by_email") val byEmail: Boolean = false,
    val arrival: String? = null,
    /** The day it goes into their mailbox by their clock (`YYYY-MM-DD`). */
    @Json(name = "arrives_on") val arrivesOn: String? = null,
    val card: SentHolidayCard? = null,
    val error: String? = null,
    val code: String? = null,
)

/**
 * `POST /api/mailbox/cards/batch/preview` → 200: the first card that can go as its person will see it (the fields of
 * [HolidayCardPreview]; none when nobody can get it), every card's line, the stamps left and the stamps the ready cards
 * take.
 */
@JsonClass(generateAdapter = true)
data class HolidayCardListPreview(
    val piece: HolidayCardPreviewPiece? = null,
    @Json(name = "arrives_on") val arrivesOn: String? = null,
    @Json(name = "opens_on") val opensOn: String? = null,
    @Json(name = "sealed_days") val sealedDays: Int? = null,
    @Json(name = "take_back_until") val takeBackUntil: String? = null,
    val email: HolidayCardPreviewEmail? = null,
    @Json(name = "link_page") val linkPage: HolidayCardPreviewLinkPage? = null,
    val recipients: List<HolidayCardListLine> = emptyList(),
    val stamps: HolidayCardStamps? = null,
    val needed: Int = 0,
) {
    /** The first card that can go, as Look it over shows one card. */
    val look: HolidayCardPreview?
        get() = piece?.let { HolidayCardPreview(it, arrivesOn, opensOn, sealedDays, takeBackUntil, email, linkPage) }
}

/** One card in a list's answer: `sent`, `already_sent` (an earlier try), or `not_sent` (and why; it used no stamp). */
@JsonClass(generateAdapter = true)
data class HolidayCardListResult(
    @Json(name = "request_id") val requestId: String,
    val status: String,
    val card: SentHolidayCard? = null,
    val error: String? = null,
    val code: String? = null,
)

/** `POST /api/mailbox/cards/batch` → 200 (402 `STAMPS_REQUIRED` with `needed` and `available` when too few stamps). */
@JsonClass(generateAdapter = true)
data class SendHolidayCardListResponse(
    val results: List<HolidayCardListResult> = emptyList(),
    val stamps: HolidayCardStamps? = null,
)

@JsonClass(generateAdapter = true)
data class SendHolidayCardResponse(
    val card: SentHolidayCard,
    /** The link to send on, for a card by link. */
    val link: String? = null,
)

/** `GET /api/mailbox/cards/:id/link`: the link of a card by link that's still waiting for someone. */
@JsonClass(generateAdapter = true)
data class HolidayCardLinkResponse(
    val link: String,
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
    val subject: String? = null,
    @Json(name = "sent_at") val sentAt: String? = null,
    /** Their name when it was sent; by email the masked address, or the name of whoever claimed it. */
    @Json(name = "to_name") val toName: String? = null,
    /** A letter to a Home itself: [toName] ("their household") is said whole, never as a first name. */
    @Json(name = "to_household") val toHousehold: Boolean = false,
    @Json(name = "by_email") val byEmail: Boolean = false,
    /** Sent by a link: [byEmail] stays true as well, so older apps still show something sensible. */
    @Json(name = "by_link") val byLink: Boolean = false,
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

/** The card's picture and its printing (the server sends null for a picture it no longer knows). */
@JsonClass(generateAdapter = true)
data class SentCardFace(
    val design: String? = null,
    val number: Int? = null,
    val caption: String? = null,
    val paper: String? = null,
    val year: Int? = null,
    /** The picture's height at 960 pixels wide (null for a picture the server doesn't know). */
    val height: Int? = null,
    /** The picture's name on its public page and its table colour (launch key `card_table`). */
    val slug: String? = null,
    val table: String? = null,
    /** The whole verse on a Christmas with Jesus Christ picture, not while it's sealed ("Read the verse"). */
    val verse: String? = null,
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
    /** A card by link: any account opens it, so the page names no address. */
    @Json(name = "by_link") val byLink: Boolean = false,
)
