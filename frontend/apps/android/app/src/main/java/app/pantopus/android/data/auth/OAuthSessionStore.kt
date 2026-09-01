@file:Suppress("MagicNumber")

package app.pantopus.android.data.auth

import android.net.Uri
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import java.security.SecureRandom

enum class OAuthProvider(val apiValue: String) {
    Google("google"),
    Apple("apple"),
}

/** One-shot command for the host screen to open Custom Tabs. */
sealed interface OAuthBrowserCommand {
    data class Open(
        val url: String,
    ) : OAuthBrowserCommand
}

/**
 * Process-local handoff between the browser callback (delivered to
 * `MainActivity` as a `pantopus://auth/callback` VIEW intent) and whichever
 * auth ViewModel initiated OAuth. Authorization codes / tokens are never
 * persisted.
 *
 * The entry point is an exported, BROWSABLE intent filter, so any installed
 * app can fire the callback URI. Every attempt therefore carries a
 * cryptographically random `app_nonce` that rides along on `redirectTo` and
 * must come back unchanged; a callback without it (or with the wrong one) is
 * rejected and its code is never exchanged. Mirrors the iOS
 * `AuthManager.signIn(with:)` nonce check 1:1.
 *
 * **Validate before consuming.** An unverifiable callback must never burn the
 * attempt: if it did, one bogus `pantopus://auth/callback` from any installed
 * app would make the user's real browser redirect get dropped, and repeating
 * it would lock the user out of sign-in entirely. So [deliver] only marks the
 * session delivered *after* a constant-time nonce match; anything else is
 * ignored and merely flips [Session.sawUnverifiableCallback], which turns the
 * later [cancelIfAwaiting] into [Callback.Rejected] instead of
 * [Callback.Cancelled]. iOS can surface the same sentence immediately because
 * its callback can only arrive through the one-shot
 * `ASWebAuthenticationSession` continuation — there is no exported entry
 * point to spam.
 */
object OAuthSessionStore {
    /** Query parameter carrying the per-attempt CSRF nonce. */
    const val NONCE_PARAM = "app_nonce"

    /**
     * User-visible copy for a rejected callback. Kept here so both auth
     * ViewModels surface the same sentence iOS's
     * `AuthManager.oauthRejectedMessage` does.
     */
    const val REJECTED_MESSAGE = "Sign-in couldn't be verified. Please try again."

    private const val CALLBACK_URI = "pantopus://auth/callback"

    sealed interface Callback {
        val ownerId: String

        data class Code(
            override val ownerId: String,
            val value: String,
        ) : Callback

        /** Legacy `#access_token&refresh_token` fragment path. */
        data class Tokens(
            override val ownerId: String,
            val accessToken: String,
            val refreshToken: String,
        ) : Callback

        data class Malformed(
            override val ownerId: String,
        ) : Callback

        /**
         * No browser could open the authorization URL. Mirrors iOS
         * `OAuthWebAuthenticationError.unableToStart`, which surfaces as
         * `AuthError.unknown`.
         */
        data class BrowserUnavailable(
            override val ownerId: String,
        ) : Callback

        /**
         * At least one callback arrived that we could not verify (missing /
         * mismatched `app_nonce`, or not our callback shape) and the attempt
         * then ended without a genuine redirect.
         */
        data class Rejected(
            override val ownerId: String,
        ) : Callback

        /** User dismissed Custom Tabs without completing. */
        data class Cancelled(
            override val ownerId: String,
        ) : Callback
    }

    private data class Session(
        val ownerId: String,
        /** Nulled once a *verified* callback lands, so a replay can never match. */
        var nonce: String?,
        var delivered: Boolean = false,
        var claimed: Boolean = false,
        /**
         * An unverifiable callback was seen for this attempt. Recorded rather
         * than surfaced so a hostile app cannot pop an error banner at will;
         * [cancelIfAwaiting] reads it when the attempt actually ends.
         */
        var sawUnverifiableCallback: Boolean = false,
    )

    private var session: Session? = null
    private val _callback = MutableStateFlow<Callback?>(null)
    val callback = _callback.asStateFlow()

    /** Opens an attempt and returns the nonce the caller must send upstream. */
    @Synchronized
    fun begin(ownerId: String): String {
        val nonce = Nonce.generate()
        session = Session(ownerId, nonce)
        _callback.value = null
        return nonce
    }

    /**
     * The `redirectTo` value for `GET /api/users/oauth/:provider`. The backend
     * (`backend/routes/users.js:3715`) only validates the `pantopus:` protocol
     * and passes the URI through to Supabase, so the nonce survives the round
     * trip. Mirrors iOS `AuthEndpoints.oauthURL(provider:nonce:)`.
     */
    fun redirectUri(nonce: String): String = "$CALLBACK_URI?$NONCE_PARAM=$nonce"

    fun isOAuthCallback(uri: Uri): Boolean =
        uri.scheme.equals("pantopus", ignoreCase = true) &&
            uri.host.equals("auth", ignoreCase = true) &&
            uri.path == "/callback"

    /**
     * Hand a browser redirect to the in-flight attempt. Verification runs
     * *before* the session is consumed, so a forged callback costs the user
     * nothing: `delivered` and `nonce` survive untouched and the genuine
     * redirect still lands. Only a nonce match consumes the attempt, which
     * also makes a replay of the matched callback a no-op.
     */
    @Synchronized
    fun deliver(uri: Uri) {
        val current = session ?: return
        if (current.delivered) return
        if (!isVerified(uri, current)) {
            current.sawUnverifiableCallback = true
            return
        }
        current.delivered = true
        current.nonce = null
        _callback.value = CallbackPayload.of(uri, current.ownerId)
    }

    /**
     * True only for our callback shape carrying this attempt's `app_nonce`.
     * Mirrors iOS `AuthManager.isOAuthCallback` + `oauthNonceMatches`.
     */
    private fun isVerified(
        uri: Uri,
        current: Session,
    ): Boolean = isOAuthCallback(uri) && Nonce.matches(current.nonce, uri.getQueryParameter(NONCE_PARAM))

    /**
     * No browser could open the authorization URL (no Custom Tabs provider
     * and no `ACTION_VIEW` handler). Ends the attempt with
     * [Callback.BrowserUnavailable] so the waiting ViewModel surfaces a
     * normal auth error instead of the launch exception escaping the host.
     */
    @Synchronized
    fun failBrowserLaunch(): Boolean {
        val current = session ?: return false
        if (current.delivered) return false
        current.delivered = true
        current.nonce = null
        _callback.value = Callback.BrowserUnavailable(current.ownerId)
        return true
    }

    @Synchronized
    fun claim(
        ownerId: String,
        callback: Callback,
    ): Boolean {
        val current = session ?: return false
        if (current.ownerId != ownerId || callback.ownerId != ownerId || current.claimed) return false
        current.claimed = true
        return true
    }

    /**
     * If the owner is still waiting for a browser callback (user backed out
     * of Custom Tabs), emit [Callback.Cancelled] so the ViewModel waiter
     * unblocks without treating it as an auth error.
     *
     * When an unverifiable callback was seen during the attempt, the ending
     * is [Callback.Rejected] instead — that is where the
     * "[REJECTED_MESSAGE]" copy surfaces on Android, matching what iOS
     * throws inline on a nonce mismatch.
     */
    @Synchronized
    fun cancelIfAwaiting(ownerId: String): Boolean {
        val current = session ?: return false
        if (current.ownerId != ownerId || current.delivered) return false
        current.delivered = true
        current.nonce = null
        _callback.value =
            if (current.sawUnverifiableCallback) {
                Callback.Rejected(ownerId)
            } else {
                Callback.Cancelled(ownerId)
            }
        return true
    }

    @Synchronized
    fun clear(ownerId: String) {
        if (session?.ownerId != ownerId) return
        session = null
        _callback.value = null
    }

    /**
     * Per-attempt CSRF nonce: 256 bits of `SecureRandom`, hex-encoded
     * (URL-safe by construction), compared in constant time. Mirrors iOS
     * `AuthManager.makeOAuthNonce` / `oauthNonceMatches`.
     */
    private object Nonce {
        /** 32 bytes = 256 bits of entropy. */
        private const val BYTES = 32

        private val HEX_DIGITS = "0123456789abcdef".toCharArray()

        private val secureRandom = SecureRandom()

        fun generate(): String {
            val bytes = ByteArray(BYTES)
            secureRandom.nextBytes(bytes)
            val out = StringBuilder(bytes.size * 2)
            for (byte in bytes) {
                val value = byte.toInt() and 0xFF
                out.append(HEX_DIGITS[value ushr 4])
                out.append(HEX_DIGITS[value and 0x0F])
            }
            return out.toString()
        }

        /**
         * `MessageDigest.isEqual` is the platform's constant-time comparison —
         * it never short-circuits on the first differing byte. An absent
         * expected or presented value never matches.
         */
        fun matches(
            expected: String?,
            presented: String?,
        ): Boolean {
            if (expected.isNullOrEmpty() || presented.isNullOrEmpty()) return false
            return MessageDigest.isEqual(
                expected.toByteArray(Charsets.UTF_8),
                presented.toByteArray(Charsets.UTF_8),
            )
        }
    }

    /**
     * Projects a *verified* callback URI into the [Callback] the waiting
     * ViewModel consumes: `?code=` first, then the legacy
     * `#access_token&refresh_token` fragment. Mirrors iOS
     * `AuthManager.exchangeOAuthCallback`.
     */
    private object CallbackPayload {
        fun of(
            uri: Uri,
            ownerId: String,
        ): Callback {
            val code = uri.getQueryParameter("code")
            if (!code.isNullOrBlank()) return Callback.Code(ownerId, code)
            val fragment = uri.fragment.orEmpty()
            val access = fragmentParam(fragment, "access_token")
            val refresh = fragmentParam(fragment, "refresh_token")
            return if (!access.isNullOrBlank() && !refresh.isNullOrBlank()) {
                Callback.Tokens(ownerId, access, refresh)
            } else {
                Callback.Malformed(ownerId)
            }
        }

        private fun fragmentParam(
            fragment: String,
            name: String,
        ): String? {
            if (fragment.isEmpty()) return null
            for (pair in fragment.split('&')) {
                val parts = pair.split('=', limit = 2)
                if (parts.size == 2 && parts[0] == name) {
                    return Uri.decode(parts[1])
                }
            }
            return null
        }
    }
}
