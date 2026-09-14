package app.pantopus.android.ui.theme

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.Density
import org.junit.Rule
import org.junit.Test

/** Render and animate actual Material labels under the installed app theme. */
class MaterialFieldTypographyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun floating_labels_render_focus_edit_and_clear_at_default_font_scale() = exerciseFields(1f)

    @Test fun floating_labels_render_focus_edit_and_clear_at_large_font_scale() = exerciseFields(LARGE_FONT_SCALE)

    private fun exerciseFields(fontScale: Float) {
        compose.setContent {
            val density = LocalDensity.current.density
            CompositionLocalProvider(LocalDensity provides Density(density, fontScale)) {
                PantopusTheme {
                    var outlined by remember { mutableStateOf("") }
                    var filled by remember { mutableStateOf("") }
                    Column {
                        OutlinedTextField(
                            value = outlined,
                            onValueChange = { outlined = it },
                            label = { Text("Private note") },
                            modifier = Modifier.testTag("outlined"),
                        )
                        TextField(
                            value = filled,
                            onValueChange = { filled = it },
                            label = { Text("Response") },
                            modifier = Modifier.testTag("filled"),
                        )
                    }
                }
            }
        }
        compose.onNodeWithTag("outlined").performClick().performTextReplacement("Reviewed note")
        compose.onNodeWithTag("outlined").assertTextContains("Reviewed note")
        compose.onNodeWithTag("filled").performClick().performTextReplacement("Reviewed response")
        compose.onNodeWithTag("filled").assertTextContains("Reviewed response")
        compose.onNodeWithTag("outlined").performClick().performTextReplacement("")
        compose.onNodeWithTag("filled").performClick().performTextReplacement("")
        compose.onNodeWithTag("outlined").performClick()
        compose.waitForIdle()
    }
}

private const val LARGE_FONT_SCALE = 1.5f
