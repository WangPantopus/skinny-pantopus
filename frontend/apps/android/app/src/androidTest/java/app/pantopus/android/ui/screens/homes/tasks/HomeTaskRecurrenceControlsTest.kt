package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class HomeTaskRecurrenceControlsTest {
    @get:Rule val compose = createComposeRule()

    @Test fun interval_renders_and_edits_under_real_app_typography_without_unit_animation_crash() {
        var changed: String? = null
        compose.setContent {
            PantopusTheme {
                var value by remember { mutableStateOf("1") }
                Column {
                    HomeTaskRecurrenceInterval(value, {
                        value = it
                        changed = it
                    }, true)
                }
            }
        }
        compose.onNodeWithText("Interval from 1 to 365").assertExists()
        compose.onNodeWithTag("homeTaskRecurrence.interval").performClick().performTextReplacement("2")
        compose.onNodeWithTag("homeTaskRecurrence.interval").assertTextEquals("2")
        compose.runOnIdle { assertEquals("2", changed) }
    }
}
