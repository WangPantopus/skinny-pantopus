@file:Suppress("PackageNaming")

package app.pantopus.android.data.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import app.pantopus.android.widget.TodayWidgetProvider
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
 * What the Today tab last showed for the person's own place; the "Today at your address" widget
 * draws its sky and one line from it and never fetches. Parity twin of iOS `TodayWidgetSnapshot`.
 */
data class TodayWidgetSnapshot(
    val savedAtEpochMs: Long,
    /** The street, never the house number ("Larkspur Loop"): the widget sits on a home screen anyone can see. */
    val placeLabel: String,
    val weather: Weather?,
    val sun: Sun?,
    val air: Air?,
    /** The next two weeks' dates at this address, as the Today tab showed them. */
    val dates: List<DateItem>,
) {
    data class Weather(
        val tempF: Double,
        /** The contract's condition code ("partly_cloudy"). */
        val condition: String,
        val label: String,
        val highF: Double?,
        val lowF: Double?,
        /** Sustained wind, mph, and where it blows from ("SW"), so the widget's trees lean too; null in older snapshots. */
        val windMph: Double? = null,
        val windDirection: String? = null,
    )

    /** Local wall-clock times, as the place-intelligence contract sends them. */
    data class Sun(
        val sunrise: String?,
        val sunset: String?,
    )

    data class Air(
        val aqi: Int,
        val label: String,
        val source: String?,
        /** Fine particles lead it (in the Northwest, wildfire smoke); null in older snapshots. */
        val smoky: Boolean? = null,
    )

    data class DateItem(
        val kind: String,
        val title: String,
        /** YYYY-MM-DD, the home's local date. */
        val date: String,
        /** "home" for what the household set itself. */
        val scope: String,
    )

    /** Older than six hours, the widget asks to open the app instead. */
    fun isStale(nowEpochMs: Long = System.currentTimeMillis()): Boolean = nowEpochMs - savedAtEpochMs > STALE_AFTER_MS

    companion object {
        const val STALE_AFTER_MS: Long = 6L * 60 * 60 * 1000
        const val MAX_DATES: Int = 20

        /** "12 Larkspur Loop" → "Larkspur Loop": the street without the number. */
        fun streetOnly(line: String): String {
            val words = line.trim().split(" ").filter { it.isNotEmpty() }
            return if (words.size > 1 && words.first().first().isDigit()) words.drop(1).joinToString(" ") else line.trim()
        }
    }
}

/** App-side store for the Today widget, written by the Today tab after each load. */
interface TodayWidgetStore {
    fun write(snapshot: TodayWidgetSnapshot)

    fun read(): TodayWidgetSnapshot?
}

/** SharedPreferences JSON; after each write the placed widgets re-render at once. */
@Singleton
class TodayWidgetStoreImpl
    @Inject
    constructor(
        @ApplicationContext private val appContext: Context,
    ) : TodayWidgetStore {
        private val prefs by lazy { appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

        override fun write(snapshot: TodayWidgetSnapshot) {
            runCatching {
                prefs.edit().putString(KEY_SNAPSHOT, encode(snapshot).toString()).apply()
                requestWidgetUpdate()
            }.onFailure { Timber.w(it, "Failed to write the Today widget snapshot") }
        }

        override fun read(): TodayWidgetSnapshot? {
            val raw = prefs.getString(KEY_SNAPSHOT, null) ?: return null
            return runCatching { decode(JSONObject(raw)) }
                .onFailure { Timber.w(it, "Failed to read the Today widget snapshot") }
                .getOrNull()
        }

        private fun encode(snapshot: TodayWidgetSnapshot): JSONObject =
            JSONObject()
                .put("saved_at", snapshot.savedAtEpochMs)
                .put("place", snapshot.placeLabel)
                .put(
                    "weather",
                    snapshot.weather?.let {
                        JSONObject()
                            .put("temp_f", it.tempF)
                            .put("condition", it.condition)
                            .put("label", it.label)
                            .put("high_f", it.highF ?: JSONObject.NULL)
                            .put("low_f", it.lowF ?: JSONObject.NULL)
                            .put("wind_mph", it.windMph ?: JSONObject.NULL)
                            .put("wind_direction", it.windDirection ?: JSONObject.NULL)
                    } ?: JSONObject.NULL,
                ).put(
                    "sun",
                    snapshot.sun?.let {
                        JSONObject().put("sunrise", it.sunrise ?: JSONObject.NULL).put("sunset", it.sunset ?: JSONObject.NULL)
                    } ?: JSONObject.NULL,
                ).put(
                    "air",
                    snapshot.air?.let {
                        JSONObject()
                            .put("aqi", it.aqi)
                            .put("label", it.label)
                            .put("source", it.source ?: JSONObject.NULL)
                            .put("smoky", it.smoky ?: JSONObject.NULL)
                    } ?: JSONObject.NULL,
                ).put(
                    "dates",
                    JSONArray().also { array ->
                        snapshot.dates.take(TodayWidgetSnapshot.MAX_DATES).forEach {
                            array.put(JSONObject().put("kind", it.kind).put("title", it.title).put("date", it.date).put("scope", it.scope))
                        }
                    },
                )

        private fun decode(json: JSONObject): TodayWidgetSnapshot {
            val dates = json.optJSONArray("dates") ?: JSONArray()
            return TodayWidgetSnapshot(
                savedAtEpochMs = json.getLong("saved_at"),
                placeLabel = json.getString("place"),
                weather =
                    json.optJSONObject("weather")?.let {
                        TodayWidgetSnapshot.Weather(
                            tempF = it.getDouble("temp_f"),
                            condition = it.getString("condition"),
                            label = it.getString("label"),
                            highF = it.optDoubleOrNull("high_f"),
                            lowF = it.optDoubleOrNull("low_f"),
                            windMph = it.optDoubleOrNull("wind_mph"),
                            windDirection = it.optStringOrNull("wind_direction"),
                        )
                    },
                sun =
                    json.optJSONObject("sun")?.let {
                        TodayWidgetSnapshot.Sun(it.optStringOrNull("sunrise"), it.optStringOrNull("sunset"))
                    },
                air =
                    json.optJSONObject("air")?.let {
                        TodayWidgetSnapshot.Air(
                            it.getInt("aqi"),
                            it.getString("label"),
                            it.optStringOrNull("source"),
                            if (it.isNull("smoky")) null else it.optBoolean("smoky"),
                        )
                    },
                dates =
                    (0 until dates.length()).map { index ->
                        val item = dates.getJSONObject(index)
                        TodayWidgetSnapshot.DateItem(
                            item.getString("kind"),
                            item.getString("title"),
                            item.getString("date"),
                            item.getString("scope"),
                        )
                    },
            )
        }

        private fun JSONObject.optDoubleOrNull(key: String): Double? = if (isNull(key)) null else optDouble(key).takeIf { !it.isNaN() }

        private fun JSONObject.optStringOrNull(key: String): String? = if (isNull(key)) null else optString(key)

        private fun requestWidgetUpdate() {
            val manager = AppWidgetManager.getInstance(appContext) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(appContext, TodayWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val intent =
                Intent(appContext, TodayWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
            appContext.sendBroadcast(intent)
        }

        private companion object {
            const val PREFS_NAME = "today_widget"
            const val KEY_SNAPSHOT = "snapshot_json"
        }
    }

@Module
@InstallIn(SingletonComponent::class)
abstract class TodayWidgetStoreModule {
    @Binds
    abstract fun bindTodayWidgetStore(impl: TodayWidgetStoreImpl): TodayWidgetStore
}
