@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.MotionTokens
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion

/** Test tag applied to the OfflineBanner container. */
const val OFFLINE_BANNER_TAG = "offlineBanner"

/**
 * Top-of-screen banner shown when the app is offline but cached data
 * is still visible underneath. Wrap any list/detail screen with
 * [OfflineBannerHost] so the banner slot stays consistent (P15).
 */
@Composable
fun OfflineBanner(
    onDismiss: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.warningBg)
                .testTag(OFFLINE_BANNER_TAG),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.WifiOff,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.warning,
            )
            Text(
                text = "You're offline. Showing last known data.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clickable(role = Role.Button, onClick = onDismiss),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Dismiss offline banner",
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        HorizontalDivider(
            thickness = 1.dp,
            color = PantopusColors.warning.copy(alpha = 0.3f),
        )
    }
}

/**
 * Hosts an [OfflineBanner] above [content] when [isOffline] is true
 * and the user hasn't dismissed it. The banner re-appears on the next
 * offline transition.
 */
@Composable
fun OfflineBannerHost(
    isOffline: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var dismissed by remember { mutableStateOf(false) }

    // Reset the dismiss flag on every offline → online transition so
    // the banner re-appears on the next offline event.
    LaunchedEffect(isOffline) {
        if (!isOffline) dismissed = false
    }

    Column(modifier = modifier) {
        val reduceMotion = rememberReduceMotion()
        AnimatedVisibility(
            visible = isOffline && !dismissed,
            enter =
                fadeIn(animationSpec = MotionTokens.componentState(reduceMotion)) +
                    expandVertically(animationSpec = MotionTokens.componentState(reduceMotion)),
            exit =
                fadeOut(animationSpec = MotionTokens.componentState(reduceMotion)) +
                    shrinkVertically(animationSpec = MotionTokens.componentState(reduceMotion)),
        ) {
            OfflineBanner(onDismiss = { dismissed = true })
        }
        content()
    }
}
