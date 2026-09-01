@file:Suppress("PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Compose-runtime interaction coverage for the P1.2 input + indicator
 * primitives. Lives in `androidTest` so [androidx.compose.ui.test] can
 * drive focus + key events; pure-logic coverage stays in `test/`.
 */
class InputPrimitivesInteractionTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun codeInput_typesAdvanceAndCompletionFiresOnce() {
        val completions = mutableListOf<String>()
        composeRule.setContent {
            var value by remember { mutableStateOf("") }
            CodeInput(
                value = value,
                onValueChange = { value = it },
                onComplete = { completions += it },
                fieldTestTag = "code-input",
            )
        }
        // Type six characters → onComplete fires once.
        composeRule.onNodeWithTag("code-input").performTextInput("abcdef")
        composeRule.waitForIdle()
        assertEquals(listOf("ABCDEF"), completions)
    }

    @Test
    fun codeInput_lockedSwallowsInput() {
        val completions = mutableListOf<String>()
        composeRule.setContent {
            var value by remember { mutableStateOf("") }
            CodeInput(
                value = value,
                onValueChange = { value = it },
                isDisabled = true,
                onComplete = { completions += it },
                fieldTestTag = "code-input-locked",
            )
        }
        // The hidden TextField has `enabled = !isDisabled`; performTextInput
        // on a disabled node is a no-op but won't crash.
        try {
            composeRule.onNodeWithTag("code-input-locked").performTextInput("ABCDEF")
        } catch (_: AssertionError) {
            // Expected — Compose may assert that the node is enabled before
            // typing; either way the contract holds: no completion event.
        }
        assertTrue("Locked input must not fire onComplete", completions.isEmpty())
    }

    @Test
    fun channelChip_offFiresTapAndLockedSwallows() {
        var offTaps = 0
        var lockedTaps = 0
        composeRule.setContent {
            androidx.compose.foundation.layout.Row {
                ChannelChip(
                    glyph = ChannelGlyph.P,
                    state = ChannelState.Off,
                    onTap = { offTaps += 1 },
                    chipTestTag = "chip-off",
                )
                ChannelChip(
                    glyph = ChannelGlyph.E,
                    state = ChannelState.Locked,
                    onTap = { lockedTaps += 1 },
                    chipTestTag = "chip-locked",
                )
            }
        }
        composeRule.onNodeWithTag("chip-off").assertIsDisplayed().performClick()
        composeRule.onNodeWithTag("chip-locked").performClick()
        composeRule.waitForIdle()
        assertEquals(1, offTaps)
        assertEquals("Locked chip must not fire onTap", 0, lockedTaps)
    }
}
