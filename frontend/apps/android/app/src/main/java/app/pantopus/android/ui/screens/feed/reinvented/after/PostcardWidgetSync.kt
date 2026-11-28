package app.pantopus.android.ui.screens.feed.reinvented.after

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.api.models.mailbox.MailItem
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxApi
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.widget.PostcardWidgetProvider
import app.pantopus.android.widget.PostcardWidgetSnapshot
import app.pantopus.android.widget.PostcardWidgetStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.FileOutputStream
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max

/*
 * The postcard widget's app side ("Pulse, reinvented" phase 3, PHASE-3 piece 9, CONTRACT 8j; iPhone's
 * `MomentPostcardWidget.swift`). It follows the switch: on (and the Mailbox on), the widget's receiver is turned on, so
 * "Postcards" is in the widget list; off, signed out or another account, it is turned off again and the snapshot and
 * picture are removed (a widget placed before shows "Open Pantopus"). It reads the Mail only when a postcard widget is
 * placed (no request otherwise), never in the app's first five seconds, at most every five minutes, one read at a time:
 * the newest letter "A postcard from …" through today's `GET /api/mailbox`, its first enclosed picture through today's
 * enclosure link, a 700 px copy kept in the app's own files. The widget fetches nothing and holds no token. The kept
 * letter is the signed-in person's only: another account or a sign-out removes it at once. While that person's app lock
 * is on (today's lock covers the whole app, the Mail with it), nothing but "A postcard is waiting" is kept or drawn.
 */
@Singleton
@OptIn(FlowPreview::class)
class PostcardWidgetSync
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val feature: PulseReinventedFeature,
        private val mailbox: MailboxApi,
        private val store: PostcardWidgetStore,
        private val auth: AuthRepository,
        private val appLock: AppLockManager,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private val reading = Mutex()
        private var started = false
        private var startedAt = 0L
        private var readAt = 0L

        /** Starts following the switch (`MainActivity`, beside the switch's own start). Safe to call more than once. */
        @Synchronized
        fun start() {
            if (started) return
            started = true
            startedAt = System.currentTimeMillis()
            // Settled first: at launch the switch reads off for a moment before the account's kept answer, and a widget's
            // receiver turned off even briefly could take a placed widget away.
            scope.launch { feature.on.debounce(SETTLE_MS).collect { on -> follow(on && LaunchFeatures.mailbox) } }
            // Another account (or none): the first one's letter goes at once, and the next read isn't held back.
            scope.launch { auth.state.map(::person).distinctUntilChanged().collect { id -> followPerson(id) } }
            // The app lock turned on: the name and picture go at once; turned off: read again.
            scope.launch { appLock.preferenceEnabled.collect { locked -> followLock(locked) } }
        }

        private suspend fun followPerson(id: String?) {
            val kept = store.read() ?: return
            if (kept.owner == id) return
            store.clearLetter()
            PostcardWidgetProvider.redraw(context)
            readAt = 0L
            refresh()
        }

        private suspend fun followLock(locked: Boolean) {
            val kept = store.read() ?: return
            if (kept.hidden == locked) return
            if (locked) {
                store.clearLetter()
                store.write(kept.copy(title = "", day = "", picture = null, hidden = true))
                PostcardWidgetProvider.redraw(context)
            } else {
                readAt = 0L
                refresh()
            }
        }

        /** The app came to the foreground: read again if a widget is placed (and it's been five minutes). */
        fun foregrounded() {
            if (started && store.on()) scope.launch { refresh() }
        }

        private suspend fun follow(on: Boolean) {
            val was = store.on()
            enable(on)
            if (!on) {
                if (was || store.read() != null) {
                    store.clear()
                    PostcardWidgetProvider.redraw(context)
                }
                return
            }
            store.setOn(true)
            if (!was) PostcardWidgetProvider.redraw(context)
            refresh()
        }

        /**
         * The receiver on or off: the widget list shows "Postcards" only while it is on. The manifest's own setting ("default")
         * is off, so with the switch off and never on nothing is written to the system.
         */
        private fun enable(on: Boolean) {
            val component = PostcardWidgetProvider.component(context)
            val now = context.packageManager.getComponentEnabledSetting(component)
            val off = now == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT || now == PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            if (on == !off) return
            val state = if (on) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            context.packageManager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP)
        }

        private suspend fun refresh() {
            val placed = AppWidgetManager.getInstance(context).getAppWidgetIds(PostcardWidgetProvider.component(context))
            if (placed.isEmpty()) return
            reading.withLock {
                // Never beside the app's first screen, and not more often than every five minutes.
                val wait = max(0L, startedAt + FIRST_WAIT_MS - System.currentTimeMillis())
                if (wait > 0) delay(wait)
                if (System.currentTimeMillis() - readAt < EVERY_MS) return
                readAt = System.currentTimeMillis()
                read()
            }
        }

        private suspend fun read() {
            val owner = person(auth.state.value) ?: return
            val list = (safeApiCall { mailbox.list(limit = LETTERS) } as? NetworkResult.Success)?.data?.mail ?: return
            // Signed out or another account while it read: not this person's letter.
            if (person(auth.state.value) != owner) return
            val letter = list.filter { it.subject.orEmpty().startsWith(POSTCARD) }.maxByOrNull { it.createdAt }
            when {
                letter == null -> {
                    // None (or the last one was deleted from Mail): the empty face.
                    store.clear()
                    store.setOn(feature.on.value)
                    PostcardWidgetProvider.redraw(context)
                }
                appLock.preferenceEnabled.value -> {
                    // The app lock is on: only that one is waiting, and nothing of it is fetched or kept.
                    store.clearLetter()
                    store.write(PostcardWidgetSnapshot(letter.id, "", "", null, owner, hidden = true))
                    PostcardWidgetProvider.redraw(context)
                }
                else -> keep(letter, owner)
            }
        }

        /** The letter's words and a small copy of its first picture, kept while it is still this person's and open. */
        private suspend fun keep(
            letter: MailItem,
            owner: String,
        ) {
            val detail = (safeApiCall { mailbox.detail(letter.id) } as? NetworkResult.Success)?.data?.mail
            val enclosure = detail?.enclosures.orEmpty().firstOrNull { it.mimeType.orEmpty().startsWith("image/") }
            val picture =
                enclosure?.let { found ->
                    val link = (safeApiCall { mailbox.enclosureLink(letter.id, found.id) } as? NetworkResult.Success)?.data?.url
                    link?.let { keepPicture(it) }
                }
            if (!feature.on.value || person(auth.state.value) != owner || appLock.preferenceEnabled.value) {
                store.pictureFile.delete()
                return
            }
            store.write(PostcardWidgetSnapshot(letter.id, letter.subject.orEmpty(), day(letter.createdAt), picture, owner))
            PostcardWidgetProvider.redraw(context)
        }

        /** A 700 px copy of the enclosed picture in the app's own files; null when it can't be read. */
        private fun keepPicture(link: String): String? =
            runCatching {
                val bytes = URL(link).openStream().use { it.readBytes() }
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                var sample = 1
                while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= SIDE) sample *= 2
                val options = BitmapFactory.Options().apply { inSampleSize = sample }
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
                FileOutputStream(store.pictureFile).use { bitmap.compress(Bitmap.CompressFormat.JPEG, QUALITY, it) }
                bitmap.recycle()
                store.pictureFile.path
            }.getOrNull()

        private fun person(state: AuthRepository.State): String? = (state as? AuthRepository.State.SignedIn)?.user?.id

        /** "Today", "Yesterday" or "Nov 27". */
        private fun day(iso: String): String {
            val date = runCatching { Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull() ?: return ""
            val today = LocalDate.now()
            return when (date) {
                today -> "Today"
                today.minusDays(1) -> "Yesterday"
                else -> date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
            }
        }

        private companion object {
            const val POSTCARD = "A postcard from "
            const val LETTERS = 30
            const val FIRST_WAIT_MS = 5_000L
            const val EVERY_MS = 5 * 60_000L
            const val SIDE = 700
            const val QUALITY = 85
            const val SETTLE_MS = 3_000L
        }
    }
