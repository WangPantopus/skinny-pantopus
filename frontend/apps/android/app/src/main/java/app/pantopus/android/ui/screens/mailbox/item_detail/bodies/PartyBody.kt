@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.GoingStrip
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.PotluckList
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.9 — Concrete party-mail body. Stacks the going strip, handwritten
 * note, and potluck claim list — the three slots the shell's body slot
 * carries beyond the hero / elf / details / sender / actions chrome.
 */
@Composable
fun PartyBody(
    party: PartyDetailDto,
    onClaimBring: (Int) -> Unit,
    onReleaseBring: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag("partyBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        GoingStrip(party = party)
        PartyNoteCard(party = party)
        PotluckList(party = party, onClaim = onClaimBring, onRelease = onReleaseBring)
    }
}

@Composable
private fun PartyNoteCard(party: PartyDetailDto) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(
                    Brush.verticalGradient(
                        listOf(
                            PantopusColors.appSurface,
                            PantopusColors.errorBg.copy(alpha = 0.6f),
                        ),
                    ),
                )
                .border(1.dp, PantopusColors.categoryParty.copy(alpha = 0.30f), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag("partyNoteCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                modifier = Modifier.weight(1f),
                text = party.note.eyebrow.uppercase(),
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.6.sp,
                color = PantopusColors.categoryParty.copy(alpha = 0.8f),
            )
            PantopusIconImage(
                icon = PantopusIcon.Quote,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.categoryParty.copy(alpha = 0.4f),
            )
        }
        party.note.paragraphs.forEach { paragraph ->
            Text(
                text = paragraph,
                fontSize = 14.5.sp,
                fontFamily = FontFamily.Serif,
                color = PantopusColors.appText,
                lineHeight = 22.sp,
            )
        }
        Text(
            modifier = Modifier.padding(top = Spacing.s1),
            text = "— ${party.note.signature}",
            fontSize = 14.sp,
            fontStyle = FontStyle.Italic,
            fontFamily = FontFamily.Serif,
            color = PantopusColors.categoryParty,
        )
    }
}
