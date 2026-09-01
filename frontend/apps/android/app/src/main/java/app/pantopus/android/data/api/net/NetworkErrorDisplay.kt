package app.pantopus.android.data.api.net

/**
 * P6.8 — mirrors iOS `errorDescription ?? "Couldn't load X."` fallbacks
 * when the server returns a blank message.
 */
fun NetworkError.displayMessage(fallback: String): String {
    return message.takeIf { it.isNotBlank() } ?: fallback
}
