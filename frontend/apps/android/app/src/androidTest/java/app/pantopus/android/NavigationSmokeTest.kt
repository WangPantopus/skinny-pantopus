package app.pantopus.android

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
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import app.pantopus.android.ui.screens.root.NotYetAvailableView
import app.pantopus.android.ui.screens.root.PantopusBottomBar
import app.pantopus.android.ui.screens.root.PantopusRoute
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

/** Exercises the real four-tab bottom bar with Hilt-free stub destinations. */
class NavigationSmokeTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun bottomBarTabs_swapDestinationsCorrectly() {
        composeRule.setContent {
            var selected by remember { mutableStateOf<PantopusRoute>(PantopusRoute.Place) }
            Scaffold(
                modifier = Modifier.testTag("rootScaffold"),
                bottomBar = {
                    PantopusBottomBar(
                        selected = selected,
                        onSelect = { selected = it },
                    )
                },
            ) { padding ->
                Box(Modifier.fillMaxSize().padding(padding)) {
                    Box(Modifier.fillMaxSize().testTag("smoke.${selected.path}"))
                }
            }
        }

        composeRule.onNodeWithTag("smoke.root/home").assertIsDisplayed()
        for (tab in listOf("today", "nearby", "mail", "home")) {
            composeRule.onNodeWithTag("tab.$tab").assertIsDisplayed().performClick()
            composeRule.onNodeWithTag("smoke.root/$tab").assertIsDisplayed()
        }
    }

    /**
     * Verifies that the `NotYetAvailableView` empty-state placeholder
     * still surfaces — `RootTabScreen.kt` routes any unknown
     * `ChildRoutes.PLACEHOLDER` push through this composable. The
     * placeholder funnel is the only `NOT_YET_AVAILABLE` destination in
     * the nav graph closure (see `docs/nav-graph-closure.md`).
     */
    @Test
    fun notYetAvailable_placeholderRenders() {
        composeRule.setContent {
            NotYetAvailableView(
                tabName = "Smoke Test",
                icon = PantopusIcon.Inbox,
            )
        }
        composeRule.onNodeWithTag(NOT_YET_AVAILABLE_TAG_SMOKE).assertIsDisplayed()
    }

    /**
     * Bottom-bar reachability for every `PantopusRoute.entries` element.
     * Independent of the rendering test above — this asserts the route
     * inventory (path string + testTag derivation) is stable. If a tab
     * is renamed or removed, this test fails before the integration test.
     */
    @Test
    fun pantopusRoute_entriesEachExposeBottomBarTestTag() {
        val expectedTags =
            PantopusRoute.entries.map { route ->
                "tab.${route.path.substringAfterLast('/')}"
            }
        // Place keeps its legacy home path for deep-link compatibility.
        check(expectedTags == listOf("tab.home", "tab.today", "tab.nearby", "tab.mail")) {
            "PantopusRoute.entries derived testTags drifted: $expectedTags"
        }
    }

    private companion object {
        // Note: matches the tag emitted by NotYetAvailableView via its
        // outermost `.testTag(NOT_YET_AVAILABLE_TAG)` constant, which is
        // visible only to package siblings. Re-declared here so the smoke
        // test stays decoupled from the internal constant; the assertion
        // still anchors on the same surface (icon + heading) that
        // NotYetAvailableView produces.
        const val NOT_YET_AVAILABLE_TAG_SMOKE = "notYetAvailable"
    }
}
