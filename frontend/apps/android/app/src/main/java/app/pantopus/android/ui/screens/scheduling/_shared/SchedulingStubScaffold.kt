@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The A0 placeholder body that every pre-stubbed scheduling screen renders
 * until its owning feature stream fills in the real implementation. Keeps the
 * route resolvable (and back-navigable) without crashing.
 */
@Composable
fun SchedulingStubScaffold(
    title: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag("schedulingStub")) {
        if (onBack != null) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2, vertical = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(BACK_BUTTON_SIZE)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable(onClickLabel = "Back", onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronLeft,
                        contentDescription = "Back",
                        size = BACK_ICON_SIZE,
                        tint = PantopusColors.appText,
                    )
                }
            }
        }
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            EmptyState(
                icon = PantopusIcon.Calendar,
                headline = title,
                subcopy = "This Calendarly screen is coming soon in this build.",
            )
        }
    }
}

private val BACK_BUTTON_SIZE = 40.dp
private val BACK_ICON_SIZE = 20.dp
