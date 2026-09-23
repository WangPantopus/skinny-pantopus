@file:Suppress("MagicNumber")

package app.pantopus.android.data.api.net

/**
 * Result of a network call — either a successful decoded body or a typed
 * [NetworkError]. Call sites switch on this rather than on raw HTTP codes.
 */
sealed interface NetworkResult<out T> {
    /** Successful response with a decoded body. */
    data class Success<T>(
        val data: T,
    ) : NetworkResult<T>

    /** Failure — carries the typed error for the UI to route on. */
    data class Failure(
        val error: NetworkError,
    ) : NetworkResult<Nothing>
}

/** Every failure mode of the Pantopus HTTP client. */
sealed class NetworkError(
    val code: Int?,
    override val message: String,
    override val cause: Throwable? = null,
) : Throwable(message, cause) {
    /** 401 — token missing or expired. Callers should redirect to sign-in. */
    data object Unauthorized : NetworkError(401, "Your session has expired.")

    /**
     * 403 — authenticated but not permitted. [message] is the server's own
     * sentence for the refusal when [body] carried one a person can read
     * (see [readableForbiddenMessage]), else the generic copy. Every 403
     * compares equal, as the old `data object` did, so the bodiless
     * companion `NetworkError.Forbidden` still matches any 403 in a `when`
     * branch, a `throw` or an assertion.
     */
    open class Forbidden(
        val body: String? = null,
    ) : NetworkError(403, readableForbiddenMessage(body) ?: FORBIDDEN_FALLBACK) {
        override fun equals(other: Any?): Boolean = other is Forbidden

        override fun hashCode(): Int = 403

        override fun toString(): String = "Forbidden"

        /** The bodiless 403 that existing call sites name as `NetworkError.Forbidden`. */
        companion object : Forbidden()
    }

    /** 404 — resource not found. */
    data object NotFound : NetworkError(404, "We couldn't find what you were looking for.")

    /** 4xx with server-supplied message. */
    class ClientError(
        code: Int,
        val body: String?,
    ) : NetworkError(code, friendlyClientMessage(body) ?: body ?: "Request failed ($code).") {
        companion object {
            fun friendlyClientMessage(body: String?): String? {
                if (body.isNullOrBlank()) return null
                return runCatching {
                    val json = org.json.JSONObject(body)
                    val details = json.optJSONArray("details")
                    if (details != null) {
                        for (index in 0 until details.length()) {
                            val message = details.optJSONObject(index)?.optString("message").orEmpty()
                            if (message.isNotBlank()) return message
                        }
                    }
                    json.optString("message").takeIf { it.isNotBlank() }
                        ?: json.optString("error").takeIf { it.isNotBlank() }
                }.getOrNull() ?: body
            }
        }
    }

    /** 5xx after retries exhausted. */
    class Server(
        code: Int,
        val body: String?,
    ) : NetworkError(code, "Server error $code. Please try again.")

    /** Network-layer failure (offline, timeout, DNS). */
    class Transport(
        cause: Throwable,
    ) : NetworkError(null, "Can't reach Pantopus. Check your connection.", cause)

    /** Response decoded into an unexpected shape. */
    class Decoding(
        cause: Throwable,
    ) : NetworkError(null, "Received an unexpected response.", cause)

    /** Retry loop exhausted without a 2xx. */
    data object RetriesExhausted :
        NetworkError(null, "The server is having trouble. Please try again.")
}

private const val FORBIDDEN_FALLBACK = "You don't have permission to do that."

private val MACHINE_TOKEN = Regex("[A-Za-z][.][A-Za-z]")

/**
 * The sentence a 403 body gives for the refusal, when it can be shown
 * as-is: the JSON `message` or `error`, four or more words and at most
 * 200 characters, with no machine vocabulary (`STEP_UP_REQUIRED`,
 * `vendors.manage`). Codes and fragments ("blocked", "Access denied",
 * "Not a participant") and non-JSON bodies keep the generic copy.
 * Mirrors iOS `APIError.readableForbiddenMessage`.
 */
internal fun readableForbiddenMessage(body: String?): String? {
    if (body.isNullOrBlank()) return null
    val json = runCatching { org.json.JSONObject(body) }.getOrNull() ?: return null
    return listOf("message", "error")
        .mapNotNull { key -> (json.opt(key) as? String)?.trim() }
        .firstOrNull { text ->
            text.split(Regex("\\s+")).size >= 4 &&
                text.length <= 200 &&
                '_' !in text &&
                !MACHINE_TOKEN.containsMatchIn(text)
        }
}
