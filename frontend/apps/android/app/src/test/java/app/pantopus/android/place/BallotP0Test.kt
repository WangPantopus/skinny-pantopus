package app.pantopus.android.place

import app.pantopus.android.data.api.models.place.BallotCoverage
import app.pantopus.android.data.api.models.place.BallotDeadline
import app.pantopus.android.data.api.models.place.BallotGovernments
import app.pantopus.android.data.api.models.place.BallotPhase
import app.pantopus.android.data.api.models.place.PlaceCivicDistrictsData
import app.pantopus.android.data.api.models.place.PlaceCivicElectionData
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.services.PlaceApi
import app.pantopus.android.ui.screens.ballot.BallotFormat
import app.pantopus.android.ui.screens.ballot.BallotPlacement
import app.pantopus.android.ui.screens.ballot.BallotStackGeometry
import app.pantopus.android.ui.screens.ballot.BallotStory
import app.pantopus.android.ui.screens.ballot.BallotTimelineLayout
import app.pantopus.android.ui.screens.ballot.BallotTimelineLayout.Anchor
import app.pantopus.android.ui.screens.ballot.BallotTimelineLayout.Side
import app.pantopus.android.ui.screens.ballot.linkUrl
import app.pantopus.android.ui.screens.ballot.storyOverline
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

/**
 * Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md): the card
 * fields decode from `civic_election` only when the server sends them; a
 * malformed ballot field never blanks the election section; the timeline
 * places markers exactly as the canvas (and iOS and the web) does; the
 * dashboard drops the election row the card replaces. Same fixture as
 * iOS `BallotP0Tests`.
 */
class BallotP0Test {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private val base =
        """
        "name":"November 3 general election","date":"2026-11-03","days_until":40,"polling_place":null,"ballot":[]
        """.trimIndent()

    private val card =
        """
        {$base,"coverage":"supported","phase":"in_season","today":"2026-09-24","title":"Your ballot",
         "subtitle":"November 3 general election","chip":"40 days",
         "line":"This address sits inside at least 5 governments.","note":null,
         "how_it_works":"Everyone here votes by mail.",
         "deadlines":[
           {"key":"ballots_mailed","label":"Ballots mailed","date":"2026-10-16","month_day":"Oct 16","days_until":22,
            "needs_action":false,"timeline":true,"detail":null},
           {"key":"register_online_mail","label":"Register by","date":"2026-10-26","month_day":"Oct 26","days_until":32,
            "needs_action":true,"timeline":true,"detail":"Online or by mail."},
           {"key":"return_by","label":"By 8 p.m.","date":"2026-11-03","month_day":"Nov 3","days_until":40,
            "needs_action":true,"timeline":true,"detail":null},
           {"key":"register_in_person","label":"Register in person","date":"2026-11-03","month_day":"Nov 3",
            "days_until":40,"needs_action":true,"timeline":false,"detail":null}],
         "election_day_notice":null,"primary_action":{"kind":"governments","label":"See your governments"},
         "official_links":[{"key":"registration","label":"Check or update registration","owner":"Secretary of State",
           "url":"https://www.sos.wa.gov/register"}],
         "governments":{"count":5,"count_is_minimum":true,"items":[{"level":"federal","name":"United States"}],
           "summary":"The United States, the state, Clark County, the Camas School District and the City of Camas.",
           "caveat":"Special districts are not counted yet.","source_line":"Boundaries: Census Bureau"},
         "ballot_week":{"show":false},
         "mover_prompt":{"text":"Moved this year? Update your registration online by Oct 26.","days_left":32,
           "url":"https://www.sos.wa.gov/register"},
         "source_line":"Washington Secretary of State","checked_at":"2026-09-24"}
        """.trimIndent()

    private val governments =
        """
        {"count":5,"count_is_minimum":true,"items":[{"level":"federal","name":"United States"}],
         "summary":"The United States, the state, Clark County, the Camas School District and the City of Camas.",
         "caveat":"Special districts are not counted yet.","source_line":"Boundaries: Census Bureau"}
        """.trimIndent()

    private fun intelligence(
        electionData: String,
        districtsData: String = NO_DISTRICTS,
    ): PlaceIntelligence {
        val json = intelligenceJson(electionData, districtsData)
        return checkNotNull(moshi.adapter(PlaceIntelligence::class.java).fromJson(json))
    }

    private fun election(intel: PlaceIntelligence): PlaceCivicElectionData {
        val section = intel.groups.flatMap { it.sections }.first { it.sectionId == PlaceSectionId.CIVIC_ELECTION }
        return checkNotNull(section.civicElection)
    }

    @Test
    fun `decodes the ballot card when sent`() {
        val data = election(intelligence(card))
        assertEquals(40, data.daysUntil)
        val ballot = checkNotNull(data.ballotCard)
        assertEquals(BallotCoverage.SUPPORTED, ballot.coverage)
        assertEquals(BallotPhase.IN_SEASON, ballot.phase)
        assertEquals("40 days", ballot.chip)
        assertEquals(listOf("ballots_mailed", "register_online_mail", "return_by", "register_in_person"), ballot.deadlines.map { it.key })
        assertEquals(5, ballot.governments?.count)
        assertEquals(true, ballot.governments?.countIsMinimum)
        assertEquals("Secretary of State", ballot.officialLinks.first().owner)
        assertEquals(32, ballot.moverPrompt?.daysLeft)
    }

    @Test
    fun `keeps the old contract when the flag is off`() {
        val data = election(intelligence("{$base}"))
        assertEquals("November 3 general election", data.name)
        assertNull(data.ballotCard)
    }

    @Test
    fun `an unknown coverage or phase sends no card`() {
        val odd = card.replace("\"phase\":\"in_season\"", "\"phase\":\"someday\"")
        val data = election(intelligence(odd))
        assertEquals(40, data.daysUntil)
        assertNull(data.ballotCard)

        val unlisted = card.replace("\"coverage\":\"supported\"", "\"coverage\":\"someday\"")
        val section = election(intelligence(unlisted))
        assertEquals(40, section.daysUntil)
        assertNull(section.ballotCard)
    }

    @Test
    fun `a malformed ballot field never blanks the section`() {
        val broken = card.replace("\"deadlines\":[", "\"deadlines\":\"oops\",\"x\":[")
        val data = election(intelligence(broken))
        assertEquals(40, data.daysUntil)
        val ballot = checkNotNull(data.ballotCard)
        assertTrue(ballot.deadlines.isEmpty())
        assertEquals("This address sits inside at least 5 governments.", ballot.line)
    }

    @Test
    fun `civic districts decode their governments and a malformed block never blanks the districts`() {
        val valid = districtsOf(intelligence("{$base}", districtsJson(governments)))
        assertEquals(1, valid.districts.size)
        val decoded = checkNotNull(valid.governments)
        assertEquals(5, decoded.count)
        assertTrue(decoded.countIsMinimum)
        assertEquals("United States", decoded.items.first().name)
        assertEquals("Boundaries: Census Bureau", decoded.sourceLine)

        val broken = districtsOf(intelligence("{$base}", districtsJson("""{"count":"five"}""")))
        assertEquals(1, broken.districts.size)
        assertNull(broken.governments)

        assertNull(BallotGovernments.decodeIn(moshi, mapOf("governments" to "oops")))
        assertNull(BallotGovernments.decodeIn(moshi, null))
    }

    @Test
    fun `an election day notice needs only its lead`() {
        val lean = card.replace("\"election_day_notice\":null", "\"election_day_notice\":{\"lead\":\"Return by 8 p.m. today.\"}")
        val notice = checkNotNull(checkNotNull(election(intelligence(lean)).ballotCard).electionDayNotice)
        assertEquals("Return by 8 p.m. today.", notice.lead)
        assertNull(notice.detail)
        assertEquals("Return by 8 p.m. today.", BallotFormat.notice(notice.lead, notice.detail).text)
    }

    @Test
    fun `the mover well links only when the server sent a URL`() {
        val mover = checkNotNull(checkNotNull(election(intelligence(card)).ballotCard).moverPrompt)
        assertEquals("https://www.sos.wa.gov/register", mover.linkUrl())
        assertNull(mover.copy(url = null).linkUrl())
        assertNull(mover.copy(url = "").linkUrl())
    }

    @Test
    fun `every intelligence request opts in to the ballot payload`() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setBody(intelligenceJson("{$base}")))
        server.enqueue(MockResponse().setBody(intelligenceJson("{$base}")))
        server.start()
        try {
            val api =
                Retrofit
                    .Builder()
                    .baseUrl(server.url("/"))
                    .addConverterFactory(MoshiConverterFactory.create(moshi))
                    .build()
                    .create(PlaceApi::class.java)
            runBlocking {
                api.intelligence("home-1")
                api.intelligence("home-1", sections = "civic_election")
            }
            assertEquals("/api/homes/home-1/intelligence?ballot=1", server.takeRequest().path)
            assertEquals("/api/homes/home-1/intelligence?ballot=1&sections=civic_election", server.takeRequest().path)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `timeline places markers like the canvas`() {
        val ballot = checkNotNull(election(intelligence(card)).ballotCard)
        val layout = checkNotNull(BallotTimelineLayout.make(ballot.deadlines, today = "2026-09-24", width = 326f))
        assertEquals(listOf("today", "ballots_mailed", "register_online_mail", "return_by"), layout.markers.map { it.key })
        assertEquals(listOf(8f, 178.5f, 256f, 318f), layout.markers.map { it.x })
        assertEquals(
            listOf(
                BallotTimelineLayout.Side.BELOW,
                BallotTimelineLayout.Side.ABOVE,
                BallotTimelineLayout.Side.BELOW,
                BallotTimelineLayout.Side.ABOVE,
            ),
            layout.markers.map { it.side },
        )
        assertEquals(listOf("register_online_mail"), layout.markers.filter { it.needsAction }.map { it.key })
        assertEquals(178.5f, layout.waitUntilX)
        assertEquals("Sep 24", layout.markers.first().secondLine)
    }

    @Test
    fun `the canvas's own board places Oct 16 at x 182`() {
        // Place board: September 23 to November 3 is 41 days over 310, and
        // October 16 falls at x = 182 (to the nearest unit).
        val mailed = BallotDeadline("ballots_mailed", "Ballots mailed", "2026-10-16", "Oct 16", 23, needsAction = false, timeline = true)
        val returnBy = BallotDeadline("return_by", "By 8 p.m.", "2026-11-03", "Nov 3", 41, needsAction = true, timeline = true)
        val layout = checkNotNull(BallotTimelineLayout.make(listOf(mailed, returnBy), today = "2026-09-23", width = 326f))
        assertEquals(182f, layout.markers[1].x, 0.5f)
    }

    @Test
    fun `timeline is empty on Election Day`() {
        val returnToday = BallotDeadline("return_by", "By 8 p.m.", "2026-11-03", "Nov 3", 0, needsAction = true, timeline = true)
        assertNull(BallotTimelineLayout.make(listOf(returnToday), today = "2026-11-03", width = 326f))
    }

    @Test
    fun `dashboard drops the election row the card replaces`() {
        val intel = intelligence(card)
        assertNotNull(BallotPlacement.ballot(intel))
        assertEquals("2026-09-24T00:00:00.000Z", BallotPlacement.ballot(intel)?.asOf)
        val ids = BallotPlacement.groups(intel).flatMap { it.sections }.map { it.sectionId }
        assertEquals(listOf(PlaceSectionId.CIVIC_DISTRICTS), ids)

        val plain = intelligence("{$base}")
        assertNull(BallotPlacement.ballot(plain))
        assertEquals(
            listOf(PlaceSectionId.CIVIC_DISTRICTS, PlaceSectionId.CIVIC_ELECTION),
            BallotPlacement.groups(plain).flatMap { it.sections }.map { it.sectionId },
        )
    }

    @Test
    fun `today shows only for ballot week or a recent move`() {
        assertNotNull(BallotPlacement.today(intelligence(card)))
        val quiet = card.replace(Regex("\"mover_prompt\":\\{[^}]*\\}"), "\"mover_prompt\":null")
        assertNull(BallotPlacement.today(intelligence(quiet)))
        val week =
            quiet.replace(
                "\"ballot_week\":{\"show\":false}",
                "\"ballot_week\":{\"show\":true,\"title\":\"Ballots go out by Oct 16\"}",
            )
        assertEquals("Ballots go out by Oct 16", BallotPlacement.today(intelligence(week))?.ballotWeek?.title)
    }

    @Test
    fun `the stack draws one layer per government, one to nine`() {
        assertEquals(1, BallotStackGeometry.layersFor(0))
        assertEquals(5, BallotStackGeometry.layersFor(5))
        assertEquals(9, BallotStackGeometry.layersFor(14))
        // The peel board's home line starts 10 above the top layer: 212 for five.
        assertEquals(212f, BallotStackGeometry.lineTop(5))
        // Layer 0's first corner at the peel's transform, centred at 195.
        val corner = BallotStackGeometry.layer(0, centerX = 195f).first()
        assertEquals(195f + (-144f + 133f) * 0.70710677f * 0.82f, corner.x, 0.01f)
        assertEquals(350f + (-144f - 133f) * 0.70710677f * 0.5f * 0.82f, corner.y, 0.01f)
    }

    @Test
    fun `the story keeps the board's timing`() {
        val story = BallotStory(steps = 5)
        assertEquals(7.2f, story.duration, 0.0001f)
        // Government 1: hidden at 0, in by 0.18 s, held to 1.02 s, gone by 1.2 s.
        assertEquals(0f, story.presence(0, 0f))
        assertEquals(1f, story.presence(0, 0.18f))
        assertEquals(1f, story.presence(0, 0.6f))
        assertEquals(-8f, story.lift(0, 0.6f))
        assertTrue(story.presence(0, 1.1f) < 1f)
        assertEquals(0f, story.presence(0, 1.2f))
        // Government 2 takes its turn 1.2 s later.
        assertEquals(0f, story.presence(1, 1.0f))
        assertEquals(1f, story.presence(1, 1.8f))
        // The finished frame arrives after the last government and holds.
        assertEquals(0f, story.presence(5, 5.9f))
        assertEquals(1f, story.presence(5, 6.5f))
        assertEquals(1f, story.presence(5, Float.POSITIVE_INFINITY))
        assertEquals(0f, story.presence(4, Float.POSITIVE_INFINITY))
        assertEquals(0.5f, story.bar(3.6f), 0.0001f)
        assertEquals(1f, story.bar(Float.POSITIVE_INFINITY))
        assertEquals("Government 2 of at least 5", storyOverline(2, 5, minimum = true))
        assertEquals("Government 2 of 5", storyOverline(2, 5, minimum = false))
    }

    @Test
    fun formatting() {
        assertEquals("32 days left.", BallotFormat.daysLeft(32))
        assertEquals("1 day left.", BallotFormat.daysLeft(1))
        assertEquals("Last day.", BallotFormat.daysLeft(0))
        assertEquals("Sep 24", BallotFormat.asOfDate("2026-09-24T00:00:00.000Z"))
        assertNull(BallotFormat.asOfDate(null))
        assertEquals(
            "Washington Secretary of State · as of Sep 24",
            BallotFormat.sourceText("Washington Secretary of State", "2026-09-24T00:00:00.000Z"),
        )
        assertEquals("Election date: federal law", BallotFormat.sourceText("Election date: federal law", null))
        assertEquals(
            "Return by 8 p.m. today. Drop box by 8 p.m.",
            BallotFormat.notice("Return by 8 p.m. today.", "Drop box by 8 p.m.").text,
        )
        assertEquals("Moved this year?", BallotFormat.notice("", "Moved this year?").text)
    }
}

/**
 * The timeline's repair pass (the shared timeline spec). Each vector is the
 * reference implementation's output for real state deadlines, the same ones
 * the web and iOS run: labels that collide move, and a layout where nothing
 * collides is the canvas's own. Text above 115% is listed, not drawn.
 */
class BallotTimelineRepairTest {
    @Test
    fun `a layout where nothing collides is the canvas's own`() {
        assertTimeline(
            BallotTimelineLayout.make(washington, today = "2026-09-24", width = 326f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("ballots_mailed", 178.5f, Side.ABOVE, Anchor.MIDDLE),
            Expect("register_online_mail", 256f, Side.BELOW, Anchor.MIDDLE),
            Expect("return_by", 318f, Side.ABOVE, Anchor.END),
        )
        // A narrower card, six days from the registration deadline.
        val laterOn =
            listOf(
                deadline("register_online_mail", "Register by", "Oct 26", 6, needsAction = true),
                deadline("return_by", "By 8 p.m.", "Nov 3", 14, needsAction = true),
            )
        assertTimeline(
            BallotTimelineLayout.make(laterOn, today = "2026-10-20", width = 296f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("register_online_mail", 128f, Side.ABOVE, Anchor.MIDDLE),
            Expect("return_by", 288f, Side.ABOVE, Anchor.END),
        )
    }

    @Test
    fun `Oregon's registration and mailing deadlines a day apart no longer overprint`() {
        // Oct 13 and Oct 14, three days out: the mailing label drops below, anchored at its marker.
        assertTimeline(
            BallotTimelineLayout.make(oregon(3, 4, 24), today = "2026-10-10", width = 326f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("register_online_mail", 46.75f, Side.ABOVE, Anchor.MIDDLE),
            Expect("ballots_mailed", 59.67f, Side.BELOW, Anchor.START),
            Expect("return_by", 318f, Side.ABOVE, Anchor.END),
        )
        // Bunched at the left edge: the mailing label also slides clear of Today.
        assertTimeline(
            BallotTimelineLayout.make(oregon(1, 2, 22), today = "2026-10-12", width = 296f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("register_online_mail", 20.73f, Side.ABOVE, Anchor.START),
            Expect("ballots_mailed", 33.45f, Side.BELOW, Anchor.START, dx = 19.55f),
            Expect("return_by", 288f, Side.ABOVE, Anchor.END),
        )
        // Today is the registration deadline: the mailing label slides past "Today / Oct 13", 12 clear of it.
        assertTimeline(
            BallotTimelineLayout.make(oregon(0, 1, 21), today = "2026-10-13", width = 326f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("register_online_mail", 8f, Side.ABOVE, Anchor.START),
            Expect("ballots_mailed", 22.76f, Side.BELOW, Anchor.START, dx = 30.24f),
            Expect("return_by", 318f, Side.ABOVE, Anchor.END),
        )
    }

    @Test
    fun `a long label near an edge is anchored to it`() {
        // Hawaii's 24-character "Paper forms by 4:30 p.m." would run off the card centred on Oct 26.
        val hawaii =
            listOf(
                deadline("register_online_mail", "Paper forms by 4:30 p.m.", "Oct 26", 1, needsAction = true),
                deadline("return_by", "By 7 p.m.", "Nov 3", 9, needsAction = true),
            )
        assertTimeline(
            BallotTimelineLayout.make(hawaii, today = "2026-10-25", width = 326f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("register_online_mail", 42.44f, Side.ABOVE, Anchor.START),
            Expect("return_by", 318f, Side.ABOVE, Anchor.END),
        )
        // Colorado on the narrowest card: the registration label leans on the final marker.
        val colorado =
            listOf(
                deadline("register_online_mail", "Register by", "Oct 26", 16, needsAction = true),
                deadline("return_by", "By 7 p.m.", "Nov 3", 24, needsAction = true),
            )
        assertTimeline(
            BallotTimelineLayout.make(colorado, today = "2026-10-10", width = 254f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("register_online_mail", 166.67f, Side.ABOVE, Anchor.END),
            Expect("return_by", 246f, Side.ABOVE, Anchor.END),
        )
    }

    @Test
    fun `labels are widened with the font scale`() {
        // The same Oregon day as the 1.0 vector: at 1.15 the labels are 15% wider and still clear.
        assertTimeline(
            BallotTimelineLayout.make(oregon(3, 4, 24), today = "2026-10-10", width = 296f, fontScale = 1.15f),
            Expect("today", 8f, Side.BELOW, Anchor.START),
            Expect("register_online_mail", 43f, Side.ABOVE, Anchor.MIDDLE),
            Expect("ballots_mailed", 54.67f, Side.BELOW, Anchor.START),
            Expect("return_by", 288f, Side.ABOVE, Anchor.END),
        )
    }

    @Test
    fun `text above 115 percent lists the deadlines instead of drawing the chart`() {
        assertTrue(BallotTimelineLayout.drawsChart(1f))
        assertTrue(BallotTimelineLayout.drawsChart(0.85f))
        assertTrue(BallotTimelineLayout.drawsChart(1.15f))
        assertFalse(BallotTimelineLayout.drawsChart(1.2f))
        assertFalse(BallotTimelineLayout.drawsChart(2f))

        // The list has one row per marker, today first, each with its date over its label.
        val rows = BallotTimelineLayout.listed(washington, today = "2026-09-24")
        assertEquals(listOf("today", "ballots_mailed", "register_online_mail", "return_by"), rows.map { it.key })
        assertEquals(listOf("Today", "Oct 16", "Oct 26", "Nov 3"), rows.map { it.firstLine })
        assertEquals(listOf("Sep 24", "Ballots mailed", "Register by", "By 8 p.m."), rows.map { it.secondLine })
        assertEquals(listOf("register_online_mail"), rows.filter { it.needsAction }.map { it.key })

        // The chart's geometry is the canvas's own at 1 and grows with the font after that.
        assertEquals(BallotTimelineLayout.Rows(14f, 26f, 38f, 60f, 72f, 74f), BallotTimelineLayout.rows(1f))
        assertEquals(BallotTimelineLayout.rows(1f), BallotTimelineLayout.rows(0.85f))
        val large = BallotTimelineLayout.rows(1.15f)
        assertEquals(27.8f, large.aboveSecond, 0.001f)
        assertEquals(39.8f, large.track, 0.001f)
        assertEquals(61.8f, large.belowFirst, 0.001f)
        assertEquals(75.6f, large.belowSecond, 0.001f)
        assertEquals(77.6f, large.height, 0.001f)
    }

    @Test
    fun `the timeline is read aloud with return by`() {
        assertEquals(
            "Timeline: today, Sep 24; ballots mailed Oct 16; register by Oct 26; return by 8 p.m. Nov 3",
            BallotTimelineLayout.description(washington, today = "2026-09-24"),
        )
        // Hawaii's own labels keep their wording, lower-cased at the first letter.
        val hawaii =
            listOf(
                deadline("ballots_mailed", "Ballots arrive", "Oct 16", 22, needsAction = false),
                deadline("return_by", "By 7 p.m.", "Nov 3", 40, needsAction = true),
            )
        assertEquals(
            "Timeline: today, Sep 24; ballots arrive Oct 16; return by 7 p.m. Nov 3",
            BallotTimelineLayout.description(hawaii, today = "2026-09-24"),
        )
    }
}

private data class Expect(
    val key: String,
    val x: Float,
    val side: Side,
    val anchor: Anchor,
    val dx: Float = 0f,
)

private fun deadline(
    key: String,
    label: String,
    monthDay: String,
    daysUntil: Int,
    needsAction: Boolean,
    timeline: Boolean = true,
) = BallotDeadline(key, label, date = "", monthDay = monthDay, daysUntil = daysUntil, needsAction = needsAction, timeline = timeline)

/** Washington on 2026-09-24: the fixture's deadlines, with "Register in person" off the timeline. */
private val washington =
    listOf(
        deadline("ballots_mailed", "Ballots mailed", "Oct 16", 22, needsAction = false),
        deadline("register_online_mail", "Register by", "Oct 26", 32, needsAction = true),
        deadline("return_by", "By 8 p.m.", "Nov 3", 40, needsAction = true),
        deadline("register_in_person", "Register in person", "Nov 3", 40, needsAction = true, timeline = false),
    )

/** Oregon's three timeline deadlines, [register] / [mailed] / [returnBy] days from today. */
private fun oregon(
    register: Int,
    mailed: Int,
    returnBy: Int,
) = listOf(
    deadline("register_online_mail", "Register by", "Oct 13", register, needsAction = true),
    deadline("ballots_mailed", "Ballots mailed", "Oct 14", mailed, needsAction = false),
    deadline("return_by", "By 8 p.m.", "Nov 3", returnBy, needsAction = true),
)

/** The side, anchor, x and slide of every marker, to two decimals. */
private fun assertTimeline(
    layout: BallotTimelineLayout?,
    vararg expected: Expect,
) {
    val markers = checkNotNull(layout).markers
    assertEquals(expected.map { it.key }, markers.map { it.key })
    expected.zip(markers).forEach { (want, got) ->
        assertEquals("${want.key} x", want.x, got.x, 0.01f)
        assertEquals("${want.key} side", want.side, got.side)
        assertEquals("${want.key} anchor", want.anchor, got.anchor)
        assertEquals("${want.key} dx", want.dx, got.dx, 0.01f)
    }
}

private fun districtsJson(governments: String): String =
    """
    {"districts":[{"level":"federal","office_label":"U.S. House","name":"Washington's 3rd District"}],
     "representatives":[],"governments":$governments}
    """.trimIndent()

private fun districtsOf(intel: PlaceIntelligence): PlaceCivicDistrictsData {
    val section = intel.groups.flatMap { it.sections }.first { it.sectionId == PlaceSectionId.CIVIC_DISTRICTS }
    return checkNotNull(section.civicDistricts)
}

private const val NO_DISTRICTS = """{"districts":[],"representatives":[]}"""

private fun intelligenceJson(
    electionData: String,
    districtsData: String = NO_DISTRICTS,
): String =
    """
    {"place":{"label":"415 NE Everett St, Camas","line1":"415 NE Everett St","city":"Camas","state":"WA","postal_code":"98607"},
     "tier":"T3","region_supported":true,"generated_at":"2026-09-24T16:00:00Z",
     "groups":[{"group":"civic","label":"Civic","sections":[
       {"id":"civic_districts","group":"civic","band":"A","access":"available","status":"ready","as_of":null,
        "source":"U.S. Census Bureau","coverage":"full","unavailable_reason":null,
        "data":$districtsData},
       {"id":"civic_election","group":"civic","band":"A","access":"available","status":"ready",
        "as_of":"2026-09-24T00:00:00.000Z","source":"Washington Secretary of State","coverage":"full",
        "unavailable_reason":null,"data":$electionData}]}]}
    """.trimIndent()
