@file:Suppress("PackageNaming")

package app.pantopus.android.data.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import app.pantopus.android.widget.TasksNearMeWidgetProvider
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import org.json.JSONArray
import org.json.JSONObject
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Phase 6c — one row of the "Tasks near me" home-screen widget. Display
 * strings are pre-formatted by the feed projection so the widget renders
 * with zero logic of its own.
 */
data class WidgetTaskSnapshot(
    val id: String,
    val title: String,
    /** "$60" / "$35 / hr" — same label the feed card shows. */
    val price: String,
    /** "0.2mi", or null when the row carried no distance. */
    val distance: String?,
    /** Backend category key — tints the widget row dot. */
    val categoryKey: String,
)

/** Persisted widget payload: rows + the write timestamp for staleness. */
data class WidgetSnapshotData(
    val tasks: List<WidgetTaskSnapshot>,
    val savedAtEpochMs: Long,
) {
    /** Snapshots older than 6 h render the "Open Pantopus" empty frame. */
    fun isStale(nowEpochMs: Long = System.currentTimeMillis()): Boolean = nowEpochMs - savedAtEpochMs > STALE_AFTER_MS

    companion object {
        const val STALE_AFTER_MS: Long = 6L * 60 * 60 * 1000
    }
}

/**
 * Phase 6c — app-side store the "Tasks near me" widget reads. Written by
 * [app.pantopus.android.ui.screens.gigs.GigsFeedViewModel] after every
 * successful feed fetch. Interface so VM unit tests substitute a fake.
 */
interface WidgetSnapshotStore {
    /** Persist the rows (capped at [MAX_TASKS]) + notify the widget. */
    fun write(tasks: List<WidgetTaskSnapshot>)

    /** Last written payload, or null when nothing was ever stored. */
    fun read(): WidgetSnapshotData?

    companion object {
        const val MAX_TASKS: Int = 10
    }
}

/**
 * SharedPreferences-JSON implementation. After each write it broadcasts
 * `ACTION_APPWIDGET_UPDATE` to [TasksNearMeWidgetProvider] so placed
 * widgets re-render without waiting for the periodic update.
 */
@Singleton
class WidgetSnapshotStoreImpl
    @Inject
    constructor(
        @ApplicationContext private val appContext: Context,
    ) : WidgetSnapshotStore {
        private val prefs by lazy {
            appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }

        override fun write(tasks: List<WidgetTaskSnapshot>) {
            runCatching {
                val payload =
                    JSONObject()
                        .put(KEY_SAVED_AT, System.currentTimeMillis())
                        .put(
                            KEY_TASKS,
                            JSONArray().also { array ->
                                tasks.take(WidgetSnapshotStore.MAX_TASKS).forEach { task ->
                                    array.put(
                                        JSONObject()
                                            .put(KEY_ID, task.id)
                                            .put(KEY_TITLE, task.title)
                                            .put(KEY_PRICE, task.price)
                                            .put(KEY_DISTANCE, task.distance ?: JSONObject.NULL)
                                            .put(KEY_CATEGORY, task.categoryKey),
                                    )
                                }
                            },
                        )
                prefs.edit().putString(KEY_SNAPSHOT, payload.toString()).apply()
                requestWidgetUpdate()
            }.onFailure { Timber.w(it, "Failed to write widget snapshot") }
        }

        override fun read(): WidgetSnapshotData? {
            val raw = prefs.getString(KEY_SNAPSHOT, null) ?: return null
            return runCatching {
                val payload = JSONObject(raw)
                val rows = payload.getJSONArray(KEY_TASKS)
                WidgetSnapshotData(
                    savedAtEpochMs = payload.getLong(KEY_SAVED_AT),
                    tasks =
                        (0 until rows.length()).map { index ->
                            val row = rows.getJSONObject(index)
                            WidgetTaskSnapshot(
                                id = row.getString(KEY_ID),
                                title = row.getString(KEY_TITLE),
                                price = row.getString(KEY_PRICE),
                                distance = row.optString(KEY_DISTANCE).takeIf { it.isNotEmpty() && !row.isNull(KEY_DISTANCE) },
                                categoryKey = row.getString(KEY_CATEGORY),
                            )
                        },
                )
            }.onFailure { Timber.w(it, "Failed to read widget snapshot") }.getOrNull()
        }

        /** Standard self-broadcast so every placed widget re-renders now. */
        private fun requestWidgetUpdate() {
            val manager = AppWidgetManager.getInstance(appContext) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(appContext, TasksNearMeWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val intent =
                Intent(appContext, TasksNearMeWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
            appContext.sendBroadcast(intent)
        }

        private companion object {
            const val PREFS_NAME = "tasks_near_me_widget"
            const val KEY_SNAPSHOT = "snapshot_json"
            const val KEY_SAVED_AT = "saved_at"
            const val KEY_TASKS = "tasks"
            const val KEY_ID = "id"
            const val KEY_TITLE = "title"
            const val KEY_PRICE = "price"
            const val KEY_DISTANCE = "distance"
            const val KEY_CATEGORY = "categoryKey"
        }
    }

@Module
@InstallIn(SingletonComponent::class)
abstract class WidgetSnapshotStoreModule {
    @Binds
    abstract fun bindWidgetSnapshotStore(impl: WidgetSnapshotStoreImpl): WidgetSnapshotStore
}
