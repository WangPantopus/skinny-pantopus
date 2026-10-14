package app.pantopus.android.ui.screens.place

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent

/**
 * `screen.place.viewed` each time a settled root of the Place tab shows, as the Hub sent `screen.hub.viewed`: first
 * shown, back from a pushed screen or another tab, or replaced by another Home. Not for the skeleton or the error.
 */
@Composable
internal fun PlaceRootViewed(root: String) {
    LaunchedEffect(Unit) { Analytics.track(AnalyticsEvent.ScreenPlaceViewed(root)) }
}
