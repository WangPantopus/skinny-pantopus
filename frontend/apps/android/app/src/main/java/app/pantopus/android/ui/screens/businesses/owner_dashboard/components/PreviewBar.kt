@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.owner_dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.7 — the dark bar pinned above the public render while the owner is
 * "previewing as a neighbor": an eye glyph, a two-line label, and an Exit
 * button that returns to the owner / edit frame. Uses `appText` for the dark
 * chrome. Mirrors iOS `PreviewBar.swift`.
 */
@Composable
fun PreviewBar(
    onExit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appText)
                .padding(horizontal = 14.dp, vertical = 9.dp)
                .testTag("businessOwner.previewBar"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Eye,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextInverse,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = "Previewing as a neighbor",
                color = PantopusColors.appTextInverse,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = "This is exactly what the public sees",
                color = PantopusColors.appTextInverse.copy(alpha = 0.65f),
                fontSize = 10.5.sp,
            )
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appTextInverse.copy(alpha = 0.16f))
                    .clickable(onClick = onExit)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
                    .semantics { contentDescription = "Exit preview" }
                    .testTag("businessOwner.exitPreview"),
        ) {
            Text(
                text = "Exit",
                color = PantopusColors.appTextInverse,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
