@file:Suppress("PackageNaming")

package app.pantopus.android.a11y

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.root.NotYetAvailableView
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

/**
 * Mounts representative screens with `LocalDensity` overridden to a
 * 1.3× font scale and asserts the chrome doesn't clip. Doesn't verify
 * pixel widths (fragile across devices); instead asserts that key
 * elements still meet their minimum size and remain displayed.
 */
class DynamicTypeAudit {
    @get:Rule
    val compose = createComposeRule()

    /**
     * Wraps `content` with a `LocalDensity` override that bumps
     * `fontScale` to 1.3× — the standard Material recommendation for
     * stress-testing layouts.
     */
    private fun setLargeFontScaleContent(content: @androidx.compose.runtime.Composable () -> Unit) {
        compose.setContent {
            val original = LocalDensity.current
            val scaledDensity =
                Density(density = original.density, fontScale = 1.3f)
            CompositionLocalProvider(LocalDensity provides scaledDensity) {
                Box(Modifier.fillMaxSize()) { content() }
            }
        }
    }

    @Test
    fun nearby_empty_state_renders_at_1_3x() {
        setLargeFontScaleContent {
            NotYetAvailableView(tabName = "Nearby", icon = PantopusIcon.Map)
        }
        // The empty-state container is the testTag-bearing Box.
        compose
            .onNodeWithTag(app.pantopus.android.ui.screens.root.NOT_YET_AVAILABLE_TAG)
            .assertIsDisplayed()
            .assertWidthIsAtLeast(48.dp)
            .assertHeightIsAtLeast(48.dp)
    }

    @Test
    fun you_empty_state_renders_at_1_3x() {
        setLargeFontScaleContent {
            NotYetAvailableView(tabName = "You", icon = PantopusIcon.User)
        }
        compose
            .onNodeWithTag(app.pantopus.android.ui.screens.root.NOT_YET_AVAILABLE_TAG)
            .assertIsDisplayed()
    }
}
