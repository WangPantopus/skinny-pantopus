@file:Suppress("LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.crewday.book

import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.InviteLinks
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.screens.crewday.components.CrewDayAddressField
import app.pantopus.android.ui.screens.crewday.components.CrewDayCrewRow
import app.pantopus.android.ui.screens.crewday.components.CrewDayFlowScaffold
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDayServiceTag
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanLockLine
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanFooterCaption
import app.pantopus.android.ui.screens.settings.payments.PaymentsEvent
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import com.stripe.android.paymentsheet.rememberPaymentSheet
import java.util.Locale

/** Where the booking flow hands off. */
data class CrewDayBookActions(
    val onClose: () -> Unit,
    /** "See my Crew Day" after booking (screen 5). */
    val onOpenBooking: (bookingId: String) -> Unit,
    /** "Ask for one on your street" when the address is outside the day (screen 11). */
    val onAsk: () -> Unit,
)

/**
 * Booking from an invitation: Your price (screen 2, board `Price`), Review and book (3, `Review`) and You're on the
 * route (4, `Booked`), in one place so Back on Review returns to the price and the flow books once.
 */
@Composable
fun CrewDayBookScreen(
    actions: CrewDayBookActions,
    viewModel: CrewDayBookViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    val context = LocalContext.current
    val paymentSheet = rememberPaymentSheet { result -> viewModel.onAddCardOutcome(StripePaymentSheets.outcome(result)) }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is PaymentsEvent.PresentAddCardSheet -> {
                    if (!viewModel.canPresentAddCardSheet(event.params)) return@collect
                    paymentSheet.presentWithSetupIntent(
                        setupIntentClientSecret = event.params.setupIntent,
                        configuration =
                            StripePaymentSheets.configuration(
                                context = context,
                                customerId = event.params.customer,
                                ephemeralKey = event.params.ephemeralKey,
                                publishableKey = event.params.publishableKey,
                            ),
                    )
                }
                is PaymentsEvent.ShowMessage -> toast.error(event.text)
            }
        }
    }
    BackHandler(enabled = state.step == CrewDayBookStep.Review) { viewModel.backToPrice() }
    val day = state.day
    when {
        day == null ->
            CrewDayFlowScaffold(
                title = "Your price",
                onBack = actions.onClose,
                step = "1 of 2",
                modifier = Modifier.testTag("crewDayPrice"),
            ) {
                val error = state.loadError
                if (error != null) {
                    ErrorState(
                        headline = "Couldn't load this Crew Day",
                        message = error,
                        onRetry = viewModel::load,
                        modifier = Modifier.heightIn(min = 360.dp),
                    )
                } else {
                    CrewDayListPlaceholder()
                }
            }
        state.step == CrewDayBookStep.Price -> PriceStep(day, state, viewModel, actions)
        state.step == CrewDayBookStep.Review -> ReviewStep(day, state, viewModel)
        else -> BookedStep(day, state, actions)
    }
    ToastHost(controller = toast)
}

/** "Gutter Day on Maple Lane · Tue, Nov 17". */
private fun dayLine(day: CrewDayPublicDto): String = listOfNotNull(day.title, CrewDayFormat.shortDate(day.serviceDate)).joinToString(" · ")

// MARK: - 2. Your price

@Composable
private fun PriceStep(
    day: CrewDayPublicDto,
    state: CrewDayBookState,
    viewModel: CrewDayBookViewModel,
    actions: CrewDayBookActions,
) {
    val outside = state.quote?.inArea == false
    CrewDayFlowScaffold(
        title = "Your price",
        onBack = actions.onClose,
        step = "1 of 2",
        modifier = Modifier.testTag("crewDayPrice"),
        footer = {
            if (!outside) {
                PriceFooterLine(state)
                PrimaryButton(
                    title = "Continue",
                    onClick = viewModel::toReview,
                    isEnabled = state.canContinue,
                    isLoading = state.quoting,
                    modifier = Modifier.fillMaxWidth().testTag("crewDayPriceContinue"),
                )
            }
        },
    ) {
        Text(text = dayLine(day), style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        PlanField("Your home") {
            val home = state.home
            if (home != null && !state.changingHome) {
                PlanFormCard {
                    PlanOptionRow(first = true) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = home.line,
                                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                                color = PantopusColors.appText,
                                modifier = Modifier.testTag("crewDayPriceAddress"),
                            )
                            Text(
                                text = homeSource(home),
                                style = PantopusTextStyle.small,
                                color = PantopusColors.appTextSecondary,
                            )
                        }
                        PlanTextButton(
                            title = "Change",
                            onClick = viewModel::changeHome,
                            modifier = Modifier.padding(start = Spacing.s2).testTag("crewDayPriceChangeAddress").fillMaxWidth(0.3f),
                        )
                    }
                }
            } else {
                CrewDayAddressField(
                    query = state.addressQuery,
                    onQuery = viewModel::setAddressQuery,
                    suggestions = state.suggestions,
                    onPick = viewModel::pickAddress,
                    label = "Your address",
                    placeholder = "Your street address",
                    testTag = "crewDayPriceAddressField",
                )
            }
            PlanLockLine("Visible to your crew and Pantopus.")
        }
        if (outside) {
            OutOfArea(day, state, actions)
            return@CrewDayFlowScaffold
        }
        PlanField(day.priceOptions.firstOrNull()?.let { optionsHeading(day) } ?: "Your home") {
            PlanFormCard(modifier = Modifier.testTag("crewDayPriceOptions")) {
                day.priceOptions.forEachIndexed { index, option ->
                    val selected = option.id == state.optionId
                    PlanOptionRow(
                        first = index == 0,
                        onClick = { viewModel.chooseOption(option.id) },
                        modifier = Modifier.semantics { this.selected = selected }.testTag("crewDayPriceOption_${option.id}"),
                    ) {
                        RadioButton(selected = selected, onClick = null)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = option.label,
                                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                                color = PantopusColors.appText,
                            )
                            if (option.needsLook) {
                                Text(
                                    text = "The crew confirms the price after a look",
                                    style = PantopusTextStyle.small,
                                    color = PantopusColors.appTextSecondary,
                                )
                            }
                        }
                        option.priceCents?.takeIf { !option.needsLook }?.let {
                            Text(
                                text = CrewDayFormat.price(it),
                                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                                color = PantopusColors.appText,
                            )
                        }
                    }
                }
            }
        }
        if (day.addOns.isNotEmpty()) {
            PlanField("Add-ons") {
                PlanFormCard {
                    day.addOns.forEachIndexed { index, addOn ->
                        PlanOptionRow(first = index == 0, modifier = Modifier.testTag("crewDayPriceAddOn_${addOn.id}")) {
                            Column(modifier = Modifier.weight(1f)) {
                                PantopusCheckbox(
                                    isChecked = addOn.id in state.addOnIds,
                                    onCheckedChange = { viewModel.toggleAddOn(addOn.id) },
                                    label = "${addOn.label} · +${CrewDayFormat.price(addOn.priceCents)}",
                                )
                            }
                        }
                    }
                }
            }
        }
        state.quoteError?.let {
            Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error, modifier = Modifier.testTag("crewDayPriceError"))
        }
    }
}

/** "How many stories?" for the gutter list, else "Your home". */
private fun optionsHeading(day: CrewDayPublicDto): String =
    if (day.priceOptions.any { it.label.contains("stor", ignoreCase = true) }) "How many stories?" else "Your home"

/** The footer's price: "$180 · including tax", or that the crew confirms it first. */
@Composable
private fun PriceFooterLine(state: CrewDayBookState) {
    val total = state.totalCents
    when {
        state.option == null || state.home == null -> PlanFooterCaption("Pick your home and its size to see your price.")
        state.needsLook -> {
            Text(
                text = "The crew confirms your price before you're booked",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.fillMaxWidth().testTag("crewDayPriceTotal"),
                textAlign = TextAlign.Center,
            )
        }
        total != null -> {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Your price",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${CrewDayFormat.price(total)} · including tax",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                    modifier = Modifier.testTag("crewDayPriceTotal"),
                )
            }
            PlanFooterCaption("Nothing is charged until the work is done.")
        }
    }
}

@Composable
private fun OutOfArea(
    day: CrewDayPublicDto,
    state: CrewDayBookState,
    actions: CrewDayBookActions,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3), modifier = Modifier.testTag("crewDayPriceOutOfArea")) {
        PlanBanner(
            title = "This Crew Day doesn't reach ${state.home?.line ?: "that address"}",
            subtitle = state.quote?.message ?: "It covers homes near ${day.streetLabel ?: "its street"}.",
            icon = PantopusIcon.MapPinOff,
            tone = PlanBannerTone.Warning,
        )
        PrimaryButton(
            title = "Ask for one on your street",
            onClick = actions.onAsk,
            modifier = Modifier.fillMaxWidth().testTag("crewDayPriceAsk"),
        )
    }
}

// MARK: - 3. Review and book

@Composable
private fun ReviewStep(
    day: CrewDayPublicDto,
    state: CrewDayBookState,
    viewModel: CrewDayBookViewModel,
) {
    val zone = CrewDayFormat.zone(day.timezone)
    val total = state.totalCents
    val cutoff = CrewDayFormat.instant(day.windowStartsAt)?.minusSeconds(CUTOFF_SECONDS)
    var choosingCard by remember { mutableStateOf(false) }
    val addCardPhase by viewModel.addCardPhase.collectAsStateWithLifecycle()
    CrewDayFlowScaffold(
        title = "Review and book",
        onBack = viewModel::backToPrice,
        step = "2 of 2",
        modifier = Modifier.testTag("crewDayReview"),
        footer = {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Total",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = total?.let { "${CrewDayFormat.price(it)} · including tax" } ?: "Price after a look",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                )
            }
            PantopusCheckbox(
                isChecked = state.approved,
                onCheckedChange = viewModel::setApproved,
                label =
                    total?.let { "I approve the scope, the ${CrewDayFormat.price(it)} total and these terms." }
                        ?: "I approve the scope and these terms. I'll see the price before anything is booked.",
                modifier = Modifier.testTag("crewDayReviewApprove"),
            )
            state.bookError?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("crewDayReviewError"),
                )
            }
            PrimaryButton(
                title = total?.let { "Book for ${CrewDayFormat.price(it)}" } ?: "Ask for my price",
                onClick = viewModel::book,
                isEnabled = state.canBook,
                isLoading = state.booking,
                modifier = Modifier.fillMaxWidth().testTag("crewDayReviewBook"),
            )
        },
    ) {
        // The day.
        Column(
            modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            CrewDayServiceTag(service = day.service, label = day.serviceLabel ?: CrewDayFormat.service(day.service))
            Text(
                text = day.title,
                style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = CrewDayFormat.dateAndWindow(day.serviceDate, day.windowStart, day.windowEnd),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
            )
            CrewDayCrewRow(crew = day.crew)
        }
        PlanField("Your home", lock = true) {
            PlanFormCard {
                PlanOptionRow(first = true) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = state.home?.line.orEmpty(),
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                        )
                        Text(
                            text =
                                (listOfNotNull(state.option?.label) + day.addOns.filter { it.id in state.addOnIds }.map { it.label })
                                    .joinToString(" · "),
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                day.included.forEach { item ->
                    PlanOptionRow {
                        PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 16.dp, tint = PantopusColors.home)
                        Text(text = item, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
                    }
                }
            }
            PlanLockLine("Visible to your crew and Pantopus.")
        }
        PlanField("For the crew (optional)", modifier = Modifier.testTag("crewDayReviewNote")) {
            PlanTextArea(
                value = state.accessNote,
                onValue = viewModel::setAccessNote,
                placeholder = "Gate, pets, parking…",
                label = "A note for the crew",
            )
            Text(
                text = "The crew sees this on the day. It's deleted a week after the job.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanField("Payment") {
            val method = state.method
            PlanFormCard(modifier = Modifier.testTag("crewDayReviewPayment")) {
                if (method != null) {
                    PlanOptionRow(first = true) {
                        PantopusIconImage(
                            icon = PantopusIcon.CreditCard,
                            contentDescription = null,
                            size = 18.dp,
                            tint = PantopusColors.appText,
                        )
                        Text(
                            text = cardLabel(method.cardBrand, method.cardLast4),
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                            modifier = Modifier.weight(1f).testTag("crewDayReviewCard"),
                        )
                        PlanTextButton(
                            title = "Change",
                            onClick = { choosingCard = true },
                            modifier = Modifier.fillMaxWidth(0.35f).testTag("crewDayReviewChangeCard"),
                        )
                    }
                } else {
                    PlanOptionRow(first = true) {
                        PlanTonalButton(
                            title = if (addCardPhase.isBusy) addCardPhase.label else "Add a card",
                            onClick = viewModel::addCard,
                            icon = PantopusIcon.CreditCard,
                            loading = addCardPhase.isBusy,
                            enabled = state.methodsLoaded,
                            modifier = Modifier.testTag("crewDayReviewAddCard"),
                        )
                    }
                }
            }
            Text(
                text =
                    total?.let {
                        "Saved now. Charged ${CrewDayFormat.price(it)} the day after the crew finishes your home, " +
                            "unless you tell us something's wrong."
                    }
                        ?: "Saved now. Nothing is charged until you approve your price and the crew finishes your home.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanField("If plans change") {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                cutoff?.let {
                    PlansChangeLine(
                        PantopusIcon.CalendarX,
                        "Free cancellation until ${CrewDayFormat.shortDate(it, zone)}, ${CrewDayFormat.clock(it, zone)}.",
                    )
                }
                PlansChangeLine(PantopusIcon.CloudRain, "Rain? You pick a new date or cancel at no charge. Same price.")
                PlansChangeLine(PantopusIcon.LifeBuoy, "A problem? Pantopus support owns it until it's fixed.")
            }
        }
    }
    if (choosingCard) {
        AlertDialog(
            onDismissRequest = { choosingCard = false },
            title = { Text("Pay with") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    state.methods.forEach { method ->
                        PlanTextButton(
                            title = cardLabel(method.cardBrand, method.cardLast4) + chosenMark(method.stripeId == state.methodId),
                            onClick = {
                                choosingCard = false
                                viewModel.chooseMethod(method.stripeId)
                            },
                        )
                    }
                    PlanTextButton(
                        title = "Add a card",
                        onClick = {
                            choosingCard = false
                            viewModel.addCard()
                        },
                    )
                }
            },
            confirmButton = { TextButton(onClick = { choosingCard = false }) { Text("Done") } },
        )
    }
}

private const val CUTOFF_SECONDS = 48L * 60 * 60

@Composable
private fun PlansChangeLine(
    icon: PantopusIcon,
    text: String,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(text = text, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
    }
}

/** "From your home in Pantopus", or the typed address's town. */
private fun homeSource(home: CrewDayBookHome): String =
    if (home.homeId != null) "From your home in Pantopus" else listOfNotNull(home.city, home.state).joinToString(", ")

private fun chosenMark(chosen: Boolean): String = if (chosen) " (chosen)" else ""

/** "Visa ending 4242". */
internal fun cardLabel(
    brand: String?,
    last4: String?,
): String {
    val name = brand?.takeIf { it.isNotBlank() }?.replaceFirstChar { it.titlecase(Locale.US) } ?: "Card"
    return if (last4.isNullOrBlank()) name else "$name ending $last4"
}

// MARK: - 4. You're on the route

/** "Monday evening": the evening before the day. */
private fun eveningBefore(day: CrewDayPublicDto): String =
    CrewDayFormat.date(day.serviceDate)?.minusDays(1)?.let { "${CrewDayFormat.weekday(it)} evening" } ?: "The evening before"

/** The board's "What happens next": each step's title over its line. */
@Composable
private fun NextSteps(steps: List<Pair<String, String>>) {
    PlanFormCard(modifier = Modifier.testTag("crewDayBookedNext")) {
        steps.forEachIndexed { index, (title, line) ->
            PlanOptionRow(first = index == 0, modifier = Modifier.semantics(mergeDescendants = true) {}) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = title,
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Text(text = line, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                }
            }
        }
    }
}

@Composable
private fun BookedStep(
    day: CrewDayPublicDto,
    state: CrewDayBookState,
    actions: CrewDayBookActions,
) {
    val context = LocalContext.current
    val booking = state.booked
    val asked = booking?.status == "price_pending"
    val crew = day.crew?.name ?: "The crew"
    val zone = CrewDayFormat.zone(day.timezone)
    val closes = CrewDayFormat.shortDate(CrewDayFormat.instant(day.bookingClosesAt), zone)
    CrewDayFlowScaffold(
        title = "",
        onBack = actions.onClose,
        closeIcon = true,
        modifier = Modifier.testTag("crewDayBooked"),
        footer = {
            PrimaryButton(
                title = "See my Crew Day",
                onClick = { booking?.id?.let(actions.onOpenBooking) },
                modifier = Modifier.fillMaxWidth().testTag("crewDayBookedOpen"),
            )
        },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            PlanIconTile(
                icon = if (asked) PantopusIcon.Clock else PantopusIcon.Check,
                background = PantopusColors.homeBg,
                tint = PantopusColors.home,
                size = 64.dp,
                glyph = 30.dp,
                corner = 20.dp,
            )
            Text(
                text = if (asked) "We asked $crew for your price" else "You're on the route",
                style = PantopusTextStyle.h2.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() }.testTag("crewDayBookedTitle"),
            )
            Text(
                text =
                    if (asked) {
                        "You'll hear by ${closes ?: "the day booking closes"}. Nothing is booked or charged until you approve it."
                    } else {
                        "$crew comes ${CrewDayFormat.longDate(CrewDayFormat.date(day.serviceDate)).orEmpty()}, " +
                            "between ${windowWords(day)}. " +
                            "You don't need to be home."
                    },
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
        }
        if (asked) {
            PlanField("What happens next") {
                NextSteps(
                    listOf(
                        "The crew looks at your home" to "From outside, before ${closes ?: "booking closes"}. You don't need to be home.",
                        "You approve your price" to "We tell you as soon as it's set. Declining is free.",
                        "Then you're on the route" to "Nothing is charged until the work is done.",
                    ),
                )
            }
        } else {
            day.prepNote?.takeIf { it.isNotBlank() }?.let { note ->
                PlanField("One thing to do") {
                    Column(
                        modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4).semantics(mergeDescendants = true) {},
                        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        Text(text = note, style = PantopusTextStyle.body, color = PantopusColors.appText)
                        Text(text = "From $crew", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                    }
                }
            }
            val price = booking?.priceCents?.let(CrewDayFormat::price)
            PlanField("What happens next") {
                NextSteps(
                    listOf(
                        eveningBefore(day) to "A reminder with your arrival window and the crew's note.",
                        "On the day" to "The crew tells you when it's on the way. Tap when your gate is ready.",
                        "When it's done" to
                            "Photos of the work. We charge ${price ?: "your price"} the next day, unless you tell us something needs " +
                            "attention.",
                    ),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PlanTonalButton(
                    title = "Add to calendar",
                    onClick = { context.addCrewDayToCalendar(day) },
                    height = 44.dp,
                    modifier = Modifier.weight(1f).testTag("crewDayBookedCalendar"),
                )
                PlanTonalButton(
                    title = "Share with neighbors",
                    onClick = { context.shareText(neighborMessage(day), "Share with neighbors") },
                    height = 44.dp,
                    modifier = Modifier.weight(1f).testTag("crewDayBookedShare"),
                )
            }
            Text(
                text = "The preview shows ${day.streetLabel ?: "the street"} and the date, never your address.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** "I'm booked for gutter cleaning on Tuesday, Nov 17. The crew has room for nearby homes if you need yours done too. <link>" */
internal fun neighborMessage(day: CrewDayPublicDto): String {
    val service = (day.serviceLabel ?: CrewDayFormat.service(day.service)).lowercase(Locale.US)
    val date = CrewDayFormat.longDate(CrewDayFormat.date(day.serviceDate))
    val link = InviteLinks.publicPageUrl("/crew-day/${day.code.orEmpty()}")
    val on = date?.let { " on $it" }.orEmpty()
    return "I'm booked for $service$on. The crew has room for nearby homes if you need yours done too. $link"
}

/** "9 AM and 1 PM" for "between 9 AM and 1 PM". */
private fun windowWords(day: CrewDayPublicDto): String {
    val start = CrewDayFormat.time(day.windowStart)
    val end = CrewDayFormat.time(day.windowEnd)
    return if (start != null && end != null) "${CrewDayFormat.clock(start)} and ${CrewDayFormat.clock(end)}" else "its arrival window"
}

/** The arrival window as a calendar event (the calendar app's own add screen). */
private fun Context.addCrewDayToCalendar(day: CrewDayPublicDto) {
    val start = CrewDayFormat.instant(day.windowStartsAt)?.toEpochMilli()
    val end = CrewDayFormat.instant(day.windowEndsAt)?.toEpochMilli()
    val intent =
        Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, day.title)
            .putExtra(CalendarContract.Events.DESCRIPTION, "Crew Day with ${day.crew?.name ?: "your crew"}. You don't need to be home.")
            .apply {
                start?.let { putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, it) }
                end?.let { putExtra(CalendarContract.EXTRA_EVENT_END_TIME, it) }
            }
    runCatching { startActivity(intent) }
}
