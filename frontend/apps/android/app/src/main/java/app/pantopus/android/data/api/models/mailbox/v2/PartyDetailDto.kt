@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.data.api.models.mailbox.v2

/**
 * Party-mail sub-payload decoded from `mail.object_payload` when
 * `mail_type == "party"`. A personal-celebration invite from a friend or
 * neighbor (housewarming, birthday, dinner) — warmer + more festive than
 * the Community HOA mail. Drives the A17.9 detail variant on top of the
 * shared `MailItemDetailShell`.
 *
 * Backend ingestion for personal invites is not yet wired; the projection
 * falls back to the deterministic `MailItemSampleData.partyInvite` fixture
 * until the route ships. Mirrors iOS `PartyDetailDTO`.
 */

/** Three-way RSVP for A17.9. Distinct from `CommunityRsvpStatus` so the
 *  party variant can hold its own +1 stepper / friend pile state. */
enum class PartyRsvpStatus(val raw: String) {
    Undecided("undecided"),
    Going("going"),
    Maybe("maybe"),
    NotGoing("notGoing"),
    ;

    companion object {
        fun fromRaw(value: String?): PartyRsvpStatus = entries.firstOrNull { it.raw == value } ?: Undecided
    }
}

/** Host card on the invite — the friend / neighbor who sent it. */
data class PartyHostInfo(
    val name: String,
    val initials: String,
    val blurb: String,
    val relationLabel: String,
    val isVerified: Boolean,
)

/** Stacked date tile content — `SAT / MAY / 24` + the human time range. */
data class PartyEventDate(
    val weekday: String,
    val dayLabel: String,
    val monthLabel: String,
    val dayNumber: String,
    val timeRange: String,
)

/** Event details — where + vibe + forecast. */
data class PartyEventInfo(
    val what: String,
    val date: PartyEventDate,
    val location: String,
    val locationNote: String,
    val walkLabel: String,
    val dressCode: String,
    val kids: String,
    val weatherSummary: String,
    val weatherTemperatureF: Int,
)

/** One avatar in the +N going pile. */
data class PartyAttendee(
    val id: String,
    val name: String,
    val initials: String,
    val accent: AccentTint,
    val plusCount: Int,
    val status: Status,
) {
    enum class Status(val raw: String) {
        Going("going"),
        Maybe("maybe"),
        ;

        companion object {
            fun fromRaw(value: String?): Status = entries.firstOrNull { it.raw == value } ?: Going
        }
    }

    /** Data-side accent so the view stays out of the hex palette. The
     *  view maps each tint onto a `PantopusColors.*` swatch. */
    enum class AccentTint(val raw: String) {
        Home("home"),
        Personal("personal"),
        Business("business"),
        Warning("warning"),
        Error("error"),
        Primary("primary"),
        Party("party"),
        ;

        companion object {
            fun fromRaw(value: String?): AccentTint = entries.firstOrNull { it.raw == value } ?: Personal
        }
    }
}

/** One "If you'd like to bring something" row. `claimedBy` is `null` when
 *  unclaimed, the name of another friend when claimed, or the literal
 *  "You" once the user claims it from the going state. */
data class PartyBringItem(
    val id: String,
    val item: String,
    val emoji: String,
    val claimedBy: String?,
) {
    fun withClaimedBy(name: String?): PartyBringItem = copy(claimedBy = name)
}

/** Handwritten-feel note from the host. Paragraphs + signature. */
data class PartyNoteContent(
    val eyebrow: String,
    val paragraphs: List<String>,
    val signature: String,
)

/** One bullet in the party elf strip. */
data class PartyElfBullet(
    val glyph: Glyph,
    val label: String,
    val text: String,
) {
    enum class Glyph(val raw: String) {
        Users("users"),
        CloudSun("cloudSun"),
        Calendar("calendar"),
        CalendarCheck("calendarCheck"),
        UserPlus("userPlus"),
        Gift("gift"),
        ;

        companion object {
            fun fromRaw(value: String?): Glyph = entries.firstOrNull { it.raw == value } ?: Calendar
        }
    }
}

/** Elf strip content — fresh-invite copy vs you're-in copy. */
data class PartyElfContent(
    val headline: String,
    val summary: String,
    val bullets: List<PartyElfBullet>,
)

/** Full A17.9 payload. */
data class PartyDetailDto(
    val partyItemId: String,
    val host: PartyHostInfo,
    val event: PartyEventInfo,
    val attendees: List<PartyAttendee>,
    val bringList: List<PartyBringItem>,
    val note: PartyNoteContent,
    val elfOpen: PartyElfContent,
    val elfGoing: PartyElfContent,
    val timeAgoLabel: String,
    val invitedCount: Int,
    val rsvp: PartyRsvpStatus,
    /** Plus-one count selected by the user (only meaningful in Going). */
    val plusOneCount: Int,
    /** Local-time confirmation surfaced in the green check banner. */
    val rsvpConfirmedAtLabel: String?,
) {
    /** Going friends, in the order the host's invite supplied them. */
    val goingAttendees: List<PartyAttendee>
        get() = attendees.filter { it.status == PartyAttendee.Status.Going }

    /** Maybe count drives the "+N maybe" line above the going strip. */
    val maybeCount: Int
        get() = attendees.count { it.status == PartyAttendee.Status.Maybe }

    /** Total headcount including the user + their plus-ones once they've
     *  RSVPed Going. Friends' explicit plus-ones are summed in. */
    val headcount: Int
        get() {
            val friendHeads = goingAttendees.sumOf { 1 + it.plusCount }
            val youHeads = if (rsvp == PartyRsvpStatus.Going) 1 + plusOneCount else 0
            return friendHeads + youHeads
        }

    /** Returns a copy with the RSVP status flipped and (when entering
     *  Going) the supplied confirmation timestamp captured. */
    fun withRsvp(
        status: PartyRsvpStatus,
        confirmedAtLabel: String? = null,
    ): PartyDetailDto =
        copy(
            rsvp = status,
            plusOneCount = if (status == PartyRsvpStatus.Going) plusOneCount else 0,
            rsvpConfirmedAtLabel =
                if (status == PartyRsvpStatus.Going) {
                    confirmedAtLabel ?: rsvpConfirmedAtLabel
                } else {
                    null
                },
        )

    /** Returns a copy with the plus-one count clamped. */
    fun withPlusOneCount(count: Int): PartyDetailDto = copy(plusOneCount = maxOf(0, count))

    /** Returns a copy with the bring-list item at `index` claimed/unclaimed. */
    fun withBringClaim(
        index: Int,
        name: String?,
    ): PartyDetailDto {
        if (index !in bringList.indices) return this
        return copy(bringList = bringList.toMutableList().also { it[index] = it[index].withClaimedBy(name) })
    }

    companion object {
        /**
         * Best-effort decode. Returns `null` today — the backend ingestion
         * path for personal invites isn't shipped yet. When the route
         * lands, fill this in to mirror `MemoryDetailDto.decode(...)`.
         */
        @Suppress("UNUSED_PARAMETER", "FunctionOnlyReturningConstant")
        fun decodeFromObjectPayload(payload: Map<String, Any?>?): PartyDetailDto? = null
    }
}
