@file:Suppress("LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.crewday.create

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.FutureDatePickerDialog
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.screens.crewday.components.CrewDayAddressField
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanLockLine
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanStepperRow
import app.pantopus.android.ui.screens.plans.components.PlanSwitchRow
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTimePickerDialog
import app.pantopus.android.ui.screens.plans.detail.PlanRoundButton
import app.pantopus.android.ui.screens.shared.wizard.WizardIdentity
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * New Crew Day (screen 14) on the Wizard archetype, in business violet: service and what's included, where and
 * when, prices, and review and send. The board is `NewCrewDay` (web); phones use the same four steps.
 */
@Composable
fun NewCrewDayScreen(
    onClose: () -> Unit,
    viewModel: NewCrewDayViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val event by viewModel.events.collectAsStateWithLifecycle()
    LaunchedEffect(event) {
        when (event) {
            NewCrewDayEvent.Close -> onClose()
            null -> Unit
        }
        if (event != null) viewModel.eventHandled()
    }
    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag("crewDayNew"),
        identity = WizardIdentity.Business,
        handleSystemBack = true,
        scrollResetKey = state.step,
    ) {
        when (state.step) {
            NewCrewDayStep.Service -> ServiceStep(state, viewModel)
            NewCrewDayStep.WhereWhen -> WhereWhenStep(state, viewModel)
            NewCrewDayStep.Prices -> PricesStep(state, viewModel)
            NewCrewDayStep.Review -> ReviewStep(state)
            NewCrewDayStep.Sent -> SentStep(state)
        }
    }
}

@Composable
private fun StepHeading(
    title: String,
    subtitle: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = title,
            style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        subtitle?.let { Text(text = it, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary) }
    }
}

// MARK: - 1. Service and what's included

@Composable
private fun ServiceStep(
    state: NewCrewDayState,
    viewModel: NewCrewDayViewModel,
) {
    StepHeading("Service and what's included", "Households see these lines on the invitation.")
    PlanField("Service") {
        PlanChoiceGroup(
            choices = (state.services.map { it.key }.ifEmpty { CrewDayFormat.SERVICES }).map { PlanChoice(it, state.serviceLabel(it)) },
            isSelected = { it.id == state.service },
            onSelect = { viewModel.setService(it.id) },
            tagFor = { "crewDayNewService_${it.id}" },
        )
    }
    PlanField("What's included") {
        Text(
            text = "Up to 6 lines. We started you with the usual ones for ${state.serviceLabel(state.service).lowercase()}.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
        state.included.forEachIndexed { index, item ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Column(modifier = Modifier.weight(1f).testTag("crewDayNewIncluded_$index")) {
                    PlanTextArea(
                        value = item,
                        onValue = { viewModel.setIncluded(index, oneLine(it)) },
                        placeholder = "What the crew does",
                        label = "Included item ${index + 1}",
                        minHeight = LINE_FIELD_HEIGHT,
                    )
                }
                if (state.included.size > 1) {
                    PlanRoundButton(
                        icon = PantopusIcon.X,
                        label = "Remove item ${index + 1}",
                        onClick = { viewModel.removeIncluded(index) },
                        glass = false,
                    )
                }
            }
        }
        if (state.included.size < NewCrewDayState.MAX_INCLUDED) {
            PlanTextButton(title = "Add a line", onClick = viewModel::addIncluded, modifier = Modifier.testTag("crewDayNewIncludedAdd"))
        }
    }
    PlanFormCard(modifier = Modifier.testTag("crewDayNewOutsideOnly")) {
        PlanOptionRow(first = true) {
            PlanSwitchRow(
                title = "Outside only",
                caption = "Households don't need to be home.",
                checked = state.outsideOnly,
                onChecked = viewModel::setOutsideOnly,
            )
        }
    }
}

// MARK: - 2. Where and when

@Composable
private fun WhereWhenStep(
    state: NewCrewDayState,
    viewModel: NewCrewDayViewModel,
) {
    var pickingDate by remember { mutableStateOf(false) }
    var pickingStart by remember { mutableStateOf(false) }
    var pickingEnd by remember { mutableStateOf(false) }
    StepHeading(
        "Where and when",
        "Only homes inside your reach can book. You can't move the date later except by proposing new dates.",
    )
    PlanField("Street or area name", modifier = Modifier.testTag("crewDayNewStreet")) {
        PlanTextArea(
            value = state.streetLabel,
            onValue = viewModel::setStreetLabel,
            placeholder = "Maple Lane",
            label = "Street or area name",
            singleLine = true,
        )
        state.streetLabel.trim().takeIf { it.isNotEmpty() }?.let { street ->
            Text(
                text = "Households see \"${titleWord(state.service)} Day on $street\".",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
    PlanField("Center of the area") {
        CrewDayAddressField(
            query = state.centerQuery,
            onQuery = viewModel::setCenterQuery,
            suggestions = state.centerSuggestions,
            onPick = viewModel::pickCenter,
            label = "Center of the area",
            placeholder = "An address on the street",
            testTag = "crewDayNewCenter",
        )
        PlanLockLine("Never shown to households.")
    }
    PlanField("Reach") {
        PlanChoiceGroup(
            choices = CrewDayReach.entries.map { PlanChoice(it.name, it.label) },
            isSelected = { it.id == state.reach.name },
            onSelect = { choice -> viewModel.setReach(CrewDayReach.valueOf(choice.id)) },
            tagFor = { "crewDayNewReach_${CrewDayReach.valueOf(it.id).meters}" },
        )
    }
    PlanField("Date and arrival window") {
        PlanFormCard {
            PickerRow("Date", CrewDayFormat.longDate(state.date) ?: "Pick a date", first = true, tag = "crewDayNewDate") {
                pickingDate = true
            }
            PickerRow("Arrives from", CrewDayFormat.clock(state.windowStart), tag = "crewDayNewWindowStart") { pickingStart = true }
            PickerRow("Until", CrewDayFormat.clock(state.windowEnd), tag = "crewDayNewWindowEnd") { pickingEnd = true }
        }
    }
    PlanFormCard {
        PlanOptionRow(first = true) {
            PlanStepperRow(
                title = "How many homes you can take",
                caption = "1 to 60",
                value = state.capacity,
                range = 1..60,
                onChange = viewModel::setCapacity,
                modifier = Modifier.testTag("crewDayNewCapacity"),
            )
        }
    }
    PlanField("Booking closes") {
        PlanChoiceGroup(
            choices = CLOSE_CHOICES.map { (hours, label) -> PlanChoice(hours.toString(), label) },
            isSelected = { it.id == state.closesHoursBefore.toString() },
            onSelect = { viewModel.setClosesHoursBefore(it.id.toInt()) },
            tagFor = { "crewDayNewCloses_${it.id}" },
        )
        state.closesAt()?.let { closes ->
            Text(
                text = "Booking closes ${CrewDayFormat.shortDate(closes.toLocalDate())}, ${CrewDayFormat.clock(closes.toLocalTime())}.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
    if (pickingDate) {
        FutureDatePickerDialog(
            initial = state.date,
            onSelect = {
                pickingDate = false
                viewModel.setDate(it)
            },
            onDismiss = { pickingDate = false },
        )
    }
    if (pickingStart) {
        PlanTimePickerDialog(
            initial = state.windowStart,
            onPicked = {
                pickingStart = false
                viewModel.setWindowStart(it)
            },
            onDismiss = { pickingStart = false },
        )
    }
    if (pickingEnd) {
        PlanTimePickerDialog(
            initial = state.windowEnd,
            onPicked = {
                pickingEnd = false
                viewModel.setWindowEnd(it)
            },
            onDismiss = { pickingEnd = false },
        )
    }
}

private val CLOSE_CHOICES = listOf(24 to "24 hours before", 48 to "48 hours before", 72 to "3 days before")

@Composable
private fun PickerRow(
    label: String,
    value: String,
    first: Boolean = false,
    tag: String,
    onClick: () -> Unit,
) {
    PlanOptionRow(first = first, onClick = onClick, modifier = Modifier.testTag(tag)) {
        Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText, modifier = Modifier.weight(1f))
        Text(text = value, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

// MARK: - 3. Prices

@Composable
private fun PricesStep(
    state: NewCrewDayState,
    viewModel: NewCrewDayViewModel,
) {
    StepHeading("Prices", "Each home pays its own price. It never changes with how many neighbors book.")
    PlanField("Options") {
        state.options.forEachIndexed { index, option ->
            PlanFormCard(modifier = Modifier.testTag("crewDayNewOption_${option.id}")) {
                Column(modifier = Modifier.padding(vertical = Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        Column(modifier = Modifier.weight(1f)) {
                            PlanTextArea(
                                value = option.label,
                                onValue = { viewModel.setOption(index, option.copy(label = oneLine(it))) },
                                placeholder = "Two stories",
                                label = "Price ${index + 1} name",
                                minHeight = LINE_FIELD_HEIGHT,
                            )
                        }
                        if (!option.needsLook) {
                            Column(modifier = Modifier.width(PRICE_WIDTH)) {
                                PlanTextArea(
                                    value = option.price,
                                    onValue = { viewModel.setOption(index, option.copy(price = it)) },
                                    placeholder = "$",
                                    label = "Price ${index + 1} amount in dollars",
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                )
                            }
                        }
                        if (state.options.size > 1) {
                            PlanRoundButton(
                                icon = PantopusIcon.X,
                                label = "Remove price ${index + 1}",
                                onClick = { viewModel.removeOption(index) },
                                glass = false,
                            )
                        }
                    }
                    PantopusCheckbox(
                        isChecked = option.needsLook,
                        onCheckedChange = { viewModel.setOption(index, option.copy(needsLook = it, price = if (it) "" else option.price)) },
                        label = "I confirm this one after a look",
                    )
                }
            }
        }
        if (state.options.size < NewCrewDayState.MAX_OPTIONS) {
            PlanTextButton(title = "Add an option", onClick = viewModel::addOption, modifier = Modifier.testTag("crewDayNewOptionAdd"))
        }
    }
    PlanField("Add-ons") {
        state.addOns.forEachIndexed { index, addOn ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier = Modifier.testTag("crewDayNewAddOn_${addOn.id}"),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    PlanTextArea(
                        value = addOn.label,
                        onValue = { viewModel.setAddOn(index, addOn.copy(label = oneLine(it))) },
                        placeholder = "Clean the gutter guards",
                        label = "Add-on ${index + 1} name",
                        minHeight = LINE_FIELD_HEIGHT,
                    )
                }
                Column(modifier = Modifier.width(PRICE_WIDTH)) {
                    PlanTextArea(
                        value = addOn.price,
                        onValue = { viewModel.setAddOn(index, addOn.copy(price = it)) },
                        placeholder = "+$",
                        label = "Add-on ${index + 1} amount in dollars",
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                }
                PlanRoundButton(
                    icon = PantopusIcon.X,
                    label = "Remove add-on ${index + 1}",
                    onClick = { viewModel.removeAddOn(index) },
                    glass = false,
                )
            }
        }
        if (state.addOns.size < NewCrewDayState.MAX_ADD_ONS) {
            PlanTextButton(title = "Add an add-on", onClick = viewModel::addAddOn, modifier = Modifier.testTag("crewDayNewAddOnAdd"))
        }
        Text(
            text = "Prices include any sales tax you owe. Households see one total.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
    PlanField("Note for households", modifier = Modifier.testTag("crewDayNewPrepNote")) {
        PlanTextArea(
            value = state.prepNote,
            onValue = viewModel::setPrepNote,
            placeholder = "Please keep the side gate unlocked and pets inside.",
            label = "A note for households",
        )
        Text(
            text = "Households see this once they book, and again the evening before.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
    PlanBanner(
        title = "Your payout",
        subtitle = state.feeLine,
        icon = PantopusIcon.HandCoins,
        tone = PlanBannerTone.Neutral,
        modifier = Modifier.testTag("crewDayNewFee"),
    )
}

private val PRICE_WIDTH = 96.dp

// MARK: - 4. Review and send

@Composable
private fun ReviewStep(state: NewCrewDayState) {
    StepHeading(
        "Review and send",
        "Pantopus checks the day and your price list. Once approved, the invitation link works and you can share it.",
    )
    val street = state.streetLabel.trim()
    val title = "${titleWord(state.service)} Day on $street"
    PlanFormCard {
        ReviewRow("Crew Day", title, first = true)
        ReviewRow("Service", state.serviceLabel(state.service))
        ReviewRow(
            "When",
            listOfNotNull(
                CrewDayFormat.shortDate(state.date),
                CrewDayFormat.window(state.windowStart, state.windowEnd),
            ).joinToString(" · "),
        )
        ReviewRow("Where", listOfNotNull(street, state.center?.city).joinToString(", ") + " · " + state.reach.label.substringBefore(" ("))
        ReviewRow("Homes", "Up to ${state.capacity}")
        state.closesAt()?.let { closes ->
            ReviewRow("Booking closes", "${CrewDayFormat.shortDate(closes.toLocalDate())}, ${CrewDayFormat.clock(closes.toLocalTime())}")
        }
    }
    PlanField("Prices") {
        PlanFormCard {
            state.options.forEachIndexed { index, option ->
                ReviewRow(
                    option.label,
                    if (option.needsLook) "After a look" else NewCrewDayState.cents(option.price)?.let(CrewDayFormat::price).orEmpty(),
                    first = index == 0,
                )
            }
            state.addOns.forEach { addOn -> ReviewRow(addOn.label, "+${CrewDayFormat.price(NewCrewDayState.cents(addOn.price))}") }
        }
    }
    PlanField("What's included") {
        PlanFormCard {
            state.included.filter { it.isNotBlank() }.forEachIndexed { index, item ->
                PlanOptionRow(first = index == 0) {
                    PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 16.dp, tint = PantopusColors.success)
                    Text(text = item, style = PantopusTextStyle.body, color = PantopusColors.appText)
                }
            }
            if (state.outsideOnly) {
                PlanOptionRow(first = state.included.none { it.isNotBlank() }) {
                    PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 16.dp, tint = PantopusColors.success)
                    Text(
                        text = "Outside only. Households don't need to be home.",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                    )
                }
            }
        }
    }
    state.prepNote.takeIf { it.isNotBlank() }?.let { note ->
        PlanField("A note for households") {
            Text(text = note, style = PantopusTextStyle.body, color = PantopusColors.appText)
        }
    }
}

@Composable
private fun ReviewRow(
    label: String,
    value: String,
    first: Boolean = false,
) {
    PlanOptionRow(first = first, modifier = Modifier.semantics(mergeDescendants = true) {}) {
        Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary, modifier = Modifier.weight(1f))
        Text(text = value, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
    }
}

/** "Gutter" for the title "Gutter Day on Maple Lane" (the server builds the title the same way). */
private fun titleWord(service: String): String =
    when (service) {
        "gutter_cleaning" -> "Gutter"
        "leaf_cleanup" -> "Leaf"
        "roof_moss" -> "Roof Moss"
        "holiday_lights" -> "Holiday Lights"
        "window_washing" -> "Window"
        "pressure_washing" -> "Pressure Washing"
        else -> "Crew"
    }

// MARK: - Sent

@Composable
private fun SentStep(state: NewCrewDayState) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s6).testTag("crewDayNewSent"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanIconTile(
            icon = if (state.sentForApproval) PantopusIcon.Clock else PantopusIcon.FileText,
            background = PantopusColors.businessBg,
            tint = PantopusColors.business,
            size = 64.dp,
            glyph = 30.dp,
            corner = 20.dp,
        )
        Text(
            text = if (state.sentForApproval) "Waiting for Pantopus" else "Saved as a draft",
            style = PantopusTextStyle.h2.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                if (state.sentForApproval) {
                    "We'll tell you within a business day. Its link works once it's approved."
                } else {
                    "Send it to Pantopus from the Crew Day's page when it's ready."
                },
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * One line of text that wraps as it's typed (an included item, a price's or an add-on's name): at large text sizes a
 * single-line field would hide most of it. A typed line break becomes a space.
 */
private fun oneLine(text: String): String = text.replace('\n', ' ')

/** A wrapping one-line field starts as tall as a single-line one. */
private val LINE_FIELD_HEIGHT = 48.dp
