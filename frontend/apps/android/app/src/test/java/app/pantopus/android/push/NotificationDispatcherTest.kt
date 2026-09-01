@file:Suppress("PackageNaming")

package app.pantopus.android.push

import android.content.Context
import app.pantopus.android.data.chats.ActiveChatThread
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Pure-JVM coverage of [NotificationDispatcher.route] and
 * [NotificationDispatcher.channelFor]. Both are public-internal helpers
 * that take only `Map<String, String>` / `String?` inputs so the suite
 * doesn't need RemoteMessage (which can't be constructed on the JVM).
 *
 * The system-side `dispatch(...)` path is exercised by the instrumented
 * permission test — that runs against a real Notification manager.
 */
class NotificationDispatcherTest {
    private val dispatcher =
        NotificationDispatcher(
            appContext = mockk<Context>(relaxed = true),
            activeChatThread = ActiveChatThread(),
        )

    // MARK: - channelFor

    @Test
    fun chat_message_type_routes_to_chat_channel() {
        assertEquals(NotificationDispatcher.Channel.CHAT, dispatcher.channelFor("chat"))
        assertEquals(NotificationDispatcher.Channel.CHAT, dispatcher.channelFor("chat_message"))
        assertEquals(NotificationDispatcher.Channel.CHAT, dispatcher.channelFor("new_message"))
        assertEquals(NotificationDispatcher.Channel.CHAT, dispatcher.channelFor("CHAT"))
    }

    @Test
    fun mail_family_routes_to_mail_channel() {
        assertEquals(NotificationDispatcher.Channel.MAIL, dispatcher.channelFor("mail"))
        assertEquals(NotificationDispatcher.Channel.MAIL, dispatcher.channelFor("mail_delivered"))
        assertEquals(NotificationDispatcher.Channel.MAIL, dispatcher.channelFor("mail_summary"))
        assertEquals(NotificationDispatcher.Channel.MAIL, dispatcher.channelFor("mailbox_invitation"))
    }

    @Test
    fun bid_family_routes_to_gig_bid_channel() {
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("bid_received"))
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("first_bid_received"))
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("bid_accepted"))
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("bid_rejected"))
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("bid_withdrawn"))
    }

    @Test
    fun gig_lifecycle_routes_to_gig_bid_channel() {
        // The gig family shares the bid channel because both surface on
        // the same gig context — the backend `pushService` groups them.
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("gig_started"))
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("gig_completed"))
        assertEquals(NotificationDispatcher.Channel.GIG_BID, dispatcher.channelFor("gig_offer"))
    }

    @Test
    fun unknown_or_null_type_routes_to_system_channel() {
        assertEquals(NotificationDispatcher.Channel.SYSTEM, dispatcher.channelFor(null))
        assertEquals(NotificationDispatcher.Channel.SYSTEM, dispatcher.channelFor(""))
        assertEquals(NotificationDispatcher.Channel.SYSTEM, dispatcher.channelFor("address_verified"))
        assertEquals(NotificationDispatcher.Channel.SYSTEM, dispatcher.channelFor("announcement"))
    }

    // MARK: - route

    @Test
    fun route_carries_title_body_and_deep_link_from_data() {
        val routing =
            dispatcher.route(
                data =
                    mapOf(
                        "type" to "bid_received",
                        "title" to "New bid on Mow lawn",
                        "body" to "Alex placed a bid",
                        "link" to "/gig/g_42",
                    ),
            )
        assertEquals(NotificationDispatcher.Channel.GIG_BID, routing.channel)
        assertEquals("New bid on Mow lawn", routing.title)
        assertEquals("Alex placed a bid", routing.body)
        assertEquals("/gig/g_42", routing.deepLink)
    }

    @Test
    fun route_prefers_notification_block_title_over_data_title() {
        // FCM splits payloads into a `notification` block (display-only)
        // and a `data` block (arbitrary). When both carry a title the
        // notification one wins — that's the contract FirebaseMessaging
        // uses to render system notifications even when the app is
        // killed, so we mirror it here.
        val routing =
            dispatcher.route(
                data = mapOf("type" to "chat", "title" to "Data title", "body" to "Data body"),
                notificationTitle = "Notif title",
                notificationBody = "Notif body",
            )
        assertEquals("Notif title", routing.title)
        assertEquals("Notif body", routing.body)
    }

    @Test
    fun route_accepts_legacy_deep_link_camel_case_key() {
        // iOS uses `deepLink`; some backend templates write `link`.
        // Accept both so the platforms stay interchangeable.
        val viaCamel =
            dispatcher.route(
                data = mapOf("type" to "mail_delivered", "deepLink" to "/mailbox"),
            )
        assertEquals("/mailbox", viaCamel.deepLink)

        val viaLink =
            dispatcher.route(
                data = mapOf("type" to "mail_delivered", "link" to "/mailbox"),
            )
        assertEquals("/mailbox", viaLink.deepLink)
    }

    @Test
    fun route_returns_null_deep_link_when_payload_omits_it() {
        val routing =
            dispatcher.route(
                data = mapOf("type" to "announcement", "title" to "Welcome", "body" to "Hi"),
            )
        assertNull(routing.deepLink)
        assertEquals(NotificationDispatcher.Channel.SYSTEM, routing.channel)
    }

    @Test
    fun route_treats_missing_type_as_system() {
        val routing =
            dispatcher.route(data = mapOf("title" to "Heads up", "body" to "Something happened"))
        assertEquals(NotificationDispatcher.Channel.SYSTEM, routing.channel)
        assertEquals("Heads up", routing.title)
        assertEquals("Something happened", routing.body)
    }

    @Test
    fun chat_route_appends_sender_name_to_deep_link() {
        // Backend chat push: `{ type: chat_message, room_id, link: /chat/<id> }`
        // with the sender name as the title (`backend/routes/chats.js:1834`).
        // The name is forwarded as a query param so the conversation header
        // has a display name when opened from the notification.
        val routing =
            dispatcher.route(
                data =
                    mapOf(
                        "type" to "chat_message",
                        "title" to "Maria K.",
                        "body" to "See you at 9",
                        "room_id" to "r1",
                        "link" to "/chat/r1",
                    ),
            )
        assertEquals(NotificationDispatcher.Channel.CHAT, routing.channel)
        assertEquals("/chat/r1?name=Maria+K.", routing.deepLink)
    }

    @Test
    fun non_chat_deep_links_stay_untouched() {
        val routing =
            dispatcher.route(
                data = mapOf("type" to "bid_received", "title" to "New bid", "link" to "/gig/g_1"),
            )
        assertEquals("/gig/g_1", routing.deepLink)
    }
}
