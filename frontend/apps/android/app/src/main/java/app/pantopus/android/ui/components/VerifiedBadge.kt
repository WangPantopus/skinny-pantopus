@file:Suppress("MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Small check badge pinned to an avatar corner.
 *
 * @param size Outer diameter; defaults to 16dp.
 * @param tint Disc fill. Defaults to [PantopusColors.success] green (the
 *   app-wide "verified" language); the Pulse / Beacons feed passes
 *   [PantopusColors.primary600] to match the A03 design's sky check disc.
 */
@Composable
fun VerifiedBadge(
    modifier: Modifier = Modifier,
    size: Dp = 16.dp,
    tint: Color = PantopusColors.success,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(tint)
                .border(1.5.dp, Color.White, CircleShape)
                .semantics { contentDescription = "Verified" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Check,
            contentDescription = null,
            size = size * 0.6f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

@Preview(showBackground = true, widthDp = 200, heightDp = 60)
@Composable
private fun VerifiedBadgePreview() {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.background(Color.White)) {
        VerifiedBadge()
        VerifiedBadge(size = Radii.xl2)
        VerifiedBadge(size = 28.dp)
    }
}
