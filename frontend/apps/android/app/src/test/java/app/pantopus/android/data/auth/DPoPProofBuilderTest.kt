package app.pantopus.android.data.auth

import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest
import java.util.Base64

/**
 * Pins the DPoP proof to `docs/persistent-login/CONTRACT.md` §Headers:
 * `dpop+jwt` / ES256 / embedded P-256 JWK, `{ jti, htm, htu, iat, rth? }`,
 * raw `r||s` signature, `htu` without query, `rth = b64url(sha256(rt))`.
 */
class DPoPProofBuilderTest {
    private val moshi = Moshi.Builder().build()
    private val mapAdapter =
        moshi.adapter<Map<String, Any?>>(Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java))
    private val builder = DPoPProofBuilder()
    private val key = SoftwareSigningKey()

    private fun decodeSegment(segment: String): Map<String, Any?> =
        mapAdapter.fromJson(String(Base64.getUrlDecoder().decode(segment), Charsets.UTF_8))!!

    @Test
    fun `header carries dpop+jwt, ES256 and the embedded public JWK`() {
        val proof = builder.build(key, htm = "POST", htu = "https://api.pantopus.com/api/users/login")
        val header = decodeSegment(proof.split(".")[0])

        assertEquals("dpop+jwt", header["typ"])
        assertEquals("ES256", header["alg"])
        @Suppress("UNCHECKED_CAST")
        val jwk = header["jwk"] as Map<String, Any?>
        assertEquals("EC", jwk["kty"])
        assertEquals("P-256", jwk["crv"])
        assertEquals(key.jwk["x"], jwk["x"])
        assertEquals(key.jwk["y"], jwk["y"])
        // base64url, no padding: 32-byte coordinates encode to 43 chars.
        assertEquals(43, (jwk["x"] as String).length)
        assertFalse((jwk["x"] as String).contains("="))
    }

    @Test
    fun `payload has jti htm htu iat and no rth without a refresh token`() {
        val proof =
            builder.build(
                key,
                htm = "post",
                htu = "https://api.pantopus.com/api/users/login",
                nowSeconds = 1_755_500_000L,
                jti = "11111111-2222-3333-4444-555555555555",
            )
        val payload = decodeSegment(proof.split(".")[1])

        assertEquals("11111111-2222-3333-4444-555555555555", payload["jti"])
        assertEquals("POST", payload["htm"])
        assertEquals("https://api.pantopus.com/api/users/login", payload["htu"])
        assertEquals(1_755_500_000.0, payload["iat"])
        assertNull(payload["rth"])
        assertFalse(payload.containsKey("rth"))
    }

    @Test
    fun `rth is base64url sha256 of the refresh token`() {
        val proof =
            builder.build(
                key,
                htm = "POST",
                htu = "https://api.pantopus.com/api/users/refresh",
                refreshToken = "rt-secret",
            )
        val payload = decodeSegment(proof.split(".")[1])

        val expected =
            Base64
                .getUrlEncoder()
                .withoutPadding()
                .encodeToString(MessageDigest.getInstance("SHA-256").digest("rt-secret".toByteArray()))
        assertEquals(expected, payload["rth"])
        assertEquals(expected, DPoPProofBuilder.refreshTokenHash("rt-secret"))
    }

    @Test
    fun `signature is a 64-byte raw r||s over header dot payload and verifies`() {
        val proof = builder.build(key, htm = "POST", htu = "https://api.pantopus.com/api/auth/resume")
        val parts = proof.split(".")
        assertEquals(3, parts.size)

        val raw = Base64.getUrlDecoder().decode(parts[2])
        assertEquals(64, raw.size)
        val signingInput = (parts[0] + "." + parts[1]).toByteArray(Charsets.US_ASCII)
        assertTrue(key.verify(signingInput, raw))
        // The key signed exactly the JOSE signing input.
        assertTrue(key.signedInputs.single().contentEquals(signingInput))
    }

    @Test
    fun `every proof gets a fresh jti`() {
        val a = builder.build(key, htm = "POST", htu = "https://api.pantopus.com/api/users/refresh")
        val b = builder.build(key, htm = "POST", htu = "https://api.pantopus.com/api/users/refresh")
        val jtiA = decodeSegment(a.split(".")[1])["jti"]
        val jtiB = decodeSegment(b.split(".")[1])["jti"]
        assertTrue(jtiA != jtiB)
    }

    @Test
    fun `htu is scheme host optional-port path without query or fragment`() {
        assertEquals(
            "https://api.pantopus.com/api/users/refresh",
            DPoPProofBuilder.htu("https://api.pantopus.com", "api/users/refresh"),
        )
        assertEquals(
            "https://api.pantopus.com/api/users/refresh",
            DPoPProofBuilder.htu("https://api.pantopus.com/", "/api/users/refresh?x=1#frag"),
        )
        // Non-default port is kept; default port is elided.
        assertEquals(
            "http://10.0.2.2:8000/api/auth/resume",
            DPoPProofBuilder.htu("http://10.0.2.2:8000", "/api/auth/resume"),
        )
        assertEquals(
            "https://api.pantopus.com/api/auth/resume",
            DPoPProofBuilder.htu("https://api.pantopus.com:443", "/api/auth/resume"),
        )
    }

    @Test
    fun `thumbprint is RFC 7638 sha256 over the canonical crv kty x y JSON`() {
        val canonical = "{\"crv\":\"P-256\",\"kty\":\"EC\",\"x\":\"${key.jwk["x"]}\",\"y\":\"${key.jwk["y"]}\"}"
        val expected =
            Base64
                .getUrlEncoder()
                .withoutPadding()
                .encodeToString(MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray()))
        assertEquals(expected, key.thumbprint)
        assertEquals(expected, EcKeyCodec.thumbprint(key.jwk))
    }

    @Test
    fun `derToRaw and rawToDer round-trip`() {
        val data = "hello".toByteArray()
        val raw = key.sign(data)
        assertEquals(64, raw.size)
        assertTrue(key.verify(data, raw))
        val der = EcKeyCodec.rawToDer(raw)
        assertTrue(EcKeyCodec.derToRaw(der).contentEquals(raw))
    }
}
