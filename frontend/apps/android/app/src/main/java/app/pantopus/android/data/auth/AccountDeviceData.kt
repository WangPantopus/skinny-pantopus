package app.pantopus.android.data.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import app.pantopus.android.core.network.HomeDocumentTemporaryFiles
import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.chats.ChatOutbox
import app.pantopus.android.data.gigs.GigCameraPhotos
import app.pantopus.android.data.gigs.GigDraftQueue
import app.pantopus.android.data.mailbox.MailEnclosureFiles
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.posts.PostCameraPhotos
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.support_trains.SupportTrainReservationsStore
import app.pantopus.android.data.widget.TodayWidgetStore
import app.pantopus.android.data.widget.WidgetSnapshotStore
import app.pantopus.android.ui.screens.audience_profile.broadcast_detail.BroadcastDetailSeedCache
import app.pantopus.android.ui.screens.inbox.conversation.ChatMediaUrl
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
 * What the device keeps for the signed-in account besides its tokens and the HTTP cache: the screens' store
 * (Instant Screens), Coil's image caches (chat and mail photos, avatars), the home-screen widgets' snapshots, the chat badge
 * snapshot, chat mute/hide choices, Support Train reservation patches, the broadcast seed, queued
 * offline task drafts and the Today cards' per-home dismissals. Sign-out clears all of it so the next
 * person on the device finds nothing of the last account, as iOS `clearLocalSession` does.
 */
@Suppress("LongParameterList") // This existing account cleanup owner keeps all account-scoped stores together.
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
        private val screenStore: ScreenStore,
        private val chatOutbox: ChatOutbox,
    ) {
        /** Never throws: a part that fails is logged and the rest is still cleared. */
        @OptIn(ExperimentalCoilApi::class)
        suspend fun clear() {
            // First, so a reply still in flight can't write the last account's data back (generation number).
            chatOutbox.clear()
            screenStore.wipe()
            MailboxRepository.forgetAccount()
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
                // And the files opened from its chats, with the photos taken for them.
                runCatching { ChatMediaUrl.removeLocalFiles(context.cacheDir) }
                    .onFailure { Timber.w(it, "Sign-out could not remove the chat files") }
                // And the photos taken with the camera for its task posts and its posts.
                runCatching { GigCameraPhotos.remove(context.cacheDir) }
                    .onFailure { Timber.w(it, "Sign-out could not remove the task camera photos") }
                runCatching { PostCameraPhotos.remove(context.cacheDir) }
                    .onFailure { Timber.w(it, "Sign-out could not remove the post camera photos") }
                // And the mail enclosures it opened.
                runCatching { MailEnclosureFiles.remove(context.cacheDir) }
                    .onFailure { Timber.w(it, "Sign-out could not remove the opened mail enclosures") }
                // And its exported Home documents, emergency card and residency letters.
                runCatching { HomeDocumentTemporaryFiles.clearPreviousLaunch(context.cacheDir) }
                    .onFailure { Timber.w(it, "Sign-out could not remove the exported documents") }
            }
        }
    }
