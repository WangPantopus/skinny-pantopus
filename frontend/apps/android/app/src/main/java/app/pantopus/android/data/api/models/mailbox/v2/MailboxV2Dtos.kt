package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonArrayValue
import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `GET /api/mailbox/v2/drawers` — route `backend/routes/mailboxV2.js:214`. */
@JsonClass(generateAdapter = true)
data class DrawerListResponse(
    val drawers: List<Drawer>,
    /** The Mail tab badge: unopened, delivered pieces in Me, Home and Biz this person can read (Mail build contract). */
    @Json(name = "unread_total") val unreadTotal: Int? = null,
    /** The latest morning round that brought this person mail, how much came, and the next round (SRV-1). */
    val delivery: MailDelivery? = null,
    /** One row per Home the person lives at, and whether its mail opens for them yet (SRV-8). */
    val homes: List<MailHome>? = null,
    /** The hold in effect, or the next one; null when there's none (SRV-5). */
    @Json(name = "vacation_hold") val vacationHold: MailVacationHold? = null,
)

/**
 * `vacation_hold` on `GET /api/mailbox/v2/drawers` (SRV-5): `status` is `scheduled` or `active`; `held_count` is what it
 * keeps now; `release_at` is when that comes back, 7 a.m. on `end_date` in the person's zone.
 */
@JsonClass(generateAdapter = true)
data class MailVacationHold(
    val status: String? = null,
    @Json(name = "start_date") val startDate: String? = null,
    @Json(name = "end_date") val endDate: String? = null,
    @Json(name = "held_count") val heldCount: Int = 0,
    @Json(name = "release_at") val releaseAt: String? = null,
) {
    val active: Boolean get() = status == "active"
}

/** The drawers the Mail badge counts: Me, Home and Biz. Earn stays out while Mail extras are off. */
private val MAIL_BADGE_DRAWERS = setOf("personal", "home", "business")

/** The Mail tab badge: the server's `unread_total` once it sends one; else the Me, Home and Biz drawers' counts. */
fun DrawerListResponse.unopenedTotal(): Int =
    (unreadTotal ?: drawers.filter { it.drawer in MAIL_BADGE_DRAWERS }.sumOf { it.unreadCount }).coerceAtLeast(0)

/** `delivery` on `GET /api/mailbox/v2/drawers`: the morning round, 7 a.m. where the mailbox is. */
@JsonClass(generateAdapter = true)
data class MailDelivery(
    /** The latest round that brought this person a piece they can read; null when none ever did. */
    @Json(name = "last_at") val lastAt: String? = null,
    /** Pieces that came in the 24 hours up to and including that round, special deliveries included. */
    @Json(name = "last_count") val lastCount: Int = 0,
    /** How many of those are still unopened. */
    @Json(name = "last_unopened") val lastUnopened: Int = 0,
    /** The next round of the person's own mailbox. */
    @Json(name = "next_at") val nextAt: String? = null,
    /** The person's own mailbox's zone (IANA), which the rounds follow. */
    @Json(name = "time_zone") val timeZone: String? = null,
)

/** `homes[]` on `GET /api/mailbox/v2/drawers`. `mail_access` is `open` or `needs_proof` (the closed Home box). */
@JsonClass(generateAdapter = true)
data class MailHome(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "address_line") val addressLine: String? = null,
    val name: String? = null,
    @Json(name = "mail_access") val mailAccess: String? = null,
)

/** `postmark` on a piece: the sender's post office town (null → the date only) and the day it was posted. */
@JsonClass(generateAdapter = true)
data class MailPostmark(
    val town: String? = null,
    val date: String? = null,
)

/**
 * `card` on a piece: a Christmas card (launch key `holiday_cards`). The app carries the picture itself, by [design], and
 * prints the [caption], the year and the postmark under it. A card is still a letter (`kind` letter). While [sealed]
 * (until [sealedUntil], 7 a.m. on Christmas morning where the person lives) its note stays on the server.
 */
@JsonClass(generateAdapter = true)
data class MailCard(
    val design: String,
    val number: Int? = null,
    val caption: String? = null,
    /** The card's paper, a colour like the picture's own border, for the strip printed under the picture. */
    val paper: String? = null,
    val holiday: String? = null,
    val year: Int? = null,
    /** `next_morning`, `sealed_christmas`, `christmas_morning` or `now`. */
    val arrival: String? = null,
    @Json(name = "sealed_until") val sealedUntil: String? = null,
    val sealed: Boolean = false,
)

/**
 * `invoice` on a piece (SRV-7): a bill made from a business invoice. `status` is `sent`, `viewed`, `paid`, `void` or
 * `overdue`; Pay goes by [id] on the existing invoice screen. Null for everything else.
 */
@JsonClass(generateAdapter = true)
data class MailInvoice(
    val id: String,
    val status: String? = null,
    @Json(name = "total_cents") val totalCents: Long? = null,
    val currency: String? = null,
    @Json(name = "due_date") val dueDate: String? = null,
    @Json(name = "business_name") val businessName: String? = null,
) {
    /** Still to pay: sent, viewed or overdue. */
    val owed: Boolean get() = status in setOf("sent", "viewed", "overdue")
}

/** `summary` on a piece (SRV-2): "Pantopus read this for you", a short note and key facts; null when there's none. */
@JsonClass(generateAdapter = true)
data class MailSummary(
    val text: String? = null,
    @Json(name = "key_facts") val keyFacts: List<MailKeyFact> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MailKeyFact(
    val label: String? = null,
    val value: String? = null,
)

/** `enclosures[]` on a piece's detail (SRV-4): what came inside; each opens through a fresh link. */
@JsonClass(generateAdapter = true)
data class MailEnclosure(
    val id: String,
    val name: String? = null,
    @Json(name = "mime_type") val mimeType: String? = null,
    @Json(name = "size_bytes") val sizeBytes: Long? = null,
)

/** `GET /api/mailbox/:id/enclosures/:enclosure_id` (SRV-4): a link signed for five minutes (null: an older public file). */
@JsonClass(generateAdapter = true)
data class EnclosureLinkResponse(
    val url: String,
    @Json(name = "expires_at") val expiresAt: String? = null,
)

/** `GET /api/mailbox/v2/search` — every piece this person can read, the same row shape as a drawer (SRV-3). */
@JsonClass(generateAdapter = true)
data class MailSearchResponse(
    val mail: List<DrawerMail>,
    val total: Int = 0,
    val nextOffset: Int? = null,
    val hasMore: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class Drawer(
    val drawer: String,
    @Json(name = "display_name") val displayName: String,
    val icon: String,
    @Json(name = "unread_count") val unreadCount: Int,
    @Json(name = "urgent_count") val urgentCount: Int,
    @Json(name = "last_item_at") val lastItemAt: String?,
)

/** `GET /api/mailbox/v2/drawer/:drawer` — route `backend/routes/mailboxV2.js:280`. */
@JsonClass(generateAdapter = true)
data class DrawerItemsResponse(
    val mail: List<DrawerMail>,
    val total: Int,
    val drawer: String,
)

@JsonClass(generateAdapter = true)
data class DrawerMail(
    val id: String,
    val type: String,
    @Json(name = "mail_type") val mailType: String?,
    val subject: String?,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "display_title") val displayTitle: String?,
    @Json(name = "preview_text") val previewText: String?,
    @Json(name = "ack_required") val ackRequired: Boolean?,
    @Json(name = "ack_status") val ackStatus: String?,
    val viewed: Boolean = false,
    val starred: Boolean = false,
    val archived: Boolean = false,
    val sender: SenderRef?,
    @Json(name = "sender_business_name") val senderBusinessName: String?,
    @Json(name = "sender_address") val senderAddress: String?,
    @Json(name = "sender_display") val senderDisplay: String,
    @Json(name = "sender_trust") val senderTrust: String,
    val `package`: JsonValue?,
    /** `Mail.due_date`: the calendar day a bill or notice is due ("2026-10-20"). */
    @Json(name = "due_date") val dueDate: String? = null,
    // ── The Mail tab (contract v1): optional, so a server without them still decodes. ──
    /** What the piece is: letter, bill, notice, postcard, booklet, parcel or bundle; anything else draws as a letter. */
    val kind: String? = null,
    /** When it went into the box: 7 a.m. for the morning round, the moment it landed for a special delivery. */
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    /** It came on its own, outside the morning round (time-sensitive, due, certified). */
    @Json(name = "special_delivery") val specialDelivery: Boolean = false,
    /** Sent by Pantopus itself. */
    @Json(name = "from_pantopus") val fromPantopus: Boolean = false,
    val postmark: MailPostmark? = null,
    /** Due, or put on the counter, and not done yet. */
    @Json(name = "on_counter") val onCounter: Boolean = false,
    /** Home mail's Home; null for the person's own mail. */
    @Json(name = "recipient_home_id") val recipientHomeId: String? = null,
    /** Who the piece is addressed to, when the sender named someone ("The Alder household"). */
    @Json(name = "recipient_name") val recipientName: String? = null,
    /** The bundle a piece came in; the bundle's own piece carries [bundleItemCount]. */
    @Json(name = "bundle_id") val bundleId: String? = null,
    /** The bundle's label ("Willow Bank · 3 statements"), on the bundle and on its pieces listed on their own. */
    @Json(name = "bundle_label") val bundleLabel: String? = null,
    @Json(name = "bundle_item_count") val bundleItemCount: Int? = null,
    /** A booklet's pages. */
    @Json(name = "page_count") val pageCount: Int? = null,
    /** The business invoice a bill was made from (SRV-7); null for everything else. */
    val invoice: MailInvoice? = null,
    /** `delivered`, `opened`, `filed` (in the Vault) … */
    val lifecycle: String? = null,
    /** The Vault folder a filed piece is in. */
    @Json(name = "vault_folder_id") val vaultFolderId: String? = null,
    /** Certified mail, which reads as plain mail and asks to be acknowledged. */
    val certified: Boolean = false,
    /** When someone in the household acknowledged it; null while nobody has. */
    @Json(name = "acknowledged_at") val acknowledgedAt: String? = null,
    /** A Christmas card; null for everything else. */
    val card: MailCard? = null,
) {
    @JsonClass(generateAdapter = true)
    data class SenderRef(
        val name: String?,
        val username: String?,
    )
}

/** `GET /api/mailbox/v2/item/:id` — route `backend/routes/mailboxV2.js:366`. */
@JsonClass(generateAdapter = true)
data class MailboxV2ItemResponse(
    val mail: MailboxV2Item,
)

@JsonClass(generateAdapter = true)
data class MailboxV2Item(
    val id: String,
    val type: String,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "display_title") val displayTitle: String?,
    @Json(name = "preview_text") val previewText: String?,
    val viewed: Boolean = false,
    val archived: Boolean = false,
    val sender: DrawerMail.SenderRef?,
    @Json(name = "sender_display") val senderDisplay: String,
    @Json(name = "sender_trust") val senderTrust: String,
    /**
     * Pantopus user id behind the sender. Sourced from the `*`
     * projection on Mail in `backend/routes/mailboxV2.js`. Drives the
     * avatar-tap → public profile navigation in P17.
     */
    @Json(name = "sender_user_id") val senderUserId: String? = null,
    val `package`: JsonValue?,
    val packageInfo: JsonValue? = null,
    @Json(name = "timeline") val packageTimeline: JsonArrayValue = emptyList(),
    @Json(name = "object_payload") val objectPayload: JsonValue? = null,
    /** Raw `Mail.subject` column. Surfaced so T3.8 Ceremonial Mail
     *  Open can render the letter heading; v1 mail-detail clients
     *  already had this. */
    val subject: String? = null,
    /** Raw `Mail.content` column for the letter body. */
    val content: String? = null,
    @Json(name = "action_required") val actionRequired: Boolean? = null,
    @Json(name = "ack_required") val ackRequired: Boolean? = null,
    val tags: List<String> = emptyList(),
    val attachments: List<String>? = null,
    /** A bundle's pieces this person may read, newest first (SRV-5); null for anything else. */
    val pieces: List<DrawerMail>? = null,
    /** A Christmas card; null for everything else. */
    val card: MailCard? = null,
)

/** `POST /api/mailbox/v2/item/:id/action` — route `backend/routes/mailboxV2.js:459`. */
@JsonClass(generateAdapter = true)
data class MailboxItemActionRequest(
    /** The receiving actions (Mail build contract): counter, done, file, unfile, shred, acknowledge; older ones too. */
    val action: String,
    /** The Vault folder for `file` and `done`; null files it where the server chooses. */
    @Json(name = "folder_id") val folderId: String? = null,
)

@JsonClass(generateAdapter = true)
data class MailboxItemActionResponse(
    val message: String,
    val action: String,
)

/**
 * `GET /api/mailbox/v2/package/:mailId` — route `backend/routes/mailboxV2.js:634`.
 * Package + timeline columns evolve server-side; they're exposed as JSON
 * maps rather than invented types.
 */
@JsonClass(generateAdapter = true)
data class PackageDetailResponse(
    val `package`: JsonValue,
    val timeline: JsonArrayValue,
    val sender: Sender?,
) {
    @JsonClass(generateAdapter = true)
    data class Sender(
        val display: String,
        val trust: String,
    )
}

/** `PATCH /api/mailbox/v2/package/:mailId/status` — route `backend/routes/mailboxV2.js:670`. */
@JsonClass(generateAdapter = true)
data class PackageStatusUpdateRequest(
    /** One of: pre_receipt, in_transit, out_for_delivery, delivered, exception. */
    val status: String,
    val location: String? = null,
    val photoUrl: String? = null,
    val deliveryLocationNote: String? = null,
)

@JsonClass(generateAdapter = true)
data class PackageStatusUpdateResponse(
    val message: String,
    val status: String,
    val previousStatus: String,
)
