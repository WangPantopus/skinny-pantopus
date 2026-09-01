@file:Suppress("PackageNaming")

package app.pantopus.android.data.chats

import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-wide "what conversation is on screen" marker for chat push
 * suppression. The conversation ViewModel publishes its active room ids
 * on load (and clears them on teardown); [MainActivity] flips
 * [isForeground] in onStart/onStop. [NotificationDispatcher] consults
 * [isViewing] to skip posting a system notification for a `chat_message`
 * push when the user is already reading that room — mirrors the standard
 * messenger behavior (and iOS `willPresent` suppression).
 */
@Singleton
class ActiveChatThread
    @Inject
    constructor() {
        /** Room ids the visible conversation screen is rendering (person
         *  threads aggregate several shared rooms — all are "viewed"). */
        @Volatile
        var viewedRoomIds: Set<String> = emptySet()

        /** True while the activity is started (visible to the user). */
        @Volatile
        var isForeground: Boolean = false

        /** True when a chat push for [roomId] should be suppressed. */
        fun isViewing(roomId: String?): Boolean = isForeground && roomId != null && viewedRoomIds.contains(roomId)

        /** Conversation screen teardown — nothing is "viewed" anymore. */
        fun clear() {
            viewedRoomIds = emptySet()
        }
    }
