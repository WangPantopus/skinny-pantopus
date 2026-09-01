package app.pantopus.android.data.auth

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Builds the `DPoP: <jwt>` proof (RFC 9449 profile pinned by
 * `docs/persistent-login/CONTRACT.md` §Headers):
 *
 * ```
 * header : {"typ":"dpop+jwt","alg":"ES256","jwk":{"kty":"EC","crv":"P-256","x":…,"y":…}}
 * payload: {"jti":"<uuid>","htm":"POST","htu":"<scheme>://<host>[:port]<path>","iat":<unix s>,
 *           "rth":"<b64url sha256(refreshToken)>"}          // only when a refresh token is sent
 * signature: raw r||s (64 bytes) base64url
 * ```
 *
 * `htu` never carries a query string. The server compares it against
 * `PUBLIC_API_BASE_URL + path` (or `<proto>://<host>` derived from the
 * request when that env is unset), so we build it from the same base URL
 * Retrofit uses ([htu]). `iat` is accepted within +/-300 s; `jti` is
 * single-use for 10 min — every proof is minted fresh, never reused across
 * retries (see `TokenAuthenticator`, which re-mints on replay).
 *
 * Pure JVM (no `android.util.Base64`, no `org.json`) so it is unit-testable
 * with a software EC key.
 */
@Singleton
class DPoPProofBuilder
    @Inject
    constructor() {
        private val jsonAdapter: JsonAdapter<Map<String, Any>> =
            Moshi
                .Builder()
                .build()
                .adapter(Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java))

        /**
         * Mint a proof for `htm htu` signed by [key].
         *
         * @param refreshToken when non-null, `rth = base64url(sha256(refreshToken))`
         *   is added — REQUIRED on `/api/users/refresh` and `/api/users/logout`
         *   whenever a refresh token travels in the body.
         * @param nowSeconds / [jti] injectable for deterministic tests.
         */
        fun build(
            key: DeviceSigningKey,
            htm: String,
            htu: String,
            refreshToken: String? = null,
            nowSeconds: Long = System.currentTimeMillis() / MILLIS_PER_SECOND,
            jti: String = UUID.randomUUID().toString(),
        ): String {
            val header =
                linkedMapOf<String, Any>(
                    "typ" to TYP,
                    "alg" to ALG,
                    "jwk" to key.jwk,
                )
            val payload =
                linkedMapOf<String, Any>(
                    "jti" to jti,
                    "htm" to htm.uppercase(),
                    "htu" to htu,
                    "iat" to nowSeconds,
                )
            if (refreshToken != null) payload["rth"] = refreshTokenHash(refreshToken)
            val signingInput =
                EcKeyCodec.base64Url(jsonAdapter.toJson(header).toByteArray(Charsets.UTF_8)) +
                    "." +
                    EcKeyCodec.base64Url(jsonAdapter.toJson(payload).toByteArray(Charsets.UTF_8))
            val signature = key.sign(signingInput.toByteArray(Charsets.US_ASCII))
            return signingInput + "." + EcKeyCodec.base64Url(signature)
        }

        companion object {
            const val TYP = "dpop+jwt"
            const val ALG = "ES256"
            private const val MILLIS_PER_SECOND = 1000L

            /** `base64url(sha256(refreshToken))` — the `rth` claim. */
            fun refreshTokenHash(refreshToken: String): String =
                EcKeyCodec.base64Url(EcKeyCodec.sha256(refreshToken.toByteArray(Charsets.UTF_8)))

            /**
             * `<scheme>://<host>[:port]<path>` for [path] under [baseUrl], with
             * any query / fragment dropped and the default port elided — the
             * exact form the backend reconstructs. [path] may be given with
             * or without a leading slash (Retrofit-style relative paths).
             */
            fun htu(
                baseUrl: String,
                path: String,
            ): String {
                val base: HttpUrl =
                    requireNotNull((baseUrl.trimEnd('/') + "/").toHttpUrlOrNull()) { "Invalid API base URL: $baseUrl" }
                val cleanPath = "/" + path.substringBefore('?').substringBefore('#').trimStart('/')
                return htu(base.newBuilder().encodedPath(cleanPath).query(null).fragment(null).build())
            }

            /** [htu] for an already-resolved request URL (query + fragment dropped). */
            fun htu(url: HttpUrl): String {
                val port = if (url.port == HttpUrl.defaultPort(url.scheme)) "" else ":${url.port}"
                return "${url.scheme}://${url.host}$port${url.encodedPath}"
            }
        }
    }
