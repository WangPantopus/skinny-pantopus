@file:Suppress("PackageNaming")

package app.pantopus.android.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import app.pantopus.android.MainActivity
import app.pantopus.android.R
import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.data.widget.TodayWidgetSnapshot
import app.pantopus.android.data.widget.TodayWidgetStore
import app.pantopus.android.ui.screens.place.detail.SkyAir
import app.pantopus.android.ui.screens.place.detail.SkyDetails
import app.pantopus.android.ui.screens.place.detail.SkyMoment
import app.pantopus.android.ui.screens.place.detail.SkyNote
import app.pantopus.android.ui.screens.place.detail.SkySeason
import app.pantopus.android.ui.screens.place.detail.TodaySkyPainter
import dagger.hilt.android.AndroidEntryPoint
import java.time.ZonedDateTime
import javax.inject.Inject
import kotlin.math.roundToInt

/**
 * "Today at your address": the Now card's living sky over the house (the app's own painter, drawn
 * still into a bitmap) with the temperature and the one thing worth knowing ([TodayWidgetLine]),
 * from the snapshot the Today tab writes after each load ([TodayWidgetStore]). The 30-minute
 * update moves the sky through the day and turns "tomorrow" into "bins out tonight" after 5 pm.
 * A tap opens Today (`pantopus://today?src=widget`). Classic RemoteViews, like "Tasks near me".
 * Parity twin of iOS `TodayWidget.swift`.
 */
@AndroidEntryPoint
class TodayWidgetProvider : AppWidgetProvider() {
    @Inject
    lateinit var store: TodayWidgetStore

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val snapshot = store.read()?.takeIf { !it.isStale() }
        appWidgetIds.forEach { id ->
            appWidgetManager.updateAppWidget(id, render(context, appWidgetManager.getAppWidgetOptions(id), snapshot))
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        val snapshot = store.read()?.takeIf { !it.isStale() }
        appWidgetManager.updateAppWidget(appWidgetId, render(context, newOptions, snapshot))
    }

    private fun render(
        context: Context,
        options: Bundle,
        snapshot: TodayWidgetSnapshot?,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_today)
        val now = ZonedDateTime.now()
        // Portrait size: the narrowest width and the tallest height the launcher gives it.
        val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, DEFAULT_WIDTH_DP).coerceIn(MIN_DP, MAX_DP)
        val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, DEFAULT_HEIGHT_DP).coerceIn(MIN_DP, MAX_DP)
        views.setImageViewBitmap(R.id.todayWidgetSky, sky(context, snapshot, now, widthDp, heightDp))
        val small = widthDp < SMALL_WIDTH_DP
        if (snapshot == null) {
            val open = context.getString(R.string.widget_today_open)
            bindText(views, context.getString(R.string.widget_today_title), open, null, null)
            views.setContentDescription(R.id.todayWidgetRoot, open)
        } else {
            val line = TodayWidgetLine.pick(snapshot, now)
            val temperature = snapshot.weather?.let { "${it.tempF.roundToInt()}°" }
            bindText(views, line.headline, line.caption, temperature, snapshot.placeLabel.takeIf { !small })
            val spoken = listOfNotNull(line.headline, line.caption, snapshot.weather?.let { "$temperature, ${it.label}" })
            views.setContentDescription(R.id.todayWidgetRoot, spoken.joinToString(". "))
        }
        views.setOnClickPendingIntent(R.id.todayWidgetRoot, openToday(context))
        return views
    }

    private fun bindText(
        views: RemoteViews,
        headline: String,
        caption: String?,
        temperature: String?,
        place: String?,
    ) {
        views.setTextViewText(R.id.todayWidgetHeadline, headline)
        listOf(R.id.todayWidgetCaption to caption, R.id.todayWidgetTemp to temperature, R.id.todayWidgetPlace to place)
            .forEach { (id, text) ->
                views.setViewVisibility(id, if (text == null) View.GONE else View.VISIBLE)
                if (text != null) views.setTextViewText(id, text)
            }
    }

    /** The living sky at [now], drawn by the app's painter into a bitmap the widget's size. */
    private fun sky(
        context: Context,
        snapshot: TodayWidgetSnapshot?,
        now: ZonedDateTime,
        widthDp: Int,
        heightDp: Int,
    ): Bitmap {
        val density = context.resources.displayMetrics.density
        val width = (widthDp * density).roundToInt()
        val height = (heightDp * density).roundToInt()
        val radius =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.resources.getDimension(android.R.dimen.system_app_widget_background_radius)
            } else {
                FALLBACK_RADIUS_DP * density
            }
        val moment = SkyMoment.at(now, snapshot?.sun?.sunrise, snapshot?.sun?.sunset)
        val pickups =
            snapshot?.dates.orEmpty().map { PlaceCalendarEvent(kind = it.kind, title = it.title, date = it.date, scope = it.scope) }
        val condition = WeatherConditionCode.entries.firstOrNull { it.name.lowercase() == snapshot?.weather?.condition }
        val painter =
            TodaySkyPainter(
                condition = condition ?: WeatherConditionCode.CLEAR,
                moment = moment,
                temperature = snapshot?.weather?.tempF ?: MILD_F,
                note = SkyNote.bins(now, moment, pickups),
                season = SkySeason.at(now.toLocalDate()),
                still = true,
                details =
                    SkyDetails(
                        meteorShower = SkyNote.meteors(now, moment) != null,
                        smoke = snapshot?.air?.let { SkyAir(it.aqi, it.label, it.smoky == true).smoke } ?: 0.0,
                        windMph = snapshot?.weather?.windMph,
                        windFrom = snapshot?.weather?.windDirection,
                    ),
            )
        val bitmap = ImageBitmap(width, height)
        CanvasDrawScope().draw(Density(density), LayoutDirection.Ltr, Canvas(bitmap), Size(width.toFloat(), height.toFloat())) {
            val outline = Path().apply { addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(radius))) }
            clipPath(outline) {
                withTransform({ scale(density, density, pivot = Offset.Zero) }) {
                    painter.paint(this, widthDp.toFloat(), heightDp.toFloat(), 0.0)
                }
            }
        }
        return bitmap.asAndroidBitmap()
    }

    private fun openToday(context: Context): PendingIntent {
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                action = Intent.ACTION_VIEW
                data = Uri.parse("pantopus://today?src=widget")
            }
        return PendingIntent.getActivity(
            context,
            OPEN_TODAY_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private companion object {
        const val OPEN_TODAY_REQUEST_CODE = 7
        const val DEFAULT_WIDTH_DP = 276
        const val DEFAULT_HEIGHT_DP = 140
        const val MIN_DP = 100
        const val MAX_DP = 600
        const val SMALL_WIDTH_DP = 200
        const val FALLBACK_RADIUS_DP = 16f

        /** No weather in the snapshot: a mild day, so no frost or chimney smoke. */
        const val MILD_F = 60.0
    }
}
