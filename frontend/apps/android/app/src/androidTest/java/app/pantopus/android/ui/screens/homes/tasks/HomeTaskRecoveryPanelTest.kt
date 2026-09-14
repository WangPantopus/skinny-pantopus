package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** Actual Compose control regression: clean recovery must not inherit a disabled dirty-form Save. */
class HomeTaskRecoveryPanelTest {
    @get:Rule val compose = createComposeRule()

    @Test fun original_retry_is_enabled_and_clickable_on_a_clean_recovery_panel() {
        var retries = 0
        compose.setContent {
            HomeTaskRecoveryPanel("Saved task request", "Original request retained", false, { retries++ }, {})
        }
        compose.onNodeWithText("Retry original request").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(1, retries) }
    }

    @Test fun in_flight_recovery_disables_retry_and_acknowledgement() {
        compose.setContent {
            HomeTaskRecoveryPanel("Saved task request", "Original request retained", true, {}, {}, {})
        }
        compose.onNodeWithText("Retry original request").assertIsNotEnabled()
        compose.onNodeWithText("Clear saved request").assertIsNotEnabled()
    }
}
