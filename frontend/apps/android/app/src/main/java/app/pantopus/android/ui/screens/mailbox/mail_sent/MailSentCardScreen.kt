@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mail_sent

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mailbox.SentCard
import app.pantopus.android.data.api.models.mailbox.SentCardStep
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.cards.CardButton
import app.pantopus.android.ui.screens.mailbox.cards.CardButtonKind
import app.pantopus.android.ui.screens.mailbox.cards.CardNoteSide
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardBack
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardFlip
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardFront
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardTimes
import app.pantopus.android.ui.screens.mailbox.cards.TakeBackDialog
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.MailLetterCard
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.MailTrailStep
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.TrailRow
import app.pantopus.android.ui.screens.mailbox.mailbox_root.MailSentWords
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.Year
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * A card the person sent (launch key `mailbox`; drawings `M3-SentCard`, `M4-SentEmail`), opened from Sent: who it went
 * to and where it is, its envelope as they got it, both sides with the sender's own note, its trail ("a card never tells
 * you when it was opened"), and Take it back while it can be, which closes the page back to Sent. Back says "Sent".
 */
@Composable
fun MailSentCardScreen(
    onBack: () -> Unit,
    viewModel: MailSentCardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val takingBack by viewModel.takingBack.collectAsStateWithLifecycle()
    val takeBackError by viewModel.takeBackError.collectAsStateWithLifecycle()
    var confirmTakeBack by rememberSaveable { mutableStateOf(false) }
    // The sender's own clock (the season's zone once cards are read; the phone's until then).
    val zone = remember { HolidayCardTimes.zone(HolidayCardsRepository.latest.value?.timeZone) }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) { viewModel.closed.collect { onBack() } }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("mailSentPiece")) {
        BackToSent(onBack)
        when (val shown = state) {
            MailSentCardState.Loading -> Loading()
            is MailSentCardState.Gone -> Gone(shown.message, onBack)
            is MailSentCardState.Error ->
                ErrorState(
                    headline = "Your card didn't load",
                    message = shown.message,
                    modifier = Modifier.padding(vertical = Spacing.s4),
                    onRetry = viewModel::read,
                )
            is MailSentCardState.Loaded ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s8),
                    verticalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    SentCardPage(shown.card, zone, takingBack, takeBackError, onTakeBack = { confirmTakeBack = true })
                }
        }
    }
    val card = (state as? MailSentCardState.Loaded)?.card
    if (confirmTakeBack && card != null) {
        TakeBackDialog(
            byEmail = card.byEmail,
            onTakeBack = {
                confirmTakeBack = false
                viewModel.takeBack()
            },
            onKeep = { confirmTakeBack = false },
            freesToday = MailSentWords.sentToday(card, zone),
        )
    }
}

/** Back, with where it goes: "Sent". */
@Composable
private fun BackToSent(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .padding(start = Spacing.s1, top = Spacing.s2, bottom = 2.dp)
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClick = onBack)
                .padding(start = Spacing.s1, end = Spacing.s2)
                .clearAndSetSemantics {
                    contentDescription = "Back to Sent"
                    role = Role.Button
                }.testTag("mailSentPieceBack"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = null, size = 24.dp, tint = PantopusColors.primary600)
        Text("Sent", fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.Medium, color = PantopusColors.primary600)
    }
}

/** The card's page: who it went to, its envelope, both sides, its trail, and Take it back while it can be. */
@Composable
private fun SentCardPage(
    card: SentCard,
    zone: ZoneId,
    takingBack: Boolean,
    takeBackError: String?,
    onTakeBack: () -> Unit,
) {
    val to = card.toName?.takeIf { it.isNotBlank() } ?: "them"
    val first = to.trim().split(Regex("\\s+")).firstOrNull()?.takeIf { it.isNotEmpty() } ?: to
    val sent = HolidayCardTimes.shortDay(card.sentAt, zone)
    val line = MailSentWords.line(card, zone)
    Column {
        Text(
            "Your card to $to",
            fontSize = 24.sp,
            lineHeight = 32.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = Spacing.s1).semantics { heading() },
        )
        Text(
            listOfNotNull("Sent $sent".takeIf { sent.isNotEmpty() }, line.takeIf { it.isNotEmpty() }).joinToString(" · "),
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
    val joined = !card.byEmail || card.status == "claimed"
    PageSection(if (joined) "In $first’s Mailbox" else "Once they join with that address") {
        val envelope = MailSentWords.envelope(card)
        Box(modifier = Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = envelope.accessibilityLabel }) {
            MailPiece(envelope)
        }
    }
    sentLetterCard(card)?.let { face ->
        PageSection("The card you sent") { BothSides(face, card.envelope?.from?.takeIf { it.isNotBlank() } ?: "You") }
    }
    Trail(card, first, zone)
    if (card.canTakeBack) ChangedYourMind(card, zone, takingBack, onTakeBack)
    takeBackError?.let {
        Text(
            it,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.error,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive }.testTag("mailSentPieceError"),
        )
    }
}

/** The picture side with "Turn it over", and the back with the sender's note under it. */
@Composable
private fun ColumnScope.BothSides(
    card: MailLetterCard,
    from: String,
) {
    var showBack by rememberSaveable { mutableStateOf(false) }
    val shape = RoundedCornerShape(3.dp)
    val caption = card.caption?.takeIf { it.isNotBlank() } ?: "A Christmas picture"
    HolidayCardFlip(
        showBack = showBack,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .rotate(-1f)
                .clearAndSetSemantics { contentDescription = "The card you sent: $caption" },
        front = {
            HolidayCardFront(
                design = card.design,
                caption = card.caption,
                paper = card.paper,
                year = card.year,
                mailedOn = card.mailedOn,
                modifier = Modifier.shadow(6.dp, shape).clip(shape),
            )
        },
        back = {
            HolidayCardBack(
                paper = card.paper,
                fromName = from,
                year = card.year,
                message = card.note,
                modifier = Modifier.shadow(6.dp, shape).clip(shape),
            )
        },
    )
    CardButton(
        if (showBack) "Turn it back" else "Turn it over",
        onClick = { showBack = !showBack },
        kind = CardButtonKind.Paper,
        fill = false,
        state = if (showBack) "Showing the back" else "Showing the picture",
        modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = Spacing.s3).testTag("mailSentPieceTurn"),
    )
    CardNoteSide(card, from, modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s4).rotate(1f))
}

/** Where the card has been, step by step, and that a card never says when it was opened. */
@Composable
private fun Trail(
    card: SentCard,
    first: String,
    zone: ZoneId,
) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s4)
                .testTag("mailSentTrail"),
    ) {
        SmallHeading("Its trail", modifier = Modifier.padding(bottom = Spacing.s3))
        val steps = card.trail.map { trailStep(it, card, first, zone) }
        steps.forEachIndexed { index, step -> TrailRow(step, isLast = index == steps.lastIndex) }
        Row(
            modifier =
                Modifier
                    .padding(top = Spacing.s2)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s3, vertical = 10.dp)
                    .semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextStrong)
            Text(
                "Like real mail, a card never tells you when it was opened.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

/** "Changed your mind?": until when it can be taken back, on the sender's clock, and Take it back. */
@Composable
private fun ChangedYourMind(
    card: SentCard,
    zone: ZoneId,
    takingBack: Boolean,
    onTakeBack: () -> Unit,
) {
    val until = HolidayCardTimes.parse(card.takeBackUntil)?.atZone(zone)
    val sentence =
        if (card.byEmail || until == null) {
            "You can take it back until they open it."
        } else {
            val day = HolidayCardTimes.shortDay(card.takeBackUntil, zone)
            "It waits for the carrier until ${MailPieceMapper.clock(until)} $day (your clock)."
        }
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .padding(horizontal = Spacing.s4, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = PantopusIcon.CalendarClock, contentDescription = null, size = 20.dp, tint = PantopusColors.cardSectionInk)
        Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
            Text(
                "Changed your mind?",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(sentence, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
        }
        CardButton(
            "Take it back",
            onClick = onTakeBack,
            kind = CardButtonKind.Paper,
            fill = false,
            busy = takingBack,
            modifier = Modifier.testTag("mailSentPieceTakeBack"),
        )
    }
}

/** A part of the page under its small heading. */
@Composable
private fun PageSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SmallHeading(title, modifier = Modifier.padding(bottom = 10.dp))
        content()
    }
}

@Composable
private fun SmallHeading(
    title: String,
    modifier: Modifier = Modifier,
) {
    Text(
        title.uppercase(Locale.US),
        fontSize = 11.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.06.em,
        color = PantopusColors.appTextSecondary,
        modifier =
            modifier.clearAndSetSemantics {
                heading()
                contentDescription = title
            },
    )
}

/** Gone (taken back, or not this person's): why, and back to Sent. */
@Composable
private fun Gone(
    message: String,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6, vertical = Spacing.s10).testTag("mailSentPieceGone"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            message,
            fontSize = 17.sp,
            lineHeight = 24.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        CardButton("Back to Sent", onClick = onBack, fill = false)
    }
}

/** The page's shape while the card is read. */
@Composable
private fun Loading() {
    Column(
        modifier =
            Modifier
                .padding(Spacing.s4)
                .semantics { contentDescription = "Loading your card" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 260.dp, height = 28.dp)
        Shimmer(width = 200.dp, height = 14.dp)
        Shimmer(width = 360.dp, height = 150.dp, cornerRadius = 6.dp, modifier = Modifier.fillMaxWidth())
        Shimmer(width = 360.dp, height = 320.dp, cornerRadius = 3.dp, modifier = Modifier.fillMaxWidth())
    }
}

private val trailDay = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US)
private val trailTime = DateTimeFormatter.ofPattern("EEE MMM d · h:mm a", Locale.US)

/**
 * One step of the trail in words: a moment on the sender's clock ("WED DEC 9 · 6:12 PM"), a day by theirs ("THU DEC
 * 10"); a step not reached yet is hollow, with "· not yet".
 */
private fun trailStep(
    step: SentCardStep,
    card: SentCard,
    first: String,
    zone: ZoneId,
): MailTrailStep {
    val round = if (card.arrival == "christmas_morning") "Christmas morning" else "7 a.m."
    val title =
        when (step.step) {
            "sealed" -> "Sealed by you"
            "picked_up" -> "Picked up by the carrier"
            "delivered" -> "Delivered with $first’s $round mail"
            "opens" -> "Opens on Christmas morning"
            "emailed" -> "Emailed to ${card.toName.orEmpty()}"
            "joined" -> if (step.done) "They joined Pantopus and have it" else "They join Pantopus and have it"
            "returned" -> "They didn’t open the email in 90 days"
            else -> step.step
        }
    val detail =
        step.at?.let { at -> HolidayCardTimes.parse(at)?.atZone(zone)?.format(trailTime) }
            ?: step.on?.let { on -> runCatching { LocalDate.parse(on.take(10)) }.getOrNull()?.format(trailDay) }
    return MailTrailStep(
        id = step.step,
        title = if (step.done) title else "$title · not yet",
        detail = detail?.uppercase(Locale.US)?.takeIf { step.done },
        done = step.done,
        readers = false,
    )
}

/** The card as its page draws it, with the sender's own note; null when the server sent no picture. */
private fun sentLetterCard(card: SentCard): MailLetterCard? {
    val face = card.card ?: return null
    return MailLetterCard(
        design = face.design,
        caption = face.caption,
        paper = face.paper,
        year = face.year ?: Year.now().value,
        sealed = false,
        opensOn = null,
        opensIn = null,
        mailedOn = card.envelope?.postmarkedOn ?: card.sentAt,
        note = card.note.orEmpty().trim(),
        firstOpen = false,
    )
}
