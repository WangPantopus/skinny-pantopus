@file:Suppress("PackageNaming")

package app.pantopus.android.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import app.pantopus.android.MainActivity
import app.pantopus.android.R
import dagger.hilt.android.AndroidEntryPoint
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * "Pulse, reinvented" phase 3 (PHASE-3 piece 9, CONTRACT 8j; iPhone's `PostcardWidget.swift`): the newest postcard in
 * the Mail tab ("A postcard from Dana", the day, the enclosed picture). A tap opens the letter. The widget fetches
 * nothing: it draws the snapshot [PostcardWidgetStore] keeps, which the app writes ([PostcardWidgetSync]) only while
 * the switch is on and a postcard widget is placed. Its receiver is off in the manifest and turned on only while the
 * switch is on, so with the switch off the widget list is today's; one placed before shows a plain "Open Pantopus".
 */
@AndroidEntryPoint
class PostcardWidgetProvider : AppWidgetProvider() {
    @Inject
    lateinit var store: PostcardWidgetStore

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val views = render(context, store.read(), store.on())
        appWidgetIds.forEach { appWidgetManager.updateAppWidget(it, views) }
    }

    private fun render(
        context: Context,
        snapshot: PostcardWidgetSnapshot?,
        on: Boolean,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_postcard)
        val kept = snapshot?.picture?.takeUnless { snapshot.hidden }?.let { File(it) }?.takeIf { it.exists() }
        val picture = kept?.let { BitmapFactory.decodeFile(it.path) }
        if (picture != null) {
            views.setImageViewBitmap(R.id.postcardWidgetPicture, picture)
            views.setViewVisibility(R.id.postcardWidgetPicture, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.postcardWidgetPicture, View.GONE)
        }
        val line =
            when {
                !on -> context.getString(R.string.widget_postcard_open)
                snapshot == null -> context.getString(R.string.widget_postcard_empty)
                // The app lock is on: only that one is waiting (no name, no day, no picture).
                snapshot.hidden -> context.getString(R.string.widget_postcard_waiting)
                else -> listOf(snapshot.title, snapshot.day).filter { it.isNotBlank() }.joinToString(" · ")
            }
        views.setTextViewText(R.id.postcardWidgetLine, line)
        views.setContentDescription(R.id.postcardWidgetRoot, line)
        val target = snapshot?.mailId?.takeIf { on }?.let { "pantopus://mailbox/$it" } ?: "pantopus://mailbox"
        views.setOnClickPendingIntent(R.id.postcardWidgetRoot, open(context, if (on) target else "pantopus://today"))
        return views
    }

    private fun open(
        context: Context,
        link: String,
    ): PendingIntent {
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                action = Intent.ACTION_VIEW
                data = Uri.parse(link)
            }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(context, OPEN_REQUEST_CODE, intent, flags)
    }

    companion object {
        private const val OPEN_REQUEST_CODE = 8

        fun component(context: Context): ComponentName = ComponentName(context, PostcardWidgetProvider::class.java)

        /** Redraws every placed postcard widget from the snapshot. */
        fun redraw(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(component(context))
            if (ids.isEmpty()) return
            context.sendBroadcast(
                Intent(context, PostcardWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                },
            )
        }
    }
}

/**
 * What the widget draws: the letter, its words, and a small copy of its picture on the phone, for [owner] only. [hidden]:
 * the app lock is on, so nothing but "A postcard is waiting" is kept or drawn.
 */
data class PostcardWidgetSnapshot(
    val mailId: String,
    val title: String,
    val day: String,
    val picture: String?,
    val owner: String,
    val hidden: Boolean = false,
)

/** The snapshot, kept in the app's own files only while the switch is on; [clear] removes it all. */
@Singleton
class PostcardWidgetStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        private val prefs get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        val pictureFile: File get() = File(context.filesDir, "widget-postcard.jpg")

        fun on(): Boolean = prefs.getBoolean(ON, false)

        fun setOn(on: Boolean) = prefs.edit().putBoolean(ON, on).apply()

        fun read(): PostcardWidgetSnapshot? {
            val id = prefs.getString(MAIL, null) ?: return null
            val title = prefs.getString(TITLE, "").orEmpty()
            return PostcardWidgetSnapshot(
                id,
                title,
                prefs.getString(DAY, "").orEmpty(),
                prefs.getString(PICTURE, null),
                prefs.getString(OWNER, "").orEmpty(),
                prefs.getBoolean(HIDDEN, false),
            )
        }

        fun write(snapshot: PostcardWidgetSnapshot) =
            prefs.edit()
                .putString(MAIL, snapshot.mailId)
                .putString(TITLE, snapshot.title)
                .putString(DAY, snapshot.day)
                .putString(PICTURE, snapshot.picture)
                .putString(OWNER, snapshot.owner)
                .putBoolean(HIDDEN, snapshot.hidden)
                .apply()

        /** Off, signed out or another account: nothing of a letter stays on the phone. */
        fun clear() {
            prefs.edit().clear().apply()
            pictureFile.delete()
        }

        /** Another account or the app lock turned on: the letter and its picture go; whether the widget is on stays. */
        fun clearLetter() {
            prefs.edit().remove(MAIL).remove(TITLE).remove(DAY).remove(PICTURE).remove(OWNER).remove(HIDDEN).apply()
            pictureFile.delete()
        }

        private companion object {
            const val PREFS = "pulse_postcard_widget"
            const val ON = "on"
            const val MAIL = "mail"
            const val TITLE = "title"
            const val DAY = "day"
            const val PICTURE = "picture"
            const val OWNER = "owner"
            const val HIDDEN = "hidden"
        }
    }
