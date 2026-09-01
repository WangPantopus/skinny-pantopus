package app.pantopus.android.core.security

import android.app.Activity
import android.view.WindowManager
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

/** Hilt door into [SecureWindowController] for composables outside a view-model. */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface SecureWindowEntryPoint {
    fun secureWindowController(): SecureWindowController
}

/**
 * Reference-counted [WindowManager.LayoutParams.FLAG_SECURE] on the host
 * Activity window. Nested sensitive screens increment on enter and
 * decrement on exit so a parent/child pair cannot clear protection while
 * another scoped screen is still visible.
 */
@Singleton
class SecureWindowController
    @Inject
    constructor() {
        private val refCount = AtomicInteger(0)
        private var activityRef: WeakReference<Activity>? = null

        /**
         * App-wide privacy hold, held for as long as the signed-in user has
         * app lock on. It suppresses the recents thumbnail (and screenshots)
         * for exactly the users who asked for one, which is Android's
         * counterpart to the iOS `AppSwitcherPrivacyOverlay` — iOS has no
         * `FLAG_SECURE`, so it draws a cover before the snapshot instead,
         * gated on the same condition (`RootView.privacyCoverEnabled`).
         *
         * Tracked as a single latched flag rather than a [refCount] bump so
         * that re-collecting the preference on a recreated Activity cannot
         * leak a second acquisition.
         */
        private var privacyHold = false

        fun bind(activity: Activity) {
            activityRef = WeakReference(activity)
            applyFlag(activity, secured = refCount.get() > 0)
        }

        fun acquire() {
            val count = refCount.incrementAndGet()
            activityRef?.get()?.let { applyFlag(it, secured = count > 0) }
        }

        /** Idempotent acquire/release of the app-wide [privacyHold]. */
        @Synchronized
        fun setPrivacyHold(enabled: Boolean) {
            if (privacyHold == enabled) return
            privacyHold = enabled
            if (enabled) acquire() else release()
        }

        fun release() {
            val count = refCount.updateAndGet { current -> (current - 1).coerceAtLeast(0) }
            activityRef?.get()?.let { applyFlag(it, secured = count > 0) }
        }

        private fun applyFlag(
            activity: Activity,
            secured: Boolean,
        ) {
            val window = activity.window ?: return
            if (secured) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }
