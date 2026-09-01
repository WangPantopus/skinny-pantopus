package app.pantopus.android.place

import app.pantopus.android.data.api.models.place.HomeUnlistedResponse
import app.pantopus.android.data.api.models.place.MoneyLeadKind
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.data.api.models.place.PublicUnlistedResponse
import app.pantopus.android.data.api.models.place.UnlistedPreviewStatus
import app.pantopus.android.data.api.models.place.UnlistedRemoval
import app.pantopus.android.data.api.models.place.UnlistedRemovalMethod
import app.pantopus.android.data.api.models.place.UnlistedRemovalResponse
import app.pantopus.android.data.api.models.place.UnlistedRemovalStatus
import app.pantopus.android.data.api.models.place.UnlistedStateProgramAnswer
import app.pantopus.android.ui.screens.place.detail.PlaceDetailViewModel
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Decoding contract for Unlisted (Wave 4).
 *
 * The invariants are almost all about what the client must NOT say. Two
 * nulls carry meaning and a naive decode flattens both:
 *
 *   * `state_program: null` means WE DID NOT CHECK — it is not the same
 *     answer as the verified `exists: false`, and rendering it as one
 *     tells someone in danger that no help exists when we simply did
 *     not look;
 *   * `removals: null` means the progress READ FAILED — it is not the
 *     empty list, which is the confident claim "nothing done yet".
 *
 * And a vocabulary the server grows must degrade to UNKNOWN rather than
 * throwing and taking the removal instructions down with it.
 */
class PlaceUnlistedDecodingTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json)) { "decoded null" }

    private fun profileJson(
        stateProgram: String,
        removals: String,
    ): String =
        """
        {"unlisted":{
          "state":"OR",
          "state_program":$stateProgram,
          "groups":[{"category":"people_search","label":"People-search sites","brokers":[
            {"id":"whitepages","name":"Whitepages","category":"people_search",
             "exposes":["home_address","phone","relatives"],
             "opt_out_url":"https://www.whitepages.com/suppression-requests",
             "method":"web_form","requires_id":false,"requires_email":true,
             "typical_days":0,
             "note":"Only the first step of this flow could be verified; expect a phone confirmation.",
             "source_url":"https://www.whitepages.com/suppression-requests","verified_at":"2026-08-27"},
            {"id":"ownerly","name":"Ownerly","category":"people_search",
             "exposes":["home_address","property_value"],
             "opt_out_url":"https://www.ownerly.com/svc/optout/search/optouts/",
             "method":"account_required","requires_id":true,"requires_email":false,
             "typical_days":45,"note":"The form sits behind bot protection.",
             "source_url":"https://www.ownerly.com/privacy/","verified_at":"2026-08-27"}
          ]}],
          "broker_count":2,
          "exposure_labels":{"home_address":"Home address","phone":"Phone number",
            "relatives":"Relatives and household members","property_value":"What your home is worth"},
          "method_note":"We do not look your address up on these sites — searching them would hand them your address.",
          "registry_verified_at":"2026-08-27",
          "removals":$removals}}
        """.trimIndent()

    // ── The profile itself ───────────────────────────────────

    @Test
    fun `decodes the exposure profile with its groups and brokers`() {
        val profile = decode<HomeUnlistedResponse>(profileJson("null", "[]")).unlisted

        assertEquals("OR", profile.state)
        assertEquals(2, profile.brokerCount)
        assertEquals(1, profile.groups.size)
        assertEquals("People-search sites", profile.groups.first().label)

        val whitepages = profile.groups.first().brokers.first()
        assertEquals("whitepages", whitepages.id)
        assertEquals(UnlistedRemovalMethod.WEB_FORM, whitepages.method)
        assertTrue(whitepages.requiresEmail)
        assertFalse(whitepages.requiresId)
        // The caveat must survive decoding whole — it is the thing the
        // person actually needs, not clutter.
        assertTrue(whitepages.note.contains("first step"))

        val ownerly = profile.groups.first().brokers[1]
        assertEquals(UnlistedRemovalMethod.ACCOUNT_REQUIRED, ownerly.method)
        assertTrue(ownerly.requiresId)
    }

    @Test
    fun `method_note survives verbatim`() {
        // Without this line the page implies a scan it never performed,
        // so it must reach the UI unaltered rather than being
        // reconstructed from a flag.
        val profile = decode<HomeUnlistedResponse>(profileJson("null", "[]")).unlisted
        assertEquals(
            "We do not look your address up on these sites — searching them would hand them your address.",
            profile.methodNote,
        )
    }

    @Test
    fun `typical_days zero is distinguishable from a real window`() {
        // 0 means the site publishes NO processing time. "not stated",
        // never "0 days" — which would read as instant.
        val brokers = decode<HomeUnlistedResponse>(profileJson("null", "[]")).unlisted.groups.first().brokers
        assertEquals(0, brokers[0].typicalDays)
        assertFalse(brokers[0].statesProcessingTime)
        assertEquals(45, brokers[1].typicalDays)
        assertTrue(brokers[1].statesProcessingTime)
    }

    @Test
    fun `exposure tokens resolve through the label map and fall back to readable English`() {
        val profile = decode<HomeUnlistedResponse>(profileJson("null", "[]")).unlisted
        assertEquals("Relatives and household members", profile.exposureLabel("relatives"))
        // A token this build has never heard of still renders as
        // something rather than vanishing from the list — and as
        // English rather than a raw slug, matching iOS.
        assertEquals("Future token", profile.exposureLabel("future_token"))
    }

    // ── The state program: three answers, three renders ──────

    @Test
    fun `a verified program decodes with its name, official URL and eligibility`() {
        val program =
            decode<HomeUnlistedResponse>(
                profileJson(
                    """{"exists":true,"name":"Safe at Home","url":"https://www.sos.ca.gov/registries/safe-home",
                       "eligibility":"Survivors of domestic violence, stalking, sexual assault or trafficking.",
                       "source_url":"https://www.sos.ca.gov/registries/safe-home","verified_at":"2026-08-27"}""",
                    "[]",
                ),
            ).unlisted.stateProgram

        assertNotNull(program)
        assertEquals(true, checkNotNull(program).exists)
        assertEquals("Safe at Home", program.name)
        assertTrue(program.hasOfficialLink)
        assertTrue(program.eligibility.isNotBlank())
    }

    @Test
    fun `a verified ABSENCE is exists false with a source — not null`() {
        // Alabama was checked and genuinely runs no substitute-address
        // program. That is a finding, it cites where it came from, and
        // `eligibility` still says what the state DOES offer.
        val program =
            decode<HomeUnlistedResponse>(
                profileJson(
                    """{"exists":false,"name":"","url":"",
                       "eligibility":"Alabama's only address protection is a Domestic Violence Voter Affirmation.",
                       "source_url":"https://www.sos.alabama.gov/x.pdf","verified_at":"2026-08-27"}""",
                    "[]",
                ),
            ).unlisted.stateProgram

        assertNotNull(program)
        assertEquals(false, checkNotNull(program).exists)
        assertTrue(program.sourceUrl.startsWith("http"))
        assertTrue(program.eligibility.isNotBlank())
        // A program that does not exist must not carry a dangling link.
        assertFalse(program.hasOfficialLink)
    }

    @Test
    fun `an unchecked state is null — never dressed as exists false`() {
        // The whole point of the distinction: null must stay null all
        // the way to the UI, which renders "we could not confirm".
        // Flattening it to a default `exists = false` object would tell
        // someone in danger that no help exists.
        val program = decode<HomeUnlistedResponse>(profileJson("null", "[]")).unlisted.stateProgram
        assertNull(program)
    }

    // ── The three answers, at the branch the VIEW actually takes ──
    //
    // `stateProgramAnswer` is the single place the collapse can happen,
    // so it is the single place worth pinning. The view switches on it
    // exhaustively; nothing else in the section reads `exists`.

    @Test
    fun `the three state answers are three distinct branches`() {
        fun answerFor(program: String) = decode<HomeUnlistedResponse>(profileJson(program, "[]")).unlisted.stateProgramAnswer

        assertTrue(
            answerFor("""{"exists":true,"name":"Safe at Home","url":"https://x.gov","eligibility":"e","source_url":"https://x.gov"}""")
                is UnlistedStateProgramAnswer.Program,
        )
        assertTrue(
            answerFor("""{"exists":false,"name":"","url":"","eligibility":"e","source_url":"https://x.gov"}""")
                is UnlistedStateProgramAnswer.NoProgram,
        )
        assertEquals(UnlistedStateProgramAnswer.Unconfirmed, answerFor("null"))
    }

    @Test
    fun `a state_program with no readable exists is UNCONFIRMED, never NoProgram`() {
        // THE regression this whole distinction exists to stop. A
        // Boolean defaulting to `false` would route an `exists` we
        // never actually read into the "we checked, your state runs
        // none" card — telling someone in danger that no help exists
        // off a fact the server never sent. Absent is not false.
        val answer =
            decode<HomeUnlistedResponse>(
                profileJson(
                    """{"name":"","url":"","eligibility":"","source_url":"https://x.gov","verified_at":"2026-08-27"}""",
                    "[]",
                ),
            ).unlisted.stateProgramAnswer

        assertEquals(UnlistedStateProgramAnswer.Unconfirmed, answer)
        assertFalse(answer is UnlistedStateProgramAnswer.NoProgram)
    }

    @Test
    fun `an unread exists never produces a dangling official link either`() {
        val program =
            checkNotNull(
                decode<HomeUnlistedResponse>(
                    profileJson("""{"name":"","url":"https://x.gov","eligibility":"","source_url":"https://x.gov"}""", "[]"),
                ).unlisted.stateProgram,
            )
        assertNull(program.exists)
        assertFalse(program.hasOfficialLink)
    }

    // ── Removals: null (read failed) vs empty (nothing yet) ──

    @Test
    fun `a failed progress read decodes as null, not an empty checklist`() {
        val profile = decode<HomeUnlistedResponse>(profileJson("null", "null")).unlisted
        assertNull(profile.removals)
        // And there is nothing to report per broker either — the UI must
        // not paint an untouched checklist over a read it never made.
        assertNull(profile.removalFor("whitepages"))
    }

    @Test
    fun `an empty progress list is a real answer, distinct from null`() {
        val profile = decode<HomeUnlistedResponse>(profileJson("null", "[]")).unlisted
        assertNotNull(profile.removals)
        assertEquals(0, checkNotNull(profile.removals).size)
    }

    @Test
    fun `recorded steps decode with their stamps and map to their broker`() {
        val profile =
            decode<HomeUnlistedResponse>(
                profileJson(
                    "null",
                    """[{"broker_id":"whitepages","status":"requested",
                        "requested_at":"2026-08-20T10:00:00Z","confirmed_at":null},
                       {"broker_id":"ownerly","status":"confirmed",
                        "requested_at":"2026-08-01T10:00:00Z","confirmed_at":"2026-08-19T10:00:00Z"}]""",
                ),
            ).unlisted

        assertEquals(UnlistedRemovalStatus.REQUESTED, checkNotNull(profile.removalFor("whitepages")).status)
        val ownerly = checkNotNull(profile.removalFor("ownerly"))
        assertEquals(UnlistedRemovalStatus.CONFIRMED, ownerly.status)
        // The stamp that was earned is not cleared by a later one.
        assertNotNull(ownerly.requestedAt)
        assertNotNull(ownerly.confirmedAt)
    }

    @Test
    fun `merging a confirmed step never fabricates a list out of a failed read`() {
        // One successful write does not tell us the other rows. Merging
        // into null would turn one fact into a complete checklist.
        val failed = decode<HomeUnlistedResponse>(profileJson("null", "null")).unlisted
        val merged = failed.withRemoval(UnlistedRemoval("whitepages", UnlistedRemovalStatus.CONFIRMED))
        assertNull(merged.removals)

        val loaded = decode<HomeUnlistedResponse>(profileJson("null", """[{"broker_id":"whitepages","status":"todo"}]""")).unlisted
        val updated = loaded.withRemoval(UnlistedRemoval("whitepages", UnlistedRemovalStatus.CONFIRMED))
        assertEquals(1, checkNotNull(updated.removals).size)
        assertEquals(UnlistedRemovalStatus.CONFIRMED, checkNotNull(updated.removalFor("whitepages")).status)
    }

    // ── Unknown-enum degradation ─────────────────────────────

    @Test
    fun `an unrecognized removal method degrades to UNKNOWN instead of throwing`() {
        // A declared UNKNOWN that is not registered in
        // PlaceEnumAdapterFactory still throws — the exact bug fixed for
        // ResidencyLetterStatus. If this regresses, a server adding one
        // method blanks the whole removal list.
        val json = profileJson("null", "[]").replace("\"method\":\"web_form\"", "\"method\":\"carrier_pigeon\"")
        val broker = decode<HomeUnlistedResponse>(json).unlisted.groups.first().brokers.first()
        assertEquals(UnlistedRemovalMethod.UNKNOWN, broker.method)
        // Everything else about the entry survives.
        assertEquals("whitepages", broker.id)
        assertTrue(broker.optOutUrl.startsWith("https://"))
    }

    @Test
    fun `an unrecognized removal status degrades to UNKNOWN and is never sent back`() {
        val profile =
            decode<HomeUnlistedResponse>(
                profileJson("null", """[{"broker_id":"whitepages","status":"escalated"}]"""),
            ).unlisted
        val removal = checkNotNull(profile.removalFor("whitepages"))
        assertEquals(UnlistedRemovalStatus.UNKNOWN, removal.status)
        // UNKNOWN carries no wire value; sending it would earn BAD_STATUS.
        assertFalse(removal.status.isSendable)
        assertTrue(UnlistedRemovalStatus.TODO.isSendable)
        assertEquals("todo", UnlistedRemovalStatus.TODO.wire)
        assertEquals("relisted", UnlistedRemovalStatus.RELISTED.wire)
    }

    @Test
    fun `an unrecognized preview status degrades rather than failing the response`() {
        val res =
            decode<PublicUnlistedResponse>(
                """{"status":"rate_limited","tier":"preview","message":"Try again shortly"}""",
            )
        assertEquals(UnlistedPreviewStatus.UNKNOWN, res.status)
        assertNull(res.unlisted)
    }

    // ── The anonymous (T0) envelope ──────────────────────────

    @Test
    fun `the anonymous response carries only city and state`() {
        val res =
            decode<PublicUnlistedResponse>(
                """
                {"status":"ready","tier":"preview","place":{"city":"Portland","state":"OR"},
                 "unlisted":{"state":"OR","state_program":null,"groups":[],"broker_count":0,
                   "exposure_labels":{},"method_note":"We are still verifying removal paths.",
                   "registry_verified_at":null},
                 "disclaimer":"We did not save this address."}
                """.trimIndent(),
            )

        assertEquals(UnlistedPreviewStatus.READY, res.status)
        assertEquals("Portland", checkNotNull(res.place).city)
        // No progress concept exists anonymously — and the absence must
        // still decode as null, not as an empty checklist.
        assertNull(checkNotNull(res.unlisted).removals)
        assertTrue(checkNotNull(res.unlisted).methodNote.isNotBlank())
    }

    @Test
    fun `a non-US address is a calm hand-off, not an error`() {
        val res =
            decode<PublicUnlistedResponse>(
                """{"status":"unsupported_region","tier":"preview","message":"Address removal help is U.S.-only for now"}""",
            )
        assertEquals(UnlistedPreviewStatus.UNSUPPORTED_REGION, res.status)
        assertNull(res.unlisted)
        assertEquals("Address removal help is U.S.-only for now", res.message)
    }

    @Test
    fun `an address we could not place is not a non-US hand-off`() {
        // The server used to collapse "could not read a state out of that"
        // into "you are outside the U.S." — a confident geographic denial
        // shown to someone standing in Portland. They are different
        // answers, and only this one still carries the whole removal list.
        val res =
            decode<PublicUnlistedResponse>(
                """
                {"status":"could_not_place","tier":"preview",
                 "message":"We could not tell which state that is",
                 "place":{"city":null,"state":null},
                 "unlisted":{"state":null,"state_program":null,"groups":[],"broker_count":19,
                   "exposure_labels":{},"method_note":"We do not look your address up on these sites.",
                   "registry_verified_at":null}}
                """.trimIndent(),
            )

        assertEquals(UnlistedPreviewStatus.COULD_NOT_PLACE, res.status)
        // The distinction is the point — never the non-US branch.
        assertNotEquals(UnlistedPreviewStatus.UNSUPPORTED_REGION, res.status)
        // The removal paths are national and never needed the address.
        assertEquals(19, checkNotNull(res.unlisted).brokerCount)
        // And the state answer degrades to "not checked", never "none".
        assertNull(checkNotNull(res.unlisted).stateProgram)
    }

    @Test
    fun `the removal write echoes the row it stored`() {
        val res =
            decode<UnlistedRemovalResponse>(
                """{"removal":{"broker_id":"ownerly","status":"requested",
                   "requested_at":"2026-08-25T09:00:00Z","confirmed_at":null}}""",
            )
        assertEquals("ownerly", res.removal.brokerId)
        assertEquals(UnlistedRemovalStatus.REQUESTED, res.removal.status)
        assertNotNull(res.removal.requestedAt)
        assertNull(res.removal.confirmedAt)
    }

    // ── money_lead on the anonymous place preview ────────────

    @Test
    fun `money_lead decodes with the scope the figure is true at`() {
        val preview =
            decode<PlacePreview>(
                """
                {"status":"partial","tier":"preview","region":"US",
                 "place":{"address":"1421 SE Oak St","city":"Portland","state":"OR","zipcode":"97214"},
                 "money_lead":{"kind":"flood_premium",
                   "headline":"Flood policies near here run ${'$'}1,240–${'$'}2,980 a year",
                   "detail":"Across 318 real NFIP policies in this census tract. A benchmark, not a quote.",
                   "low":1240,"high":2980,"scope":"census tract","source":"FEMA · OpenFEMA NFIP policies"}}
                """.trimIndent(),
            )

        val lead = checkNotNull(preview.moneyLead)
        assertEquals(MoneyLeadKind.FLOOD_PREMIUM, lead.kind)
        assertEquals(1240, lead.low)
        assertEquals(2980, lead.high)
        // The scope is what stops a county estimate reading as this home.
        assertEquals("census tract", lead.scope)
    }

    @Test
    fun `a missing money_lead is null so the tiles carry the page`() {
        val preview =
            decode<PlacePreview>(
                """{"status":"partial","tier":"preview","region":"US","money_lead":null}""",
            )
        assertNull(preview.moneyLead)
    }

    @Test
    fun `a money_lead missing its headline is not renderable and never fails the preview`() {
        // The lead is the one OPTIONAL section of the preview. A
        // required field here would take the whole anonymous page down
        // over the part that was always allowed to be absent — and an
        // empty headline is nothing to lead with either way.
        val preview =
            decode<PlacePreview>(
                """{"status":"partial","tier":"preview","region":"US",
                   "money_lead":{"kind":"rent_band","low":1800,"high":2200,"scope":"county","source":"HUD"}}""",
            )
        val lead = checkNotNull(preview.moneyLead)
        assertFalse(lead.isRenderable)
        assertEquals(1800, lead.low)
    }

    @Test
    fun `an unrecognized money_lead kind degrades without losing the figure`() {
        val preview =
            decode<PlacePreview>(
                """
                {"status":"partial","tier":"preview","region":"US",
                 "money_lead":{"kind":"tax_band","headline":"h","detail":"d","low":10,"high":20,
                   "scope":"county","source":"s"}}
                """.trimIndent(),
            )
        val lead = checkNotNull(preview.moneyLead)
        assertEquals(MoneyLeadKind.UNKNOWN, lead.kind)
        assertEquals("h", lead.headline)
    }

    // ── The outcome copy never claims we acted ───────────────

    @Test
    fun `removal confirmations describe what the resident did, not what we did`() {
        // Pantopus removes nothing on anyone's behalf: every removal
        // happens on the broker's own site and we only track what the
        // resident tells us. The copy must not imply otherwise.
        val messages =
            listOf(
                PlaceDetailViewModel.removalSavedMessage(UnlistedRemovalStatus.REQUESTED),
                PlaceDetailViewModel.removalSavedMessage(UnlistedRemovalStatus.CONFIRMED),
                PlaceDetailViewModel.removalSavedMessage(UnlistedRemovalStatus.RELISTED),
                PlaceDetailViewModel.removalSavedMessage(UnlistedRemovalStatus.TODO),
            )
        for (message in messages) {
            assertTrue(message.isNotBlank())
            assertFalse(message.lowercase().contains("we removed"))
            assertFalse(message.lowercase().contains("we've removed"))
            assertFalse(message.lowercase().contains("removing for you"))
        }
    }
}
