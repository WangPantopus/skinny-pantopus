package app.pantopus.android.data.store

import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult

/**
 * One store entry's address (Instant Screens contract §6): method, path and sorted query. The store adds the server
 * and the signed-in account. [T] is the reply type; [kind] picks the freshness windows and tier; [topics] are the
 * change topics (contract §8) that mark the entry out of date. Tokens never appear in a key.
 */
class StoreKey<T : Any>(
    val path: String,
    query: Map<String, String?> = emptyMap(),
    val kind: StoreKind,
    val topics: Set<String> = emptySet(),
) {
    val id: String =
        buildString {
            append("GET ").append(path)
            val sorted = query.filterValues { it != null }.toSortedMap()
            if (sorted.isNotEmpty()) append('?').append(sorted.entries.joinToString("&") { "${it.key}=${it.value}" })
        }

    /** True when [topic] (contract §8) marks this entry out of date; a key topic `name:*` takes any `name:…`. */
    fun matches(topic: String): Boolean = topics.any { it == topic || (it.endsWith(":*") && topic.startsWith(it.dropLast(1))) }

    override fun equals(other: Any?): Boolean = other is StoreKey<*> && other.id == id

    override fun hashCode(): Int = id.hashCode()

    override fun toString(): String = id
}

/** What a screen sees for one key (contract §3 and §6). */
data class Stored<out T : Any>(
    /** The copy to show; null when there is nothing to show yet (the only time a screen waits). */
    val data: T? = null,
    /** When this copy arrived or a 304 last confirmed it (wall clock); 0 without data. */
    val fetchedAt: Long = 0L,
    /** A read is running. Background reads never blank the screen; only a pull shows the pull indicator. */
    val refreshing: Boolean = false,
    /** The last read failed; [data], when present, is still the previous copy. */
    val failure: NetworkError? = null,
) {
    /** Inside [kind]'s "fresh for" window: coming back sends no request. */
    fun isFresh(
        kind: StoreKind,
        now: Long = System.currentTimeMillis(),
    ): Boolean = data != null && now - fetchedAt in 0 until kind.freshForMs

    /** A failed read on a copy older than [kind]'s max shown age: show "Couldn't refresh. Showing 3:42 PM." */
    fun showsRefreshFailure(
        kind: StoreKind,
        now: Long = System.currentTimeMillis(),
    ): Boolean = data != null && failure != null && now - fetchedAt > kind.maxShownAgeMs
}

/**
 * A forced read as a [NetworkResult], for callers written before the store: the reply when the read succeeded (a 304
 * counts), else its failure. A read dropped by a wipe or an account switch (no data, no failure) fails as transport.
 */
fun <T : Any> Stored<T>.asResult(): NetworkResult<T> =
    when {
        failure != null -> NetworkResult.Failure(failure)
        data != null -> NetworkResult.Success(data)
        else -> NetworkResult.Failure(NetworkError.Transport(IllegalStateException("The read was dropped")))
    }
