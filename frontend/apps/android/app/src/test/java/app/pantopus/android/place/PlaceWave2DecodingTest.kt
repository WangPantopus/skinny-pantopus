package app.pantopus.android.place

import app.pantopus.android.data.api.models.place.AssessmentStance
import app.pantopus.android.data.api.models.place.ExemptionFilingStatus
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceSectionId
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Decoding contract for the Wave 2 additions: the `exemption_check`
 * section and the optional `flood.nfip` premium benchmark. Both
 * resolved to UNKNOWN / null — and therefore rendered nothing — until
 * the enum, the payload union and the adapter learned them.
 *
 * Parity: mirrors the Wave-2 cases in iOS `PlaceSectionsDecodingTests`.
 */
class PlaceWave2DecodingTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json)) { "decoded null" }

    private fun wrap(section: String): String =
        """
        {"place":{"label":"x","line1":"x","city":"x","state":"OR","postal_code":"97214"},
         "tier":"T3","region_supported":true,"generated_at":"2026-08-25T09:00:00Z",
         "groups":[{"group":"money_signals","label":"Money signals","sections":[$section]}]}
        """.trimIndent()

    @Test
    fun `decodes exemption_check with the assessment signal`() {
        val json =
            wrap(
                """
                {"id":"exemption_check","group":"money_signals","band":"B","access":"available","status":"ready",
                 "as_of":null,"source":"County records","coverage":"full","unavailable_reason":null,
                 "data":{"filing_status":"none_on_file","exemptions":[],"homestead_on_file":false,
                   "assessment_signal":{"assessed_value":550000,"market_value":500000,"ratio_pct":10,"stance":"above"},
                   "state_program":{"state":"TX","label":"Texas homestead exemption","filing":"application",
                     "note":"Not automatic - file with your county appraisal district.","curated":true}}}
                """.trimIndent(),
            )

        val env = decode<PlaceIntelligence>(json).groups.first().sections.first()
        assertEquals(PlaceSectionId.EXEMPTION_CHECK, env.sectionId)
        val d = assertNotNull(env.exemptionCheck).let { env.exemptionCheck!! }
        assertEquals(ExemptionFilingStatus.NONE_ON_FILE, d.filingStatus)
        assertFalse(d.homesteadOnFile)
        val signal = assertNotNull(d.assessmentSignal).let { d.assessmentSignal!! }
        assertEquals(AssessmentStance.ABOVE, signal.stance)
        assertEquals(10.0, signal.ratioPct, 0.0)
        assertEquals("application", d.stateProgram.filing)
    }

    @Test
    fun `exemption vocabulary additions fall back to UNKNOWN`() {
        // A new server-side filing_status or stance must not blank the
        // section on an older build; a null assessment_signal stays null.
        val json =
            wrap(
                """
                {"id":"exemption_check","group":"money_signals","band":"B","access":"available","status":"ready",
                 "as_of":null,"source":"County records","coverage":"full","unavailable_reason":null,
                 "data":{"filing_status":"partially_exempt","exemptions":["Ag land"],"homestead_on_file":false,
                   "assessment_signal":null,
                   "state_program":{"state":null,"label":"Homeowner exemption programs","filing":"varies",
                     "note":"Check your county assessor.","curated":false}}}
                """.trimIndent(),
            )

        val d = decode<PlaceIntelligence>(json).groups.first().sections.first().exemptionCheck!!
        assertEquals(ExemptionFilingStatus.UNKNOWN, d.filingStatus)
        assertNull(d.assessmentSignal)
        assertNull(d.stateProgram.state)
    }

    @Test
    fun `decodes the flood nfip benchmark when present`() {
        val json =
            wrap(
                """
                {"id":"flood","group":"money_signals","band":"A","access":"available","status":"ready",
                 "as_of":null,"source":"FEMA","coverage":"full","unavailable_reason":null,
                 "data":{"zone":"AE","zone_label":"Zone AE","risk_level":"high","in_sfha":true,
                   "insurance_required":true,"plain_meaning":"High-risk zone.",
                   "nfip":{"policy_count":128,"premium_p25":480,"premium_median":760,"premium_p75":1240,
                     "full_risk_median":910,"window_months":24,"coverage":"full","as_of":"2026-08-01T00:00:00.000Z"}}}
                """.trimIndent(),
            )

        val nfip = decode<PlaceIntelligence>(json).groups.first().sections.first().flood!!.nfip!!
        assertEquals(128, nfip.policyCount)
        assertEquals(760.0, nfip.premiumMedian, 0.0)
        assertEquals(910.0, nfip.fullRiskMedian!!, 0.0)
        assertEquals("full", nfip.coverage)
    }

    @Test
    fun `flood still decodes without nfip`() {
        // The pre-Wave-2 payload — warming or suppressed tracts — must
        // keep decoding exactly as before.
        val json =
            wrap(
                """
                {"id":"flood","group":"money_signals","band":"A","access":"available","status":"ready",
                 "as_of":null,"source":"FEMA","coverage":"full","unavailable_reason":null,
                 "data":{"zone":"X","zone_label":"Zone X","risk_level":"minimal","in_sfha":false,
                   "insurance_required":false,"plain_meaning":"Minimal risk."}}
                """.trimIndent(),
            )

        val flood = decode<PlaceIntelligence>(json).groups.first().sections.first().flood!!
        assertEquals("X", flood.zone)
        assertNull(flood.nfip)
    }
}
