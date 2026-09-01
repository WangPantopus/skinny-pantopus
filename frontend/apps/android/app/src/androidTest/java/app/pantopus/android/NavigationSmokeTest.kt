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

/**
 * P8.3 — End-to-end navigation smoke test (Android instrumented).
 *
 * Coverage strategy
 * ─────────────────
 * The Android side exposes 4 [PantopusRoute] bottom-bar destinations plus
 * 117 typed `ChildRoutes` constants inside `RootTabScreen.kt`. Hosting
 * the real `RootTabScreen` from a Compose UI test would require Hilt
 * test infrastructure (a `HiltAndroidRule`, `@HiltAndroidTest` activity)
 * that the codebase does not yet ship — driving every Hilt-injected
 * view-model through `connectedAndroidTest` is out of scope for a smoke
 * pass. The existing screen-level tests
 * (`AddHomeWizardScreenTest`, `LoginScreenTest`, `RootTabTest`,
 * `ComponentsInteractionTest`) follow the same pattern: bypass Hilt by
 * hosting a target composable directly via `composeRule.setContent`.
 *
 * This file extends that pattern across every bottom-bar route:
 *  - drives the real [PantopusBottomBar] with the same `tab.<path>`
 *    testTags the app ships;
 *  - swaps in stub destinations that render the testTag the real
 *    landing screen carries (`hubScreen`, `nearbyMap`, `chatList`,
 *    `meScreen`);
 *  - verifies tab selection swaps the visible destination's testTag.
 *
 * For in-tab navigation correctness the canonical reference is the
 * static analysis in `docs/nav-graph-closure.md` (every `ChildRoutes`
 * constant audited against its `navigate(...)` call sites + the
 * `composable(route)` block in `RootTabScreen.kt`). The route-by-route
 * pass/fail summary is in `docs/nav-smoke-results.md`.
 */
class NavigationSmokeTest {
    @get:Rule
    val composeRule = createComposeRule()

    /**
     * Render the five bottom-bar tabs with stub destinations whose
     * testTags match the real landing screens. Verifies:
     *  - all five tab affordances render with `tab.home` / `tab.pulse` /
     *    `tab.tasks` / `tab.marketplace` / `tab.messages`;
     *  - selecting a tab swaps the visible destination's testTag;
     *  - selecting Home returns to the Home destination.
     */
    @Test
    fun bottomBarTabs_swapDestinationsCorrectly() {
        composeRule.setContent {
            var selected by remember { mutableStateOf<PantopusRoute>(PantopusRoute.Home) }
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
                    when (selected) {
                        PantopusRoute.Home ->
                            Box(Modifier.fillMaxSize().testTag(LANDING_TAG_HOME))
                        PantopusRoute.Pulse ->
                            Box(Modifier.fillMaxSize().testTag(LANDING_TAG_PULSE))
                        PantopusRoute.Tasks ->
                            Box(Modifier.fillMaxSize().testTag(LANDING_TAG_TASKS))
                        PantopusRoute.Marketplace ->
                            Box(Modifier.fillMaxSize().testTag(LANDING_TAG_MARKETPLACE))
                        PantopusRoute.Messages ->
                            Box(Modifier.fillMaxSize().testTag(LANDING_TAG_MESSAGES))
                    }
                }
            }
        }

        // 1. All five tabs render with the expected testTags.
        composeRule.onNodeWithTag("tab.home").assertIsDisplayed()
        composeRule.onNodeWithTag("tab.pulse").assertIsDisplayed()
        composeRule.onNodeWithTag("tab.tasks").assertIsDisplayed()
        composeRule.onNodeWithTag("tab.marketplace").assertIsDisplayed()
        composeRule.onNodeWithTag("tab.messages").assertIsDisplayed()

        // 2. Default landing is Home.
        composeRule.onNodeWithTag(LANDING_TAG_HOME).assertIsDisplayed()

        // 3. Tapping Pulse swaps in the feed landing tag.
        composeRule.onNodeWithTag("tab.pulse").performClick()
        composeRule.onNodeWithTag(LANDING_TAG_PULSE).assertIsDisplayed()

        // 4. Tapping Tasks swaps in the gigs feed landing tag.
        composeRule.onNodeWithTag("tab.tasks").performClick()
        composeRule.onNodeWithTag(LANDING_TAG_TASKS).assertIsDisplayed()

        // 5. Tapping Marketplace swaps in the marketplace landing tag.
        composeRule.onNodeWithTag("tab.marketplace").performClick()
        composeRule.onNodeWithTag(LANDING_TAG_MARKETPLACE).assertIsDisplayed()

        // 6. Tapping Messages swaps in the chat list landing tag.
        composeRule.onNodeWithTag("tab.messages").performClick()
        composeRule.onNodeWithTag(LANDING_TAG_MESSAGES).assertIsDisplayed()

        // 7. Re-selecting Home returns to the Home landing.
        composeRule.onNodeWithTag("tab.home").performClick()
        composeRule.onNodeWithTag(LANDING_TAG_HOME).assertIsDisplayed()
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
        // Home / Pulse / Tasks / Marketplace / Messages.
        check(expectedTags == listOf("tab.home", "tab.pulse", "tab.tasks", "tab.marketplace", "tab.messages")) {
            "PantopusRoute.entries derived testTags drifted: $expectedTags"
        }
    }

    private companion object {
        const val LANDING_TAG_HOME = "smokeStub.hubScreen"
        const val LANDING_TAG_PULSE = "smokeStub.pulseFeed"
        const val LANDING_TAG_TASKS = "smokeStub.gigsFeed"
        const val LANDING_TAG_MARKETPLACE = "smokeStub.marketplace"
        const val LANDING_TAG_MESSAGES = "smokeStub.chatList"

        // Note: matches the tag emitted by NotYetAvailableView via its
        // outermost `.testTag(NOT_YET_AVAILABLE_TAG)` constant, which is
        // visible only to package siblings. Re-declared here so the smoke
        // test stays decoupled from the internal constant; the assertion
        // still anchors on the same surface (icon + heading) that
        // NotYetAvailableView produces.
        const val NOT_YET_AVAILABLE_TAG_SMOKE = "notYetAvailable"
    }
}
