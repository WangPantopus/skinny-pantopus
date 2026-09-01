@file:Suppress("MagicNumber", "PackageNaming")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.saved_places

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * BLOCK 2E Frame 3 — the row overflow action sheet: Open on map / Share place /
 * Remove (destructive). Driven by the VM's `actionTarget` signal.
 */
@Composable
fun SavedPlacesActionSheet(
    target: SavedPlaceActionTarget,
    onOpenMap: () -> Unit,
    onShare: () -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s4).testTag("savedPlaces.actionSheet"),
        ) {
            ContextHeader(target)
            Divider()
            ActionRow(
                icon = PantopusIcon.Map,
                label = "Open on map",
                testTag = "savedPlaces.action.openMap",
                onClick = onOpenMap,
            )
            Divider()
            ActionRow(
                icon = PantopusIcon.Share,
                label = "Share place",
                testTag = "savedPlaces.action.share",
                onClick = onShare,
            )
            Divider()
            ActionRow(
                icon = PantopusIcon.Trash2,
                label = "Remove",
                testTag = "savedPlaces.action.remove",
                destructive = true,
                onClick = onRemove,
            )
        }
    }
}

@Composable
private fun ContextHeader(target: SavedPlaceActionTarget) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(target.type.tileBackground),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = target.type.icon,
                contentDescription = null,
                size = 16.dp,
                tint = target.type.tileForeground,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = target.label,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = target.subtitle,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun ActionRow(
    icon: PantopusIcon,
    label: String,
    testTag: String,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    val tint = if (destructive) PantopusColors.error else PantopusColors.appText
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = tint)
        Text(text = label, fontSize = 15.5.sp, fontWeight = FontWeight.Medium, color = tint)
    }
}

@Composable
private fun Divider() {
    Box(
        Modifier
            .fillMaxWidth()
            .height(1.dp)
            .padding(start = Spacing.s12)
            .background(PantopusColors.appBorderSubtle),
    )
}
