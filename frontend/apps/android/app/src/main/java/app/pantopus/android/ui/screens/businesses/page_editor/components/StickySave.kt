@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/** Sticky-save bar mode. Mirrors iOS `EditBusinessStickySaveMode`. */
sealed interface EditBusinessStickySaveMode {
    data class Dirty(val count: Int) : EditBusinessStickySaveMode

    data class Setup(val remaining: Int) : EditBusinessStickySaveMode
}

/**
 * P4.2 — A13.10 Edit Business Page. Bottom-anchored save bar with two
 * modes: Dirty (N unsaved · Discard · Save) and Setup (Save draft ·
 * Publish · N to go, locked until N == 0).
 */
@Composable
fun EditBusinessStickySave(
    mode: EditBusinessStickySaveMode,
    onDiscard: () -> Unit = {},
    onSave: () -> Unit = {},
    onSaveDraft: () -> Unit = {},
    onPublish: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .testTag("editBusinessPage.stickySave"),
    ) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface.copy(alpha = 0.96f))
                    .padding(start = Spacing.s4, end = Spacing.s4, top = 10.dp, bottom = 22.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            when (mode) {
                is EditBusinessStickySaveMode.Dirty -> DirtyRow(count = mode.count, onDiscard = onDiscard, onSave = onSave)
                is EditBusinessStickySaveMode.Setup ->
                    SetupRow(
                        remaining = mode.remaining,
                        onSaveDraft = onSaveDraft,
                        onPublish = onPublish,
                    )
            }
        }
    }
}

@Composable
private fun RowScope.DirtyRow(
    count: Int,
    onDiscard: () -> Unit,
    onSave: () -> Unit,
) {
    DirtyBadge(count = count)
    Spacer(modifier = Modifier.weight(1f))
    Box(
        modifier =
            Modifier
                .clickable(onClick = onDiscard)
                .heightIn(min = 42.dp)
                .padding(horizontal = Spacing.s3)
                .testTag("editBusinessPage.discard"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Discard",
            style = TextStyle(fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appTextStrong,
        )
    }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.lg))
                .pantopusShadow(PantopusElevations.md, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.business)
                .clickable(onClick = onSave)
                .heightIn(min = 42.dp)
                .padding(horizontal = 22.dp)
                .testTag("editBusinessPage.save"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Check,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = "Save",
            style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun RowScope.SetupRow(
    remaining: Int,
    onSaveDraft: () -> Unit,
    onPublish: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clickable(onClick = onSaveDraft)
                .heightIn(min = 42.dp)
                .padding(horizontal = Spacing.s3)
                .testTag("editBusinessPage.saveDraft"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Upload,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.business,
        )
        Text(
            text = "Save draft",
            style = TextStyle(fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.business,
        )
    }
    Spacer(modifier = Modifier.weight(1f))
    val isLocked = remaining > 0
    val bg = if (isLocked) PantopusColors.appSurfaceSunken else PantopusColors.business
    val shadowMod =
        if (isLocked) Modifier else Modifier.pantopusShadow(PantopusElevations.md, RoundedCornerShape(Radii.lg))
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.lg))
                .then(shadowMod)
                .background(bg)
                .then(if (isLocked) Modifier else Modifier.clickable(onClick = onPublish))
                .heightIn(min = 42.dp)
                .padding(horizontal = 16.dp)
                .testTag("editBusinessPage.publish"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (isLocked) {
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "Publish · $remaining to go",
                style = TextStyle(fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextMuted,
            )
        } else {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Publish",
                style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun DirtyBadge(count: Int) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .border(
                    width = 1.dp,
                    color = PantopusColors.warningLight,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(6.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.warning),
        )
        Text(
            text = "$count UNSAVED",
            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold),
            color = PantopusColors.warmAmber,
        )
    }
}
