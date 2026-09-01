package app.pantopus.android.data.auth

import java.math.BigInteger
import java.security.MessageDigest
import java.security.interfaces.ECPublicKey
import java.util.Base64

/**
 * A P-256 signing key usable for DPoP proofs and step-up assertions:
 * exposes its public JWK, the RFC 7638 thumbprint, the backing tier and a
 * raw-`r||s` ES256 signature. Implemented by the Keystore-backed keys in
 * [DeviceKeyStore] / [StepUpKeyStore] and by software keys in unit tests.
 */
interface DeviceSigningKey {
    /** `{ kty: "EC", crv: "P-256", x, y }` — base64url, no padding. */
    val jwk: Map<String, String>

    /** RFC 7638 `base64url(sha256('{"crv":"P-256","kty":"EC","x":"…","y":"…"}'))`. */
    val thumbprint: String

    /** `strongbox` | `tee` | `software` (CONTRACT `keyBacking`). */
    val keyBacking: String

    /** ES256 over [data]; returns the 64-byte raw `r||s` (JOSE) encoding. */
    fun sign(data: ByteArray): ByteArray
}

/**
 * Pure-JVM helpers shared by the key stores, the DPoP builder and tests:
 * JWK export, RFC 7638 thumbprint, DER <-> raw ECDSA signature conversion
 * and base64url. Uses `java.util.Base64` (API 26+) so it runs in plain JVM
 * unit tests without Robolectric.
 */
@Suppress("TooManyFunctions")
object EcKeyCodec {
    const val CURVE = "P-256"
    const val KEY_TYPE = "EC"

    /** Coordinate size for P-256 in bytes. */
    const val COORDINATE_BYTES = 32

    private val urlEncoder: Base64.Encoder = Base64.getUrlEncoder().withoutPadding()
    private val urlDecoder: Base64.Decoder = Base64.getUrlDecoder()

    fun base64Url(bytes: ByteArray): String = urlEncoder.encodeToString(bytes)

    fun base64UrlDecode(text: String): ByteArray = urlDecoder.decode(text)

    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    /** Public JWK for a P-256 key, coordinates left-padded / trimmed to 32 bytes. */
    fun jwkFor(publicKey: ECPublicKey): Map<String, String> {
        val x = fixedLength(publicKey.w.affineX, COORDINATE_BYTES)
        val y = fixedLength(publicKey.w.affineY, COORDINATE_BYTES)
        return linkedMapOf(
            "kty" to KEY_TYPE,
            "crv" to CURVE,
            "x" to base64Url(x),
            "y" to base64Url(y),
        )
    }

    /**
     * RFC 7638 thumbprint: SHA-256 over the canonical JSON of the required
     * members in lexicographic order (`crv, kty, x, y`), no whitespace.
     */
    fun thumbprint(jwk: Map<String, String>): String {
        val canonical =
            buildString {
                append("{\"crv\":\"").append(jwk.getValue("crv"))
                append("\",\"kty\":\"").append(jwk.getValue("kty"))
                append("\",\"x\":\"").append(jwk.getValue("x"))
                append("\",\"y\":\"").append(jwk.getValue("y"))
                append("\"}")
            }
        return base64Url(sha256(canonical.toByteArray(Charsets.UTF_8)))
    }

    /**
     * Convert a DER-encoded ECDSA signature (`SEQUENCE { INTEGER r, INTEGER s }`,
     * what `java.security.Signature` produces) into the fixed 64-byte JOSE
     * `r || s` form ES256 requires.
     */
    fun derToRaw(
        der: ByteArray,
        coordinateBytes: Int = COORDINATE_BYTES,
    ): ByteArray {
        require(der.isNotEmpty() && der[0] == DER_SEQUENCE) { "Not a DER ECDSA signature" }
        var offset = 1
        // Sequence length (short or long form) — we don't need its value.
        offset += lengthFieldSize(der, offset)
        require(der[offset] == DER_INTEGER) { "Expected INTEGER for r" }
        offset++
        val rLen = readLength(der, offset)
        offset += lengthFieldSize(der, offset)
        val r = der.copyOfRange(offset, offset + rLen)
        offset += rLen
        require(der[offset] == DER_INTEGER) { "Expected INTEGER for s" }
        offset++
        val sLen = readLength(der, offset)
        offset += lengthFieldSize(der, offset)
        val s = der.copyOfRange(offset, offset + sLen)
        return fixedLength(BigInteger(1, r), coordinateBytes) + fixedLength(BigInteger(1, s), coordinateBytes)
    }

    /** Inverse of [derToRaw] — used by tests to verify with `java.security.Signature`. */
    fun rawToDer(raw: ByteArray): ByteArray {
        require(raw.size % 2 == 0) { "raw signature must be r||s" }
        val half = raw.size / 2
        val r = derInteger(raw.copyOfRange(0, half))
        val s = derInteger(raw.copyOfRange(half, raw.size))
        val body = r + s
        return byteArrayOf(DER_SEQUENCE) + derLength(body.size) + body
    }

    /** Big-endian magnitude of [value] padded / trimmed to exactly [size] bytes. */
    fun fixedLength(
        value: BigInteger,
        size: Int,
    ): ByteArray {
        val bytes = value.toByteArray()
        return when {
            bytes.size == size -> bytes
            bytes.size > size -> bytes.copyOfRange(bytes.size - size, bytes.size)
            else -> ByteArray(size - bytes.size) + bytes
        }
    }

    private fun derInteger(magnitude: ByteArray): ByteArray {
        // Strip leading zeros, then re-add one if the top bit is set (DER
        // INTEGERs are signed two's complement).
        var start = 0
        while (start < magnitude.size - 1 && magnitude[start] == 0.toByte()) start++
        var content = magnitude.copyOfRange(start, magnitude.size)
        if (content[0].toInt() and TOP_BIT != 0) content = byteArrayOf(0) + content
        return byteArrayOf(DER_INTEGER) + derLength(content.size) + content
    }

    private fun derLength(length: Int): ByteArray =
        if (length < DER_LONG_FORM) {
            byteArrayOf(length.toByte())
        } else {
            byteArrayOf((DER_LONG_FORM or 1).toByte(), length.toByte())
        }

    private fun readLength(
        der: ByteArray,
        offset: Int,
    ): Int {
        val first = der[offset].toInt() and BYTE_MASK
        if (first < DER_LONG_FORM) return first
        val count = first and (DER_LONG_FORM - 1)
        var value = 0
        for (i in 1..count) value = (value shl BITS_PER_BYTE) or (der[offset + i].toInt() and BYTE_MASK)
        return value
    }

    private fun lengthFieldSize(
        der: ByteArray,
        offset: Int,
    ): Int {
        val first = der[offset].toInt() and BYTE_MASK
        return if (first < DER_LONG_FORM) 1 else 1 + (first and (DER_LONG_FORM - 1))
    }

    private const val DER_SEQUENCE: Byte = 0x30
    private const val DER_INTEGER: Byte = 0x02
    private const val DER_LONG_FORM = 0x80
    private const val TOP_BIT = 0x80
    private const val BYTE_MASK = 0xFF
    private const val BITS_PER_BYTE = 8
}
