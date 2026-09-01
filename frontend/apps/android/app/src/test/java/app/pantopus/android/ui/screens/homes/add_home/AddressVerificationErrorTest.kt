@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import app.pantopus.android.data.api.net.NetworkError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * UX-06 — neither native client had any address layer. The wizard let the user
 * complete every step, then rendered the 422 from `POST /api/homes` through the
 * generic networking path: "Request failed", with no indication of what was
 * wrong or what to change. The `code` the server sends was referenced nowhere.
 */
class AddressVerificationErrorTest {
    private fun clientError(code: String) = NetworkError.ClientError(422, """{"error":"nope","code":"$code"}""")

    @Test
    fun `every code the backend can return is mapped`() {
        // Kept in step with getHomeValidationError in backend/routes/home.js.
        val backendCodes =
            listOf(
                "ADDRESS_MISSING_UNIT",
                "ADDRESS_NOT_HOME",
                "ADDRESS_UNDELIVERABLE",
                "ADDRESS_CONFLICT",
                "ADDRESS_LOW_CONFIDENCE",
                "ADDRESS_AMBIGUOUS",
                "ADDRESS_PO_BOX",
                "ADDRESS_MISSING_STREET_NUMBER",
                "ADDRESS_UNVERIFIED_STREET_NUMBER",
                "ADDRESS_STEP_UP_REQUIRED",
                "ADDRESS_VALIDATION_UNAVAILABLE",
            )

        backendCodes.forEach { code ->
            assertNotNull(
                "backend can return $code and the app does not recognise it",
                AddressVerificationError.from(clientError(code)),
            )
        }
    }

    @Test
    fun `extracts the code from a 422 body`() {
        assertEquals(
            AddressVerificationError.MISSING_UNIT,
            AddressVerificationError.from(clientError("ADDRESS_MISSING_UNIT")),
        )
    }

    @Test
    fun `ignores errors that are not address refusals`() {
        assertNull(AddressVerificationError.from(NetworkError.Unauthorized))
        assertNull(AddressVerificationError.from(NetworkError.NotFound))
        assertNull(AddressVerificationError.from(clientError("SOMETHING_ELSE")))
    }

    @Test
    fun `survives a malformed body without crashing`() {
        assertNull(AddressVerificationError.from(NetworkError.ClientError(422, null)))
        assertNull(AddressVerificationError.from(NetworkError.ClientError(422, "not json")))
        assertNull(AddressVerificationError.from(NetworkError.ClientError(422, "{}")))
    }

    @Test
    fun `every case says what is wrong and what to do`() {
        AddressVerificationError.entries.forEach {
            assertTrue(it.message.isNotBlank())
            assertTrue(it.recoverySuggestion.isNotBlank())
            assertTrue(it.displayMessage.contains(it.message))
        }
    }

    @Test
    fun `only a genuine outage suggests retrying`() {
        // Telling someone to retry a PO Box forever is the defect this replaces.
        AddressVerificationError.entries
            .filter { it != AddressVerificationError.UNAVAILABLE }
            .forEach { assertFalse("${it.code} should not be retryable", it.isRetryable) }
        assertTrue(AddressVerificationError.UNAVAILABLE.isRetryable)
    }

    @Test
    fun `the outage code is parsed out of a 503, not just a 4xx`() {
        // The backend sends ADDRESS_VALIDATION_UNAVAILABLE as HTTP 503, which
        // the networking layer surfaces as NetworkError.Server. Matching only
        // ClientError made the one retryable case unreachable during the exact
        // outage it was written for.
        val body = """{"error":"Address verification is temporarily unavailable.","code":"ADDRESS_VALIDATION_UNAVAILABLE"}"""
        assertEquals(
            AddressVerificationError.UNAVAILABLE,
            AddressVerificationError.from(NetworkError.Server(503, body)),
        )

        // Other 5xx bodies without an address code stay unmapped.
        assertNull(AddressVerificationError.from(NetworkError.Server(500, "oops")))
    }

    @Test
    fun `refusals the address step can fix route back to it`() {
        assertTrue(AddressVerificationError.MISSING_UNIT.isFixableInAddressStep)
        assertTrue(AddressVerificationError.PO_BOX.isFixableInAddressStep)
        assertFalse(AddressVerificationError.CONFLICT.isFixableInAddressStep)
        assertFalse(AddressVerificationError.UNAVAILABLE.isFixableInAddressStep)
    }
}
