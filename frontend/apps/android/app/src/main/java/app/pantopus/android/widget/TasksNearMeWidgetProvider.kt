@file:Suppress("PackageNaming")

package app.pantopus.android.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import androidx.compose.ui.graphics.toArgb
import app.pantopus.android.MainActivity
import app.pantopus.android.R
import app.pantopus.android.data.widget.WidgetSnapshotData
import app.pantopus.android.data.widget.WidgetSnapshotStore
import app.pantopus.android.data.widget.WidgetTaskSnapshot
import app.pantopus.android.ui.screens.gigs.GigsCategory
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Phase 6c — "Tasks near me" home-screen AppWidget (classic RemoteViews;
 * the project carries no Glance dependency). Renders the header count +
 * up to [ROW_IDS.size] rows from the [WidgetSnapshotStore] payload that
 * [app.pantopus.android.ui.screens.gigs.GigsFeedViewModel] refreshes
 * after every successful feed fetch.
 *
 * Row taps deep-link `pantopus://gigs/<id>` — the same scheme the Phase
 * 6b ongoing notification rides into MainActivity's `ACTION_VIEW`
 * handler. Empty or stale (> 6 h) snapshots render the "Open Pantopus to
 * see tasks near you" frame, which opens the app shell.
 */
@AndroidEntryPoint
class TasksNearMeWidgetProvider : AppWidgetProvider() {
    @Inject
    lateinit var snapshotStore: WidgetSnapshotStore

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val snapshot = snapshotStore.read()
        appWidgetIds.forEach { id ->
            appWidgetManager.updateAppWidget(id, buildViews(context, snapshot))
        }
    }

    private fun buildViews(
        context: Context,
        snapshot: WidgetSnapshotData?,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_tasks_near_me)
        val tasks = snapshot?.takeIf { !it.isStale() }?.tasks.orEmpty()
        if (tasks.isEmpty()) {
            renderEmpty(context, views)
        } else {
            renderTasks(context, views, tasks)
        }
        return views
    }

    private fun renderEmpty(
        context: Context,
        views: RemoteViews,
    ) {
        views.setTextViewText(R.id.widgetHeader, context.getString(R.string.widget_tasks_near_me_title))
        views.setViewVisibility(R.id.widgetEmpty, View.VISIBLE)
        ROW_IDS.forEach { (row, _) -> views.setViewVisibility(row, View.GONE) }
        views.setOnClickPendingIntent(R.id.widgetRoot, openAppIntent(context))
    }

    private fun renderTasks(
        context: Context,
        views: RemoteViews,
        tasks: List<WidgetTaskSnapshot>,
    ) {
        views.setTextViewText(
            R.id.widgetHeader,
            context.resources.getQuantityString(R.plurals.widget_tasks_nearby, tasks.size, tasks.size),
        )
        views.setViewVisibility(R.id.widgetEmpty, View.GONE)
        views.setOnClickPendingIntent(R.id.widgetRoot, openAppIntent(context))
        ROW_IDS.forEachIndexed { index, ids ->
            val task = tasks.getOrNull(index)
            if (task == null) {
                views.setViewVisibility(ids.row, View.GONE)
            } else {
                bindRow(context, views, ids, task)
            }
        }
    }

    private fun bindRow(
        context: Context,
        views: RemoteViews,
        ids: RowIds,
        task: WidgetTaskSnapshot,
    ) {
        views.setViewVisibility(ids.row, View.VISIBLE)
        views.setTextViewText(ids.title, task.title)
        views.setTextViewText(ids.meta, listOfNotNull(task.price, task.distance).joinToString(" · "))
        views.setInt(ids.dot, "setColorFilter", GigsCategory.fromBackendKey(task.categoryKey).color.toArgb())
        views.setOnClickPendingIntent(ids.row, openGigIntent(context, task.id))
    }

    /** Row tap → `pantopus://gigs/<id>` into MainActivity (Phase 6b scheme). */
    private fun openGigIntent(
        context: Context,
        gigId: String,
    ): PendingIntent {
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                action = Intent.ACTION_VIEW
                data = Uri.parse("pantopus://gigs/$gigId")
            }
        return PendingIntent.getActivity(
            context,
            gigId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** Empty / chrome tap → plain app launch. */
    private fun openAppIntent(context: Context): PendingIntent {
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        return PendingIntent.getActivity(
            context,
            OPEN_APP_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private data class RowIds(
        val row: Int,
        val dot: Int,
        val title: Int,
        val meta: Int,
    )

    private companion object {
        const val OPEN_APP_REQUEST_CODE = 0

        /** The fixed three-row layout — RemoteViews-safe, no ListView. */
        val ROW_IDS =
            listOf(
                RowIds(R.id.widgetRow1, R.id.widgetRow1Dot, R.id.widgetRow1Title, R.id.widgetRow1Meta),
                RowIds(R.id.widgetRow2, R.id.widgetRow2Dot, R.id.widgetRow2Title, R.id.widgetRow2Meta),
                RowIds(R.id.widgetRow3, R.id.widgetRow3Dot, R.id.widgetRow3Title, R.id.widgetRow3Meta),
            )
    }
}
