package app.pantopus.android.data.api.models.mailbox

import app.pantopus.android.data.api.models.mailbox.v2.MailCard
import app.pantopus.android.data.api.models.mailbox.v2.MailCardPostmark
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
    /** The box a signature beside FROM is drawn in (plan 8.2, launch key `card_table`); absent: no signing, the typed name. */
    val signature: CardSignatureBox? = null,
    /** What can go into a card besides the note (launch key `holiday_card_memories`); absent from an older server. */
    val media: HolidayCardMediaRules? = null,
    /** "Help me write it" can be used now (the server's launch key `card_note_help`); absent: no button. */
    @Json(name = "note_help") val noteHelp: Boolean = false,
    /** "Let it travel" (the server's switch `card_travel`, travelling card plan Part 2); absent while it's off: no switch. */
    val travel: HolidayCardTravelRules? = null,
    /**
     * "Pick a card" as shelves (the server's switch `card_shelves`, card shelves SPEC Part B): one large card from each
     * collection, then a shelf per collection. Absent while it's off, and from older servers: today's screen.
     */
    val shelves: Boolean = false,
    /**
     * The collections' ids in the order "One from each collection" draws them (card shelves SPEC E2); the shelves keep
     * [collections]' order. Absent from older servers: the collections' order.
     */
    val opening: List<String> = emptyList(),
    /**
     * The card improvements of November 28 are on (the server's `CARD_IMPROVEMENTS`): the send flow draws the new
     * experience only while this read says so. Absent while it's off, and from older servers: the flow as it was.
     */
    val improved: Boolean = false,
)

/**
 * `travel` on `GET /api/mailbox/cards`: the switch is on to begin with ([on], decision D5), the sender's town ("Boise,
 * ID"; null: "Where does it start?" is asked once, D4), and how many people one person may pass a card to (D1).
 */
@JsonClass(generateAdapter = true)
data class HolidayCardTravelRules(
    val on: Boolean = true,
    val town: String? = null,
    val places: Int = 2,
)

/** A town from `GET /api/mailbox/cards/towns` (the Census lists the server carries): its id, name, state and label. */
@JsonClass(generateAdapter = true)
data class CardTown(
    val id: String,
    val town: String,
    val state: String? = null,
    /** "Vancouver, WA". */
    val label: String,
    /** The ZIP code it was found by, when it was. */
    val zip: String? = null,
)

/** `GET /api/mailbox/cards/towns?q=`: up to 8 towns; with no q, the town nearest where the person is ("Use …"), or null. */
@JsonClass(generateAdapter = true)
data class CardTownsResponse(
    val towns: List<CardTown> = emptyList(),
    val suggested: CardTown? = null,
)

/** `PUT /api/mailbox/cards/town` body: a town's id from the list. */
@JsonClass(generateAdapter = true)
data class CardTownBody(
    val id: String,
)

/** `PUT /api/mailbox/cards/town` answer: the town as kept ("Vancouver, WA"). */
@JsonClass(generateAdapter = true)
data class CardTownKept(
    val town: String? = null,
)

/** One note "Help me write it" offers: a way of saying it (`heartfelt`, `light` or `brief`) and the words. */
@JsonClass(generateAdapter = true)
data class HolidayCardNoteIdea(
    val tone: String = "",
    val text: String = "",
)

/** The answer of `POST /api/ai/draft/card-note`: up to three notes to pick from. */
@JsonClass(generateAdapter = true)
data class HolidayCardNoteIdeas(
    val notes: List<HolidayCardNoteIdea> = emptyList(),
)

/**
 * The body of `POST /api/ai/draft/card-note`: the picture picked, the first names the card is to as the screen shows them
 * (none for an address or a link), how many people it goes to (past two, the note names no one), what to mention, what's
 * on the card so far, and the notes already shown ("Try again").
 */
@JsonClass(generateAdapter = true)
data class HolidayCardNoteHelpBody(
    val design: String,
    val to: List<String>,
    val count: Int,
    val hint: String? = null,
    val note: String? = null,
    @Json(name = "passed_over") val passedOver: List<String>? = null,
)

/** `media` on `GET /api/mailbox/cards`: whether a photo and a voice greeting can be added now, and their limits. */
@JsonClass(generateAdapter = true)
data class HolidayCardMediaRules(
    val photo: CardMediaRule? = null,
    val voice: CardMediaRule? = null,
    /** A photo or voice greeting goes only on a card sent with a bought stamp (founder 2026-11-11); absent on older servers. */
    @Json(name = "bought_stamp") val boughtStamp: CardBoughtStamp? = null,
    /** The free photo or voice cards a person has, while the card improvements are on (cards-next Wave 2). */
    @Json(name = "free_allowance") val freeAllowance: CardFreeAllowance? = null,
)

/** `media.free_allowance`: the first [limit] cards with a photo or greeting need no bought stamp; [remaining] are left. */
@JsonClass(generateAdapter = true)
data class CardFreeAllowance(
    val limit: Int = 0,
    val remaining: Int = 0,
)

/**
 * `media.bought_stamp`: [state] is what the composer does, as the server decides it. `ready`: photo and voice as usual
 * (the card spends a bought stamp). `buy`: both buttons stay, with the line under them, and open the stamp books.
 * `unavailable`: no photo or voice at all. [remaining]: bought stamps left now, or null when it couldn't be read.
 */
@JsonClass(generateAdapter = true)
data class CardBoughtStamp(
    val required: Boolean = false,
    val remaining: Int? = null,
    val state: String? = null,
) {
    val toBuy: Boolean get() = required && state == "buy"
    val unavailable: Boolean get() = required && state == "unavailable"
}

/** One kind of card media: [usable] is false while the key is off; the size and length limits the server keeps. */
@JsonClass(generateAdapter = true)
data class CardMediaRule(
    val usable: Boolean = false,
    @Json(name = "max_bytes") val maxBytes: Long? = null,
    /** A photo is stored at most this many pixels on its long side. */
    @Json(name = "long_side") val longSide: Int? = null,
    /** A voice greeting is at most this many seconds. */
    @Json(name = "max_seconds") val maxSeconds: Int? = null,
)

/**
 * A card's own photo (memories plan step 4): its stored file, upright size and the sender's description. [covered]: the
 * reader isn't the sender's connection, so it shows "Photo from {name}. Tap to show." and loads nothing until the tap.
 * Never on a sealed card, in a list row, a share picture or a public page.
 */
@JsonClass(generateAdapter = true)
data class CardPhoto(
    @Json(name = "file_id") val fileId: String,
    val width: Int? = null,
    val height: Int? = null,
    val alt: String? = null,
    val covered: Boolean = false,
    /** The photo is a Live Photo: its few seconds of video (contract section 13), covered whenever the photo is. */
    val live: CardLive? = null,
)

/** A Live Photo's moving part: an MP4 or QuickTime clip of at most 10 seconds, read from the same routes as its photo. */
@JsonClass(generateAdapter = true)
data class CardLive(
    @Json(name = "file_id") val fileId: String,
    @Json(name = "mime_type") val mimeType: String? = null,
    @Json(name = "duration_ms") val durationMs: Long? = null,
)

/** A card's voice greeting (memories plan step 7): its file and its length as the server measured it. */
@JsonClass(generateAdapter = true)
data class CardVoice(
    @Json(name = "file_id") val fileId: String,
    @Json(name = "duration_ms") val durationMs: Long? = null,
)

/** `POST /api/mailbox/cards/media` (201): the stored file, kept for the sender's next send for 72 hours. */
@JsonClass(generateAdapter = true)
data class CardMediaUploaded(
    val media: CardMediaFile,
    @Json(name = "expires_at") val expiresAt: String? = null,
)

/** A stored photo (upright, at most 2400 px on its long side, no metadata) or voice greeting. */
@JsonClass(generateAdapter = true)
data class CardMediaFile(
    @Json(name = "file_id") val fileId: String,
    val kind: String = "photo",
    val width: Int? = null,
    val height: Int? = null,
    @Json(name = "duration_ms") val durationMs: Long? = null,
)

/**
 * Where `GET /api/mailbox/cards` keeps signatures: a [w] × [h] box, at most [maxBytes] as compact JSON. [saves]: the
 * account can keep one signature for the next cards (founder, 2026-11-16; `PUT`/`DELETE /api/mailbox/cards/signature`),
 * and [saved] is the one it keeps (null: none, or an older server).
 */
@JsonClass(generateAdapter = true)
data class CardSignatureBox(
    val w: Int = CardSignature.WIDTH,
    val h: Int = CardSignature.HEIGHT,
    @Json(name = "max_bytes") val maxBytes: Int = CardSignature.MAX_BYTES,
    val saves: Boolean = false,
    val saved: CardSignature? = null,
)

/** `PUT /api/mailbox/cards/signature`: the signature to keep, and back as kept. */
@JsonClass(generateAdapter = true)
data class CardSignatureBody(
    val signature: CardSignature,
)

/**
 * The sender's own signature beside FROM (plan 8.2): pen strokes in a 400 × 100 box, whole numbers, each stroke a flat
 * list of x, y points (a dot is one point). The sender's own data, kept with the note: never in a share picture's file
 * name, a log or analytics.
 */
@JsonClass(generateAdapter = true)
data class CardSignature(
    val w: Int = WIDTH,
    val h: Int = HEIGHT,
    val strokes: List<List<Int>> = emptyList(),
) {
    /** One this app can draw: the box every app uses, with ink in it. */
    val drawable: Boolean get() = w == WIDTH && h == HEIGHT && strokes.any { it.size >= 2 }

    companion object {
        const val WIDTH = 400
        const val HEIGHT = 100
        const val MAX_BYTES = 2048
        const val MAX_STROKES = 40
    }
}

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
    /**
     * The table it opens on (card shelves SPEC A4): `reverence`, `santa` or `nostalgia`, from its collection. Absent from
     * older servers: the app decides by its number ([app.pantopus.android.ui.screens.mailbox.cards.table.CardMood]).
     */
    val mood: String? = null,
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
    /** Its short name ("Jesus Christ"), for the website's row of collections. Absent from older servers. */
    val short: String? = null,
    /** Its public name in a link (`/cards/collection/<slug>`). Absent from older servers. */
    val slug: String? = null,
    /** The design id of the card that stands for it in "One from each collection"; absent: no large card for it. */
    val pick: String? = null,
    /** Its parts in story order (Christmas with Jesus Christ only); together they are [designs], in order. */
    val parts: List<HolidayCardPart> = emptyList(),
)

/** A part of a collection ("The first Christmas"): its name and its pictures' ids, in order. */
@JsonClass(generateAdapter = true)
data class HolidayCardPart(
    val name: String = "",
    val designs: List<String> = emptyList(),
)

/**
 * The arrivals open now. To a person: `next_morning`, `sealed_christmas`, `christmas_morning`. By email: `now`,
 * `sealed_christmas`. After December 24 only the first of each is left.
 */
@JsonClass(generateAdapter = true)
data class HolidayCardArrivals(
    val person: List<String> = emptyList(),
    /** By email the two choices older apps word, and a card by link's two. */
    val email: List<String> = emptyList(),
    /**
     * By email all four, where the server has them: its email at the sender's next 7 a.m. ([HolidayCardsResponse.nextRoundAt])
     * or on Christmas morning, sealed until Christmas, or right away (after Christmas morning: `next_morning`, `now`).
     * Absent from an older server: [email] then.
     */
    @Json(name = "email_all") val emailAll: List<String>? = null,
)

/**
 * `GET /api/mailbox/cards/waiting` (TABCARD §3): the newest unopened Christmas card in a new account's own Mailbox,
 * for the first time its app opens on a phone; [card] is null when there is none.
 */
@JsonClass(generateAdapter = true)
data class HolidayCardWaitingResponse(
    val card: HolidayCardWaiting? = null,
)

/** The waiting card: its mail id (opened as a Mailbox tap opens it), who sent it, and whether it waits for Christmas morning. */
@JsonClass(generateAdapter = true)
data class HolidayCardWaiting(
    @Json(name = "mail_id") val mailId: String,
    @Json(name = "from_first_name") val fromFirstName: String? = null,
    val sealed: Boolean = false,
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
    /** By email, set to go at the sender's 7 a.m. or on Christmas morning: when. Absent once it went, or when it went at once. */
    @Json(name = "email_send_at") val emailSendAt: String? = null,
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
    /** A card that travels (the server's switch `card_travel`): its journey; absent for every other card. */
    val travel: SentCardTravel? = null,
)

/**
 * `travel` on a card its sender sees (travelling card plan Part 6): the journey's id, and on Sent, from this card on,
 * the towns, the miles and the town it's in now ("5 towns · 2,692 miles. Now in Tampa, FL.").
 */
@JsonClass(generateAdapter = true)
data class SentCardTravel(
    val journey: String? = null,
    val towns: Int? = null,
    val miles: Int? = null,
    @Json(name = "now_in") val nowIn: String? = null,
    /** The postmarks on its envelope, oldest first: one for a card that started a journey, more for one passed on. */
    val postmarks: List<MailCardPostmark> = emptyList(),
) {
    /** Passed on, not started: free, never the day's card, so taking it back gives no stamp and frees no day. */
    val passedOn: Boolean get() = postmarks.size >= 2
}

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
    /** Signed beside FROM (plan 8.2); null: the first name typed in the pen. The same on every look and retry. */
    val signature: CardSignature? = null,
    /** The card's own photo, the file id `POST /cards/media` gave (needs [requestId]); null: none. */
    val photo: String? = null,
    /** The photo's description for screen readers, up to 200 letters. */
    @Json(name = "photo_alt") val photoAlt: String? = null,
    /** The card's voice greeting's file id (needs [requestId]); null: none. */
    val voice: String? = null,
    /** "Let it travel" left on (travelling card plan Part 2): true; null (left out) for an ordinary card. */
    val travel: Boolean? = null,
)

/** `GET /api/mailbox/cards/share-video/:design` (the server's launch key `card_share_video`): where the picture's video is. */
@JsonClass(generateAdapter = true)
data class HolidayCardShareVideo(
    val url: String,
    val width: Int? = null,
    val height: Int? = null,
)

/** `POST /api/mailbox/cards/shared` (launch key `card_table`): what was shared, for the counts; never the note or a name. */
@JsonClass(generateAdapter = true)
data class HolidayCardSharedBody(
    val design: String,
    /** `instagram`, `facebook`, `email`, `link`, `save` or `more`. */
    val kind: String,
    /** `story`, `post`, `link` or `video`. */
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
 * address reads the morning mail as right away and Christmas morning as sealed until Christmas, unless
 * [emailsKeepArrival].
 */
@JsonClass(generateAdapter = true)
data class SendHolidayCardListBody(
    val design: String,
    val message: String,
    val arrival: String,
    val recipients: List<HolidayCardListRecipient>,
    @Json(name = "use_stamp") val useStamp: Boolean = true,
    /** One signature for the whole list, as one note (plan 8.2). */
    val signature: CardSignature? = null,
    /** The photo, its words and the voice greeting each card of the list carries (only while [HolidayCardsResponse.improved]). */
    val photo: String? = null,
    @Json(name = "photo_alt") val photoAlt: String? = null,
    val voice: String? = null,
    /**
     * Each address keeps the list's choice too (its email at the sender's 7 a.m. or on Christmas morning): true where the
     * server offers every email choice ([HolidayCardArrivals.emailAll]), else left out.
     */
    @Json(name = "emails_keep_arrival") val emailsKeepArrival: Boolean? = null,
    /** "Let it travel" left on: each card of the list starts a journey of its own; null (left out) otherwise. */
    val travel: Boolean? = null,
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
    /** By email, set to go at the sender's 7 a.m. or on Christmas morning: when (absent: it goes now). */
    @Json(name = "email_send_at") val emailSendAt: String? = null,
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
    /** The first card's email, set for later: when (see [HolidayCardPreview.emailSendAt]). */
    @Json(name = "email_send_at") val emailSendAt: String? = null,
    val recipients: List<HolidayCardListLine> = emptyList(),
    val stamps: HolidayCardStamps? = null,
    val needed: Int = 0,
) {
    /** The first card that can go, as Look it over shows one card. */
    val look: HolidayCardPreview?
        get() =
            piece?.let {
                HolidayCardPreview(it, arrivesOn, opensOn, sealedDays, takeBackUntil, email, linkPage, emailSendAt = emailSendAt)
            }
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

/**
 * `POST /api/mailbox/cards/:id/pass-on` (and its look) body (travelling card plan Part 4): the same card goes on, free,
 * to a person, an email address or by link, with the passer's note and signature, under one request ID per draft, in
 * one of the card's two places (`piece.card.travel.next_place`).
 */
@JsonClass(generateAdapter = true)
data class CardPassOnBody(
    val to: HolidayCardRecipient,
    val message: String,
    val signature: CardSignature? = null,
    @Json(name = "request_id") val requestId: String,
    val place: Int,
)

/** `POST /api/mailbox/cards/:id/pass-on/preview` → 200: every check the pass-on runs passed; nothing was sent. */
@JsonClass(generateAdapter = true)
data class CardPassOnPreview(
    @Json(name = "pass_on") val passOn: CardPassOnLook,
)

/** A pass-on as it would go: who it's to, how, when it arrives, until when it can come back, and the passer's town. */
@JsonClass(generateAdapter = true)
data class CardPassOnLook(
    val place: Int? = null,
    @Json(name = "to_name") val toName: String? = null,
    @Json(name = "by_email") val byEmail: Boolean = false,
    @Json(name = "by_link") val byLink: Boolean = false,
    @Json(name = "arrives_at") val arrivesAt: String? = null,
    @Json(name = "arrives_on") val arrivesOn: String? = null,
    @Json(name = "take_back_until") val takeBackUntil: String? = null,
    /** "Tampa, FL": the passer's town as it goes on the journey. */
    val town: String? = null,
    /** The postmark this pass-on strikes (the passer's town and today there): the sealing table's newest postmark. */
    val postmark: MailCardPostmark? = null,
)

/** `POST /api/mailbox/cards/:id/pass-on/take-back` → 200: the place is free again. */
@JsonClass(generateAdapter = true)
data class CardPassOnTakenBack(
    @Json(name = "taken_back") val takenBack: Boolean = false,
    @Json(name = "card_id") val cardId: String? = null,
    val place: Int? = null,
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
    /** By email, set to go at the sender's 7 a.m. or on Christmas morning: when (null: it goes as it's sealed). */
    @Json(name = "email_send_at") val emailSendAt: String? = null,
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
 * The email a card to an email address sends: the picture at its top, its subject, the heading, two sentences, the
 * button, the footnote and the footer's lines.
 */
@JsonClass(generateAdapter = true)
data class HolidayCardPreviewEmail(
    /**
     * The picture at the top of the email (launch key `card_table` on the server): the card's front lying on its open
     * envelope, or the sealed envelope for a card sealed until Christmas. Null from a server without it.
     */
    val picture: String? = null,
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
    /**
     * A card by email whose email hasn't gone out while it waits (`email_waiting`): `retrying` while the server keeps
     * trying (about an hour), then `failed`. Absent once it went; any other word is read as no trouble.
     */
    @Json(name = "email_status") val emailStatus: String? = null,
    /** By email, set to go at the sender's 7 a.m. or on Christmas morning: when. Absent once it went (or when it went at once). */
    @Json(name = "email_send_at") val emailSendAt: String? = null,
    /** The address the sender typed, whole, so a mistake in it shows (only with [emailStatus]). */
    @Json(name = "email_to") val emailTo: String? = null,
    /** A reply this person wrote back to a card (plan Part 3): the card it answers; a letter otherwise. */
    @Json(name = "card_reply") val cardReply: CardReplyFace? = null,
    /** A card that travels (the server's switch `card_travel`): its journey, towns, miles and the town it's in now. */
    val travel: SentCardTravel? = null,
)

/** `POST /api/mailbox/cards/:id/email-again`: the card's email went this time. */
@JsonClass(generateAdapter = true)
data class CardEmailedAgainResponse(
    val emailed: Boolean = false,
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
    /** The table it opens on: `reverence`, `santa` or `nostalgia` (absent from older servers: decided by number). */
    val mood: String? = null,
    /** The whole verse on a Christmas with Jesus Christ picture, not while it's sealed ("Read the verse"). */
    val verse: String? = null,
    /** The sender's own signature beside FROM (plan 8.2; the card's page only), also while it's sealed for them. */
    val signature: CardSignature? = null,
    /** The card's own photo (the card's page only; never covered for its sender). */
    val photo: CardPhoto? = null,
    /** The card's voice greeting (the card's page only). */
    val voice: CardVoice? = null,
)

/**
 * One step of a sent card's trail: `sealed`, `picked_up`, `delivered`, `opens`, `emailed`, `joined` or `returned`, when
 * (a time, [at], or a day by their clock, [on]) and whether it has happened (`emailed` only once the email went out).
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
