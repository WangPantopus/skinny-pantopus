@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "CyclomaticComplexMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
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
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.sharein.ShareInCardPhotoNote
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.cards.table.CardLinkBox
import app.pantopus.android.ui.screens.mailbox.cards.table.clothTint
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
    /** "See it in Sent" on the card just sent: that card's page in Sent; "See them in Sent" on a list: null (Sent itself). */
    onSeeInSent: (String?) -> Unit = {},
    viewModel: SendCardViewModel = hiltViewModel(),
) {
    val cards by viewModel.cards.collectAsStateWithLifecycle()
    val load by viewModel.load.collectAsStateWithLifecycle()
    val form by viewModel.form.collectAsStateWithLifecycle()
    val fromName by viewModel.fromName.collectAsStateWithLifecycle()
    val stampShort by viewModel.stampShort.collectAsStateWithLifecycle()
    var confirmTakeBack by rememberSaveable { mutableStateOf(false) }
    // Pick a card's picture open large on the card rack (a tap on it, or "See it larger").
    var largeDesign by rememberSaveable { mutableStateOf<String?>(null) }
    // "Seal and send" on Look it over: the table, to seal it by hand (Part 2).
    var sealing by rememberSaveable { mutableStateOf(false) }
    // "Seal and send" on step 4 (plan Part 5): the look's check, then straight to the table; Back there returns to step 4.
    var sealFromStep4 by rememberSaveable { mutableStateOf(false) }
    // Look it over's pinned button, measured, so the end of the page can scroll up above it.
    var pinnedHeight by remember { mutableIntStateOf(0) }
    // A card on a sent list, asked about before it's taken back.
    var listTakeBack by remember { mutableStateOf<SentHolidayCard?>(null) }
    val season = cards
    val page = SendCardPage.of(season, form)
    // Pick a card as shelves (the server's switch `card_shelves`, card shelves SPEC Part B), and the collection whose
    // page is open over them ("All collections"); the page closes with the step.
    val shelves = page == SendCardPage.Steps && form.step == SendCardStep.Pick && season?.drawsShelves == true
    var openCollection by rememberSaveable { mutableStateOf<String?>(null) }
    val collectionOpen = shelves && openCollection != null
    // Back walks the steps only while they show: on today's card (or done for the year) it closes at once, even when
    // "Send Hazel a card" opened the steps at Pick a card underneath. On a collection's page it goes back to the shelves.
    val back = {
        if (collectionOpen) {
            openCollection = null
        } else if (page != SendCardPage.Steps || !viewModel.back()) {
            onClose()
        }
    }
    BackHandler(onBack = back)
    val scroll = rememberScrollState()
    LaunchedEffect(form.step) { scroll.scrollTo(0) }
    LaunchedEffect(form.step) { if (form.step != SendCardStep.Pick) openCollection = null }
    // Digital stamps (postage on): the balance after each step, card and take-back, and on coming back (Google Play
    // purchases are finished then). The stamp books open from the header's count, "Get stamps to send", or a card the
    // server refused for a stamp.
    val stamps: MailStampBooksViewModel? = if (season?.postageEnabled == true) hiltViewModel() else null
    var showsStampBooks by rememberSaveable { mutableStateOf(false) }
    // Opened for the card's photo or greeting (no bought stamp left): the sheet says why.
    var stampsForMedia by rememberSaveable { mutableStateOf(false) }
    val getStamps = { showsStampBooks = true }
    val getStampsForMedia = {
        stampsForMedia = true
        showsStampBooks = true
    }
    if (stamps != null) {
        LifecycleResumeEffect(stamps, form.step, form.sent?.id, form.listResults?.size, form.listTakenBack.size, form.tookBack) {
            stamps.refresh()
            onPauseOrDispose { }
        }
        LaunchedEffect(stamps) {
            viewModel.stampsNeeded.collect { forMedia ->
                stampsForMedia = forMedia
                showsStampBooks = true
                stamps.refresh()
                // A photo or greeting refused for a bought stamp: Write on the back then says why (`media.bought_stamp`).
                viewModel.reload()
            }
        }
        // Photo and voice waiting for a bought stamp ("buy"): once one is bought (or found with Check for your stamps),
        // the cards are read again, and Write on the back offers them without leaving the step.
        val paid = stamps.balance?.paidRemaining ?: 0
        val toBuy = season?.media?.boughtStamp?.toBuy == true
        LaunchedEffect(paid, toBuy) {
            if (toBuy && paid > 0) viewModel.reload()
        }
    }
    val onSteps = page == SendCardPage.Steps
    val listLook = form.listPreview.takeIf { onSteps && form.to is CardRecipient.Several }
    // Look it over keeps only its button, over the page (plan 5.2); every other bar sits under the steps.
    val pinsOver = onSteps && form.step == SendCardStep.Look && (listLook != null || form.preview != null)
    // "Seal it for the day" pins its two buttons too, so they show the moment it opens (the design check of November 17).
    val sealTo = form.to.takeIf { onSteps && form.step == SendCardStep.Seal && season?.designOf(form.design) != null }
    val lookGround = lookGround(season, form)
    val density = LocalDensity.current
    // "Send this card to someone else" (plan Part 6): the same picture and signature, from Who it's for.
    val sendAgain = { viewModel.startAnotherCard(samePicture = true) }
    // Above the keyboard: the steps and what's pinned under them (step 1's button on with a list).
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.cardDesk).imePadding().testTag("sendCard")) {
        StepHeader(
            title = if (collectionOpen) "All collections" else page.title(form),
            step = form.step.takeIf { page == SendCardPage.Steps },
            onBack = back,
        )
        // On the shelves the stamps left sit on the "To" line instead.
        if (!shelves) {
            StampChip(
                stamps?.balance,
                onOpen = getStamps,
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            )
        }
        // A photo shared to Mail from another app waits for "Write on the back".
        ShareInCardPhotoNote()
        Box(modifier = Modifier.weight(1f)) {
            if (shelves && season != null) {
                PickShelves(
                    cards = season,
                    chosen = form.design,
                    to = form.to,
                    stamps = stamps?.balance,
                    onStamps = getStamps,
                    open = openCollection,
                    onOpen = { openCollection = it },
                    onLarge = { largeDesign = it },
                )
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .verticalScroll(scroll)
                            .padding(bottom = if ((pinsOver || sealTo != null) && LaunchFeatures.cardTable) 0.dp else Spacing.s6),
                ) {
                    when (page) {
                        SendCardPage.Reading -> {
                            val failed = load as? SendCardLoad.Failed
                            if (failed != null) LoadProblem(failed.message, onRetry = viewModel::reload) else LoadingDesk()
                        }
                        SendCardPage.Today ->
                            season?.todaysCard?.let { today ->
                                SentCardSection(
                                    today,
                                    season,
                                    "Today’s card",
                                    form,
                                    onTakeBack = { confirmTakeBack = true },
                                    onClose = onClose,
                                    fromName = fromName,
                                )
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
                                    stamps = stamps?.balance,
                                    onStampsForMedia = getStampsForMedia,
                                    onTakeBackFromList = { listTakeBack = it },
                                    onLarge = { largeDesign = it },
                                    endRoom = with(density) { pinnedHeight.toDp() }.takeIf { pinsOver || sealTo != null } ?: 0.dp,
                                    onSendAgain = sendAgain.takeIf { season.canSendAnother(stamps?.balance) },
                                )
                            }
                    }
                }
            }
            val pinned = Modifier.align(Alignment.BottomCenter).onSizeChanged { pinnedHeight = it.height }
            if (pinsOver && listLook != null) {
                ListLookFooter(
                    form = form,
                    look = listLook,
                    stamps = stamps?.balance,
                    onSend = { sealing = true },
                    onGetStamps = { viewModel.getStampsForList(stamps?.balance?.available ?: 0) },
                    ground = lookGround,
                    modifier = pinned,
                )
            } else if (pinsOver) {
                LookFooter(
                    form = form,
                    onSend = { sealing = true },
                    byLink = form.to is CardRecipient.Link,
                    stamps = stamps?.balance,
                    onGetStamps = getStamps,
                    ground = lookGround,
                    modifier = pinned,
                )
            } else if (sealTo != null) {
                SealFooter(
                    to = sealTo,
                    form = form,
                    stamps = stamps?.balance,
                    sealingNow = sealFromStep4,
                    onSend = viewModel::send,
                    onSealNow = {
                        sealFromStep4 = true
                        viewModel.look()
                    },
                    onLook = {
                        sealFromStep4 = false
                        viewModel.look()
                    },
                    onGetStamps = getStamps,
                    ground = lookGround,
                    modifier = pinned,
                )
            }
        }
        val listGrowing = onSteps && viewModel.maxRecipients > 1 && form.listed.isNotEmpty()
        if (form.step == SendCardStep.To && listGrowing) {
            ListContinueBar(form, onContinue = viewModel::continueWithList)
        } else if (shelves && season != null) {
            // The shelves' bar shows only once a card is chosen; the rack is the same.
            ShelvesBar(season, form.design, onLarge = { largeDesign = it }, onNext = viewModel::next)
            PickRack(
                season,
                large = largeDesign,
                onLarge = { largeDesign = it },
                onChoose = viewModel::chooseDesign,
                onNext = viewModel::next,
            )
        } else if (onSteps && form.step == SendCardStep.Pick && season != null) {
            PickBar(
                cards = season,
                chosen = form.design,
                large = largeDesign,
                onLarge = { largeDesign = it },
                onChoose = viewModel::chooseDesign,
                onNext = viewModel::next,
            )
        }
    }
    // The table stays while the card is looked over and sent; anything else (step 4 saying why) puts it away.
    LaunchedEffect(form.step) {
        if (form.step != SendCardStep.Look && form.step != SendCardStep.Sent) sealing = false
    }
    // Step 4's "Seal and send" once its check is answered: the table, or the reason on step 4. A list with a card that
    // won't go, or too few stamps for it, opens Look it over instead, which shows each person's line (plan 5.1).
    LaunchedEffect(form.step, form.previewing) {
        if (!sealFromStep4 || form.previewing) return@LaunchedEffect
        when (form.step) {
            SendCardStep.Look -> {
                val list = form.listPreview
                val stampsLeft = stamps?.balance?.available ?: list?.needed ?: 0
                val listGoes = list == null || (list.recipients.all { it.status == "ready" } && list.needed <= stampsLeft)
                if (listGoes) sealing = true else sealFromStep4 = false
            }
            SendCardStep.Seal -> sealFromStep4 = false
            else -> Unit
        }
    }
    val sealable = form.step == SendCardStep.Look || form.step == SendCardStep.Sent
    if (sealing && season != null && sealable) {
        SealByHand(
            cards = season,
            form = form,
            fromName = fromName,
            onSeal = { if (viewModel.form.value.to is CardRecipient.Several) viewModel.sendList() else viewModel.send() },
            // Back from a table reached from step 4 returns there; from Look it over, to Look it over.
            onBack = {
                sealing = false
                if (sealFromStep4) {
                    sealFromStep4 = false
                    viewModel.back()
                }
            },
            // Done (or ✕) once it's sent: back to the Mailbox.
            onFinished = {
                sealing = false
                onClose()
            },
            onTakeBack = {
                sealing = false
                confirmTakeBack = true
            },
            onSendAgain =
                {
                    sealing = false
                    sendAgain()
                }.takeIf { season.canSendAnother(stamps?.balance) },
        )
    }
    if (stamps != null && showsStampBooks) {
        StampBooksSheet(
            stamps,
            onDismiss = {
                showsStampBooks = false
                stampsForMedia = false
                viewModel.clearStampShort()
            },
            short = stampShort,
            forMedia = stampsForMedia,
        )
    }
    listTakeBack?.let { card ->
        TakeBackDialog(
            byEmail = card.byEmail,
            postage = true,
            notEmailedYet = card.emailSendAt != null,
            onTakeBack = {
                listTakeBack = null
                viewModel.takeBackFromList(card)
            },
            onKeep = { listTakeBack = null },
        )
    }
    if (confirmTakeBack) {
        TakeBackDialog(
            byEmail = (form.sent ?: season?.todaysCard)?.byEmail == true,
            byLink = (form.sent ?: season?.todaysCard)?.byLink == true,
            postage = season?.postageEnabled == true,
            notEmailedYet = (form.sent ?: season?.todaysCard)?.emailSendAt != null,
            onTakeBack = {
                confirmTakeBack = false
                viewModel.takeBack()
            },
            onKeep = { confirmTakeBack = false },
        )
    }
    // "Where does it start?" (travelling card plan Part 2): asked once, for a travelling card from someone with no town.
    val askTown by viewModel.town.askTown.collectAsStateWithLifecycle()
    if (askTown != null) {
        CardTownSheet(
            onKept = {
                // What was asked for goes on with the town kept.
                when (viewModel.town.kept()) {
                    TownThen.Look -> viewModel.look()
                    TownThen.Send -> viewModel.send()
                    TownThen.SendList -> viewModel.sendList()
                    TownThen.Nothing, null -> Unit
                }
            },
            onDismiss = viewModel.town::dismissed,
        )
    }
}

/** Under a card just sent: "Send another card", and "Send this card to someone else" while another can go (Part 6). */
@Composable
private fun AnotherCardButtons(
    onAnother: () -> Unit,
    onSendAgain: (() -> Unit)?,
) {
    CardButton(
        "Send another card",
        onClick = onAnother,
        kind = CardButtonKind.Paper,
        modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4).testTag("sendAnotherCard"),
    )
    if (onSendAgain != null) {
        CardButton(
            SEND_THIS_CARD_AGAIN,
            onClick = onSendAgain,
            kind = CardButtonKind.Paper,
            modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2).testTag("sendThisCardAgain"),
        )
    }
}

/** "Send this card to someone else" (plan Part 6). */
internal const val SEND_THIS_CARD_AGAIN = "Send this card to someone else"

/** Another card can go now (plan Part 6): a stamp left with digital stamps on, else today's card not used yet. */
internal fun HolidayCardsResponse?.canSendAnother(stamps: StampBalance?): Boolean {
    val season = this ?: return false
    if (!season.open) return false
    return if (season.postageEnabled) (stamps?.available ?: season.stamps?.available ?: 0) > 0 else season.todaysCard == null
}

/** What Look it over lies on under its pinned button: the card's cloth at the table, else the desk. */
private fun lookGround(
    cards: HolidayCardsResponse?,
    form: SendCardForm,
): Color {
    val design = cards?.designOf(form.design)
    return if (LaunchFeatures.cardTable && design != null) clothTint(design.table) else PantopusColors.cardDesk
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
            Steps, Sent -> if (form.step == SendCardStep.Sent && form.sent?.byLink == true) "Your card is ready" else form.step.title
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
    onSeeInSent: (String?) -> Unit,
    /** Digital stamps left (postage on, once read), for step 4 when it seals and sends itself. */
    stamps: StampBalance?,
    /** The stamp books for the card's photo or greeting (no bought stamp left), saying why. */
    onStampsForMedia: () -> Unit,
    /** A card on a sent list: "Take it back" (asked first). */
    onTakeBackFromList: (SentHolidayCard) -> Unit,
    /** Pick a card: show this picture large. */
    onLarge: (String) -> Unit,
    /** Room at the end of "Seal it for the day" and of Look it over for their pinned buttons. */
    endRoom: Dp = 0.dp,
    /** "Send this card to someone else" once it's sent, while another card can go (plan Part 6). */
    onSendAgain: (() -> Unit)? = null,
) {
    val backNote = form.backNote(postage = cards.postageEnabled)
    if (backNote != null && form.step == SendCardStep.To) {
        DeskNote(
            backNote,
            modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2),
        )
    }
    ToLine(form)
    if (form.step == SendCardStep.Sent && form.listResults != null) {
        ListSentSection(
            cards = cards,
            form = form,
            onTakeBack = onTakeBackFromList,
            onSendRest = viewModel::sendList,
            onClose = onClose,
            onSeeInSent = { onSeeInSent(null) },
            onAnother = { viewModel.startAnotherCard() },
            onSendAgain = onSendAgain,
        )
        return
    }
    val to = form.to
    val design = cards.designs.firstOrNull { it.id == form.design }
    val keepingState by viewModel.signatureKeeper.state.collectAsStateWithLifecycle()
    val mediaWords = cards.mediaWords(stamps, form)
    when (form.step) {
        SendCardStep.To -> ToStep(form, viewModel)
        SendCardStep.Pick -> PickStep(cards, form.design, onLarge = onLarge)
        SendCardStep.Write ->
            if (design != null) {
                StepsAtTable(LaunchFeatures.cardTable, design.table) {
                    WriteStep(
                        design = design,
                        year = cards.year,
                        fromName = fromName,
                        to = to,
                        limit = cards.messageLimit,
                        message = form.message,
                        onMessage = viewModel::onMessageChange,
                        onNext = viewModel::next,
                        signature = form.signature,
                        canSign = LaunchFeatures.cardTable && cards.signature != null,
                        onSignature = viewModel::onSignature,
                        keeping =
                            CardSignKeeping(
                                saved = cards.signature?.saved?.takeIf { it.drawable },
                                state = keepingState,
                                onSigned = viewModel.signatureKeeper::signed,
                                onForget = viewModel.signatureKeeper::forget,
                                onOpened = viewModel.signatureKeeper::opened,
                            ).takeIf { LaunchFeatures.cardTable && cards.signature?.saves == true },
                        photo = form.photo,
                        photos = photoCalls(cards, form, viewModel),
                        voice = form.voice,
                        voices = voiceCalls(cards, form, viewModel),
                        buyStamp = onStampsForMedia.takeIf { mediaWords.buyStamp },
                        mediaWords = mediaWords,
                        noteHelp = viewModel.noteHelp.takeIf { cards.noteHelp },
                    )
                }
            }
        SendCardStep.Seal ->
            if (design != null && to != null) {
                StepsAtTable(LaunchFeatures.cardTable, design.table) {
                    SealStep(
                        cards,
                        to,
                        design,
                        fromName,
                        form,
                        onArrival = viewModel::chooseArrival,
                        stamps = stamps,
                        endRoom = endRoom,
                        // "Let it travel" (travelling card plan Part 2): only where the server offers it.
                        travel = (!form.travelOff).takeIf { cards.travel?.on == true },
                        onTravel = viewModel.town::set,
                    )
                }
            }
        SendCardStep.Look -> {
            val preview = form.preview
            val listLook = form.listPreview
            StepsAtTable(LaunchFeatures.cardTable && design != null, design?.table) {
                when {
                    to is CardRecipient.Several && design != null && listLook != null -> {
                        ListLookStep(cards, form, design, listLook)
                        ListLookEndLines(form, listLook, stamps)
                    }
                    design != null && to != null && preview != null -> {
                        LookStep(cards, to, design, preview)
                        LookEndLines(lookTakeBackLine(to)) {
                            StampPostageLine(stamps, design = form.design, modifier = Modifier.padding(top = 10.dp))
                        }
                    }
                }
                Spacer(Modifier.height(endRoom))
            }
        }
        SendCardStep.Sent ->
            form.sent?.let { card ->
                SentCardSection(
                    card = card,
                    cards = cards,
                    title = if (card.byLink) "By link" else "On its way",
                    form = form,
                    fromName = fromName,
                    onTakeBack = onTakeBack,
                    onClose = onClose,
                    onSeeInSent = { onSeeInSent(card.id) },
                )
                // With digital stamps there's no card a day: another card starts here, under the one just sent.
                if (cards.postageEnabled) AnotherCardButtons(onAnother = { viewModel.startAnotherCard() }, onSendAgain = onSendAgain)
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

/**
 * The back arrow, the title, and five dots: wax red for the steps done and the current one (longer), cream ahead. With
 * digital stamps on, the stamps left sit before the dots ([stamps], once read) and open the stamp books.
 */
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
 * "Take your card back?" (the card screens and Sent). With digital stamps on ([postage]) the card's stamp comes back.
 * Otherwise taking back a card sent today frees the day ([freesToday]); one sent before doesn't, so the dialog doesn't
 * say so then.
 */
@Composable
internal fun TakeBackDialog(
    byEmail: Boolean,
    onTakeBack: () -> Unit,
    onKeep: () -> Unit,
    freesToday: Boolean = true,
    byLink: Boolean = false,
    postage: Boolean = false,
    /**
     * By email, nothing has been emailed to them yet: its email is set for later (`email_send_at`), or Sent says it didn't
     * go out (`email_status`; taking it back stops the tries).
     */
    notEmailedYet: Boolean = false,
) {
    val first =
        when {
            byLink -> "Your link will say you took it back."
            byEmail && notEmailedYet -> "We haven’t emailed them yet, so nothing will go out."
            byEmail -> "The link in their email will say you took it back."
            else -> "It won’t go out with the morning mail."
        }
    AlertDialog(
        onDismissRequest = onKeep,
        title = { Text("Take your card back?") },
        text = {
            Text(
                when {
                    postage -> "$first Its stamp comes back to you."
                    freesToday -> "$first You can send a card again today."
                    else -> first
                },
            )
        },
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
    /** Who it's from, for the line sent with a link. */
    fromName: String = "",
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
        SentCardBox(card, cards.designOf(card.design), title, arrivalLine(card, zone))
        if (card.byLink && card.canTakeBack) {
            CardLinkBox(
                cardId = card.id,
                knownLink = card.link,
                fromFirst = fromName.trim().substringBefore(' ').ifEmpty { "someone" },
                copyWords = if (card.link != null) "Copy link" else "Copy link again",
                modifier = Modifier.padding(top = Spacing.s3),
            )
        }
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
            if (cards.postageEnabled) {
                "One digital stamp per card. Receiving and replies are free."
            } else {
                "One card a day. You can send another tomorrow."
            },
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
    picture: HolidayCardDesign?,
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
        card.design?.let { design ->
            TiltedThumb(design, width = 84.dp, tilt = -2f, pictureHeight = picture?.height, paper = picture?.paper)
        }
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
                if (card.byLink && card.status != "claimed") "To whoever opens your link" else "To ${card.toName ?: "them"}",
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
internal fun arrivalLine(
    card: SentHolidayCard,
    zone: ZoneId,
): String {
    val who = card.toName ?: "They"
    val day = HolidayCardTimes.shortDay(card.arrivesOn ?: card.arrivesAt, zone)
    return when {
        card.status == "withdrawn" -> "You took this card back."
        card.byLink && card.status == "claimed" ->
            card.toName?.let { "$it opened your link and has your card." } ?: "They opened your link and have your card."
        card.byLink && card.status == "expired" -> "Nobody opened your link in 90 days."
        card.byLink -> "Waiting for someone to open your link."
        card.byEmail && card.status == "claimed" -> "$who joined Pantopus and has your card."
        // Set for the sender's 7 a.m. or Christmas morning: nothing is emailed before then.
        card.byEmail && card.emailSendAt != null ->
            "We’ll email them ${HolidayCardTimes.emailGoesAt(card.emailSendAt, zone)}, your time. Once they join with that address, it " +
                "waits in their mailbox."
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
internal fun takeBackLine(
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

/**
 * A card's picture, small and tilted, with a soft shadow; its [paper] at the picture's shape ([pictureHeight], the
 * server's) while it loads.
 */
@Composable
internal fun TiltedThumb(
    design: String,
    width: Dp,
    tilt: Float,
    pictureHeight: Int? = null,
    paper: String? = null,
) {
    val shape = RoundedCornerShape(2.dp)
    AsyncImage(
        model = HolidayCardArt.picture(design, thumb = true),
        contentDescription = null,
        contentScale = ContentScale.FillBounds,
        modifier =
            Modifier
                .size(width = width, height = width / HolidayCardArt.pictureAspect(design, pictureHeight))
                .rotate(tilt)
                .shadow(4.dp, shape)
                .clip(shape)
                .background(HolidayCardArt.paper(paper)),
    )
}

/** The season's picture with this [id], with its caption, paper and height; null for one it doesn't have. */
internal fun HolidayCardsResponse.designOf(id: String?): HolidayCardDesign? = designs.firstOrNull { it.id == id }

/**
 * What Write on the back can do with a photo (memories plan step 4): only with the key on, when `GET /cards` says photos
 * can be added now, and for one card to one person (a list goes without: one photo, one card). None when no bought
 * stamp is left and none can be bought (`media.bought_stamp` "unavailable"). A photo already added stays shown so it can
 * be removed.
 */
private fun photoCalls(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    viewModel: SendCardViewModel,
): CardPhotoCalls? {
    val canAdd = LaunchFeatures.holidayCardMemories && cards.media?.photo?.usable == true && cards.mediaCanGo(form)
    if (!canAdd && form.photo == null) return null
    val drafts = viewModel.drafts
    return CardPhotoCalls(drafts::addPhoto, drafts::retryPhoto, drafts::removePhoto, drafts::onPhotoAlt)
}

/**
 * What Write on the back can do with a voice greeting (memories plan step 7): only with the key on, when `GET /cards`
 * says greetings can be added now, for one card to one person (a list too while `improved`), and not when no bought
 * stamp can be had. One already added stays so it can be removed.
 */
private fun voiceCalls(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    viewModel: SendCardViewModel,
): CardVoiceCalls? {
    val canAdd = LaunchFeatures.holidayCardMemories && cards.media?.voice?.usable == true && cards.mediaCanGo(form)
    if (!canAdd && form.voice == null) return null
    val drafts = viewModel.drafts
    return CardVoiceCalls(drafts::addVoice, drafts::retryVoice, drafts::removeVoice)
}

/**
 * One card to one person (a list too while `improved`: Wave 2), while a bought stamp is left or can be bought (not
 * `media.bought_stamp` "unavailable"; while `improved` it's left out as long as a free photo or voice card is left).
 */
private fun HolidayCardsResponse.mediaCanGo(form: SendCardForm): Boolean =
    (improved || form.to !is CardRecipient.Several) && media?.boughtStamp?.unavailable != true
