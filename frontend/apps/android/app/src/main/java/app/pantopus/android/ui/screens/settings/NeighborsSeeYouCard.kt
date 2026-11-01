package app.pantopus.android.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * How neighbors see you, in Privacy's header slot: a row that opens Edit profile, whose "Neighbors see this" edits the
 * name and photo neighbors see with the rest of the profile (PRF: one editor). Keeps the card's test tag.
 */
@Composable
fun NeighborsSeeYouRow(onOpen: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(Spacing.s4)
                .testTag("neighborsSeeYou"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = "How neighbors see you", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            Text(
                text = "Your name and photo on your posts, comments, chats, tasks and notices. Change them in Edit profile.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextMuted)
    }
}
