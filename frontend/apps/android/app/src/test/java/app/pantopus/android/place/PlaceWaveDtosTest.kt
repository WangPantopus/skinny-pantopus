package app.pantopus.android.place

import app.pantopus.android.data.api.models.place.FridgeCardStatus
import app.pantopus.android.data.api.models.place.FridgeCardsResponse
import app.pantopus.android.data.api.models.place.MailboxCheckResponse
import app.pantopus.android.data.api.models.place.MailboxCheckVerdict
import app.pantopus.android.data.api.models.place.MailboxFindingSeverity
import app.pantopus.android.data.api.models.place.MailboxPhysicalStatus
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.RecordWatchResponse
import app.pantopus.android.data.api.models.place.ResidencyClaimScope
import app.pantopus.android.data.api.models.place.ResidencyClaimStatus
import app.pantopus.android.data.api.models.place.ResidencyClaimsResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Decoding contract for the Wave endpoint DTOs that ride beside the
 * Place sections: the Mailbox Reality Check and the Record Watch.
 * Vocabulary enums must fall back to safe constants rather than
 * failing. Parity: iOS `PlaceWaveDTOsTests.swift`.
 */
class PlaceWaveDtosTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json)) { "decoded null" }

    @Test
    fun `decodes the mailbox check`() {
        val json =
            """
            {"check":{"verdict":"needs_attention",
              "findings":[
                {"severity":"attention","title":"A unit number is missing","detail":"USPS confirms the building but expects a unit."},
                {"severity":"ok","title":"USPS confirms this exact address","detail":"Full match."}],
              "physical":{"status":"proven","title":"Mail physically reaches this mailbox","detail":"A postcard was delivered here."},
              "checked_at":"2026-08-01T00:00:00.000Z"}}
            """.trimIndent()
        val check = decode<MailboxCheckResponse>(json).check
        assertEquals(MailboxCheckVerdict.NEEDS_ATTENTION, check.verdict)
        assertEquals(2, check.findings.size)
        assertEquals(MailboxFindingSeverity.ATTENTION, check.findings[0].severity)
        assertEquals(MailboxPhysicalStatus.PROVEN, check.physical.status)
    }

    @Test
    fun `mailbox vocabulary additions fall back safely`() {
        val json =
            """
            {"check":{"verdict":"catastrophic",
              "findings":[{"severity":"apocalyptic","title":"t","detail":"d"}],
              "physical":{"status":"teleported","title":"t","detail":"d"},
              "checked_at":null}}
            """.trimIndent()
        val check = decode<MailboxCheckResponse>(json).check
        assertEquals(MailboxCheckVerdict.UNKNOWN, check.verdict)
        assertEquals(MailboxFindingSeverity.INFO, check.findings[0].severity)
        assertEquals(MailboxPhysicalStatus.NOT_RUN, check.physical.status)
        assertNull(check.checkedAt)
    }

    @Test
    fun `decodes fridge cards and keeps unknown sections`() {
        val json =
            """
            {"cards":[{"id":"f1","home_id":"h1","label":"Sitter card","status":"active",
              "card_code":"ABCD-EFGH-JKMN-PQRS","card_url":"https://pantopus.com/fridge-card/ABCD-EFGH-JKMN-PQRS",
              "content":{"address":{"line1":"1421 SE Oak St Unit B","city_state_zip":"Portland, OR 97214"},
                "sections":[
                  {"key":"household","items":[{"label":"Mia (6)","note":"Peanut allergy"}]},
                  {"key":"evacuation_routes","items":[{"label":"Meet","note":"At the oak tree"}]}]},
              "issued_at":"2026-08-25T00:00:00.000Z","revoked_at":null,"view_count":2,"last_viewed_at":null}]}
            """.trimIndent()
        val card = decode<FridgeCardsResponse>(json).cards.first()
        assertEquals(FridgeCardStatus.ACTIVE, card.status)
        // The address block is server-derived and always present.
        assertEquals("1421 SE Oak St Unit B", card.content.address.line1)
        // A section key this build has never heard of still decodes and
        // still carries its items — household safety data never hides.
        assertEquals("evacuation_routes", card.content.sections[1].key)
        assertEquals("At the oak tree", card.content.sections[1].items.first().note)
    }

    @Test
    fun `decodes residency claims and falls back on new vocabulary`() {
        val json =
            """
            {"claims":[
              {"id":"c1","home_id":"h1","scope":"school_district",
               "statement":"Dana is a verified resident of Portland SD 1J.",
               "holder_name":"Dana","status":"active","claim_code":"ABCD-EFGH-JKMN-PQRS",
               "verify_url":"https://pantopus.com/verify-claim/ABCD-EFGH-JKMN-PQRS",
               "issued_at":"2026-08-25T00:00:00.000Z","expires_at":"2026-09-24T00:00:00.000Z",
               "revoked_at":null,"residency_verified_at":null,"view_count":3,"last_viewed_at":null},
              {"id":"c2","home_id":"h1","scope":"galactic_sector",
               "statement":"s","holder_name":"Dana","status":"superseded","claim_code":"AAAA-BBBB-CCCC-DDDD",
               "verify_url":"u","issued_at":"2026-08-25T00:00:00.000Z","expires_at":"2026-09-24T00:00:00.000Z",
               "revoked_at":null,"residency_verified_at":null,"view_count":0,"last_viewed_at":null}]}
            """.trimIndent()
        val claims = decode<ResidencyClaimsResponse>(json).claims
        assertEquals(2, claims.size)
        assertEquals(ResidencyClaimScope.SCHOOL_DISTRICT, claims[0].scope)
        assertEquals(ResidencyClaimStatus.ACTIVE, claims[0].status)
        assertEquals(3, claims[0].viewCount)
        // A scope or status this build has never heard of renders inert,
        // never as active, and never fails the list.
        assertEquals(ResidencyClaimScope.UNKNOWN, claims[1].scope)
        assertEquals(ResidencyClaimStatus.EXPIRED, claims[1].status)
    }

    @Test
    fun `decodes the record watch with and without an evaluation`() {
        val withEval =
            """
            {"watch":{"id":"w1","home_id":"home-1","loan_recorded_month":"2023-03",
              "baseline_rate":6.6,"created_at":"2026-08-01T00:00:00.000Z",
              "evaluation":{"baseline_rate":6.6,"current_rate":5.7,"current_as_of":"2026-08-20",
                "delta_pp":-0.9,"refi_window":true}}}
            """.trimIndent()
        val response = decode<RecordWatchResponse>(withEval)
        assertNotNull(response.watch)
        val watch = response.watch!!
        assertEquals("2023-03", watch.loanRecordedMonth)
        assertNotNull(watch.evaluation)
        val ev = watch.evaluation!!
        assertEquals(-0.9, ev.deltaPp, 0.0001)
        assertTrue(ev.refiWindow)

        // GET with no watch is {"watch": null}; a watch whose rate
        // history is momentarily unreachable ships evaluation: null.
        assertNull(decode<RecordWatchResponse>("""{"watch":null}""").watch)
        val noEval =
            """
            {"watch":{"id":"w1","home_id":"home-1","loan_recorded_month":"2023-03",
              "baseline_rate":6.6,"created_at":"2026-08-01T00:00:00.000Z","evaluation":null}}
            """.trimIndent()
        assertNull(decode<RecordWatchResponse>(noEval).watch!!.evaluation)
    }
}
