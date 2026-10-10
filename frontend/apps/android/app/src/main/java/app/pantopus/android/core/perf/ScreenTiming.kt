package app.pantopus.android.core.perf

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import app.pantopus.android.BuildConfig
import timber.log.Timber

/**
 * Debug builds only: logcat lines (tag `ISPerf`) for the Instant Screens tab loop (contract §10,
 * `frontend/apps/android/scripts/tabloop.py`): one when a bottom-bar tab is tapped, one each time a tab's screen
 * shows content, and one each time content it showed drops to a skeleton or an error. `sinceTap` is milliseconds
 * from the last tab tap. Release builds log nothing.
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

    fun navigationTapped(screen: String) {
        if (!BuildConfig.DEBUG) return
        tappedAt = SystemClock.uptimeMillis()
        Timber.tag(TAG).d("tap screen=%s", screen)
    }

    fun contentShown(screen: String) = log("content", screen)

    /** Content that was on screen gave way to a skeleton or an error (a blank the tab loop counts). */
    fun contentHidden(screen: String) = log("blank", screen)

    private fun log(
        event: String,
        screen: String,
    ) {
        if (!BuildConfig.DEBUG) return
        val since = if (tappedAt > 0) SystemClock.uptimeMillis() - tappedAt else -1
        Timber.tag(TAG).d("%s screen=%s sinceTap=%d", event, screen, since)
    }
}

/**
 * Reports [screen]'s content each time it shows (on entry with it, or as soon as it arrives), and each time content
 * this visit showed drops away again. A first visit that waits for its data reports no blank.
 */
@Composable
fun ReportContentShown(
    screen: String,
    shown: Boolean,
) {
    if (!BuildConfig.DEBUG) return
    var wasShown by remember { mutableStateOf(false) }
    LaunchedEffect(shown) {
        if (shown) {
            ScreenTiming.contentShown(screen)
            wasShown = true
        } else if (wasShown) {
            ScreenTiming.contentHidden(screen)
        }
    }
}
