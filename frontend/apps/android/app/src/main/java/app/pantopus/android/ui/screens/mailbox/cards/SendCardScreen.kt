@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import java.time.ZoneId

/**
 * Send a Christmas card (launch keys `holiday_cards` + `mailbox`): the five steps on the cream desk, with the back arrow
 * and the step dots in the header (step 5, "Look it over", keeps "Seal and send" under it); today's card once it's sent;
 * and "done for this year" after December 31. Back (the arrow or the system's) goes a step back with everything kept,
 * and from the first step or a sent card back to the Mailbox. Each step opens at its top.
 */
@Composable
fun SendCardScreen(
    onClose: () -> Unit,
    /** "See it in Sent" on the card just sent: that card's page in Sent. */
    onSeeInSent: (String) -> Unit = {},
    viewModel: SendCardViewModel = hiltViewModel(),
) {
    val cards by viewModel.cards.collectAsStateWithLifecycle()
    val load by viewModel.load.collectAsStateWithLifecycle()
    val form by viewModel.form.collectAsStateWithLifecycle()
    val fromName by viewModel.fromName.collectAsStateWithLifecycle()
    var confirmTakeBack by rememberSaveable { mutableStateOf(false) }
    val back = { if (!viewModel.back()) onClose() }
    BackHandler(onBack = back)

    val season = cards
    val page = SendCardPage.of(season, form)
    val scroll = rememberScrollState()
    LaunchedEffect(form.step) { scroll.scrollTo(0) }
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.cardDesk).testTag("sendCard")) {
        StepHeader(title = page.title(form), step = form.step.takeIf { page == SendCardPage.Steps }, onBack = back)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .imePadding()
                    .verticalScroll(scroll)
                    .padding(bottom = Spacing.s6),
        ) {
            when (page) {
                SendCardPage.Reading -> {
                    val failed = load as? SendCardLoad.Failed
                    if (failed != null) LoadProblem(failed.message, onRetry = viewModel::reload) else LoadingDesk()
                }
                SendCardPage.Today ->
                    season?.todaysCard?.let { today ->
                        SentCardSection(today, season, "Today’s card", form, onTakeBack = { confirmTakeBack = true }, onClose = onClose)
                    }
                SendCardPage.Closed -> DoneForTheYear(onClose)
                SendCardPage.Steps, SendCardPage.Sent ->
                    season?.let {
                        Steps(
                            cards = it,
                            form = form,
                            fromName = fromName,
                            viewModel = viewModel,
                            onClose = onClose,
                            onTakeBack = { confirmTakeBack = true },
                            onSeeInSent = onSeeInSent,
                        )
                    }
            }
        }
        if (page == SendCardPage.Steps && form.step == SendCardStep.Look && form.preview != null) {
            LookFooter(byEmail = form.to is CardRecipient.Email, form = form, onSend = viewModel::send)
        }
    }
    if (confirmTakeBack) {
        TakeBackDialog(
            byEmail = (form.sent ?: season?.todaysCard)?.byEmail == true,
            onTakeBack = {
                confirmTakeBack = false
                viewModel.takeBack()
            },
            onKeep = { confirmTakeBack = false },
        )
    }
}

/** What the send screen shows: the cards being read, today's card, done for the year, the steps, or the card just sent. */
private enum class SendCardPage {
    Reading,
    Today,
    Closed,
    Steps,
    Sent,
    ;

    fun title(form: SendCardForm): String =
        when (this) {
            Reading, Closed -> "Christmas cards"
            Today -> "Today’s card"
            Steps, Sent -> form.step.title
        }

    companion object {
        fun of(
            cards: HolidayCardsResponse?,
            form: SendCardForm,
        ): SendCardPage =
            when {
                cards == null -> Reading
                form.step == SendCardStep.Sent -> Sent
                cards.todaysCard != null -> Today
                !cards.open -> Closed
                else -> Steps
            }
    }
}

/** The step the person is on, under the header: who it's to once that's chosen, then the step itself. */
@Composable
private fun Steps(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    fromName: String,
    viewModel: SendCardViewModel,
    onClose: () -> Unit,
    onTakeBack: () -> Unit,
    onSeeInSent: (String) -> Unit,
) {
    if (form.tookBack && form.step == SendCardStep.To) {
        DeskNote(
            "You took your card back. You can send a card again today.",
            modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2),
        )
    }
    ToLine(form)
    val to = form.to
    val design = cards.designs.firstOrNull { it.id == form.design }
    when (form.step) {
        SendCardStep.To -> ToStep(form, viewModel)
        SendCardStep.Pick -> PickStep(cards, form.design, onChoose = viewModel::chooseDesign, onNext = viewModel::next)
        SendCardStep.Write ->
            if (design != null) {
                WriteStep(
                    design = design,
                    year = cards.year,
                    fromName = fromName,
                    to = to,
                    limit = cards.messageLimit,
                    message = form.message,
                    onMessage = viewModel::onMessageChange,
                    onNext = viewModel::next,
                )
            }
        SendCardStep.Seal ->
            if (design != null && to != null) {
                SealStep(
                    cards,
                    to,
                    design,
                    fromName,
                    form,
                    onArrival = viewModel::chooseArrival,
                    onLook = viewModel::look,
                    onSend = viewModel::send,
                )
            }
        SendCardStep.Look -> {
            val preview = form.preview
            if (design != null && to != null && preview != null) LookStep(cards, to, design, preview)
        }
        SendCardStep.Sent ->
            form.sent?.let { card ->
                SentCardSection(
                    card = card,
                    cards = cards,
                    title = "On its way",
                    form = form,
                    onTakeBack = onTakeBack,
                    onClose = onClose,
                    onSeeInSent = { onSeeInSent(card.id) },
                )
            }
    }
}

/** "To Maya O." over steps 2 to 5, once who it's to is chosen. */
@Composable
private fun ToLine(form: SendCardForm) {
    val to = form.to ?: return
    if (form.step !in setOf(SendCardStep.Pick, SendCardStep.Write, SendCardStep.Seal, SendCardStep.Look)) return
    Text(
        "To ${to.label}",
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = PantopusColors.cardTextQuiet,
        modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s1),
    )
}

/** The back arrow, the title, and five dots: wax red for the steps done and the current one (longer), cream ahead. */
@Composable
private fun StepHeader(
    title: String,
    step: SendCardStep?,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(start = Spacing.s1, end = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack, modifier = Modifier.testTag("sendCardBack")) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                size = 24.dp,
                tint = PantopusColors.cardTextStrong,
            )
        }
        Text(
            title,
            fontSize = 18.sp,
            lineHeight = 24.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        val index = step?.let { SendCardStep.steps.indexOf(it) } ?: -1
        if (index >= 0) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                modifier = Modifier.clearAndSetSemantics { contentDescription = "Step ${index + 1} of ${SendCardStep.steps.size}" },
            ) {
                SendCardStep.steps.forEachIndexed { at, _ ->
                    Box(
                        modifier =
                            Modifier
                                .height(7.dp)
                                .widthIn(min = if (at == index) 20.dp else 7.dp)
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(if (at <= index) PantopusColors.cardWax else PantopusColors.cardFieldEdge),
                    )
                }
            }
        }
    }
}

/** A note on the desk: cream card stock with a thin edge. */
@Composable
internal fun DeskNote(
    text: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Text(
        text,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = PantopusColors.cardTextBody,
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .padding(horizontal = 14.dp, vertical = 10.dp),
    )
}

/** Reading the cards: the search field and its rows, in shimmer. */
@Composable
private fun LoadingDesk() {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .semantics { contentDescription = "Loading the Christmas cards" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 360.dp, height = 48.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        Shimmer(width = 220.dp, height = 14.dp)
        repeat(3) { Shimmer(width = 360.dp, height = 56.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth()) }
    }
}

/** The cards couldn't be read: why, and Try again. */
@Composable
private fun LoadProblem(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6, vertical = Spacing.s10).testTag("sendCardError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            "Couldn’t load the Christmas cards",
            fontSize = 18.sp,
            lineHeight = 24.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Text(message, fontSize = 15.sp, lineHeight = 22.sp, color = PantopusColors.cardTextQuiet, textAlign = TextAlign.Center)
        CardButton("Try again", onClick = onRetry, modifier = Modifier.padding(top = Spacing.s3))
    }
}

/** Sending closes when December 31 ends; the cards people received stay. */
@Composable
private fun DoneForTheYear(onClose: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6, vertical = Spacing.s10).testTag("sendCardClosed"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Christmas cards are done for this year",
            fontFamily = FontFamily.Serif,
            fontSize = 22.sp,
            lineHeight = 28.sp,
            color = PantopusColors.cardWax,
            textAlign = TextAlign.Center,
        )
        Text(
            "The cards you received stay in your mailbox.",
            fontSize = 15.sp,
            lineHeight = 22.sp,
            color = PantopusColors.cardTextQuiet,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        CardButton("Back to your mail", onClick = onClose, modifier = Modifier.padding(top = Spacing.s6))
    }
}

/**
 * "Take your card back?" (the card screens and Sent). Taking back a card sent today frees the day ([freesToday]); one
 * sent before doesn't, so the dialog doesn't say so then.
 */
@Composable
internal fun TakeBackDialog(
    byEmail: Boolean,
    onTakeBack: () -> Unit,
    onKeep: () -> Unit,
    freesToday: Boolean = true,
) {
    val first = if (byEmail) "The link in their email will say you took it back." else "It won’t go out with the morning mail."
    AlertDialog(
        onDismissRequest = onKeep,
        title = { Text("Take your card back?") },
        text = { Text(if (freesToday) "$first You can send a card again today." else first) },
        confirmButton = {
            TextButton(onClick = onTakeBack, modifier = Modifier.testTag("sendCardTakeBackConfirm")) {
                Text("Take it back", color = PantopusColors.cardWax, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = { TextButton(onClick = onKeep) { Text("Keep it", color = PantopusColors.cardTextBody) } },
        containerColor = PantopusColors.appSurface,
    )
}

/**
 * A sent card: just now ("On its way", with "See it in Sent") or today's card, with when it arrives, Take it back and
 * Back to your mail.
 */
@Composable
internal fun SentCardSection(
    card: SentHolidayCard,
    cards: HolidayCardsResponse,
    title: String,
    form: SendCardForm,
    onTakeBack: () -> Unit,
    onClose: () -> Unit,
    onSeeInSent: (() -> Unit)? = null,
) {
    val zone = HolidayCardTimes.zone(cards.timeZone)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4)
                .testTag("sendCardSent"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SentCardBox(card, title, arrivalLine(card, zone))
        takeBackLine(card, zone)?.let {
            Text(
                it,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.cardTextQuiet,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = Spacing.s3),
            )
        }
        form.takeBackError?.let {
            Text(
                it,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.cardTextProblem,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = Spacing.s2),
            )
        }
        Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (card.canTakeBack) {
                CardButton(
                    "Take it back",
                    onClick = onTakeBack,
                    kind = CardButtonKind.Paper,
                    busy = form.takingBack,
                    modifier = Modifier.testTag("sendCardTakeBack"),
                )
            }
            CardButton("Back to your mail", onClick = onClose, modifier = Modifier.testTag("sendCardBackToMail"))
            if (onSeeInSent != null) {
                CardButton(
                    "See it in Sent",
                    onClick = onSeeInSent,
                    kind = CardButtonKind.Words,
                    icon = PantopusIcon.Send,
                    modifier = Modifier.testTag("sendCardSeeInSent"),
                )
            }
        }
        Text(
            "One card a day. You can send another tomorrow.",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.cardTextQuiet,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3),
        )
    }
}

/** The card's picture, tilted, beside who it's to and when it arrives. */
@Composable
private fun SentCardBox(
    card: SentHolidayCard,
    title: String,
    line: String,
) {
    val shape = RoundedCornerShape(Radii.xl)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, PantopusColors.cardListEdge, shape)
                .padding(Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        card.design?.let { design -> TiltedThumb(design, width = 84.dp, tilt = -2f) }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                title.uppercase(),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.78.sp,
                color = PantopusColors.cardTextQuiet,
            )
            Text(
                "To ${card.toName ?: "them"}",
                fontSize = 17.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(
                line,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = PantopusColors.cardTextBody,
                modifier = Modifier.padding(top = Spacing.s1),
            )
        }
    }
}

/** How a sent card arrives, in a sentence: "their 7 a.m. mail", never their 7 a.m. turned into the sender's hours. */
private fun arrivalLine(
    card: SentHolidayCard,
    zone: ZoneId,
): String {
    val who = card.toName ?: "They"
    val day = HolidayCardTimes.shortDay(card.arrivesOn ?: card.arrivesAt, zone)
    return when {
        card.status == "withdrawn" -> "You took this card back."
        card.byEmail && card.status == "claimed" -> "$who joined Pantopus and has your card."
        card.byEmail && card.arrival == "sealed_christmas" ->
            "We emailed them. Once they join with that address, it waits in their mailbox and opens on Christmas morning."
        card.byEmail -> "We emailed them. It waits for them to join with that address and open it."
        card.status == "delivered" && card.opensAt != null -> "It’s in $who’s mailbox, sealed until Christmas morning."
        card.status == "delivered" -> "It’s in $who’s mailbox."
        card.arrival == "christmas_morning" -> "$who gets it on Christmas morning with their 7 a.m. mail."
        card.arrival == "sealed_christmas" -> "It comes with their 7 a.m. mail on $day, sealed until Christmas morning."
        else -> "$who gets it with their 7 a.m. mail on $day."
    }
}

/** Until when it can be taken back, on the sender's own clock; null once it can't. */
private fun takeBackLine(
    card: SentHolidayCard,
    zone: ZoneId,
): String? =
    when {
        !card.canTakeBack -> null
        card.byEmail -> "You can take it back until they open it."
        else ->
            "You can take it back until ${HolidayCardTimes.clockTime(card.takeBackUntil, zone)} " +
                "${HolidayCardTimes.shortDay(card.takeBackUntil, zone)}, when the carrier picks it up."
    }

/** A card's picture, small and tilted, with a soft shadow. */
@Composable
internal fun TiltedThumb(
    design: String,
    width: Dp,
    tilt: Float,
) {
    val shape = RoundedCornerShape(2.dp)
    AsyncImage(
        model = HolidayCardArt.picture(design, thumb = true),
        contentDescription = null,
        contentScale = ContentScale.FillBounds,
        modifier =
            Modifier
                .size(width = width, height = width / HolidayCardArt.pictureAspect(design))
                .rotate(tilt)
                .shadow(4.dp, shape)
                .clip(shape)
                .background(PantopusColors.cardPaper),
    )
}
