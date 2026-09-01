@file:Suppress("MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.pantopusShadow
import app.pantopus.android.ui.theme.rememberReduceMotion

/**
 * A19 legal scaffold — a small circular "scroll to top" button that fades in
 * once the reader scrolls past the table of contents. The host screen owns
 * the scroll threshold + the scroll-to-top action and toggles [isVisible];
 * the fab owns the fade/slide transition (180 ms, collapsing to 100 ms under
 * reduce-motion), the 48 dp touch target, and disabling interaction when
 * hidden.
 *
 * A 40 dp visual circle sits inside a 48 dp tap target on a sunken surface.
 *
 * @param isVisible Whether the fab is shown (host wires `scrollTop > ~220`).
 * @param onTap Scroll the host's scroll view back to the top.
 */
@Composable
fun BackToTopFab(
    isVisible: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val reduceMotion = rememberReduceMotion()
    val durationMs = if (reduceMotion) 100 else 180
    val alpha by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = tween(durationMs),
        label = "backToTopAlpha",
    )
    val offsetY by animateDpAsState(
        targetValue = if (isVisible) 0.dp else 6.dp,
        animationSpec = tween(durationMs),
        label = "backToTopOffset",
    )
    IconButton(
        onClick = onTap,
        enabled = isVisible,
        modifier =
            modifier
                .size(48.dp)
                .alpha(alpha)
                .offset(y = offsetY)
                .testTag("backToTopFab"),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .pantopusShadow(PantopusElevations.fab, CircleShape)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.dp, PantopusColors.appBorder, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowUp,
                contentDescription = "Back to top",
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appText,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 120, heightDp = 120)
@Composable
private fun BackToTopFabPreview() {
    BackToTopFab(isVisible = true, onTap = {})
}
