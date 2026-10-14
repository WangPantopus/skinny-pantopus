package app.pantopus.android.ui.screens.pulse

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.feed.pulse.PostStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/**
 * One conversation in the Pulse page (build spec section 3, wireframes 1 and 4). Top to bottom: name, label, distance
 * and time with the type's name on the right; the words; the photo; where and what it's about; then the type's one
 * action, the reply count and the status. The whole card is one TalkBack stop that reads [PulseCardUi.description];
 * the action is its own control.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PulseConversationCard(
    card: PulseCardUi,
    onOpen: () -> Unit,
    onAction: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onOpen)
                .padding(Spacing.s4)
                .testTag("pulseCard_${card.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // Everything above the action reads as one sentence in TalkBack; the action stays a control of its own.
        Column(
            modifier = Modifier.clearAndSetSemantics { contentDescription = card.description },
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                FlowRow(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = card.authorName,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.align(Alignment.CenterVertically),
                    )
                    card.labelText?.let {
                            text ->
                        PulseLabelChip(text = text, tone = card.labelTone, modifier = Modifier.align(Alignment.CenterVertically))
                    }
                    if (card.meta.isNotEmpty()) {
                        Text(
                            text = card.meta,
                            fontSize = 13.sp,
                            color = PantopusColors.appTextSecondary,
                            modifier = Modifier.align(Alignment.CenterVertically),
                        )
                    }
                }
                Text(
                    text = card.typeName,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.8.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (card.text.isNotEmpty()) {
                Text(
                    text = card.text,
                    fontSize = 16.sp,
                    lineHeight = 22.sp,
                    color = PantopusColors.appText,
                    maxLines = CARD_TEXT_LINES,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            card.photoUrl?.let { url ->
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 120.dp, max = 180.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurfaceSunken)
                            .testTag("pulseCardPhoto_${card.id}"),
                )
            }
            card.aboutLine?.let { line ->
                Text(text = line, fontSize = 13.sp, color = PantopusColors.appTextMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            card.actionLabel?.let { label ->
                PulseActionButton(label = label, done = card.actionDone, onClick = onAction, cardId = card.id)
            }
            Column(modifier = Modifier.weight(1f)) {
                val words = listOfNotNull(card.repliesText, card.goingText).joinToString("  ·  ")
                if (words.isNotEmpty()) {
                    Text(
                        text = words,
                        fontSize = 14.sp,
                        color = PantopusColors.appTextSecondary,
                        fontWeight = FontWeight.Normal,
                        modifier = Modifier.semantics { contentDescription = words },
                    )
                }
                card.status?.let { PostStatusPill(status = it, postId = card.id) }
            }
        }
    }
}

/** The type's one action: filled once the viewer has done it, outlined before. A check says "done" besides the color. */
@Composable
private fun PulseActionButton(
    label: String,
    done: Boolean,
    onClick: () -> Unit,
    cardId: String,
) {
    val shape = RoundedCornerShape(Radii.pill)
    Box(
        modifier =
            Modifier
                .heightIn(min = 48.dp)
                .clip(shape)
                .then(
                    if (done) {
                        Modifier.background(PantopusColors.primary600)
                    } else {
                        Modifier.border(BorderStroke(1.dp, PantopusColors.appBorderStrong), shape)
                    },
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4)
                .semantics {
                    role = Role.Button
                    contentDescription = if (done) "$label, done" else label
                }
                .testTag("pulseCardAction_$cardId"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (done) "✓ $label" else label,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (done) PantopusColors.appTextInverse else PantopusColors.appText,
        )
    }
}

/** "Resident", "New here", ...: always the words, tinted by relationship. */
@Composable
fun PulseLabelChip(
    text: String,
    tone: PulseLabelTone?,
    modifier: Modifier = Modifier,
) {
    val variant =
        when (tone) {
            PulseLabelTone.Resident -> StatusChipVariant.Success
            PulseLabelTone.NewHere -> StatusChipVariant.Personal
            PulseLabelTone.Official -> StatusChipVariant.Info
            PulseLabelTone.Business -> StatusChipVariant.Warning
            PulseLabelTone.Pantopus -> StatusChipVariant.Home
            PulseLabelTone.Nearby, PulseLabelTone.Visitor, null -> StatusChipVariant.Neutral
        }
    Text(
        text = text,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = variant.foreground,
        maxLines = 1,
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(variant.background)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
    )
}

private const val CARD_TEXT_LINES = 6
