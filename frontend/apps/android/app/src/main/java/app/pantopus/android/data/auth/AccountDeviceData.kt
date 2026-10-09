package app.pantopus.android.data.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.gigs.GigDraftQueue
import app.pantopus.android.data.support_trains.SupportTrainReservationsStore
import app.pantopus.android.data.widget.TodayWidgetStore
import app.pantopus.android.data.widget.WidgetSnapshotStore
import app.pantopus.android.ui.screens.audience_profile.broadcast_detail.BroadcastDetailSeedCache
import app.pantopus.android.ui.screens.place.detail.homeTodayPreferences
import coil.annotation.ExperimentalCoilApi
import coil.imageLoader
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * What the device keeps for the signed-in account besides its tokens and the HTTP cache: Coil's image
 * caches (chat and mail photos, avatars), the home-screen widgets' snapshots, the chat badge
 * snapshot, chat mute/hide choices, Support Train reservation patches, the broadcast seed, queued
 * offline task drafts and the Today cards' per-home dismissals. Sign-out clears all of it so the next
 * person on the device finds nothing of the last account, as iOS `clearLocalSession` does.
 */
@Singleton
class AccountDeviceData
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val todayWidget: TodayWidgetStore,
        private val tasksWidget: WidgetSnapshotStore,
        private val chatBadges: ChatBadgeCoordinator,
        private val chatPreferences: ChatConversationPreferences,
        private val reservations: SupportTrainReservationsStore,
        private val broadcastSeeds: BroadcastDetailSeedCache,
        private val gigDrafts: GigDraftQueue,
    ) {
        /** Never throws: a part that fails is logged and the rest is still cleared. */
        @OptIn(ExperimentalCoilApi::class)
        suspend fun clear() {
            chatBadges.reset()
            reservations.reset()
            broadcastSeeds.clear()
            gigDrafts.drafts.value.forEach { gigDrafts.remove(it.id) }
            withContext(Dispatchers.IO) {
                runCatching {
                    context.imageLoader.memoryCache?.clear()
                    context.imageLoader.diskCache?.clear()
                }.onFailure { Timber.w(it, "Sign-out could not clear the image caches") }
                runCatching {
                    todayWidget.clear()
                    tasksWidget.clear()
                }.onFailure { Timber.w(it, "Sign-out could not clear the widget snapshots") }
                runCatching { chatPreferences.clear() }
                    .onFailure { Timber.w(it, "Sign-out could not clear the chat preferences") }
                runCatching { context.homeTodayPreferences.edit { it.clear() } }
                    .onFailure { Timber.w(it, "Sign-out could not clear the Today preferences") }
            }
        }
    }
