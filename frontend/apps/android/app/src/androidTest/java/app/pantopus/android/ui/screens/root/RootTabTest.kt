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
import org.junit.Rule
import org.junit.Test

/**
 * Bottom-bar tab switching with stub destinations.
 */
class RootTabTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun home_is_default_and_tabs_switch() {
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
                Box(Modifier.padding(padding)) {
                    Box(Modifier.fillMaxSize().testTag("landing.${selected.path}"))
                }
            }
        }

        composeRule.onNodeWithTag("landing.root/home").assertIsDisplayed()
        for (route in PantopusRoute.entries) {
            composeRule.onNodeWithTag("tab.${route.path.substringAfterLast('/')}").performClick()
            composeRule.onNodeWithTag("landing.${route.path}").assertIsDisplayed()
        }
        composeRule.onNodeWithTag("tab.home").performClick()
        composeRule.onNodeWithTag("landing.root/home").assertIsDisplayed()
    }
}
