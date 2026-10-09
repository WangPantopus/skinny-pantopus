package app.pantopus.android.core.perf

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import app.pantopus.android.BuildConfig
import timber.log.Timber

/**
 * Debug builds only: one logcat line (tag `ISPerf`) when a bottom-bar tab is tapped, and one when a tab's
 * screen shows content after that, for the Instant Screens tab loop (contract §10,
 * `frontend/apps/android/scripts/tabloop.py`). `sinceTap` is milliseconds from the last tab tap. Release
 * builds log nothing.
 */
object ScreenTiming {
    private const val TAG = "ISPerf"

    @Volatile
    private var tappedAt = 0L

    fun tabTapped(tab: String) {
        if (!BuildConfig.DEBUG) return
        tappedAt = SystemClock.uptimeMillis()
        Timber.tag(TAG).d("tap tab=%s", tab)
    }

    fun contentShown(screen: String) {
        if (!BuildConfig.DEBUG) return
        val since = if (tappedAt > 0) SystemClock.uptimeMillis() - tappedAt else -1
        Timber.tag(TAG).d("content screen=%s sinceTap=%d", screen, since)
    }
}

/** Reports [screen]'s content each time the screen is entered with it, or as soon as it arrives. */
@Composable
fun ReportContentShown(
    screen: String,
    shown: Boolean,
) {
    if (!BuildConfig.DEBUG) return
    LaunchedEffect(shown) { if (shown) ScreenTiming.contentShown(screen) }
}
