@file:Suppress("PackageNaming")

package app.pantopus.android.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.pantopus.android.MainActivity
import app.pantopus.android.R
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.routing.HomeTaskNotificationRoute
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.chats.ActiveChatThread
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.runBlocking
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

/**
 * Routes incoming FCM payloads to the right notification channel and,
 * on tap, into the same deep-link router iOS uses.
 *
 * Mirrors iOS `AppDelegate.userNotificationCenter(_:didReceive:)` — the
 * payload's `link` (or `deepLink`) is baked into the PendingIntent so
 * MainActivity's existing `ACTION_VIEW` handler feeds it into
 * `DeepLinkRouter.handle(uri)` on tap. Same trigger point, same
 * destination, both platforms.
 *
 * Android additionally splits the four payload families the backend
 * emits (chat / mail / gig bid / system) onto separate notification
 * channels so users can mute one without losing the others. The category
 * is inferred from the backend `type` field — the canonical list lives
 * in `backend/services/pushService.js`.
 */
@Singleton
class NotificationDispatcher
    @Inject
    constructor(
        @ApplicationContext private val appContext: Context,
        private val activeChatThread: ActiveChatThread,
        private val tokens: TokenStorage,
    ) {
        /** Channels match the four top-level families the backend emits. */
        enum class Channel(
            val id: String,
            val nameRes: Int,
            val importance: Int,
        ) {
            CHAT(
                id = "pantopus.chat",
                nameRes = R.string.notif_channel_chat,
                importance = NotificationManager.IMPORTANCE_HIGH,
            ),
            MAIL(
                id = "pantopus.mail",
                nameRes = R.string.notif_channel_mail,
                importance = NotificationManager.IMPORTANCE_DEFAULT,
            ),
            GIG_BID(
                id = "pantopus.gig_bid",
                nameRes = R.string.notif_channel_gig_bid,
                importance = NotificationManager.IMPORTANCE_HIGH,
            ),
            SYSTEM(
                id = "pantopus.system",
                nameRes = R.string.notif_channel_system,
                importance = NotificationManager.IMPORTANCE_DEFAULT,
            ),
        }

        /**
         * Resolved routing for a single FCM message. Exposed as a value so
         * the dispatching logic is unit-testable without RemoteMessage
         * (which can't be instantiated on the JVM).
         */
        data class Routing(
            val channel: Channel,
            val title: String?,
            val body: String?,
            val deepLink: String?,
            val category: String? = null,
            val homeId: String? = null,
            val taskId: String? = null,
            val date: String? = null,
            val recipientUserId: String? = null,
            val pushType: String? = null,
        )

        /**
         * Hand off a [RemoteMessage] for foreground/background display.
         * Extracts the payload and posts a system notification on the
         * right channel. The deep link is baked into the notification's
         * PendingIntent so it only fires on tap — same trigger point
         * iOS uses in `userNotificationCenter(_:didReceive:)`.
         */
        fun dispatch(message: RemoteMessage) {
            val routing = route(message.data, message.notification?.title, message.notification?.body)
            // Launch cut (2026-09-27): no system notification for a feature
            // hidden for the first launch (bids, listings, Beacon, bookings…).
            if (!DeepLinkRouter.isLaunchAvailable(message.data["type"], routing.deepLink)) {
                Timber.d("Push suppressed — its feature is hidden for the first launch")
                return
            }
            // The backend's chat push (`backend/routes/chats.js:1834`) is
            // data-only with `{ type: "chat_message", room_id, link }`, so
            // this fires in the foreground too — skip the system post when
            // the user is already looking at that very conversation.
            if (routing.channel == Channel.CHAT && activeChatThread.isViewing(message.data["room_id"])) {
                Timber.d("Chat push suppressed — conversation is on screen")
                return
            }
            postNotification(routing)
        }

        /**
         * Pure routing — takes a flat `data` map (as FCM delivers it) plus
         * the optional title/body from the notification block, and returns
         * the resolved [Routing]. Stays JVM-only so tests don't need
         * Robolectric.
         */
        internal fun route(
            data: Map<String, String>,
            notificationTitle: String? = null,
            notificationBody: String? = null,
        ): Routing {
            val channel = channelFor(data["type"])
            val title = notificationTitle ?: data["title"]
            val body = notificationBody ?: data["body"]
            var deepLink =
                HomeTaskNotificationRoute.pushPath(data)
                    ?: DeepLinkRouter.notificationPath(data["type"], data["link"])
                    ?: data["deepLink"]
                    ?: briefingOrReceiptLink(data)
            // Chat pushes link to `/chat/<roomId>` with the sender name in
            // the title — forward it as a `name` query param so the
            // conversation header has a display name on cold-open
            // (`DeepLinkRouter.Destination.Conversation.name`).
            if (channel == Channel.CHAT && deepLink != null && !title.isNullOrBlank() && !deepLink.contains('?')) {
                deepLink = "$deepLink?name=${java.net.URLEncoder.encode(title, "UTF-8")}"
            }
            return Routing(
                channel = channel, title = title, body = body, deepLink = deepLink,
                category = data["category"],
                homeId = HomeTaskNotificationRoute.canonicalId(data["homeId"] ?: data["home_id"]),
                taskId = HomeTaskNotificationRoute.canonicalId(data["taskId"] ?: data["task_id"]),
                date = data["pickupDate"] ?: data["date"], recipientUserId = data["recipient_user_id"], pushType = data["type"],
            )
        }

        /**
         * Morning/Evening Briefing and Monthly Receipt pushes ship no `link` —
         * the briefing carries `{ type, route: "/hub/today", briefingKind,
         * briefingDeliveryId }` (`backend/routes/internalBriefing.js:239`), and
         * the receipt push is typed only. Compose the same paths RN's
         * `resolveNotificationRoute` produces
         * (`pantopus/frontend/apps/mobile/src/utils/notificationRouting.ts:18`)
         * so the tap resolves the specific stored briefing / expands the card.
         */
        internal fun briefingOrReceiptLink(data: Map<String, String>): String? {
            val type = data["type"].orEmpty().lowercase()
            if (type == "monthly_receipt") return "/profile?tab=receipt"
            if (type !in briefingTypes) return null
            val kind =
                if (type == "evening_briefing") {
                    "evening"
                } else {
                    (data["briefingKind"] ?: data["briefing_kind"]).orEmpty().lowercase()
                }
            val deliveryId = data["briefingDeliveryId"] ?: data["briefing_delivery_id"]
            val resolvedKind = if (kind == "evening") "evening" else "morning"
            val suffix =
                if (deliveryId.isNullOrBlank()) {
                    ""
                } else {
                    "&deliveryId=${java.net.URLEncoder.encode(deliveryId, "UTF-8")}"
                }
            return "/hub-today?kind=$resolvedKind$suffix"
        }

        private val briefingTypes =
            setOf("daily_briefing", "morning_briefing", "evening_briefing")

        /**
         * Map a backend notification `type` to one of the four channels.
         * The substring/prefix shapes catch the families enumerated in
         * `backend/services/pushService.js` (e.g. `bid_received`,
         * `gig_started`, `mail_delivered`, `chat_message`).
         */
        internal fun channelFor(type: String?): Channel {
            val key = type?.lowercase() ?: return Channel.SYSTEM
            return when {
                key == "chat" ||
                    key.startsWith("chat_") ||
                    key == "new_message" ||
                    key.endsWith("_message") ||
                    key.contains("message_") -> Channel.CHAT

                key == "mail" ||
                    key.startsWith("mail_") ||
                    key.startsWith("mailbox_") ||
                    key == "mailbox" -> Channel.MAIL

                key.startsWith("bid_") ||
                    key == "first_bid_received" ||
                    key.startsWith("gig_") ||
                    key == "gig_offer" -> Channel.GIG_BID

                else -> Channel.SYSTEM
            }
        }

        /**
         * Drops everything this app has in the shade. Called on sign-out, so the
         * next person on the device never reads the last account's notifications.
         */
        fun clearDelivered() {
            runCatching { NotificationManagerCompat.from(appContext).cancelAll() }
                .onFailure { Timber.w(it, "Failed to clear delivered notifications") }
        }

        private fun postNotification(routing: Routing) {
            ensureChannel(routing.channel)
            val notificationId = Random.nextInt()
            val contentIntent = buildContentIntent(routing)
            // Replace `ic_launcher` with a dedicated monochrome notification
            // icon (`ic_notification`) before public launch.
            // Status-bar icons must be white-on-transparent per Android
            // 5+; the launcher icon renders as a flat silhouette here.
            val notification =
                NotificationCompat
                    .Builder(appContext, routing.channel.id)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(routing.title ?: appContext.getString(R.string.app_name))
                    .apply { routing.body?.let(::setContentText) }
                    .setAutoCancel(true)
                    .setContentIntent(contentIntent)
                    .setPriority(routing.channel.toCompatPriority())
                    .apply { addReminderActions(this, routing, notificationId) }
                    .build()

            val nm = NotificationManagerCompat.from(appContext)
            // POST_NOTIFICATIONS is requested at runtime in MainActivity.
            // If it's still denied, drop silently — `nm.notify` would
            // throw SecurityException on Android 13+.
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(appContext, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                Timber.d("POST_NOTIFICATIONS denied — skipping system post")
                return
            }
            if (!nm.areNotificationsEnabled()) {
                Timber.d("Notifications disabled — skipping system post")
                return
            }
            runCatching {
                nm.notify(notificationId, notification)
            }.onFailure { Timber.w(it, "Failed to post FCM notification") }
        }

        private fun ensureChannel(channel: Channel) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel(channel.id) != null) return
            val nc = NotificationChannel(channel.id, appContext.getString(channel.nameRes), channel.importance)
            manager.createNotificationChannel(nc)
        }

        private fun addReminderActions(
            builder: NotificationCompat.Builder,
            routing: Routing,
            notificationId: Int,
        ) {
            if (routing.category !in setOf("PICKUP_REMINDER", "TASK_REMINDER", "TASK_REMINDER_DONE_ONLY")) return
            val identity = runCatching { runBlocking { tokens.sessionIdentity() } }.getOrNull() ?: return
            if (identity.first != routing.recipientUserId) return
            val session = ReminderActionReceiver.sessionFingerprint(identity) ?: return

            fun background(action: String): PendingIntent {
                val intent =
                    Intent(appContext, ReminderActionReceiver::class.java).apply {
                        this.action = action
                        data = Uri.parse("pantopus-reminder-action://$notificationId/$action")
                        putExtra(ReminderActionReceiver.RECIPIENT, routing.recipientUserId)
                        putExtra(ReminderActionReceiver.SESSION, session)
                        putExtra(ReminderActionReceiver.HOME, routing.homeId)
                        putExtra(ReminderActionReceiver.TASK, routing.taskId)
                        putExtra(ReminderActionReceiver.DATE, routing.date)
                        putExtra(ReminderActionReceiver.NOTIFICATION_ID, notificationId)
                    }
                return PendingIntent.getBroadcast(
                    appContext,
                    notificationId,
                    intent,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE,
                )
            }
            if (routing.category == "PICKUP_REMINDER") {
                if (routing.date?.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$")) == true) {
                    builder.addAction(NotificationCompat.Action.Builder(0, "Bins out", background(ReminderActionReceiver.BINS_OUT)).build())
                }
            } else {
                addTaskReminderActions(builder, routing, session, ::background)
            }
        }

        private fun addTaskReminderActions(
            builder: NotificationCompat.Builder,
            routing: Routing,
            session: String,
            background: (String) -> PendingIntent,
        ) {
            val home = routing.homeId ?: return
            val task = routing.taskId ?: return
            if (routing.pushType != "task_due") return
            builder.addAction(
                NotificationCompat.Action.Builder(0, "Done", background(ReminderActionReceiver.TASK_DONE))
                    .setAuthenticationRequired(true).build(),
            )
            if (routing.category == "TASK_REMINDER") {
                val editRouting = routing.copy(deepLink = "/app/homes/$home/tasks/$task?edit=due_date")
                builder.addAction(NotificationCompat.Action.Builder(0, "Not now", buildContentIntent(editRouting, session)).build())
            }
        }

        private fun buildContentIntent(
            routing: Routing,
            reminderSession: String? = null,
        ): PendingIntent {
            val deepLink = routing.deepLink
            val intent =
                Intent(appContext, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra(ReminderActionReceiver.PUSH_OPEN, true)
                    putExtra(ReminderActionReceiver.PUSH_TYPE, routing.pushType)
                    if (reminderSession != null) {
                        putExtra(ReminderActionReceiver.ACTION, ReminderActionReceiver.TASK_NOT_NOW)
                        putExtra(ReminderActionReceiver.SESSION, reminderSession)
                        putExtra(ReminderActionReceiver.RECIPIENT, routing.recipientUserId)
                    }
                    if (!deepLink.isNullOrBlank()) {
                        action = Intent.ACTION_VIEW
                        data = normalizeForIntent(deepLink)
                    }
                }
            val update = if (reminderSession == null) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_ONE_SHOT
            val flags = update or PendingIntent.FLAG_IMMUTABLE
            return PendingIntent.getActivity(appContext, Random.nextInt(), intent, flags)
        }

        /**
         * Notification payloads carry path-style deep links (e.g.
         * `/gig/g_42`); MainActivity's deep-link forwarder only acts on
         * `Intent.ACTION_VIEW` with a non-null `Uri`, so wrap the path
         * in the `pantopus://` custom scheme. Full URLs pass through.
         */
        private fun normalizeForIntent(deepLink: String): Uri {
            val normalized =
                when {
                    deepLink.startsWith("pantopus://") || deepLink.startsWith("http") -> deepLink
                    deepLink.startsWith("/") -> "pantopus://" + deepLink.drop(1)
                    else -> "pantopus://$deepLink"
                }
            return Uri.parse(normalized)
        }

        private fun Channel.toCompatPriority(): Int =
            when (importance) {
                NotificationManager.IMPORTANCE_HIGH -> NotificationCompat.PRIORITY_HIGH
                NotificationManager.IMPORTANCE_LOW -> NotificationCompat.PRIORITY_LOW
                NotificationManager.IMPORTANCE_MIN -> NotificationCompat.PRIORITY_MIN
                else -> NotificationCompat.PRIORITY_DEFAULT
            }
    }
