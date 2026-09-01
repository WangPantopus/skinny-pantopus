@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.feed.beacons

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import app.pantopus.android.ui.screens.feed.FeedScreen
import app.pantopus.android.ui.screens.feed.FeedSurface
import app.pantopus.android.ui.screens.feed.pulse.PulseFeedViewModel
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent

/**
 * A03.2 — Beacon Updates. Broadcasts from verified beacons (businesses,
 * civic accounts, neighbors-as-creators) the user follows. The design
 * (docs/designs/A03/beacons-frames.jsx) renders the Pulse archetype
 * parametrized to `surface=personas` — same chrome, chip row, card recipe,
 * FAB, and tab bar — so this screen reuses [FeedScreen] with
 * [FeedSurface.Beacons]. Only the title, verified floor, and empty state
 * diverge, all driven by the surface.
 *
 * Reached from the AudienceProfile "Beacon Updates" entry and the
 * `pantopus://beacons` deep link.
 */
@Composable
fun BeaconsFeedScreen(
    onOpenPost: (String) -> Unit = {},
    onCompose: (PulseIntent) -> Unit = {},
    onDiscover: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    viewModel: PulseFeedViewModel = hiltViewModel(),
) {
    FeedScreen(
        surface = FeedSurface.Beacons,
        onOpenPost = onOpenPost,
        onCompose = onCompose,
        onEmptyCta = onDiscover,
        onBack = onBack,
        viewModel = viewModel,
    )
}
