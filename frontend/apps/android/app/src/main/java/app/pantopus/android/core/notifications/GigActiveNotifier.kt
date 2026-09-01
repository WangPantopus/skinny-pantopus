@file:Suppress("PackageNaming")

package app.pantopus.android.core.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.compose.ui.graphics.toArgb
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.pantopus.android.MainActivity
import app.pantopus.android.R
import app.pantopus.android.ui.screens.gigs.GigsCategory
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Phase 6b — ongoing-notification payload for an active task. One per
 * gig: re-posting with the same [gigId] updates the line in place.
 */
data class GigActiveNotification(
    val gigId: String,
    val title: String,
    /** "Assigned — waiting for worker" / "Worker on the way" / … */
    val phaseLine: String,
    /** Backend category key — tints the small icon via [GigsCategory.color]. */
    val categoryKey: String? = null,
)

/**
 * Phase 6b — persistent (ongoing, non-dismissable) notification that
 * mirrors an active gig's phase for its participants. Driven by
 * [app.pantopus.android.ui.screens.contentdetail.GigDetailViewModel]
 * on the same transitions the phase strip uses (incl. `gig:*` room
 * events). Interface so VM unit tests can substitute a fake.
 */
interface GigActiveNotifier {
    /** Post (or update in place) the ongoing notification for a gig. */
    fun post(notification: GigActiveNotification)

    /** Remove the gig's ongoing notification (task resolved / not a participant). */
    fun cancel(gigId: String)
}

/**
 * System-notification implementation. Channel + PendingIntent pattern
 * mirrors `push/NotificationDispatcher` — the deep link rides
 * `pantopus://gigs/<id>` into MainActivity's `ACTION_VIEW` handler and
 * `DeepLinkRouter`, same destination as the backend's gig pushes.
 */
@Singleton
class GigActiveNotifierImpl
    @Inject
    constructor(
        @ApplicationContext private val appContext: Context,
    ) : GigActiveNotifier {
        override fun post(notification: GigActiveNotification) {
            ensureChannel()
            val category = GigsCategory.fromBackendKey(notification.categoryKey)
            val built =
                NotificationCompat
                    .Builder(appContext, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setColor(category.color.toArgb())
                    .setContentTitle(notification.title)
                    .setContentText(notification.phaseLine)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setContentIntent(contentIntent(notification.gigId))
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                    .build()

            val nm = NotificationManagerCompat.from(appContext)
            // POST_NOTIFICATIONS is requested at runtime in MainActivity;
            // here we only check — `nm.notify` would throw a
            // SecurityException on Android 13+ when denied.
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(appContext, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                Timber.d("POST_NOTIFICATIONS denied — skipping active-task post")
                return
            }
            if (!nm.areNotificationsEnabled()) {
                Timber.d("Notifications disabled — skipping active-task post")
                return
            }
            runCatching {
                nm.notify(notificationId(notification.gigId), built)
            }.onFailure { Timber.w(it, "Failed to post active-task notification") }
        }

        override fun cancel(gigId: String) {
            runCatching {
                NotificationManagerCompat.from(appContext).cancel(notificationId(gigId))
            }.onFailure { Timber.w(it, "Failed to cancel active-task notification") }
        }

        /** Stable per-gig id so re-posts update instead of stacking. */
        private fun notificationId(gigId: String): Int = gigId.hashCode()

        private fun ensureChannel() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel(CHANNEL_ID) != null) return
            val channel =
                NotificationChannel(
                    CHANNEL_ID,
                    appContext.getString(R.string.notif_channel_active_task),
                    // Low importance — silent status mirror, no sound.
                    NotificationManager.IMPORTANCE_LOW,
                ).apply { setSound(null, null) }
            manager.createNotificationChannel(channel)
        }

        private fun contentIntent(gigId: String): PendingIntent {
            val intent =
                Intent(appContext, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    action = Intent.ACTION_VIEW
                    data = Uri.parse("pantopus://gigs/$gigId")
                }
            return PendingIntent.getActivity(
                appContext,
                notificationId(gigId),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private companion object {
            const val CHANNEL_ID = "active_task"
        }
    }

@Module
@InstallIn(SingletonComponent::class)
abstract class GigActiveNotifierModule {
    @Binds
    abstract fun bindGigActiveNotifier(impl: GigActiveNotifierImpl): GigActiveNotifier
}
