@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.data.api.models.mailbox.HolidayCardListLine
import app.pantopus.android.data.api.models.mailbox.HolidayCardListPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.ZoneId

// One Christmas card to a list of people and addresses (digital stamps on; the web's `SendCardFlow` list): the list on
// "Who it's for" and its button on, Look it over's line for every card and its footer ("Postage · 4 people · 4 stamps",
// "Seal and send 4 cards"), and On its way, where each card can be taken back on its own and the cards that didn't go
// say why. Each person gets a card of their own; nobody sees who else got one.

// ── Step 1: the list ─────────────────────────────────────────

/** Who's on the list, each taken off with its ×, and what a list means. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ListChips(
    form: SendCardForm,
    max: Int,
    onRemove: (CardRecipient) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (form.listed.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier = Modifier.testTag("sendCardList"),
            ) {
                form.listed.forEach { entry ->
                    val shape = RoundedCornerShape(Radii.pill)
                    Row(
                        modifier =
                            Modifier
                                .height(36.dp)
                                .widthIn(max = 280.dp)
                                .clip(shape)
                                .background(PantopusColors.cardField)
                                .border(1.dp, PantopusColors.cardFieldEdge, shape)
                                .clickable(role = Role.Button) { onRemove(entry) }
                                .padding(start = 14.dp, end = 10.dp)
                                .clearAndSetSemantics {
                                    contentDescription = "Take ${entry.label} off the list"
                                    role = Role.Button
                                }.testTag("sendCardListChip.${entry.key}"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            entry.label,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.cardTextStrong,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        PantopusIconImage(
                            icon = PantopusIcon.X,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.cardTextQuiet,
                        )
                    }
                }
            }
        }
        Text(
            (if (form.listed.size >= max) "That’s $max, the most for one send. " else "") +
                "Each person gets their own card. No one sees who else got one.",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.cardTextQuiet,
        )
    }
}

/** Step 1's button on, pinned under the list: "Continue with 4 people". */
@Composable
internal fun ListContinueBar(
    form: SendCardForm,
    onContinue: () -> Unit,
) {
    val listed = form.listed
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.cardDesk)) {
        HorizontalDivider(color = PantopusColors.cardNoteEdge)
        CardButton(
            if (listed.size == 1) "Continue with ${listed[0].label.substringBefore(' ')}" else "Continue with ${listed.size} people",
            onClick = onContinue,
            modifier =
                Modifier
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s4)
                    .testTag("sendCardContinue"),
        )
    }
}

// ── Step 5: look it over ─────────────────────────────────────

/** Look it over for a list: the first card that can go, exactly as its person will see it, then every card's line. */
@Composable
internal fun ListLookStep(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    design: HolidayCardDesign,
    look: HolidayCardListPreview,
) {
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val first = look.recipients.firstOrNull { it.status == "ready" }?.let { form.listEntry(it.requestId) }
    val preview = look.look
    if (first != null && preview != null) LookStep(cards, first, design, preview)
    val ready = look.recipients.count { it.status == "ready" }
    Column(modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s6).testTag("sendCardListLook")) {
        Text(
            "Going to $ready ${if (ready == 1) "person" else "people"}",
            fontSize = 16.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            modifier = Modifier.semantics { heading() },
        )
        val shape = RoundedCornerShape(Radii.lg)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.s2)
                    .clip(shape)
                    .background(PantopusColors.cardField)
                    .border(1.dp, PantopusColors.cardListEdge, shape),
        ) {
            look.recipients.forEachIndexed { index, line ->
                if (index > 0) HorizontalDivider(color = PantopusColors.cardNoteEdge)
                ListLookRow(form.listEntry(line.requestId)?.label ?: line.toName.orEmpty(), line, zone)
            }
        }
    }
}

/** One card on a list's look: who it's for, and when it comes or why it won't go. */
@Composable
private fun ListLookRow(
    name: String,
    line: HolidayCardListLine,
    zone: ZoneId,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(PantopusColors.cardInitialPaper),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                name.take(1).uppercase(),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardInitialInk,
                modifier = Modifier.clearAndSetSemantics {},
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                name,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                listLineWords(line, zone),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = if (line.status == "refused") PantopusColors.cardTextProblem else PantopusColors.cardTextQuiet,
            )
        }
    }
}

/** What will happen to one card on a list's look, in a line. */
private fun listLineWords(
    line: HolidayCardListLine,
    zone: ZoneId,
): String {
    val day = HolidayCardTimes.shortDay(line.arrivesOn, zone)
    return when {
        line.status == "refused" -> "${line.error ?: "It can’t go."} Won’t be sent."
        line.status == "already_sent" -> "Already sent."
        line.byEmail && line.arrival == "sealed_christmas" -> "Gets an email now. The card opens on Christmas morning."
        line.byEmail -> "Gets an email now."
        line.arrival == "christmas_morning" -> "On Christmas morning, with their 7 a.m. mail."
        line.arrival == "sealed_christmas" -> "Comes with their 7 a.m. mail on $day, sealed until Christmas."
        else -> "With their 7 a.m. mail on $day."
    }
}

/**
 * Under a list's Look it over, pinned: until when each card can be taken back, what the cards cost, why sending didn't
 * go, and "Seal and send 4 cards" (or, with too few stamps, "Get stamps to send").
 */
@Composable
internal fun ListLookFooter(
    form: SendCardForm,
    look: HolidayCardListPreview,
    stamps: StampBalance?,
    onSend: () -> Unit,
    onGetStamps: () -> Unit,
) {
    val needed = look.needed
    val needsStamps = (stamps?.available ?: needed) < needed
    val cardsWord = if (needed == 1) "1 card" else "$needed cards"
    val entries = (form.to as? CardRecipient.Several)?.entries.orEmpty()
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.cardDesk)) {
        HorizontalDivider(color = PantopusColors.cardNoteEdge)
        Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s4)) {
            DeskNote(listSealNote(entries))
            if (needed > 0) {
                StampPostageLine(stamps, design = form.design, modifier = Modifier.padding(top = 10.dp), count = needed)
            } else {
                Text(
                    "None of these cards can go now.",
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.cardTextQuiet,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                )
            }
            form.sendError?.let {
                Text(
                    it,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.cardTextProblem,
                    modifier = Modifier.padding(top = 10.dp).testTag("sendCardError"),
                )
            }
            CardButton(
                when {
                    needsStamps -> "Get stamps to send"
                    form.sending -> "Sending $cardsWord…"
                    else -> "Seal and send $cardsWord"
                },
                onClick = if (needsStamps) onGetStamps else onSend,
                enabled = needed > 0,
                busy = form.sending,
                modifier = Modifier.padding(top = 10.dp).testTag("sendCardLookSend"),
            )
        }
    }
}

// ── On its way ───────────────────────────────────────────────

/** A card on a list that didn't go only because of a hiccup (or the stamps ran out meanwhile): sending again can work. */
private val SEND_AGAIN = setOf("CARD_UNAVAILABLE", "BLOCK_CHECK_UNAVAILABLE", "STAMPS_REQUIRED")

/**
 * A list on its way: each card in a row with its own "Take it back", the cards that didn't go and why (no stamp used),
 * and "Send the rest" when only a hiccup kept some back.
 */
@Composable
internal fun ListSentSection(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    onTakeBack: (SentHolidayCard) -> Unit,
    onSendRest: () -> Unit,
    onClose: () -> Unit,
    onSeeInSent: () -> Unit,
    onAnother: () -> Unit,
) {
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val results = form.listResults.orEmpty()
    val went = results.mapNotNull { result -> result.card.takeIf { result.status != "not_sent" } }
    val stayed = results.filter { it.status == "not_sent" }
    val onTheirWay = went.count { it.id !in form.listTakenBack }
    val again = stayed.any { it.code in SEND_AGAIN }
    Column(
        modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4).testTag("sendCardListSent"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            if (onTheirWay == 1) "1 card is on its way." else "$onTheirWay cards are on their way.",
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            modifier = Modifier.testTag("sendCardListSentCount"),
        )
        went.forEach { card ->
            ListSentRow(card, cards, form, zone, onTakeBack)
        }
        if (stayed.isNotEmpty()) {
            Text(
                "Not sent",
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.padding(top = Spacing.s1).semantics { heading() },
            )
            stayed.forEach { result ->
                val name = form.listEntry(result.requestId)?.label ?: "them"
                val stamp = if (result.code == "CARD_TAKEN_BACK") "Its stamp came back." else "No stamp was used."
                DeskNote(
                    "Not sent to $name: ${result.error.orEmpty()} $stamp",
                    modifier = Modifier.testTag("sendCardNotSent.${result.requestId}"),
                )
            }
        }
        form.sendError?.let {
            Text(
                it,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.cardTextProblem,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (again) {
                CardButton("Send the rest", onClick = onSendRest, busy = form.sending, modifier = Modifier.testTag("sendCardSendRest"))
                CardButton(
                    "Back to your mail",
                    onClick = onClose,
                    kind = CardButtonKind.Paper,
                    modifier = Modifier.testTag("sendCardBackToMail"),
                )
            } else {
                CardButton("Back to your mail", onClick = onClose, modifier = Modifier.testTag("sendCardBackToMail"))
            }
            CardButton(
                "See them in Sent",
                onClick = onSeeInSent,
                kind = CardButtonKind.Words,
                icon = PantopusIcon.Send,
                modifier = Modifier.testTag("sendCardSeeInSent"),
            )
        }
        Text(
            "One digital stamp per card. Receiving and replies are free.",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.cardTextQuiet,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        CardButton(
            "Send another card",
            onClick = onAnother,
            kind = CardButtonKind.Paper,
            modifier = Modifier.testTag("sendAnotherCard"),
        )
    }
}

/** One card on its way: its picture, who it's to, when it comes, and its own "Take it back". */
@Composable
private fun ListSentRow(
    card: SentHolidayCard,
    cards: HolidayCardsResponse,
    form: SendCardForm,
    zone: ZoneId,
    onTakeBack: (SentHolidayCard) -> Unit,
) {
    val back = card.id in form.listTakenBack
    val picture = cards.designOf(card.design)
    val shape = RoundedCornerShape(Radii.xl)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, PantopusColors.cardListEdge, shape)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        card.design?.let { design ->
            TiltedThumb(design, width = 48.dp, tilt = -2f, pictureHeight = picture?.height, paper = picture?.paper)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                "To ${card.toName ?: "them"}",
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                if (back) "You took this card back, and its stamp is back with you." else arrivalLine(card, zone),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.cardTextBody,
            )
            form.listTakeBackError?.takeIf { it.first == card.id }?.let {
                Text(
                    it.second,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.cardTextProblem,
                )
            }
            if (card.canTakeBack && !back) {
                CardButton(
                    "Take it back",
                    onClick = { onTakeBack(card) },
                    kind = CardButtonKind.Paper,
                    busy = form.listTakingBack == card.id,
                    fill = false,
                    modifier = Modifier.padding(top = 2.dp).testTag("sendCardTakeBack.${card.id}"),
                )
            }
        }
    }
}
