@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.support_trains.manage.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.support_trains.manage.OrganizeRowContent
import app.pantopus.android.ui.screens.support_trains.manage.OrganizeRowTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MANAGE_TRAIN_ORGANIZE_SECTION_TAG: String = "manageTrainOrganizeSection"
const val MANAGE_TRAIN_WIND_DOWN_SECTION_TAG: String = "manageTrainWindDownSection"

fun manageTrainControlRowTag(id: String): String = "manageTrainControlRow.$id"

/**
 * One row inside an Organize / Wind-down card. Mirrors the iOS
 * [ManageControlRow] geometry: 32dp tinted icon tile + label + optional
 * meta pill + sub-line + trailing chevron.
 */
@Composable
fun ManageControlRow(
    content: OrganizeRowContent,
    isLast: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onTap)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                    .testTag(manageTrainControlRowTag(content.id)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            IconTile(icon = content.icon, tone = content.tone)
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = content.label,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (content.isDestructive) PantopusColors.error else PantopusColors.appText,
                    )
                    if (content.meta != null) {
                        MetaPill(value = content.meta)
                    }
                }
                if (content.sub != null) {
                    Text(
                        text = content.sub,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 2,
                    )
                }
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (!isLast) {
            Box(
                modifier =
                    Modifier
                        .padding(start = Spacing.s3 + 32.dp + Spacing.s3)
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(PantopusColors.appBorderSubtle),
            )
        }
    }
}

@Composable
private fun IconTile(
    icon: PantopusIcon,
    tone: OrganizeRowTone,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(tileBackground(tone)),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 16.dp,
            tint = tileForeground(tone),
        )
    }
}

@Composable
private fun MetaPill(value: String) {
    Box(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 1.dp),
    ) {
        Text(
            text = value,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

/** Three-row Organize card. */
@Composable
fun OrganizeSection(
    rows: List<OrganizeRowContent>,
    onTapRow: (OrganizeRowContent) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .testTag(MANAGE_TRAIN_ORGANIZE_SECTION_TAG),
    ) {
        rows.forEachIndexed { index, row ->
            ManageControlRow(
                content = row,
                isLast = index == rows.size - 1,
                onTap = { onTapRow(row) },
            )
        }
    }
}

/** Single-row Wind-down card with the destructive `Close train` row. */
@Composable
fun WindDownSection(
    row: OrganizeRowContent,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .testTag(MANAGE_TRAIN_WIND_DOWN_SECTION_TAG),
    ) {
        ManageControlRow(content = row, isLast = true, onTap = onTap)
    }
}

private fun tileBackground(tone: OrganizeRowTone): Color =
    when (tone) {
        OrganizeRowTone.AMBER -> PantopusColors.warmAmberBg
        OrganizeRowTone.SKY -> PantopusColors.primary50
        OrganizeRowTone.GREEN -> PantopusColors.successBg
        OrganizeRowTone.RED -> PantopusColors.errorBg
    }

private fun tileForeground(tone: OrganizeRowTone): Color =
    when (tone) {
        OrganizeRowTone.AMBER -> PantopusColors.warmAmber
        OrganizeRowTone.SKY -> PantopusColors.primary600
        OrganizeRowTone.GREEN -> PantopusColors.success
        OrganizeRowTone.RED -> PantopusColors.error
    }
