@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_detail.letter

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.EaseIn
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.cards.CardButton
import app.pantopus.android.ui.screens.mailbox.cards.CardButtonKind
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardBack
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardFlip
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardFront
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/** Where a card's page is: in its envelope, coming out of it, or out and picture side up. */
private enum class CardStage { Envelope, Opening, Card }

/**
 * Reading a Christmas card (launch key `holiday_cards`). Sealed until Christmas morning: the envelope with its seal and
 * how long until it opens. The first time it's opened: "Open the envelope", and the card rises out of it picture side
 * up. Then "Turn it over" reads the note. With animations off nothing rises or turns. Tapping the envelope, or "The
 * envelope", shows who sent it and its trail.
 */
@Composable
internal fun HolidayCardPage(
    letter: MailLetter,
    card: MailLetterCard,
    onEnvelope: () -> Unit,
    onOpen: () -> Unit,
) {
    val from = letter.fromName.trim().ifEmpty { "Someone" }
    if (card.sealed) return SealedCard(letter, card, from, onEnvelope)
    val reduceMotion = rememberReduceMotion()
    var stage by rememberSaveable(letter.envelope.id) {
        mutableStateOf(if (card.firstOpen) CardStage.Envelope else CardStage.Card)
    }
    Column(modifier = Modifier.fillMaxWidth().testTag("mailHolidayCard"), horizontalAlignment = Alignment.CenterHorizontally) {
        if (stage == CardStage.Envelope) {
            CardEnvelope(letter, "Christmas card from $from", onEnvelope)
            Text(
                // "Ivy M." ends the sentence itself.
                "A Christmas card from ${from.removeSuffix(".")}.",
                fontSize = 15.sp,
                lineHeight = 22.sp,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4),
            )
            CardButton(
                "Open the envelope",
                onClick = {
                    onOpen()
                    stage = if (reduceMotion) CardStage.Card else CardStage.Opening
                },
                fill = false,
                modifier = Modifier.padding(top = Spacing.s3).testTag("mailHolidayCardOpen"),
            )
        } else {
            var showBack by rememberSaveable(letter.envelope.id) { mutableStateOf(false) }
            HolidayCardOutOfEnvelope(
                envelope = letter.envelope,
                card = card,
                from = from,
                showBack = showBack,
                opening = stage == CardStage.Opening,
                onOut = { stage = CardStage.Card },
            )
            Row(
                modifier = Modifier.padding(top = Spacing.s4),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CardButton(
                    if (showBack) "Turn it back" else "Turn it over",
                    onClick = { showBack = !showBack },
                    kind = CardButtonKind.Paper,
                    fill = false,
                    state = if (showBack) "Showing the back" else "Showing the picture",
                    modifier = Modifier.testTag("mailHolidayCardTurn"),
                )
                CardButton(
                    "The envelope",
                    onClick = onEnvelope,
                    kind = CardButtonKind.Words,
                    fill = false,
                    modifier = Modifier.testTag("mailHolidayCardEnvelope"),
                )
            }
        }
    }
}

/**
 * The card, and while it's [opening], the torn [envelope] it rises out of falling away under it: the card page's first
 * open, and step 5 of sending one ("Open it again") showing it before it's sent.
 */
@Composable
internal fun HolidayCardOutOfEnvelope(
    envelope: MailPieceModel,
    card: MailLetterCard,
    from: String,
    showBack: Boolean,
    opening: Boolean,
    onOut: () -> Unit,
) {
    // First composed as it starts opening (from 0), or already out (at 1).
    val rise = remember { Animatable(if (opening) 0f else 1f) }
    val away = remember { Animatable(0f) }
    LaunchedEffect(opening) {
        if (!opening) return@LaunchedEffect
        coroutineScope {
            launch { rise.animateTo(1f, tween(durationMillis = 720, easing = CubicBezierEasing(0.2f, 0.8f, 0.2f, 1f))) }
            launch { away.animateTo(1f, tween(durationMillis = 720, easing = EaseIn)) }
        }
        onOut()
    }
    // The caption as a sentence for screen readers: most end in a full stop or a question mark already.
    val caption = card.caption?.takeIf { it.isNotBlank() } ?: "A Christmas picture"
    val captionSentence = if (caption.last() in ".!?") caption else "$caption."
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .graphicsLayer {
                        val progress = rise.value
                        translationY = (1f - progress) * 0.38f * size.height
                        scaleX = 0.92f + 0.08f * progress
                        scaleY = 0.92f + 0.08f * progress
                        alpha = progress
                    }
                    // Whichever side is up, a screen reader reads the card and the note on its back.
                    .clearAndSetSemantics { contentDescription = "Card from $from: $captionSentence On the back: ${card.note}" }
                    .testTag("mailHolidayCardFace"),
        ) {
            val shape = RoundedCornerShape(3.dp)
            HolidayCardFlip(
                showBack = showBack,
                front = {
                    HolidayCardFront(
                        design = card.design,
                        caption = card.caption,
                        paper = card.paper,
                        year = card.year,
                        mailedOn = card.mailedOn,
                        pictureHeight = card.pictureHeight,
                        modifier = Modifier.shadow(10.dp, shape).clip(shape),
                    )
                },
                back = {
                    HolidayCardBack(
                        paper = card.paper,
                        fromName = from,
                        year = card.year,
                        message = card.note,
                        modifier = Modifier.shadow(10.dp, shape).clip(shape),
                    )
                },
            )
        }
        if (opening) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .graphicsLayer {
                            translationY = away.value * 0.55f * size.height
                            alpha = 1f - away.value
                        }.clearAndSetSemantics {},
            ) { MailPiece(envelope.copy(opened = true)) }
        }
    }
}

/** Sealed until Christmas morning: the envelope with its seal, and when it opens. */
@Composable
private fun SealedCard(
    letter: MailLetter,
    card: MailLetterCard,
    from: String,
    onEnvelope: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("mailHolidayCardSealed"),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        CardEnvelope(letter, "Christmas card from $from, sealed until Christmas morning", onEnvelope)
        HolidayCardSealedNotice(from = from, opensOn = card.opensOn, opensIn = card.opensIn)
    }
}

/**
 * "Do not open until Christmas" and when it opens ("Friday, December 25", "in 14 days"): a sealed card's page, and step
 * 5 of sending one showing it before it's sent.
 */
@Composable
internal fun HolidayCardSealedNotice(
    from: String,
    opensOn: String?,
    opensIn: String?,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .padding(horizontal = 20.dp, vertical = Spacing.s4)
                .semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Do not open until Christmas",
            fontFamily = FontFamily.Serif,
            fontSize = 22.sp,
            lineHeight = 28.sp,
            color = PantopusColors.cardWax,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        val day = opensOn ?: "December 25"
        Text(
            "$from sealed this card. It opens on Christmas morning, $day${opensIn?.let { ", $it" }.orEmpty()}.",
            fontSize = 15.sp,
            lineHeight = 22.sp,
            color = PantopusColors.cardTextBody,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2),
        )
    }
}

/** The card's envelope, whole; tapping it shows who sent it and its trail. */
@Composable
private fun CardEnvelope(
    letter: MailLetter,
    what: String,
    onEnvelope: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClickLabel = "See who sent it and its trail", role = Role.Button, onClick = onEnvelope)
                .clearAndSetSemantics {
                    contentDescription = "${what.removeSuffix(".")}. Show who sent it and its trail"
                    role = Role.Button
                }.testTag("mailLetterEnvelope"),
    ) { MailPiece(letter.envelope) }
}
