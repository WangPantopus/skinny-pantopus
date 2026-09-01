@file:Suppress("PackageNaming")

package app.pantopus.android.a11y

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.hub.HUB_SCREEN_TAG
import app.pantopus.android.ui.screens.root.NotYetAvailableView
import app.pantopus.android.ui.screens.root.PantopusBottomBar
import app.pantopus.android.ui.screens.root.PantopusRoute
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Walks every clickable node on each major screen and asserts its
 * touch target is ≥ 48 × 48 dp (Material 3 minimum). Uses the same
 * Hilt-free test fixture as `RootTabTest` so we don't need a
 * Hilt-aware runner.
 */
class TapTargetAudit {
    @get:Rule
    val compose = createComposeRule()

    /**
     * Material 3 minimum touch target. WCAG 2.5.5 AAA wants 44 × 44 — we
     * lean on the stricter Material guideline because Compose components
     * almost always come back at least 48.
     */
    private val minDp = 48.dp

    private fun assertAllClickableTouchTargetsClear(screenName: String) {
        val minPx = with(compose.density) { minDp.toPx() }
        val matcher =
            SemanticsMatcher("hasClickAction") { hasClickAction().matches(it) }
        val nodes = compose.onAllNodes(matcher).fetchSemanticsNodes()
        for (node in nodes) {
            val bounds = node.boundsInRoot
            assertTrue(
                "[$screenName] node id=${node.id} bounds=$bounds < $minDp dp",
                bounds.width >= minPx && bounds.height >= minPx,
            )
        }
    }

    @Test
    fun root_tab_bar_meets_min_tap_size() {
        compose.setContent {
            var selected by remember { mutableStateOf<PantopusRoute>(PantopusRoute.Home) }
            Scaffold(
                modifier = Modifier.fillMaxSize(),
                bottomBar = {
                    PantopusBottomBar(
                        selected = selected,
                        onSelect = { selected = it },
                    )
                },
            ) { padding ->
                Box(Modifier.padding(padding)) {
                    when (selected) {
                        PantopusRoute.Home -> Box(Modifier.fillMaxSize().testTag(HUB_SCREEN_TAG))
                        PantopusRoute.Pulse -> Box(Modifier.fillMaxSize().testTag("pulseFeed"))
                        PantopusRoute.Tasks -> Box(Modifier.fillMaxSize().testTag("gigsFeed"))
                        PantopusRoute.Marketplace -> Box(Modifier.fillMaxSize().testTag("marketplace"))
                        PantopusRoute.Messages ->
                            NotYetAvailableView(
                                tabName = "Messages",
                                icon = PantopusIcon.MessageCircle,
                            )
                    }
                }
            }
        }
        compose.onNodeWithTag(HUB_SCREEN_TAG).performClick()
        assertAllClickableTouchTargetsClear("RootTab")
    }

    @Test
    fun nearby_empty_state_meets_min_tap_size() {
        compose.setContent {
            NotYetAvailableView(tabName = "Nearby", icon = PantopusIcon.Map)
        }
        assertAllClickableTouchTargetsClear("NearbyEmpty")
    }
}
