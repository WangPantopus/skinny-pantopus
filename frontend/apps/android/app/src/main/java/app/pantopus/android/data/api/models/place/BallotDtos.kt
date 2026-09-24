package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types

// Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md §5.2): the
// optional card fields the backend adds to the `civic_election` section
// when the `ballot_p0` flag is on for the viewer. Every sentence is
// composed on the server; the app lays it out. The card is decoded field
// by field ([BallotSummary.decode]), so a malformed ballot field never
// blanks the election section the dashboard already shows. Parity twin
// of iOS `BallotDTOs.swift`.

enum class BallotCoverage(
    val wire: String,
) {
    SUPPORTED("supported"),
    LINKS_ONLY("links_only"),
    ;

    companion object {
        fun from(raw: Any?): BallotCoverage? = entries.firstOrNull { it.wire == raw }
    }
}

enum class BallotPhase(
    val wire: String,
) {
    FAR("far"),
    IN_SEASON("in_season"),
    ELECTION_DAY("election_day"),
    AFTER("after"),
    ;

    companion object {
        fun from(raw: Any?): BallotPhase? = entries.firstOrNull { it.wire == raw }
    }
}

@JsonClass(generateAdapter = true)
data class BallotDeadline(
    val key: String,
    val label: String,
    /** Calendar date in the state's timezone, `YYYY-MM-DD`. */
    val date: String,
    /** "Oct 16". */
    @Json(name = "month_day") val monthDay: String,
    @Json(name = "days_until") val daysUntil: Int,
    @Json(name = "needs_action") val needsAction: Boolean,
    /** Drawn as a marker on the deadline timeline. */
    val timeline: Boolean,
    val detail: String? = null,
)

@JsonClass(generateAdapter = true)
data class BallotOfficialLink(
    val key: String,
    val label: String,
    val owner: String,
    val url: String,
)

@JsonClass(generateAdapter = true)
data class BallotGovernment(
    val level: String,
    val name: String,
)

@JsonClass(generateAdapter = true)
data class BallotGovernments(
    val count: Int,
    /** Always true in P0: special districts are not counted yet. */
    @Json(name = "count_is_minimum") val countIsMinimum: Boolean,
    val items: List<BallotGovernment>,
    val summary: String,
    val caveat: String,
    @Json(name = "source_line") val sourceLine: String,
)

@JsonClass(generateAdapter = true)
data class BallotPrimaryAction(
    /** `governments` opens the still governments view. */
    val kind: String,
    val label: String,
)

@JsonClass(generateAdapter = true)
data class BallotWeek(
    val show: Boolean,
    val overline: String? = null,
    val title: String? = null,
    val body: String? = null,
)

@JsonClass(generateAdapter = true)
data class BallotMoverPrompt(
    val text: String,
    @Json(name = "days_left") val daysLeft: Int,
    val url: String? = null,
)

@JsonClass(generateAdapter = true)
data class BallotNotice(
    val lead: String,
    val detail: String,
)

/** The Ballot P0 card, present only when the server sent it. */
data class BallotSummary(
    val coverage: BallotCoverage,
    val phase: BallotPhase,
    /** The state's local date the summary was composed for. */
    val today: String? = null,
    val title: String = FALLBACK_TITLE,
    val subtitle: String? = null,
    val chip: String? = null,
    val line: String? = null,
    val note: String? = null,
    val howItWorks: String? = null,
    val deadlines: List<BallotDeadline> = emptyList(),
    val electionDayNotice: BallotNotice? = null,
    val primaryAction: BallotPrimaryAction? = null,
    val officialLinks: List<BallotOfficialLink> = emptyList(),
    val governments: BallotGovernments? = null,
    val ballotWeek: BallotWeek? = null,
    val moverPrompt: BallotMoverPrompt? = null,
    val sourceLine: String? = null,
) {
    companion object {
        /** The card's title when the server leaves it out (iOS parity). */
        const val FALLBACK_TITLE = "Your ballot"

        /**
         * Decodes the card from the civic_election `data` object. Returns
         * null when the server did not send one (flag off) or sent an
         * unknown coverage or phase. Never throws: a missing or malformed
         * field reads as null, or empty for a list.
         */
        fun decode(
            moshi: Moshi,
            data: Any?,
        ): BallotSummary? {
            val map = data as? Map<*, *> ?: return null
            val coverage = BallotCoverage.from(map["coverage"]) ?: return null
            val phase = BallotPhase.from(map["phase"]) ?: return null
            val fields = Fields(moshi, map)
            return BallotSummary(
                coverage = coverage,
                phase = phase,
                today = fields.text("today"),
                title = fields.text("title") ?: FALLBACK_TITLE,
                subtitle = fields.text("subtitle"),
                chip = fields.text("chip"),
                line = fields.text("line"),
                note = fields.text("note"),
                howItWorks = fields.text("how_it_works"),
                deadlines = fields.list("deadlines", BallotDeadline::class.java),
                electionDayNotice = fields.obj("election_day_notice", BallotNotice::class.java),
                primaryAction = fields.obj("primary_action", BallotPrimaryAction::class.java),
                officialLinks = fields.list("official_links", BallotOfficialLink::class.java),
                governments = fields.obj("governments", BallotGovernments::class.java),
                ballotWeek = fields.obj("ballot_week", BallotWeek::class.java),
                moverPrompt = fields.obj("mover_prompt", BallotMoverPrompt::class.java),
                sourceLine = fields.text("source_line"),
            )
        }
    }

    /** One field at a time: a malformed field is null, never an error. */
    private class Fields(
        private val moshi: Moshi,
        private val map: Map<*, *>,
    ) {
        fun text(key: String): String? = map[key] as? String

        fun <T> obj(
            key: String,
            type: Class<T>,
        ): T? = map[key]?.let { raw -> runCatching { moshi.adapter(type).fromJsonValue(raw) }.getOrNull() }

        fun <T> list(
            key: String,
            type: Class<T>,
        ): List<T> =
            map[key]
                ?.let { raw ->
                    runCatching {
                        moshi.adapter<List<T>>(Types.newParameterizedType(List::class.java, type)).fromJsonValue(raw)
                    }.getOrNull()
                }.orEmpty()
    }
}
