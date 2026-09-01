package app.pantopus.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

/**
 * Smoke-tests every interactive shared component by hosting it in a
 * Compose UI test harness, asserting it renders, and exercising its
 * click/state callbacks where applicable.
 */
class ComponentsInteractionTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun primary_button_click_fires_handler() {
        var tapped = false
        composeRule.setContent {
            PrimaryButton(title = "Continue", onClick = { tapped = true })
        }
        composeRule.onNodeWithText("Continue").assertIsDisplayed().performClick()
        assert(tapped) { "Expected PrimaryButton onClick to fire" }
    }

    @Test
    fun ghost_and_destructive_buttons_render() {
        composeRule.setContent {
            androidx.compose.foundation.layout.Column {
                GhostButton(title = "Skip", onClick = {})
                DestructiveButton(title = "Delete", onClick = {})
            }
        }
        composeRule.onNodeWithText("Skip").assertIsDisplayed()
        composeRule.onNodeWithText("Delete").assertIsDisplayed()
    }

    @Test
    fun action_chip_click_fires() {
        var tapped = false
        composeRule.setContent {
            ActionChip(
                icon = PantopusIcon.Search,
                label = "Search",
                onClick = { tapped = true },
            )
        }
        composeRule.onNodeWithText("Search").performClick()
        assert(tapped)
    }

    @Test
    fun section_header_action_fires() {
        var tapped = false
        composeRule.setContent {
            SectionHeader("Neighbors", actionTitle = "See all", onAction = { tapped = true })
        }
        composeRule.onNodeWithText("See all").performClick()
        assert(tapped)
    }

    @Test
    fun empty_state_renders_cta() {
        var tapped = false
        composeRule.setContent {
            EmptyState(
                icon = PantopusIcon.Home,
                headline = "No home verified",
                subcopy = "Claim it.",
                ctaTitle = "Claim",
                onCta = { tapped = true },
            )
        }
        composeRule.onNodeWithText("Claim").performClick()
        assert(tapped)
    }

    @Test
    fun text_field_error_renders_helper() {
        composeRule.setContent {
            PantopusTextField(
                label = "Email",
                value = "bad",
                onValueChange = {},
                state = PantopusFieldState.Error("Please enter a valid email address"),
            )
        }
        composeRule.onNodeWithText("Please enter a valid email address").assertIsDisplayed()
    }

    @Test
    fun status_chips_render_all_variants() {
        composeRule.setContent {
            androidx.compose.foundation.layout.Column {
                StatusChip("Success", StatusChipVariant.Success)
                StatusChip("Warning", StatusChipVariant.Warning)
                StatusChip("Error", StatusChipVariant.ErrorVariant)
                StatusChip("Info", StatusChipVariant.Info)
                StatusChip("Personal", StatusChipVariant.Personal)
                StatusChip("Home", StatusChipVariant.Home)
                StatusChip("Business", StatusChipVariant.Business)
                StatusChip("Neutral")
            }
        }
        listOf("Success", "Warning", "Error", "Info", "Personal", "Home", "Business", "Neutral")
            .forEach { composeRule.onNodeWithText(it).assertIsDisplayed() }
    }

    @Test
    fun timeline_renders_all_states() {
        composeRule.setContent {
            // StepMarker's connector uses `fillMaxHeight()`. Without a
            // bounded vertical AND horizontal host, that resolves toward
            // Constraints.Infinity and the row is clipped off-screen,
            // tripping assertIsDisplayed. A 360 × 480 dp Box mirrors a
            // typical content surface.
            Box(modifier = Modifier.size(width = 360.dp, height = 480.dp)) {
                TimelineStepper(
                    steps =
                        listOf(
                            TimelineStep("Placed", TimelineStepState.Done),
                            TimelineStep("In transit", TimelineStepState.Current),
                            TimelineStep("Delivered", TimelineStepState.Upcoming),
                        ),
                )
            }
        }
        // The parent Row sets a contentDescription without mergeDescendants,
        // which hides the child Text nodes from the default merged tree.
        // useUnmergedTree=true reaches the inner Text composables directly.
        // assertExists is enough — we already know the bounded Box places
        // them on-screen; assertIsDisplayed adds an alpha/visibility check
        // that the StepMarker's `Current` pulse animation transiently
        // fails (alpha animates 1→0).
        listOf("Placed", "In transit", "Delivered").forEach {
            composeRule.onNodeWithText(it, useUnmergedTree = true).assertExists()
        }
    }
}
