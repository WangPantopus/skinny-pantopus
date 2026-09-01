package app.pantopus.android.data.scheduling

import app.pantopus.android.data.api.net.NetworkError
import com.squareup.moshi.Moshi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SchedulingErrorDecoderTest {
    private val decoder = SchedulingErrorDecoder(Moshi.Builder().build())

    @Test
    fun decodes_409_slot_taken_into_conflict_with_alternatives() {
        val body =
            """
            {"error":"SLOT_TAKEN","message":"That time was just taken.",
             "alternatives":[
               {"start":"2026-06-17T18:00:00Z","end":"2026-06-17T18:30:00Z","startLocal":"2026-06-17T11:00:00"},
               {"start":"2026-06-17T19:00:00Z","end":"2026-06-17T19:30:00Z","startLocal":"2026-06-17T12:00:00"}
             ]}
            """.trimIndent()
        val result = decoder.decode(NetworkError.ClientError(409, body))
        assertTrue(result is SchedulingError.Conflict)
        result as SchedulingError.Conflict
        assertEquals("SLOT_TAKEN", result.code)
        assertEquals(2, result.alternatives.size)
        assertEquals("2026-06-17T18:00:00Z", result.alternatives.first().start)
    }

    @Test
    fun decodes_400_validation_into_validation_with_details() {
        val body =
            """{"error":"Validation failed","details":[{"field":"slug","message":"Slug is invalid","code":"INVALID"}]}"""
        val result = decoder.decode(NetworkError.ClientError(400, body))
        assertTrue(result is SchedulingError.Validation)
        result as SchedulingError.Validation
        assertEquals(1, result.details.size)
        assertEquals("slug", result.details.first().field)
    }

    @Test
    fun decodes_page_paused_into_paused() {
        val result = decoder.decode(NetworkError.ClientError(409, """{"error":"PAGE_PAUSED","message":"Paused."}"""))
        assertEquals(SchedulingError.Paused, result)
    }

    @Test
    fun decodes_status_expired_into_expired() {
        val result = decoder.decode(NetworkError.ClientError(404, """{"error":"NOT_FOUND","status":"expired"}"""))
        assertEquals(SchedulingError.Expired, result)
    }

    @Test
    fun decodes_slug_taken_into_slug_taken_with_suggestions() {
        val result =
            decoder.decode(NetworkError.ClientError(409, """{"error":"SLUG_TAKEN","suggestions":["maria-1","maria-k","mk"]}"""))
        assertTrue(result is SchedulingError.SlugTaken)
        result as SchedulingError.SlugTaken
        assertEquals(3, result.suggestions.size)
    }

    @Test
    fun bodyless_not_found_defaults_to_unavailable_but_honors_hint() {
        assertEquals(SchedulingError.Unavailable, decoder.decode(NetworkError.NotFound))
        assertEquals(
            SchedulingError.Expired,
            decoder.decode(NetworkError.NotFound, notFoundAs = SchedulingError.Expired),
        )
    }

    @Test
    fun forbidden_decodes_to_secret() {
        assertEquals(SchedulingError.Secret, decoder.decode(NetworkError.Forbidden))
    }

    @Test
    fun decodes_501_not_available_into_not_available_501() {
        val result =
            decoder.decode(NetworkError.Server(501, """{"error":"NOT_AVAILABLE","message":"External calendar sync is coming soon."}"""))
        assertEquals(SchedulingError.NotAvailable501, result)
    }
}
