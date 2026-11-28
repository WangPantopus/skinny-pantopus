package app.pantopus.android.data.pulse

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * PHASE-5 B on Android (with PHASE-6 A2's rail): the new Pulse's filters and its time, kept on this phone for each
 * person, and the time that person last opened the new Pulse here ("New since your last visit"). Nothing of it leaves the
 * phone but the filters a read sends. Only the new Pulse reads or writes it.
 */
@Singleton
class ReinventedFilterStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

        /** The kept choice, as written by [write]; null when nothing is kept for [person]. */
        fun read(person: String): ReinventedKeptFilters? {
            val raw = prefs.getString("filters.$person", null) ?: return null
            val fields =
                raw.split('|').mapNotNull { part ->
                    val at = part.indexOf('=')
                    if (at <= 0) null else part.substring(0, at) to part.substring(at + 1)
                }.toMap()

            fun list(key: String) = fields[key].orEmpty().split(',').filter { it.isNotBlank() }
            return ReinventedKeptFilters(
                kinds = list("kinds"),
                from = fields["from"] ?: "everyone",
                state = list("state"),
                fresh = fields["fresh"] == "1",
                time = fields["time"],
            )
        }

        fun write(
            person: String,
            kept: ReinventedKeptFilters,
        ) {
            val raw =
                listOf(
                    "kinds=" + kept.kinds.joinToString(","),
                    "from=" + kept.from,
                    "state=" + kept.state.joinToString(","),
                    "fresh=" + if (kept.fresh) "1" else "0",
                    "time=" + kept.time.orEmpty(),
                ).joinToString("|")
            prefs.edit().putString("filters.$person", raw).apply()
        }

        /** The last visit kept for [person] (an ISO time), then this visit is kept as the next one. */
        fun visit(
            person: String,
            now: String,
        ): String? {
            val last = prefs.getString("visit.$person", null)
            prefs.edit().putString("visit.$person", now).apply()
            return last
        }

        /** How often [person] turned each kind on in the Filters card here, for its order (most used first). */
        fun uses(person: String): Map<String, Int> =
            prefs.getString("uses.$person", null).orEmpty().split(',').mapNotNull { part ->
                val at = part.indexOf('=')
                if (at <= 0) null else part.substring(0, at) to (part.substring(at + 1).toIntOrNull() ?: 0)
            }.toMap()

        /** [person] turned [kind] on once more. */
        fun used(
            person: String,
            kind: String,
        ) {
            val next = uses(person).toMutableMap().apply { this[kind] = (this[kind] ?: 0) + 1 }
            prefs.edit().putString("uses.$person", next.entries.joinToString(",") { "${it.key}=${it.value}" }).apply()
        }

        private companion object {
            const val FILE = "pantopus_pulse_filters"
        }
    }

/** What is kept: the kinds, who from, the states, "New since your last visit", and the time row's choice. */
data class ReinventedKeptFilters(
    val kinds: List<String>,
    val from: String,
    val state: List<String>,
    val fresh: Boolean,
    val time: String?,
)

/**
 * CONTRACT 10a's fields for one read; null fields are not sent. The list sends [whenTime]; the map does not (its time row
 * is its When).
 */
data class ReinventedFilterQuery(
    val kinds: String? = null,
    val whenTime: String? = null,
    val from: String? = null,
    val state: String? = null,
    val since: String? = null,
    /** CONTRACT 11b, the list only: the posts and Moments without a place follow, under "Without a place". */
    val noPlace: Boolean = false,
)
