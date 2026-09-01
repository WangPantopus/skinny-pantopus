package app.pantopus.android.ui.screens.nearby

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.screens.nearby.map.MapEntity
import app.pantopus.android.ui.screens.nearby.map.NearbyMapScreen

/**
 * Nearby tab body — the T2.4 Map+List hybrid (a live Google Map with a
 * draggable list sheet). Delegates to [NearbyMapScreen], mirroring the iOS
 * Nearby tab (`NearbyTabRoot` → `NearbyMapView`). Entity taps bubble up via
 * [onOpenEntity] so the host can route to the gig / listing detail.
 *
 * `nearbyTab.mapList` tags the whole hybrid surface and `nearbyTab.list` tags
 * the list pane (the bottom sheet) — both are the cross-platform parity
 * contract asserted in tests.
 */
@Composable
fun NearbyScreen(onOpenEntity: (MapEntity) -> Unit = {}) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("nearbyTab.mapList"),
    ) {
        NearbyMapScreen(
            onOpenEntity = onOpenEntity,
            listTestTag = "nearbyTab.list",
        )
    }
}
