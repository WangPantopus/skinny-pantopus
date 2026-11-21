@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "CyclomaticComplexMethod")

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
import androidx.compose.ui.platform.LocalContext
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
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mailbox.SentCard
import app.pantopus.android.data.api.models.mailbox.SentCardStep
import app.pantopus.android.data.api.models.mailbox.SentCardTravel
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.mailbox.cards.CardButton
import app.pantopus.android.ui.screens.mailbox.cards.CardButtonKind
import app.pantopus.android.ui.screens.mailbox.cards.CardNoteSide
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardBack
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardFlip
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardFront
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardTimes
import app.pantopus.android.ui.screens.mailbox.cards.SEND_THIS_CARD_AGAIN
import app.pantopus.android.ui.screens.mailbox.cards.TakeBackDialog
import app.pantopus.android.ui.screens.mailbox.cards.canSendAnother
import app.pantopus.android.ui.screens.mailbox.cards.rememberCardLeaves
import app.pantopus.android.ui.screens.mailbox.cards.table.CardGreetingVoice
import app.pantopus.android.ui.screens.mailbox.cards.table.CardLinkBox
import app.pantopus.android.ui.screens.mailbox.cards.table.CardPrintPhoto
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplyState
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplyTable
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplyViewModel
import app.pantopus.android.ui.screens.mailbox.cards.table.CardShareSheet
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableDialog
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableSendBack
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTravel
import app.pantopus.android.ui.screens.mailbox.cards.table.LetterCardPrint
import app.pantopus.android.ui.screens.mailbox.cards.table.SEE_ITS_JOURNEY
import app.pantopus.android.ui.screens.mailbox.cards.table.joined
import app.pantopus.android.ui.screens.mailbox.cards.table.openJourney
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.MailLetterCard
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.MailTrailStep
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.TrailRow
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.tableCard
import app.pantopus.android.ui.screens.mailbox.mailbox_root.MailSentWords
import app.pantopus.android.ui.screens.mailbox.mailbox_root.SentEmailTrouble
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
 * you when it was opened"), and Take it back while it can be, which closes the page back to Sent. Back says "Sent". A
 * card by email whose email didn't go out says so right under where it is, with the address typed and Email it again.
 */
@Composable
fun MailSentCardScreen(
    onBack: () -> Unit,
    /** "Send this card to someone else" (plan Part 6): the send flow with this picture kept, from Who it's for. */
    onSendAgain: ((design: String) -> Unit)? = null,
    viewModel: MailSentCardViewModel = hiltViewModel(),
    replies: CardReplyViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val takingBack by viewModel.takingBack.collectAsStateWithLifecycle()
    val takeBackError by viewModel.takeBackError.collectAsStateWithLifecycle()
    val emailingAgain by viewModel.emailingAgain.collectAsStateWithLifecycle()
    val emailAgainError by viewModel.emailAgainError.collectAsStateWithLifecycle()
    val toasts = remember { ToastController() }
    // With digital stamps on, taking a card back gives its stamp back.
    val cards by HolidayCardsRepository.latest.collectAsStateWithLifecycle()
    var confirmTakeBack by rememberSaveable { mutableStateOf(false) }
    // The sender's own clock (the season's zone once cards are read; the phone's until then).
    val zone = remember { HolidayCardTimes.zone(HolidayCardsRepository.latest.value?.timeZone) }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) { viewModel.closed.collect { onBack() } }
    LaunchedEffect(Unit) { viewModel.emailed.collect { toasts.success("We emailed them.") } }

    // Write back (plan Part 3): a reply this person wrote opens as the joined card; a card of theirs that was answered
    // offers "{First name} wrote back".
    val sentCard = (state as? MailSentCardState.Loaded)?.card
    LaunchedEffect(sentCard?.id) { sentCard?.id?.let { replies.load(it) } }
    val replyState by replies.state.collectAsStateWithLifecycle()
    var showsJoined by rememberSaveable { mutableStateOf(false) }
    val ownReply = sentCard?.cardReply != null
    // The writer took their reply back: there's nothing left to show here.
    LaunchedEffect(replyState.exchange) { if (ownReply && replyState.exchange?.let { it.reply == null } == true) onBack() }
    SentJoinedCard(
        card = sentCard,
        state = replyState,
        replies = replies,
        shows = showsJoined || ownReply,
        onClose = {
            showsJoined = false
            if (ownReply) onBack()
        },
    )
    Box(modifier = Modifier.fillMaxSize()) {
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
                        SentCardPage(
                            card = shown.card,
                            zone = zone,
                            takingBack = takingBack,
                            takeBackError = takeBackError,
                            onTakeBack = { confirmTakeBack = true },
                            emailAgain =
                                EmailAgain(
                                    busy = emailingAgain,
                                    error = emailAgainError,
                                    postage = cards?.postageEnabled == true,
                                    onEmailAgain = viewModel::emailAgain,
                                ),
                        )
                        // Only while another card can go now: a stamp left, or today's card not used.
                        val design = shown.card.card?.design
                        if (onSendAgain != null && design != null && cards.canSendAnother(null)) {
                            CardButton(
                                SEND_THIS_CARD_AGAIN,
                                onClick = { onSendAgain(design) },
                                kind = CardButtonKind.Paper,
                                modifier = Modifier.testTag("sentSendThisCardAgain"),
                            )
                        }
                        // The card was answered: who wrote back, opening the joined card.
                        val answer = replyState.exchange?.reply?.takeIf { shown.card.cardReply == null }
                        if (answer != null) {
                            val first = answer.fromName.orEmpty().trim().substringBefore(' ').ifEmpty { "Someone" }
                            CardButton(
                                "$first wrote back",
                                onClick = { showsJoined = true },
                                kind = CardButtonKind.Paper,
                                modifier = Modifier.testTag("sentWroteBack"),
                            )
                        }
                    }
            }
        }
        ToastHost(controller = toasts)
    }
    val card = (state as? MailSentCardState.Loaded)?.card
    if (confirmTakeBack && card != null) {
        TakeBackDialog(
            byEmail = card.byEmail,
            byLink = card.byLink,
            onTakeBack = {
                confirmTakeBack = false
                viewModel.takeBack()
            },
            onKeep = { confirmTakeBack = false },
            freesToday = MailSentWords.sentToday(card, zone),
            postage = cards?.postageEnabled == true,
            notEmailedYet = MailSentWords.notEmailedYet(card),
        )
    }
}

/** The joined card from Sent (plan Part 3): the writer's own reply with Take it back while it waits, or the answered card. */
@Composable
private fun SentJoinedCard(
    card: SentCard?,
    state: CardReplyState,
    replies: CardReplyViewModel,
    shows: Boolean,
    onClose: () -> Unit,
) {
    if (card == null || !shows) return
    val mine = card.cardReply != null
    val joined = state.exchange?.joined(viewerWrote = mine) ?: return
    val takeBack =
        state.exchange.pendingReply
            ?.takeIf { mine && it.canTakeBack }
            ?.let { listOf(CardTableSendBack("Take it back") { replies.takeBack() }) }
            .orEmpty()
    CardReplyTable(joined, onClose = onClose, actions = takeBack, closeLabel = if (mine) "Back to Sent" else "Close")
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

/** Email it again on a card by email whose email didn't go out: while it tries, why it didn't work, and the stamp's words. */
private data class EmailAgain(
    val busy: Boolean,
    val error: String?,
    /** Digital stamps are on: taking the card back gives its stamp back. */
    val postage: Boolean,
    val onEmailAgain: () -> Unit,
)

/** The card's page: who it went to, its envelope, both sides, its trail, and Take it back while it can be. */
@Composable
private fun SentCardPage(
    card: SentCard,
    zone: ZoneId,
    takingBack: Boolean,
    takeBackError: String?,
    onTakeBack: () -> Unit,
    emailAgain: EmailAgain,
) {
    val waitingLink = card.byLink && card.status != "claimed"
    val to = if (waitingLink) "whoever opens your link" else card.toName?.takeIf { it.isNotBlank() } ?: "them"
    // A household is said whole ("their household’s 7 a.m. mail"), a person by their first name.
    val first = if (card.toHousehold) to else to.trim().split(Regex("\\s+")).firstOrNull()?.takeIf { it.isNotEmpty() } ?: to
    val sent = HolidayCardTimes.shortDay(card.sentAt, zone)
    val line = MailSentWords.line(card, zone)
    Column {
        Text(
            "Your ${if (card.kind == "letter") "letter" else "card"} to $to",
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
    // A card that travels (travelling card plan Part 6): how far it has gone, and its journey's page.
    card.travel?.let { travel -> Travelling(travel) }
    // Its email didn't go out: said first, under where it is, before the envelope and the card.
    MailSentWords.emailTrouble(card)?.let { EmailTrouble(card, it, emailAgain) }
    emailAgain.error?.let { PageError(it, Modifier.testTag("mailSentPieceEmailError")) }
    val delivered = card.status == "delivered" || card.status == "claimed"
    val mailboxLabel =
        when {
            waitingLink -> "Once someone opens your link"
            card.byEmail -> "Once they claim it"
            else -> "Addressed to $first"
        }
    PageSection(if (delivered) "In $first’s Mailbox" else mailboxLabel) {
        val envelope = MailSentWords.envelope(card)
        Box(modifier = Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = envelope.accessibilityLabel }) {
            MailPiece(envelope)
        }
    }
    if (card.kind == "letter") {
        PageSection("The letter you sent") {
            card.subject?.let { Text(it, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText) }
            androidx.compose.foundation.text.selection.SelectionContainer {
                Text(card.note.orEmpty(), fontSize = 16.sp, lineHeight = 25.sp, color = PantopusColors.appText)
            }
        }
    } else {
        sentLetterCard(card)?.let { face ->
            val from = card.envelope?.from?.takeIf { it.isNotBlank() } ?: "You"
            PageSection("The card you sent") {
                BothSides(face, from, first)
                if (LaunchFeatures.cardTable) TheWayTheyDid(card, face, from)
            }
        }
    }
    if (card.byLink && card.canTakeBack) {
        CardLinkBox(
            cardId = card.id,
            knownLink = null,
            fromFirst = (card.envelope?.from?.takeIf { it.isNotBlank() } ?: "someone").trim().substringBefore(' '),
            copyWords = "Copy link again",
            canShare = false,
        )
    }
    Trail(card, first, zone)
    if (card.canTakeBack) ChangedYourMind(card, zone, takingBack, onTakeBack)
    takeBackError?.let { PageError(it, Modifier.testTag("mailSentPieceError")) }
}

/** "5 towns · 2,692 miles. Now in Tampa, FL." and "See its journey", its web page inside the app (decision D6). */
@Composable
private fun Travelling(travel: SentCardTravel) {
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            CardTravel.sentLine(travel.towns, travel.miles, travel.nowIn),
            fontSize = 15.sp,
            lineHeight = 21.sp,
            color = PantopusColors.appText,
            modifier = Modifier.testTag("sentTravelLine"),
        )
        travel.journey?.takeIf { it.isNotBlank() }?.let { journey ->
            CardButton(
                SEE_ITS_JOURNEY,
                onClick = { openJourney(context, journey) },
                kind = CardButtonKind.Paper,
                modifier = Modifier.testTag("sentSeeJourney"),
            )
        }
    }
}

/** Why something on the page didn't work, said as it appears. */
@Composable
private fun PageError(
    message: String,
    modifier: Modifier = Modifier,
) {
    Text(
        message,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.Medium,
        color = PantopusColors.error,
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Assertive },
    )
}

/** "See it the way they did": the same full-screen moment, and Share. Nothing about it reaches them. */
@Composable
private fun ColumnScope.TheWayTheyDid(
    card: SentCard,
    face: MailLetterCard,
    from: String,
) {
    var playing by rememberSaveable { mutableStateOf(false) }
    var sharing by rememberSaveable { mutableStateOf(false) }
    val onTable =
        face.tableCard(
            id = "sent-${card.id}",
            from = from,
            to = card.toName?.takeIf { !card.byLink || card.status == "claimed" },
        )
    Row(
        modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CardButton(
            "See it the way they did",
            onClick = { playing = true },
            kind = CardButtonKind.Words,
            fill = false,
            modifier = Modifier.testTag("mailSentPieceSeeIt"),
        )
        CardButton(
            "Share",
            onClick = { sharing = true },
            kind = CardButtonKind.Words,
            fill = false,
            icon = PantopusIcon.Share,
            modifier = Modifier.testTag("mailSentPieceShare"),
        )
    }
    if (playing) {
        CardTableDialog(card = onTable, firstOpen = true, onClose = { playing = false }, mine = true)
    }
    if (sharing) {
        CardShareSheet(
            card = onTable.copy(sealed = card.sealed, note = if (card.sealed) "" else onTable.note),
            mine = true,
            onClose = { sharing = false },
        )
    }
}

/** The picture side with "Turn it over", and the back with the sender's note under it. */
@Composable
private fun ColumnScope.BothSides(
    card: MailLetterCard,
    from: String,
    /** Who it went to, for the greeting's label ("For Maya"). */
    forFirst: String = "you",
) {
    var showBack by rememberSaveable { mutableStateOf(false) }
    // A long note goes over two leaves, as the reader sees it (plan Part 9).
    val leaves = rememberCardLeaves()
    val shape = RoundedCornerShape(3.dp)
    val caption = card.caption?.takeIf { it.isNotBlank() } ?: "A Christmas picture"
    HolidayCardFlip(
        showBack = showBack,
        leaves = leaves,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.s2)
                .rotate(-1f)
                .clearAndSetSemantics { contentDescription = "The card you sent: $caption" },
        front = {
            HolidayCardFront(
                design = card.design,
                caption = card.caption,
                paper = card.paper,
                year = card.year,
                mailedOn = card.mailedOn,
                pictureHeight = card.pictureHeight,
                modifier = Modifier.shadow(6.dp, shape).clip(shape),
            )
        },
        back = {
            HolidayCardBack(
                paper = card.paper,
                fromName = from,
                year = card.year,
                message = card.note,
                design = card.design,
                signature = card.signature,
                leaves = leaves,
                modifier = Modifier.shadow(6.dp, shape).clip(shape),
            )
        },
    )
    CardButton(
        leaves.turnLabel(showBack),
        onClick = { leaves.press(showBack) { showBack = !showBack } },
        kind = CardButtonKind.Paper,
        fill = false,
        state = if (showBack) "Showing the back" else "Showing the picture",
        spoken = leaves.turnSpoken(showBack),
        modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = Spacing.s3).testTag("mailSentPieceTurn"),
    )
    CardNoteSide(card, from, modifier = Modifier.padding(vertical = Spacing.s4).rotate(1f))
    LetterCardPrint(
        card,
        from.substringBefore(' '),
        forFirst = forFirst,
        modifier = Modifier.padding(bottom = Spacing.s4),
    )
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
                "Mail never tells you when it was opened.",
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
        if (card.byEmail || card.byLink || until == null) {
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

/**
 * Its email hasn't gone out (Sent's `email_status`): still being tried for an hour, or given up. The address they typed,
 * whole, so a mistake shows, and Email it again. Take it back stays in its own box at the end of the page.
 */
@Composable
private fun EmailTrouble(
    card: SentCard,
    trouble: SentEmailTrouble,
    emailAgain: EmailAgain,
) {
    val to = card.emailTo?.trim()?.takeIf { it.isNotEmpty() } ?: "them"
    val title: String
    val body: String
    when (trouble) {
        SentEmailTrouble.Retrying -> {
            title = "The email hasn’t gone out yet"
            body = "We couldn’t reach $to yet. We’ll keep trying for an hour, or you can email it again now."
        }
        SentEmailTrouble.Failed -> {
            title = "The email didn’t go out"
            body =
                "We couldn’t email $to. If the address is right, email it again. If it has a mistake, take the card back " +
                "and send it to the right one." + if (emailAgain.postage) " Your stamp comes back." else ""
        }
    }
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag("mailSentEmailTrouble"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Mail,
            contentDescription = null,
            size = 20.dp,
            tint = PantopusColors.cardSectionInk,
        )
        Column(modifier = Modifier.weight(1f)) {
            Column(modifier = Modifier.semantics(mergeDescendants = true) {}) {
                Text(title, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(body, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
            }
            CardButton(
                "Email it again",
                onClick = emailAgain.onEmailAgain,
                kind = CardButtonKind.Paper,
                fill = false,
                busy = emailAgain.busy,
                modifier = Modifier.padding(top = Spacing.s3).testTag("mailSentPieceEmailAgain"),
            )
        }
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
                .semantics { contentDescription = "Loading your mail" },
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
    // Its email didn't go out (email_status), or it waits for its time (email_send_at); never both.
    val trouble = emailStepTrouble(step, card)
    val later = if (trouble == null) emailStepLater(step, card, zone) else null
    val title = trouble ?: later ?: sentTrailTitle(step, card, first)
    val detail =
        step.at?.let { at -> HolidayCardTimes.parse(at)?.atZone(zone)?.format(trailTime) }
            ?: step.on?.let { on -> runCatching { LocalDate.parse(on.take(10)) }.getOrNull()?.format(trailDay) }
    return MailTrailStep(
        id = step.step,
        title = if (step.done || trouble != null || later != null) title else "$title · not yet",
        detail = detail?.uppercase(Locale.US)?.takeIf { step.done },
        done = step.done,
        readers = false,
    )
}

/** The emailed step while its email is set for the sender's 7 a.m. or Christmas morning: when it goes, not "· not yet". */
private fun emailStepLater(
    step: SentCardStep,
    card: SentCard,
    zone: ZoneId,
): String? {
    if (step.step != "emailed" || step.done) return null
    return card.emailSendAt?.let { "Email goes ${HolidayCardTimes.emailGoesAt(it, zone)}" }
}

/** The card as its page draws it, with the sender's own note; null when the server sent no picture. */
private fun sentLetterCard(card: SentCard): MailLetterCard? {
    val face = card.card ?: return null
    val design = face.design?.takeIf { it.isNotBlank() } ?: return null
    return MailLetterCard(
        design = design,
        caption = face.caption,
        paper = face.paper,
        year = face.year ?: Year.now().value,
        sealed = false,
        opensOn = null,
        opensIn = null,
        mailedOn = card.envelope?.postmarkedOn ?: card.sentAt,
        note = card.note.orEmpty().trim(),
        firstOpen = false,
        pictureHeight = face.height,
        number = face.number,
        slug = face.slug,
        table = face.table,
        verse = face.verse?.takeIf { it.isNotBlank() },
        signature = face.signature?.takeIf { it.drawable },
        // The sender's own photo, through Sent's route: never covered for them (memories plan).
        photo = face.photo?.let { CardPrintPhoto.sent(card.id, it) },
        voice = face.voice?.let { CardGreetingVoice.sent(card.id, it) },
    )
}

/** The emailed step while its email hasn't gone out: what happened to it, instead of "· not yet". */
private fun emailStepTrouble(
    step: SentCardStep,
    card: SentCard,
): String? {
    if (step.step != "emailed" || step.done) return null
    return when (MailSentWords.emailTrouble(card)) {
        SentEmailTrouble.Failed -> "The email didn’t go out"
        SentEmailTrouble.Retrying -> "Emailing them · trying again"
        null -> null
    }
}

private fun claimStepTitle(
    done: Boolean,
    letter: Boolean,
): String =
    if (letter) {
        if (done) "They claimed your letter" else "They claim your letter"
    } else {
        if (done) "They joined Pantopus and have it" else "They join Pantopus and have it"
    }

/** A card by link's own steps, in its own words; null for a step any card has. */
private fun linkTrailTitle(
    step: SentCardStep,
    card: SentCard,
): String? =
    when (step.step) {
        "emailed" -> "Your link was ready"
        "joined" ->
            if (step.done) {
                "${card.toName?.takeIf { it.isNotBlank() } ?: "Someone"} opened your link and has your card"
            } else {
                "Someone opens your link"
            }
        "returned" -> "Nobody opened your link in 90 days"
        else -> null
    }

private fun sentTrailTitle(
    step: SentCardStep,
    card: SentCard,
    first: String,
): String {
    val round = if (card.arrival == "christmas_morning") "Christmas morning" else "7 a.m."
    val contactTo = card.toName?.takeIf { card.status != "claimed" && it.isNotBlank() } ?: "them"
    val letter = card.kind == "letter"
    if (card.byLink) linkTrailTitle(step, card)?.let { return it }
    return when (step.step) {
        "sealed" -> "Sealed by you"
        "picked_up" -> "Picked up by the carrier"
        "delivered" -> "Delivered with $first’s $round mail"
        "opens" -> "Opens on Christmas morning"
        // Once claimed, Sent names the person instead of the address it went to (as the web says it).
        "emailed" -> "${if (letter) "Sent" else "Emailed"} to $contactTo"
        "joined" -> claimStepTitle(step.done, letter)
        "returned" -> if (letter) "The claim link expired" else "They didn’t open the email in 90 days"
        "not_delivered" -> "Couldn’t be delivered"
        else -> step.step
    }
}
