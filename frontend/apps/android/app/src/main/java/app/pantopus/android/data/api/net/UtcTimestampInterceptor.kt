package app.pantopus.android.data.api.net

import okhttp3.Interceptor
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.json.JSONArray
import org.json.JSONObject

/**
 * API timestamps arrive as PostgREST writes them, `2026-10-06T08:38:39.429308+00:00`.
 * Android 8 to 13 ship the OpenJDK 8/11 `java.time`, whose `Instant.parse` accepts only a
 * `Z` offset (offsets came in JDK 12), and the app parses API dates with `Instant.parse` in
 * about 150 places. On those versions every such date failed: blank dates, invitations read
 * as expired, postcard and recovery rows treated as malformed, and a few unguarded crashes.
 * `Z` names the same instant as `+00:00`, so newer versions see no difference.
 */
object UtcTimestamps {
    private val IN_JSON = Regex("(\"\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?)\\+00:00\"")
    private val VALUE = Regex("(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?)\\+00:00")

    /** JSON text with every UTC timestamp string written with `Z`. */
    fun normalize(json: String): String {
        if (!json.contains("+00:00\"")) return json
        return IN_JSON.replace(json) { it.groupValues[1] + "Z\"" }
    }

    /** The same for a decoded payload (Socket.IO events), in place. */
    fun normalizeInPlace(json: JSONObject): JSONObject {
        json.keys().asSequence().filterIsInstance<String>().toList().forEach { key ->
            when (val value = json.opt(key)) {
                is String -> utcAsZ(value)?.let { json.put(key, it) }
                is JSONObject -> normalizeInPlace(value)
                is JSONArray -> normalizeInPlace(value)
            }
        }
        return json
    }

    private fun normalizeInPlace(json: JSONArray) {
        for (i in 0 until json.length()) {
            when (val value = json.opt(i)) {
                is String -> utcAsZ(value)?.let { json.put(i, it) }
                is JSONObject -> normalizeInPlace(value)
                is JSONArray -> normalizeInPlace(value)
            }
        }
    }

    private fun utcAsZ(text: String): String? = VALUE.matchEntire(text)?.let { it.groupValues[1] + "Z" }
}

/**
 * Rewrites UTC timestamps in JSON responses with `Z` (see [UtcTimestamps]). Event streams,
 * NDJSON and file downloads pass through untouched.
 */
class UtcTimestampInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        val body = response.body ?: return response
        val type = body.contentType() ?: return response
        val isJson = type.type == "application" && (type.subtype == "json" || type.subtype.endsWith("+json"))
        if (!isJson) return response
        val text = body.string()
        return response
            .newBuilder()
            .removeHeader("Content-Length")
            .body(UtcTimestamps.normalize(text).toResponseBody(type))
            .build()
    }
}
