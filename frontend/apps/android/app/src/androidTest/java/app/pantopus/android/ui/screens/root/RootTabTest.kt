package app.pantopus.android.ui.screens.root

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
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

private const val HUB_SCREEN_TAG = "hubScreen"

/**
 * Bottom-bar tab switching with stub destinations.
 */
class RootTabTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun home_is_default_and_tabs_switch() {
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

        // Default is Home.
        composeRule.onNodeWithTag(HUB_SCREEN_TAG).assertIsDisplayed()

        // Pulse tab renders the feed container.
        composeRule.onNodeWithTag("tab.pulse").performClick()
        composeRule.onNodeWithTag("pulseFeed").assertIsDisplayed()

        // Tasks tab renders the gigs feed container.
        composeRule.onNodeWithTag("tab.tasks").performClick()
        composeRule.onNodeWithTag("gigsFeed").assertIsDisplayed()

        // Marketplace tab renders its grid container.
        composeRule.onNodeWithTag("tab.marketplace").performClick()
        composeRule.onNodeWithTag("marketplace").assertIsDisplayed()

        // Messages tab renders its empty-state heading.
        composeRule.onNodeWithTag("tab.messages").performClick()
        composeRule.onNodeWithTag("notYetAvailable").assertIsDisplayed()

        // Back to Home.
        composeRule.onNodeWithTag("tab.home").performClick()
        composeRule.onNodeWithTag(HUB_SCREEN_TAG).assertIsDisplayed()
    }
}
