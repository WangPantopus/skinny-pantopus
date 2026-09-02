package app.pantopus.android.data.api

import app.pantopus.android.data.api.models.auth.LoginResponse
import com.squareup.moshi.Moshi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Wedge sign-up sends only email + password, so the login payload comes back
 * with `name`, `firstName` and `lastName` as JSON null. Decoding that must not
 * throw, otherwise the very first login after sign-up dies on the login screen.
 */
class AuthenticatedUserDecodingTest {
    private val adapter = Moshi.Builder().build().adapter(LoginResponse::class.java)

    @Test
    fun `login payload with null name fields decodes`() {
        val json =
            """
            {"message":"ok","accessToken":"a","refreshToken":"r","expiresIn":900,"expiresAt":1,
             "user":{"id":"u1","email":"review@example.com","username":"review",
                     "name":null,"firstName":null,"middleName":null,"lastName":null}}
            """.trimIndent()

        val decoded = adapter.fromJson(json)

        assertNotNull(decoded)
        assertEquals("u1", decoded!!.user.id)
        assertNull(decoded.user.name)
        assertNull(decoded.user.firstName)
    }

    @Test
    fun `login payload without name keys decodes`() {
        val json = """{"user":{"id":"u2","email":"x@example.com"}}"""

        val decoded = adapter.fromJson(json)

        assertEquals("u2", decoded?.user?.id)
        assertNull(decoded?.user?.name)
    }
}
