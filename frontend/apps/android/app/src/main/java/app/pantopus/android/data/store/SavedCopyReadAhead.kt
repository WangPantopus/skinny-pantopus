package app.pantopus.android.data.store

import app.pantopus.android.data.api.models.homes.showsCopyBeforeRecheck
import app.pantopus.android.data.auth.TokenStorage
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import timber.log.Timber
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Launch (Instant Screens contract §6 "Read"): while the session restores, reads on a background thread the saved
 * copies the first screens open: the Messages list behind the tab badge, My Homes, and the Place and Today of the Home
 * those land on. Their first frames then find the copies in memory instead of reading and decoding the files on the
 * main thread. A screen that asks first reads its copy itself, as before, and each screen still decides what it may
 * show (founder decision 3).
 */
@Singleton
class SavedCopyReadAhead
    @Inject
    constructor(
        private val store: ScreenStore,
        private val tokens: TokenStorage,
    ) {
        // Only an optimization: a failure leaves the screens to read their copies themselves.
        private val scope =
            CoroutineScope(
                SupervisorJob() + Dispatchers.IO + CoroutineExceptionHandler { _, error -> Timber.w(error, "saved copies not read ahead") },
            )
        private val started = AtomicBoolean(false)

        /** Once per process, for the account whose session is restoring; nothing when no one is signed in. */
        fun start() {
            if (!started.compareAndSet(false, true)) return
            scope.launch {
                val account = tokens.userId() ?: return@launch
                launch { store.readAhead(StoreKeys.conversations, account) }
                val homes = store.readAhead(StoreKeys.myHomes, account) ?: return@launch
                // The Home Place and Today land on, when its copy shows before the re-check (as those screens decide).
                val home = homes.homes.firstOrNull { it.id == homes.defaultHomeId }?.takeIf { it.showsCopyBeforeRecheck }
                if (home != null) {
                    launch { store.readAhead(StoreKeys.today(home.id), account) }
                    store.readAhead(StoreKeys.place(home.id), account)
                }
            }
        }
    }
