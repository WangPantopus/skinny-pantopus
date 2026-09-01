@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.PartyBringItem
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.9 — "If you'd like to bring something" rows. Emoji tile + item
 * label + claim attribution + trailing affordance (rose-outline "I'll
 * bring it" pill when unclaimed; rose check-circle for the user's own
 * claim; muted check for friends' claims).
 */
@Composable
fun PotluckList(
    party: PartyDetailDto,
    onClaim: (Int) -> Unit,
    onRelease: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("partyPotluckList"),
    ) {
        Header(party)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        party.bringList.forEachIndexed { index, item ->
            RowItem(item = item, index = index, onClaim = onClaim, onRelease = onRelease)
            if (index < party.bringList.lastIndex) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun Header(party: PartyDetailDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "IF YOU'D LIKE TO BRING SOMETHING",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        val claimed = party.bringList.count { it.claimedBy != null }
        Text(
            text = "$claimed of ${party.bringList.size} claimed",
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun RowItem(
    item: PartyBringItem,
    index: Int,
    onClaim: (Int) -> Unit,
    onRelease: (Int) -> Unit,
) {
    val isYou = item.claimedBy == "You"
    val claimed = item.claimedBy != null
    val rowBg = if (isYou) PantopusColors.errorBg.copy(alpha = 0.5f) else Color.Transparent
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(rowBg)
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .testTag("partyPotluckList_row_${item.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        EmojiTile(emoji = item.emoji, highlighted = isYou)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.item,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (claimed && !isYou) PantopusColors.appTextSecondary else PantopusColors.appText,
                textDecoration = if (claimed && !isYou) TextDecoration.LineThrough else TextDecoration.None,
            )
            when {
                isYou ->
                    Text(
                        text = "You're bringing this",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Black,
                        color = PantopusColors.categoryParty,
                    )
                item.claimedBy != null ->
                    Text(
                        text = "${item.claimedBy} has it",
                        fontSize = 10.5.sp,
                        color = PantopusColors.appTextSecondary,
                    )
            }
        }
        Trailing(claimed = claimed, isYou = isYou, index = index, onClaim = onClaim, onRelease = onRelease)
    }
}

@Composable
private fun Trailing(
    claimed: Boolean,
    isYou: Boolean,
    index: Int,
    onClaim: (Int) -> Unit,
    onRelease: (Int) -> Unit,
) {
    when {
        !claimed -> {
            Text(
                text = "I'll bring it",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.categoryParty,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .border(
                            1.dp,
                            PantopusColors.categoryParty.copy(alpha = 0.45f),
                            RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onClaim(index) }
                        .padding(horizontal = Spacing.s3, vertical = 6.dp)
                        .testTag("partyPotluckList_claim_$index"),
            )
        }
        isYou ->
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = "You're bringing this. Tap to release.",
                size = 18.dp,
                tint = PantopusColors.categoryParty,
                modifier =
                    Modifier
                        .clickable { onRelease(index) }
                        .testTag("partyPotluckList_release_$index"),
            )
        else ->
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
    }
}

@Composable
private fun EmojiTile(
    emoji: String,
    highlighted: Boolean,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (highlighted) PantopusColors.appSurface else PantopusColors.appSurfaceSunken)
                .border(
                    if (highlighted) 1.5.dp else 1.dp,
                    if (highlighted) PantopusColors.categoryParty else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.md),
                ),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = emoji, fontSize = 16.sp)
    }
}
