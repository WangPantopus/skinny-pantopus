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
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import app.pantopus.android.ui.screens.hub.HUB_SCREEN_TAG
import app.pantopus.android.ui.screens.root.NotYetAvailableView
import app.pantopus.android.ui.screens.root.PantopusBottomBar
import app.pantopus.android.ui.screens.root.PantopusRoute
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test

/**
 * Walks every clickable node and asserts it surfaces a non-empty
 * accessibility label (`Text` semantics for buttons-with-labels or
 * `ContentDescription` for icon-only controls). Catches regressions
 * where a designer drops the description and the control becomes
 * invisible to TalkBack.
 */
class A11yLabelAudit {
    @get:Rule
    val compose = createComposeRule()

    private fun assertEveryClickableHasALabel(screenName: String) {
        val matcher =
            SemanticsMatcher("hasClickAction") { hasClickAction().matches(it) }
        val nodes = compose.onAllNodes(matcher).fetchSemanticsNodes()
        for (node in nodes) {
            val cfg = node.config
            val text = cfg.getOrNull(SemanticsProperties.Text)?.joinToString(" ") { it.text }
            val cd = cfg.getOrNull(SemanticsProperties.ContentDescription)?.joinToString(" ")
            val onClickLabel =
                cfg.getOrNull(SemanticsActions.OnClick)?.label
            val combined = listOfNotNull(text, cd, onClickLabel).joinToString(" ").trim()
            assertFalse(
                "[$screenName] clickable node id=${node.id} has no Text/ContentDescription/OnClick label",
                combined.isEmpty(),
            )
        }
    }

    @Test
    fun root_tab_bar_buttons_all_labelled() {
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
        assertEveryClickableHasALabel("RootTab")
    }

    @Test
    fun nearby_empty_state_buttons_all_labelled() {
        compose.setContent {
            NotYetAvailableView(tabName = "Nearby", icon = PantopusIcon.Map)
        }
        assertEveryClickableHasALabel("NearbyEmpty")
    }
}
