@file:Suppress("LongMethod", "TooManyFunctions", "LongParameterList", "MatchingDeclarationName", "MagicNumber", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.crewday.booking

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.crewday.components.CrewDayCrewRow
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDayServiceTag
import app.pantopus.android.ui.screens.crewday.components.CrewDayStreetMap
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanLockLine
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PLAN_MAP_HEIGHT
import app.pantopus.android.ui.screens.plans.detail.PlanMenuItem
import app.pantopus.android.ui.screens.plans.detail.PlanPageScaffold
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/** Where the booking page hands off. */
data class CrewDayBookingActions(
    val onBack: () -> Unit,
    /** "Something needs attention" (screen 7), and "Add a note or photo" to an open case. */
    val onProblem: (bookingId: String) -> Unit,
    /** "Message the crew": the conversation with the crew's business page. */
    val onMessageCrew: (businessUserId: String, name: String) -> Unit,
    /** "See receipt" and "Pay now": the existing invoice page and its pay flow. */
    val onOpenInvoice: (invoiceId: String) -> Unit,
    /** The system share sheet. */
    val onShare: (message: String, title: String) -> Unit,
    /** "Who sees what", the printable flyer: the web's pages. */
    val onOpenWebPath: (path: String) -> Unit,
    val onOpenWeb: (url: String) -> Unit,
    /** "Find another Crew Day": Your Crew Days (screen 10). */
    val onFindAnother: () -> Unit,
    /** "Ask for one on your street" (screen 11). */
    val onAsk: () -> Unit,
)

/**
 * Your Crew Day (screen 5, boards `CrewDay` and `Cd*`, `AndroidCrewDay`): the street map, the day, the four-step
 * status line, the state card for where the booking is, your booking, the note for the crew, and the actions.
 */
@Composable
fun CrewDayBookingScreen(
    actions: CrewDayBookingActions,
    viewModel: CrewDayBookingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notice by viewModel.notice.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(notice) {
        notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    when (val current = state) {
        CrewDayBookingUiState.Loading ->
            PlanPlainScaffold(onBack = actions.onBack, title = "Your Crew Day", modifier = Modifier.testTag("crewDayBooking")) {
                CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
            }
        CrewDayBookingUiState.Gone ->
            PlanPlainScaffold(onBack = actions.onBack, title = "Your Crew Day", modifier = Modifier.testTag("crewDayBooking")) {
                EmptyState(
                    icon = PantopusIcon.CalendarX,
                    headline = "This booking isn't here",
                    subcopy = "It may belong to another account. Your Crew Days lists every booking you made.",
                    ctaTitle = "Your Crew Days",
                    onCta = actions.onFindAnother,
                    modifier = Modifier.heightIn(min = 420.dp),
                    tint = PantopusColors.homeBg,
                    accent = PantopusColors.home,
                )
            }
        is CrewDayBookingUiState.Error ->
            PlanPlainScaffold(onBack = actions.onBack, title = "Your Crew Day", modifier = Modifier.testTag("crewDayBooking")) {
                ErrorState(
                    headline = "Couldn't load your Crew Day",
                    message = current.message,
                    onRetry = viewModel::retry,
                    modifier = Modifier.heightIn(min = 420.dp).testTag("crewDayLoadError"),
                )
            }
        is CrewDayBookingUiState.Loaded -> BookingPage(current.booking, viewModel, actions)
    }
    ToastHost(controller = toast)
}

@Composable
private fun BookingPage(
    booking: CrewDayBookingDto,
    viewModel: CrewDayBookingViewModel,
    actions: CrewDayBookingActions,
) {
    val working by viewModel.working.collectAsStateWithLifecycle()
    val gateTold by viewModel.gateTold.collectAsStateWithLifecycle()
    val prices by viewModel.prices.collectAsStateWithLifecycle()
    var sheet by rememberSaveable { mutableStateOf<String?>(null) }
    val day = booking.crewDay
    val share = booking.share
    val shareBooking: () -> Unit = { sheet = SHEET_SHARE }
    PlanPageScaffold(
        header = { CrewDayStreetMap(street = day?.streetLabel ?: day?.title.orEmpty(), height = PLAN_MAP_HEIGHT) },
        onBack = actions.onBack,
        modifier = Modifier.testTag("crewDayBooking"),
        onShare = shareBooking.takeIf { share?.url != null },
        menu =
            listOf(
                PlanMenuItem("Who sees what") { actions.onOpenWebPath("/crew-day/who-sees-what") },
                PlanMenuItem("How Crew Day works") { actions.onOpenWebPath("/crew-day/how-it-works") },
            ),
    ) {
        TitleBlock(booking)
        StatusLine(boardSteps(booking))
        StateCard(booking, working, gateTold, viewModel, actions, onEditNote = { sheet = SHEET_NOTE })
        YourBooking(booking)
        ForTheCrew(booking, onEdit = { sheet = SHEET_NOTE })
        ActionRows(
            booking = booking,
            onMessage = {
                day?.crew?.businessUserId?.let { id -> actions.onMessageCrew(id, booking.crewName) }
            },
            onChange = {
                viewModel.loadPrices()
                sheet = SHEET_CHANGE
            },
            onShare = shareBooking,
            onWhoSees = { actions.onOpenWebPath("/crew-day/who-sees-what") },
        )
    }
    when (sheet) {
        SHEET_NOTE ->
            CrewDayNoteDialog(
                initial = booking.accessNote.orEmpty(),
                onSave = {
                    sheet = null
                    viewModel.saveNote(it)
                },
                onDismiss = { sheet = null },
            )
        SHEET_CHANGE ->
            CrewDayChangeSheet(
                booking = booking,
                prices = prices,
                working = working,
                onEditNote = { sheet = SHEET_NOTE },
                onChangeDetails = { option, addOns ->
                    sheet = null
                    viewModel.changeDetails(option, addOns)
                },
                onCancel = {
                    sheet = null
                    viewModel.cancel()
                },
                onAskRelease = {
                    sheet = null
                    viewModel.askRelease()
                    day?.crew?.businessUserId?.let { id -> actions.onMessageCrew(id, booking.crewName) }
                },
                onDismiss = { sheet = null },
            )
        SHEET_SHARE ->
            CrewDayShareSheet(
                booking = booking,
                onShare = { message -> actions.onShare(message, "Share with neighbors") },
                onOpenFlyer = { share?.flyerUrl?.let(actions.onOpenWeb) },
                onDismiss = { sheet = null },
            )
        else -> Unit
    }
}

private const val SHEET_NOTE = "note"
private const val SHEET_CHANGE = "change"
private const val SHEET_SHARE = "share"

/** The service tag, the title, the date and window, and the crew row. */
@Composable
private fun TitleBlock(booking: CrewDayBookingDto) {
    val day = booking.crewDay
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        CrewDayServiceTag(service = day?.service, label = day?.serviceLabel ?: CrewDayFormat.service(day?.service))
        Text(
            text = day?.title.orEmpty(),
            style = PantopusTextStyle.h2.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(text = booking.whenWords, style = PantopusTextStyle.body, color = PantopusColors.appTextStrong)
        CrewDayCrewRow(crew = day?.crew)
    }
}

/** A step as the board draws it: the server's step, with the board's words where the booking waits. */
private data class BoardStep(
    val key: String,
    val label: String,
    val state: String?,
    val tone: StepTone,
)

private enum class StepTone { Normal, Warning, Error }

/**
 * The board's status line for this booking (board `CrewDay`, as the web draws it): "Requested" is where a home
 * waiting on its price stands, "Pick a date" while rain moved it, "Paused" while support has a problem, "Payment due"
 * after a declined card.
 */
private fun boardSteps(booking: CrewDayBookingDto): List<BoardStep> {
    // Waiting on support or on a payment comes after the work: every step before Paid is done (board `CdAttention`).
    val stuckAtPaid = booking.problem?.status == "open" || booking.status == "payment_failed"
    return booking.steps.map { step ->
        val label = step.label ?: step.key
        when {
            stuckAtPaid && step.key != "paid" -> BoardStep(step.key, label, "done", StepTone.Normal)
            booking.status in setOf("price_pending", "price_offered") && step.key == "booked" ->
                BoardStep(step.key, label, "current", StepTone.Normal)
            booking.status == "new_dates" && step.key == "booked" -> BoardStep(step.key, "Pick a date", "current", StepTone.Warning)
            booking.problem?.status == "open" && step.key == "paid" -> BoardStep(step.key, "Paused", "current", StepTone.Warning)
            booking.status == "payment_failed" && step.key == "paid" -> BoardStep(step.key, "Payment due", "current", StepTone.Error)
            else -> BoardStep(step.key, label, step.state, StepTone.Normal)
        }
    }
}

/**
 * The four-step status line (Booked · On the way · Done · Paid). With large text it becomes a list, so no word has to
 * squeeze into a quarter of the width (board `CdDoneLarge`).
 */
@Composable
private fun StatusLine(steps: List<BoardStep>) {
    if (steps.isEmpty()) return
    val large = LocalDensity.current.fontScale >= LARGE_TEXT
    val spoken = steps.joinToString(", ") { "${it.label}: ${stepWord(it)}" }
    if (large) {
        Column(
            modifier = Modifier.fillMaxWidth().testTag("crewDayBookingSteps").semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            steps.forEach { step ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    StepDot(step)
                    Text(
                        text = "${step.label} · ${stepWord(step)}",
                        style = PantopusTextStyle.body,
                        color = stepInk(step),
                    )
                }
            }
        }
        return
    }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("crewDayBookingSteps")
                .semantics(mergeDescendants = true) { contentDescription = spoken },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        steps.forEach { step ->
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 4.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(stepFill(step))
                            .padding(vertical = 2.dp),
                )
                Text(
                    text = step.label,
                    style = PantopusTextStyle.caption.copy(fontWeight = stepWeight(step.state)),
                    color = stepInk(step),
                    maxLines = 1,
                )
            }
        }
    }
}

private const val LARGE_TEXT = 1.3f

private fun stepWeight(state: String?): FontWeight = if (state == "current") FontWeight.Bold else FontWeight.Medium

/** The step's colour on the line: home green as it goes, amber while it waits, red when a payment is due. */
private fun stepFill(step: BoardStep): Color =
    when {
        step.tone == StepTone.Warning -> PantopusColors.warning
        step.tone == StepTone.Error -> PantopusColors.error
        step.state == "todo" -> PantopusColors.appBorderStrong
        else -> PantopusColors.home
    }

private fun stepInk(step: BoardStep): Color =
    when {
        step.tone == StepTone.Warning -> PantopusColors.warning
        step.tone == StepTone.Error -> PantopusColors.error
        step.state == "todo" -> PantopusColors.appTextSecondary
        else -> PantopusColors.appText
    }

@Composable
private fun StepDot(step: BoardStep) {
    val todo = step.state == "todo"
    Box(
        modifier =
            Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(if (todo) PantopusColors.appSurfaceSunken else stepFill(step))
                .border(1.dp, stepFill(step), CircleShape),
    )
}

/** What TalkBack says after a step's name (the board: "in progress", "on hold", "needs payment"). */
private fun stepWord(step: BoardStep): String =
    when {
        step.state == "done" -> "done"
        step.state != "current" -> "not yet"
        step.tone == StepTone.Warning -> "on hold"
        step.tone == StepTone.Error -> "needs payment"
        else -> "now"
    }

/** The card on top: what is happening and what the household can do now. */
@Composable
private fun StateCard(
    booking: CrewDayBookingDto,
    working: Set<String>,
    gateTold: Boolean,
    viewModel: CrewDayBookingViewModel,
    actions: CrewDayBookingActions,
    onEditNote: () -> Unit,
) {
    val card = booking.card()
    val day = booking.crewDay
    val crew = booking.crewName
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .planCard()
                .border(1.dp, PantopusColors.home.copy(alpha = 0.4f), RoundedCornerShape(Radii.xl2))
                .padding(Spacing.s4)
                .testTag("crewDayBookingState_${card.name.lowercase()}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        when (card) {
            CrewDayBookingCard.Booked ->
                StateText(
                    title = "You're on the route",
                    body =
                        booking.reminderWeekday()?.let { "We'll remind you $it evening. You don't need to be home." }
                            ?: "We'll remind you the evening before. You don't need to be home.",
                    note = booking.prepNote,
                )
            CrewDayBookingCard.Evening -> {
                StateText(
                    title = "Tomorrow, ${CrewDayFormat.window(booking.windowStart, booking.windowEnd).orEmpty()}",
                    body = "You don't need to be home.",
                    note = booking.prepNote,
                )
                PlanTonalButton(
                    title = "Edit access note",
                    onClick = onEditNote,
                    height = 44.dp,
                    modifier = Modifier.testTag("crewDayBookingEditNote"),
                )
            }
            CrewDayBookingCard.DayOf ->
                StateText(
                    title = "Today, ${CrewDayFormat.window(booking.windowStart, booking.windowEnd).orEmpty()}",
                    body = "$crew tells you when it's on the way. You don't need to be home.",
                    note = booking.prepNote,
                )
            CrewDayBookingCard.Confirming ->
                StateText(
                    title = "The crew is checking your price",
                    body =
                        "$crew looks at your home before confirming the price. " +
                            "${closesWords(booking)}Nothing is booked or charged yet.",
                )
            CrewDayBookingCard.PriceOffered -> {
                StateText(title = "Your price: ${booking.priceWords.orEmpty()}", body = "$crew looked at your home.")
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PlanTonalButton(
                        title = "Decline",
                        onClick = { viewModel.answerPrice(false) },
                        height = 44.dp,
                        loading = CrewDayBookingViewModel.DECLINE in working,
                        modifier = Modifier.weight(1f).testTag("crewDayBookingDecline"),
                    )
                    PrimaryButton(
                        title = "Approve ${booking.priceWords.orEmpty()}",
                        onClick = { viewModel.answerPrice(true) },
                        isLoading = CrewDayBookingViewModel.APPROVE in working,
                        modifier = Modifier.weight(1f).testTag("crewDayBookingApprove"),
                    )
                }
            }
            CrewDayBookingCard.OnTheWay -> {
                val eta = CrewDayFormat.eta(booking.eta?.start, booking.eta?.end, CrewDayFormat.zone(day?.timezone))
                StateText(
                    title = eta?.let { "On the way · expected $it" } ?: "On the way",
                    body = booking.clockOf(booking.eta?.updatedAt)?.let { "Updated by $crew at $it" },
                )
                if (gateTold || booking.gateReadyAt != null) {
                    Text(
                        text = "We told the crew the gate is ready.",
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                        modifier = Modifier.testTag("crewDayBookingGateTold"),
                    )
                } else {
                    PrimaryButton(
                        title = "Gate is ready",
                        onClick = viewModel::gateReady,
                        isLoading = CrewDayBookingViewModel.GATE in working,
                        modifier = Modifier.fillMaxWidth().testTag("crewDayBookingGateReady"),
                    )
                }
                PlanTonalButton(
                    title = "Message the crew",
                    onClick = { day?.crew?.businessUserId?.let { actions.onMessageCrew(it, crew) } },
                    height = 44.dp,
                    modifier = Modifier.testTag("crewDayBookingMessage"),
                )
            }
            CrewDayBookingCard.Done -> {
                StateText(
                    title = "Done · reported by the crew" + booking.clockOf(booking.doneAt)?.let { " at $it" }.orEmpty(),
                    body = null,
                )
                Photos(booking.photoUrls)
                booking.doneNote?.takeIf { it.isNotBlank() }?.let { NoteQuote(it) }
                Text(
                    text =
                        "We'll charge ${booking.priceWords ?: "your price"} ${booking.chargeWhen() ?: "tomorrow"} " +
                            "unless you tell us something needs attention.",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                )
                PrimaryButton(
                    title = "Everything looks good",
                    onClick = viewModel::looksGood,
                    isLoading = CrewDayBookingViewModel.CONFIRM in working,
                    modifier = Modifier.fillMaxWidth().testTag("crewDayBookingLooksGood"),
                )
                PlanTonalButton(
                    title = "Something needs attention",
                    onClick = { actions.onProblem(booking.id) },
                    height = 44.dp,
                    modifier = Modifier.testTag("crewDayBookingProblem"),
                )
            }
            CrewDayBookingCard.Paid -> {
                StateText(
                    title = "Paid ${booking.priceWords.orEmpty()}${booking.dayOf(booking.charge?.paidAt)?.let { " · $it" }.orEmpty()}",
                    body = null,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // After a declined charge the household paid in Pantopus, maybe with another card (as the web says).
                    val paidInApp = booking.events.any { it.kind == "paid_by_household" }
                    Text(
                        text = booking.cardWords?.takeUnless { paidInApp } ?: "Paid in Pantopus",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextStrong,
                        modifier = Modifier.weight(1f),
                    )
                    booking.invoiceId?.let { invoice ->
                        PlanTextButton(
                            title = "See receipt",
                            onClick = { actions.onOpenInvoice(invoice) },
                            modifier = Modifier.fillMaxWidth(0.45f).testTag("crewDayBookingReceipt"),
                        )
                    }
                }
                Photos(booking.photoUrls)
                Text(
                    text = "Want this again next season? We'll ask you first.",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                )
                PlanTonalButton(
                    title = if (booking.remindNextSeason) "We'll remind you" else "Remind me next season",
                    onClick = { viewModel.remindNextSeason(!booking.remindNextSeason) },
                    height = 44.dp,
                    loading = CrewDayBookingViewModel.REMIND in working,
                    modifier = Modifier.testTag("crewDayBookingRemind"),
                )
            }
            CrewDayBookingCard.CardFailed -> {
                StateText(
                    title = "Your card didn't go through",
                    body = "Pay ${booking.priceWords.orEmpty()} to $crew in Pantopus.",
                )
                booking.invoiceId?.let { invoice ->
                    PrimaryButton(
                        title = "Pay now",
                        onClick = { actions.onOpenInvoice(invoice) },
                        modifier = Modifier.fillMaxWidth().testTag("crewDayBookingPayNow"),
                    )
                }
            }
            CrewDayBookingCard.NewDates -> NewDatesCard(booking, working, viewModel)
            CrewDayBookingCard.Attention -> {
                val problem = booking.problem
                StateText(title = "Pantopus support has this", body = problem?.note?.let { "You said: $it" })
                Photos(booking.problemPhotoUrls, from = "you sent")
                Text(
                    text =
                        "Your ${booking.priceWords ?: ""} charge is paused while we sort it out." +
                            (booking.dayOf(problem?.dueAt)?.let { " We'll reply by ${booking.clockOf(problem?.dueAt)} $it." } ?: ""),
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                )
                Timeline(booking)
                PlanTonalButton(
                    title = "Add a note or photo",
                    onClick = { actions.onProblem(booking.id) },
                    height = 44.dp,
                    modifier = Modifier.testTag("crewDayBookingAddNote"),
                )
            }
            CrewDayBookingCard.Resolved -> {
                StateText(title = booking.resolutionWords(), body = "Pantopus support closed this case.")
                booking.invoiceId?.let { invoice ->
                    PlanTextButton(
                        title = "See receipt",
                        onClick = { actions.onOpenInvoice(invoice) },
                        modifier = Modifier.testTag("crewDayBookingReceipt"),
                    )
                }
            }
            CrewDayBookingCard.Refunded -> {
                StateText(title = "Refunded ${booking.priceWords.orEmpty()}${booking.cardWords?.let { " to $it" }.orEmpty()}", body = null)
                booking.invoiceId?.let { invoice ->
                    PlanTextButton(
                        title = "See receipt",
                        onClick = { actions.onOpenInvoice(invoice) },
                        modifier = Modifier.testTag("crewDayBookingReceipt"),
                    )
                }
            }
            CrewDayBookingCard.Cancelled, CrewDayBookingCard.Declined -> {
                StateText(
                    title = if (card == CrewDayBookingCard.Declined) "$crew can't take your home" else "Cancelled",
                    body = if (card == CrewDayBookingCard.Declined) "Nothing was charged." else booking.cancelledWords(),
                )
                PrimaryButton(
                    title = "Find another Crew Day",
                    onClick = actions.onFindAnother,
                    modifier = Modifier.fillMaxWidth().testTag("crewDayBookingFindAnother"),
                )
                PlanTonalButton(
                    title = "Ask for one on your street",
                    onClick = actions.onAsk,
                    height = 44.dp,
                    modifier = Modifier.testTag("crewDayBookingAsk"),
                )
            }
        }
    }
}

/** A sunken well for a quote or the crew's note. */
private fun Modifier.wellShape(): Modifier = clip(RoundedCornerShape(14.dp)).background(PantopusColors.appSurfaceSunken).padding(Spacing.s3)

/** "You'll hear by Sun, Nov 15. " for a price check. */
private fun closesWords(booking: CrewDayBookingDto): String =
    booking.dayOf(booking.cancelCutoffAt)?.let { "You'll hear by $it. " }.orEmpty()

@Composable
private fun StateText(
    title: String,
    body: String?,
    note: String? = null,
) {
    Text(
        text = title,
        style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
        color = PantopusColors.appText,
        modifier = Modifier.semantics { heading() }.testTag("crewDayBookingStateTitle"),
    )
    body?.let { Text(text = it, style = PantopusTextStyle.body, color = PantopusColors.appTextStrong) }
    note?.takeIf { it.isNotBlank() }?.let { prep ->
        Column(
            modifier = Modifier.fillMaxWidth().wellShape(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "One thing to do",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(text = prep, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
        }
    }
}

@Composable
private fun NoteQuote(text: String) {
    Text(
        text = "“$text”",
        style = PantopusTextStyle.body,
        color = PantopusColors.appTextStrong,
        modifier = Modifier.fillMaxWidth().wellShape(),
    )
}

/** One to eight photo thumbnails ([from]: "from the crew", "you sent"); a tap shows one large. */
@Composable
private fun Photos(
    urls: List<String>,
    from: String = "from the crew",
) {
    if (urls.isEmpty()) return
    var open by remember { mutableStateOf<String?>(null) }
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("crewDayBookingPhotos"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        urls.forEachIndexed { index, url ->
            AsyncImage(
                model = url,
                contentDescription = "Photo ${index + 1} of ${urls.size} $from",
                contentScale = ContentScale.Crop,
                modifier =
                    Modifier
                        .size(88.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(role = Role.Image) { open = url },
            )
        }
    }
    open?.let { url ->
        Dialog(onDismissRequest = { open = null }) {
            AsyncImage(
                model = url,
                contentDescription = "Photo $from, large",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable { open = null },
            )
        }
    }
}

/** The case so far (board `CdAttention`): when, and what happened, from the report on. */
@Composable
private fun Timeline(booking: CrewDayBookingDto) {
    val lines = caseLines(booking)
    if (lines.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("crewDayBookingTimeline")) {
        lines.forEach { (at, text) ->
            Column(modifier = Modifier.semantics(mergeDescendants = true) {}) {
                Text(text = at, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                Text(text = text, style = PantopusTextStyle.body, color = PantopusColors.appText)
            }
        }
    }
}

/** "Thu, Nov 5 · 9:05 AM" and its line for each step of the case the household may see, as the web words them. */
private fun caseLines(booking: CrewDayBookingDto): List<Pair<String, String>> {
    val start = booking.events.indexOfFirst { it.kind == "problem_opened" }
    if (start < 0) return emptyList()
    return booking.events.drop(start).mapNotNull { event ->
        val note = (event.data?.get("note") as? String)?.trim()?.takeIf { it.isNotEmpty() }
        val text =
            when (event.kind) {
                "problem_opened" -> "You reported a problem. Your charge paused."
                "problem_note" -> note?.let { "You added: “$it”" } ?: "You added photos."
                "operator_note" -> note?.let { "Pantopus support: $it" }
                "refunded" -> (event.data?.get("amount_cents") as? Number)?.let { "Refunded ${CrewDayFormat.price(it.toInt())}." }
                "problem_resolved" -> listOfNotNull(resolvedLine(event.data?.get("resolution") as? String), note).joinToString(" ")
                "charged", "paid_by_household" -> "Your charge went through."
                else -> null
            } ?: return@mapNotNull null
        listOfNotNull(booking.dayOf(event.createdAt), booking.clockOf(event.createdAt)).joinToString(" · ") to text
    }
}

private fun resolvedLine(resolution: String?): String =
    when (resolution) {
        "released" -> "Pantopus support released the charge."
        "refunded" -> "Pantopus support refunded you."
        "partial_refund" -> "Pantopus support refunded part of the charge."
        else -> "Pantopus support closed this case."
    }

/** Rain changed the plan (screen 6): pick one of the dates, or cancel at no charge. */
@Composable
private fun NewDatesCard(
    booking: CrewDayBookingDto,
    working: Set<String>,
    viewModel: CrewDayBookingViewModel,
) {
    val proposal = booking.proposal
    var choice by rememberSaveable { mutableStateOf(proposal?.dates?.firstOrNull()?.date) }
    StateText(
        title = "Rain changed the plan",
        body =
            "${booking.crewName} can come on one of these dates. Your price stays ${booking.priceWords ?: "the same"}. " +
                "No payment has been taken.",
    )
    PlanFormCard(modifier = Modifier.testTag("crewDayBookingDates")) {
        proposal?.dates.orEmpty().forEachIndexed { index, option ->
            val selected = option.date == choice
            PlanOptionRow(
                first = index == 0,
                onClick = { choice = option.date },
                modifier = Modifier.semantics { this.selected = selected }.testTag("crewDayBookingDate_${option.date}"),
            ) {
                RadioButton(selected = selected, onClick = null)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = CrewDayFormat.longDate(CrewDayFormat.date(option.date)).orEmpty(),
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    CrewDayFormat.window(option.windowStart, option.windowEnd)?.let {
                        Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                    }
                }
            }
        }
    }
    val picked = choice
    PrimaryButton(
        title = picked?.let { "Book ${CrewDayFormat.weekday(CrewDayFormat.date(it))}" } ?: "Pick a date",
        onClick = { if (picked != null && proposal != null) viewModel.answerNewDate(proposal.id, picked) },
        isEnabled = picked != null,
        isLoading = CrewDayBookingViewModel.NEW_DATE in working,
        modifier = Modifier.fillMaxWidth().testTag("crewDayBookingBookDate"),
    )
    PlanTonalButton(
        title = "Cancel at no charge",
        onClick = { proposal?.let { viewModel.answerNewDate(it.id, CrewDayBookingViewModel.CANCEL_CHOICE) } },
        height = 44.dp,
        modifier = Modifier.testTag("crewDayBookingCancelDates"),
    )
    booking.dayOf(proposal?.deadlineAt)?.let { deadline ->
        Text(
            text = "If you don't answer by $deadline at ${booking.clockOf(proposal?.deadlineAt)}, we won't book a new date for you.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/** Your booking: the address (crew and Pantopus only), the home's details, the price, the card, cancelling. */
@Composable
private fun YourBooking(booking: CrewDayBookingDto) {
    PlanField("Your booking") {
        PlanFormCard(modifier = Modifier.testTag("crewDayBookingDetails")) {
            PlanOptionRow(first = true) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = booking.address?.line.orEmpty(),
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    PlanLockLine("Visible to your crew and Pantopus.")
                }
            }
            DetailRow("Your home", booking.homeDetails)
            DetailRow("Price", booking.priceWords?.let { "$it · including tax" } ?: "The crew confirms it after a look")
            booking.cardWords?.let { DetailRow("Card", it) }
            booking.cancelWords()?.let { words ->
                PlanOptionRow { Text(text = words, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
            }
        }
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
) {
    // The label keeps its width and a long value wraps beside it (a long value used to squeeze the label to nothing).
    PlanOptionRow(modifier = Modifier.semantics(mergeDescendants = true) {}) {
        Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
        Text(
            text = value,
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1f),
        )
    }
}

/** For the crew: the access note, Edit, and who sees it when. */
@Composable
private fun ForTheCrew(
    booking: CrewDayBookingDto,
    onEdit: () -> Unit,
) {
    if (booking.status in setOf("cancelled", "declined", "refunded", "paid")) return
    PlanField("For the crew") {
        PlanFormCard(modifier = Modifier.testTag("crewDayBookingNote")) {
            PlanOptionRow(first = true) {
                Text(
                    text = booking.accessNote?.takeIf { it.isNotBlank() } ?: "No note yet. Gate, pets, parking…",
                    style = PantopusTextStyle.body,
                    color = if (booking.accessNote.isNullOrBlank()) PantopusColors.appTextSecondary else PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PlanTextButton(
                    title = "Edit",
                    onClick = onEdit,
                    modifier = Modifier.fillMaxWidth(0.25f).testTag("crewDayBookingEditNoteRow"),
                )
            }
        }
        Text(text = "The crew sees this on the day only.", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
    }
}

/** Message the crew · Change or cancel · Share with neighbors · Who sees what. */
@Composable
private fun ActionRows(
    booking: CrewDayBookingDto,
    onMessage: () -> Unit,
    onChange: () -> Unit,
    onShare: () -> Unit,
    onWhoSees: () -> Unit,
) {
    val active = booking.status !in setOf("cancelled", "declined", "refunded")
    PlanFormCard(modifier = Modifier.testTag("crewDayBookingActions")) {
        ActionRow(PantopusIcon.MessageCircle, "Message the crew", first = true, tag = "crewDayBookingMessageRow", onClick = onMessage)
        if (active && booking.status !in setOf("done", "paid", "payment_failed")) {
            ActionRow(PantopusIcon.Pencil, "Change or cancel", tag = "crewDayBookingChange", onClick = onChange)
        }
        if (active && booking.share?.url != null) {
            ActionRow(PantopusIcon.Share, "Share with neighbors", tag = "crewDayBookingShare", onClick = onShare)
        }
        ActionRow(PantopusIcon.Lock, "Who sees what", tag = "crewDayBookingWhoSees", onClick = onWhoSees)
    }
}

@Composable
private fun ActionRow(
    icon: PantopusIcon,
    title: String,
    first: Boolean = false,
    tag: String,
    onClick: () -> Unit,
) {
    PlanOptionRow(first = first, onClick = onClick, modifier = Modifier.testTag(tag)) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = PantopusColors.appText)
        Text(text = title, style = PantopusTextStyle.body, color = PantopusColors.appText, modifier = Modifier.weight(1f))
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}
