@file:Suppress("PackageNaming")

package app.pantopus.android.data.gigs

import android.content.Context
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Phase 6c — one queued offline gig draft. [form] is the composer's
 * scalar `composeGig2.*` snapshot — the exact encoding the wizard
 * already mirrors into `SavedStateHandle` (module objects stay
 * in-memory there too, so the queue intentionally drops them).
 */
data class GigQueuedDraft(
    val id: String,
    val createdAtEpochMs: Long,
    /** Display label for the feed banner (form title / describe excerpt). */
    val title: String,
    /** `composeGig2.*` key → String / Int / Boolean / List<String>. */
    val form: Map<String, Any?>,
)

/**
 * Phase 6c — offline draft queue behind the composer. A magic-post /
 * classic submit that fails on a connectivity-class error parks the
 * form here; the Gigs feed re-submits (or discards) once back online.
 * Interface so VM unit tests substitute an in-memory fake.
 */
interface GigDraftQueue {
    /** Pending drafts, oldest first. Hot — the feed banner observes it. */
    val drafts: StateFlow<List<GigQueuedDraft>>

    /** Append (or replace by id). Capped at [MAX_DRAFTS], oldest dropped. */
    fun enqueue(draft: GigQueuedDraft)

    /** Drop a draft (posted successfully or discarded by the user). */
    fun remove(id: String)

    companion object {
        const val MAX_DRAFTS: Int = 5
    }
}

/** SharedPreferences-JSON implementation, hydrated once at first read. */
@Singleton
class GigDraftQueueImpl
    @Inject
    constructor(
        @ApplicationContext private val appContext: Context,
    ) : GigDraftQueue {
        private val prefs by lazy {
            appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }

        private val _drafts = MutableStateFlow(load())
        override val drafts: StateFlow<List<GigQueuedDraft>> = _drafts.asStateFlow()

        override fun enqueue(draft: GigQueuedDraft) {
            update { current ->
                (current.filterNot { it.id == draft.id } + draft).takeLast(GigDraftQueue.MAX_DRAFTS)
            }
        }

        override fun remove(id: String) {
            update { current -> current.filterNot { it.id == id } }
        }

        private fun update(transform: (List<GigQueuedDraft>) -> List<GigQueuedDraft>) {
            val next = transform(_drafts.value)
            _drafts.value = next
            persist(next)
        }

        private fun persist(drafts: List<GigQueuedDraft>) {
            runCatching {
                val array = JSONArray()
                drafts.forEach { draft ->
                    array.put(
                        JSONObject()
                            .put(KEY_ID, draft.id)
                            .put(KEY_CREATED_AT, draft.createdAtEpochMs)
                            .put(KEY_TITLE, draft.title)
                            .put(KEY_FORM, encodeForm(draft.form)),
                    )
                }
                prefs.edit().putString(KEY_QUEUE, array.toString()).apply()
            }.onFailure { Timber.w(it, "Failed to persist gig draft queue") }
        }

        private fun load(): List<GigQueuedDraft> {
            val raw = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
            return runCatching {
                val array = JSONArray(raw)
                (0 until array.length()).map { index ->
                    val item = array.getJSONObject(index)
                    GigQueuedDraft(
                        id = item.getString(KEY_ID),
                        createdAtEpochMs = item.getLong(KEY_CREATED_AT),
                        title = item.getString(KEY_TITLE),
                        form = decodeForm(item.getJSONObject(KEY_FORM)),
                    )
                }
            }.onFailure { Timber.w(it, "Failed to read gig draft queue") }.getOrDefault(emptyList())
        }

        /** Nulls are dropped — a missing key restores as null anyway. */
        private fun encodeForm(form: Map<String, Any?>): JSONObject {
            val json = JSONObject()
            form.forEach { (key, value) ->
                when (value) {
                    null -> Unit
                    is List<*> -> json.put(key, JSONArray(value))
                    else -> json.put(key, value)
                }
            }
            return json
        }

        private fun decodeForm(json: JSONObject): Map<String, Any?> {
            val map = mutableMapOf<String, Any?>()
            val keys = json.keys()
            while (keys.hasNext()) {
                val key = keys.next().toString()
                map[key] =
                    when (val value = json.get(key)) {
                        is JSONArray -> ArrayList((0 until value.length()).map { value.getString(it) })
                        else -> value
                    }
            }
            return map
        }

        private companion object {
            const val PREFS_NAME = "gig_draft_queue"
            const val KEY_QUEUE = "drafts_json"
            const val KEY_ID = "id"
            const val KEY_CREATED_AT = "createdAt"
            const val KEY_TITLE = "title"
            const val KEY_FORM = "form"
        }
    }

@Module
@InstallIn(SingletonComponent::class)
abstract class GigDraftQueueModule {
    @Binds
    abstract fun bindGigDraftQueue(impl: GigDraftQueueImpl): GigDraftQueue
}
