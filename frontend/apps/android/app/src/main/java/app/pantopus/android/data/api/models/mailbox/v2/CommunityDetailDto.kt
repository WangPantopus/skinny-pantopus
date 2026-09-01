@file:Suppress("PackageNaming", "LongParameterList", "MagicNumber")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue

/** HOA/neighborhood-group seal rendered in the badge card. */
data class CommunityGroupInfo(
    val name: String,
    val tagline: String?,
    val founded: String?,
    val role: String?,
    val membershipSince: String?,
    val memberCount: Int?,
    val isVerified: Boolean,
)

/** When/where/bring chunk per the A17.4 design's Event details card. */
data class CommunityEventInfo(
    val dayLabel: String?,
    val dateLabel: String?,
    val timeRange: String?,
    val location: String?,
    val locationNote: String?,
    val distanceLabel: String?,
    val bringItems: List<String>,
    val weatherSummary: String?,
    val weatherTemperatureF: Int?,
)

/** One attendee rendered in the strip. */
data class CommunityAttendee(
    val id: String,
    val displayName: String,
    val initials: String,
    val blockLabel: String?,
    val isVerified: Boolean,
)

/** Cross-link card pointing at the related Pulse thread. */
data class CommunityPulseThread(
    val threadId: String,
    val title: String,
    val replyCount: Int,
    val lastReplyAuthor: String?,
    val lastReplyPreview: String?,
    val lastReplyAge: String?,
)

/** Tri-state RSVP — mirrors the design's chip row. */
enum class CommunityRsvpStatus(val wire: String) {
    Going("going"),
    Maybe("maybe"),
    NotGoing("not_going"),
    Undecided("undecided"),
    ;

    companion object {
        fun fromWire(value: String?): CommunityRsvpStatus =
            when (value?.lowercase()) {
                "going", "will_attend" -> Going
                "maybe" -> Maybe
                "not_going", "declined" -> NotGoing
                else -> Undecided
            }
    }
}

/** Content variation rendered in the Community body card. */
enum class CommunityMailSubtype(val wire: String) {
    Event("event"),
    Poll("poll"),
    NeighborhoodUpdate("neighborhood_update"),
    ;

    companion object {
        fun fromWire(value: String?): CommunityMailSubtype =
            when (value?.lowercase()) {
                "poll", "vote" -> Poll
                "neighborhood_update", "neighborhood-update", "update", "announcement" -> NeighborhoodUpdate
                else -> Event
            }
    }
}

/** One option in a community poll. */
data class CommunityPollOption(
    val id: String,
    val label: String,
    val voteCount: Int,
    val isSelected: Boolean = false,
)

/** Poll card payload for community mail. */
data class CommunityPollInfo(
    val question: String,
    val options: List<CommunityPollOption>,
    val totalVotes: Int,
    val closesAtLabel: String?,
    val statusLabel: String?,
)

/** Neighborhood-update card payload for community mail. */
data class CommunityUpdateInfo(
    val headline: String,
    val summary: String?,
    val items: List<String>,
    val statusLabel: String?,
    val footerLabel: String?,
)

/**
 * Community detail sub-payload decoded from `mail.object_payload` when
 * `mail_type == "community"`. Backend stores this as untyped JSON shaped
 * by the `CommunityMailItem` table (`backend/database/schema.sql:5350`).
 * The RSVP-going state flows back from
 * `POST /api/mailbox/v2/community/rsvp`
 * (`backend/routes/mailboxV2Phase3.js:746`).
 * [decodeFromObjectPayload] returns null when the payload doesn't carry
 * a community item id.
 */
data class CommunityDetailDto(
    val communityItemId: String,
    val subtype: CommunityMailSubtype = CommunityMailSubtype.Event,
    val group: CommunityGroupInfo,
    val event: CommunityEventInfo?,
    val poll: CommunityPollInfo? = null,
    val update: CommunityUpdateInfo? = null,
    val attendees: List<CommunityAttendee>,
    val attendeeCount: Int,
    val attendeesFromBlock: Int?,
    val pulseThread: CommunityPulseThread?,
    val rsvp: CommunityRsvpStatus,
) {
    companion object {
        @Suppress("UNCHECKED_CAST", "LongMethod", "CyclomaticComplexMethod")
        fun decodeFromObjectPayload(payload: JsonValue?): CommunityDetailDto? {
            if (payload == null) return null
            val itemId =
                (payload["community_item_id"] as? String)
                    ?: (payload["id"] as? String) ?: return null
            if (itemId.isEmpty()) return null
            val groupRaw =
                (payload["group"] as? Map<String, Any?>)
                    ?: (payload["community"] as? Map<String, Any?>)
                    ?: emptyMap<String, Any?>()
            val group =
                CommunityGroupInfo(
                    name = (groupRaw["name"] as? String) ?: "Neighborhood group",
                    tagline = groupRaw["tagline"] as? String,
                    founded = groupRaw["founded"] as? String,
                    role =
                        (groupRaw["role"] as? String)
                            ?: (groupRaw["membership_role"] as? String),
                    membershipSince =
                        (groupRaw["membership_since"] as? String)
                            ?: (groupRaw["since"] as? String),
                    memberCount = (groupRaw["member_count"] as? Number)?.toInt(),
                    isVerified = (groupRaw["verified"] as? Boolean) ?: false,
                )
            val eventRaw = payload["event"] as? Map<String, Any?>
            val event =
                eventRaw?.let { evt ->
                    val weather = evt["weather"] as? Map<String, Any?>
                    val whenMap = evt["when"] as? Map<String, Any?>
                    val whereStr =
                        (evt["location"] as? String)
                            ?: (evt["where"] as? String)
                    val bring =
                        (evt["bring"] as? List<*>)
                            ?.mapNotNull { it as? String } ?: emptyList()
                    CommunityEventInfo(
                        dayLabel =
                            (evt["day_label"] as? String)
                                ?: (whenMap?.get("day") as? String),
                        dateLabel =
                            (evt["date_label"] as? String)
                                ?: (whenMap?.get("date") as? String),
                        timeRange =
                            (evt["time_range"] as? String)
                                ?: (whenMap?.get("range") as? String),
                        location = whereStr,
                        locationNote =
                            (evt["location_note"] as? String)
                                ?: (evt["where_note"] as? String),
                        distanceLabel = evt["distance_label"] as? String,
                        bringItems = bring,
                        weatherSummary = weather?.get("summary") as? String,
                        weatherTemperatureF =
                            (weather?.get("temperature_f") as? Number)?.toInt()
                                ?: (weather?.get("temp") as? Number)?.toInt(),
                    )
                }
            val poll = decodePoll(payload)
            val update = decodeUpdate(payload)
            val explicitSubtype =
                CommunityMailSubtype.fromWire(
                    (payload["community_kind"] as? String)
                        ?: (payload["kind"] as? String)
                        ?: (payload["subtype"] as? String)
                        ?: (payload["variant"] as? String),
                )
            val subtype =
                when {
                    poll != null && explicitSubtype == CommunityMailSubtype.Event -> CommunityMailSubtype.Poll
                    update != null && event == null && poll == null &&
                        explicitSubtype == CommunityMailSubtype.Event -> CommunityMailSubtype.NeighborhoodUpdate
                    else -> explicitSubtype
                }
            val attendeesRaw = payload["attendees"] as? List<*> ?: emptyList<Any?>()
            val attendees =
                attendeesRaw.mapNotNull { entry ->
                    val map = entry as? Map<String, Any?> ?: return@mapNotNull null
                    val name =
                        (map["display_name"] as? String)
                            ?: (map["name"] as? String) ?: return@mapNotNull null
                    if (name.isEmpty()) return@mapNotNull null
                    val initials = (map["initials"] as? String) ?: makeInitials(name)
                    CommunityAttendee(
                        id = (map["id"] as? String) ?: java.util.UUID.randomUUID().toString(),
                        displayName = name,
                        initials = initials,
                        blockLabel =
                            (map["block_label"] as? String)
                                ?: (map["block"] as? String),
                        isVerified = (map["verified"] as? Boolean) ?: true,
                    )
                }
            val attendeeCount =
                (payload["attendee_count"] as? Number)?.toInt()
                    ?: (payload["rsvp_count"] as? Number)?.toInt()
                    ?: attendees.size
            val attendeesFromBlock = (payload["attendees_from_block"] as? Number)?.toInt()
            val threadRaw = payload["pulse_thread"] as? Map<String, Any?>
            val pulseThread =
                threadRaw?.let { td ->
                    val threadId =
                        (td["thread_id"] as? String)
                            ?: (td["id"] as? String) ?: return@let null
                    val title = td["title"] as? String ?: return@let null
                    val last = td["last_reply"] as? Map<String, Any?>
                    CommunityPulseThread(
                        threadId = threadId,
                        title = title,
                        replyCount =
                            (td["reply_count"] as? Number)?.toInt()
                                ?: (td["count"] as? Number)?.toInt() ?: 0,
                        lastReplyAuthor =
                            (last?.get("author") as? String)
                                ?: (last?.get("who") as? String),
                        lastReplyPreview = last?.get("preview") as? String,
                        lastReplyAge =
                            (last?.get("age") as? String)
                                ?: (last?.get("when") as? String),
                    )
                }
            return CommunityDetailDto(
                communityItemId = itemId,
                subtype = subtype,
                group = group,
                event = event,
                poll = poll,
                update = update,
                attendees = attendees,
                attendeeCount = attendeeCount,
                attendeesFromBlock = attendeesFromBlock,
                pulseThread = pulseThread,
                rsvp = CommunityRsvpStatus.fromWire(payload["rsvp_status"] as? String),
            )
        }

        private fun makeInitials(name: String): String {
            val parts = name.split(" ").take(2)
            return parts.mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
                .joinToString("")
                .ifEmpty { "·" }
        }

        @Suppress("UNCHECKED_CAST")
        private fun decodePoll(payload: JsonValue): CommunityPollInfo? {
            val poll = (payload["poll"] as? JsonValue) ?: payload
            val options = decodePollOptions(poll["options"] as? List<*> ?: emptyList<Any?>())
            val question = firstString(poll, "question", "title")?.takeIf { it.isNotEmpty() } ?: return null
            if (options.isEmpty()) return null
            val voteSum = options.sumOf { it.voteCount }
            return CommunityPollInfo(
                question = question,
                options = options,
                totalVotes = firstInt(poll, "total_votes", "vote_count") ?: voteSum,
                closesAtLabel = firstString(poll, "closes_at", "closes_at_label"),
                statusLabel = firstString(poll, "status", "status_label"),
            )
        }

        private fun decodePollOptions(rawOptions: List<*>): List<CommunityPollOption> = rawOptions.mapIndexedNotNull(::decodePollOption)

        private fun decodePollOption(
            index: Int,
            raw: Any?,
        ): CommunityPollOption? =
            when (raw) {
                is String ->
                    raw.takeIf { it.isNotEmpty() }?.let {
                        CommunityPollOption(id = "option-$index", label = it, voteCount = 0)
                    }
                is Map<*, *> -> decodePollMapOption(index, raw)
                else -> null
            }

        @Suppress("UNCHECKED_CAST")
        private fun decodePollMapOption(
            index: Int,
            raw: Map<*, *>,
        ): CommunityPollOption? {
            val option = raw as Map<String, Any?>
            val label = firstString(option, "label", "title", "value")?.takeIf { it.isNotEmpty() } ?: return null
            return CommunityPollOption(
                id = firstString(option, "id") ?: "option-$index",
                label = label,
                voteCount = firstInt(option, "vote_count", "votes") ?: 0,
                isSelected = firstBoolean(option, "selected", "is_selected") ?: false,
            )
        }

        private fun firstString(
            map: Map<String, Any?>,
            vararg keys: String,
        ): String? = keys.firstNotNullOfOrNull { map[it] as? String }

        private fun firstInt(
            map: Map<String, Any?>,
            vararg keys: String,
        ): Int? = keys.firstNotNullOfOrNull { (map[it] as? Number)?.toInt() }

        private fun firstBoolean(
            map: Map<String, Any?>,
            vararg keys: String,
        ): Boolean? = keys.firstNotNullOfOrNull { map[it] as? Boolean }

        @Suppress("UNCHECKED_CAST")
        private fun decodeUpdate(payload: JsonValue): CommunityUpdateInfo? {
            val update =
                (payload["update"] as? Map<String, Any?>)
                    ?: (payload["neighborhood_update"] as? Map<String, Any?>)
                    ?: (payload["announcement"] as? Map<String, Any?>)
                    ?: payload
            val headline = (update["headline"] as? String) ?: (update["title"] as? String) ?: return null
            if (headline.isEmpty() || update["event"] != null || update["poll"] != null) return null
            val items =
                (
                    (update["items"] as? List<*>)
                        ?: (update["bullets"] as? List<*>)
                        ?: (update["updates"] as? List<*>)
                        ?: emptyList<Any?>()
                )
                    .mapNotNull { it as? String }
            return CommunityUpdateInfo(
                headline = headline,
                summary = (update["summary"] as? String) ?: (update["body"] as? String),
                items = items,
                statusLabel = (update["status"] as? String) ?: (update["status_label"] as? String),
                footerLabel = (update["footer"] as? String) ?: (update["footer_label"] as? String),
            )
        }
    }
}
