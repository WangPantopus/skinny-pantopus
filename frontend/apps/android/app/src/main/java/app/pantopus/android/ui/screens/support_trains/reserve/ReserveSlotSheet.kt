@file:Suppress(
    "CyclomaticComplexMethod",
    "LongMethod",
    "LongParameterList",
    "MagicNumber",
    "MatchingDeclarationName",
    "PackageNaming",
    "UnusedPrivateMember",
)

package app.pantopus.android.ui.screens.support_trains.reserve

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.support_trains.ReserveSlotBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainContributionMode
import app.pantopus.android.ui.screens.support_trains.detail.ReserveSheetContext
import app.pantopus.android.ui.screens.support_trains.detail.ReserveSlotOption
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * S1 — the helper sign-up flow the A10.9 detail screen was missing.
 * Mirrors RN's `components/support-trains/ReserveSheet.tsx` and the iOS
 * `ReserveSlotSheet`: pick the date (skipped when the user tapped a
 * specific slot row) → pick a contribution lane → optional detail →
 * confirm → success, then
 * `POST /api/activities/support-trains/:id/slots/:slotId/reserve`.
 */
enum class ReserveStep { DATE, MODE, DETAILS, CONFIRM, SUCCESS }

@Composable
fun ReserveSlotSheet(
    preselectedSlotId: String?,
    options: List<ReserveSlotOption>,
    context: ReserveSheetContext,
    isSubmitting: Boolean,
    onSubmit: (String, ReserveSlotBody, (String?) -> Unit) -> Unit,
    onClose: () -> Unit,
) {
    var step by rememberSaveable {
        mutableStateOf(if (preselectedSlotId == null) ReserveStep.DATE else ReserveStep.MODE)
    }
    var slotId by rememberSaveable { mutableStateOf(preselectedSlotId) }
    var mode by rememberSaveable { mutableStateOf<String?>(null) }
    var dishTitle by rememberSaveable { mutableStateOf("") }
    var restaurantName by rememberSaveable { mutableStateOf("") }
    var noteToRecipient by rememberSaveable { mutableStateOf("") }
    var errorMessage by rememberSaveable { mutableStateOf<String?>(null) }

    val selected = remember(slotId, options) { options.firstOrNull { it.id == slotId } }
    val selectedMode = remember(mode) { SupportTrainContributionMode.entries.firstOrNull { it.wire == mode } }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .testTag("supportTrainReserveSheet"),
    ) {
        SheetHeader(
            title =
                when {
                    step == ReserveStep.SUCCESS -> "Signed up!"
                    selected != null -> "${selected.slotLabel} — ${selected.dateLabel}"
                    else -> "Pick a date"
                },
            onClose = onClose,
        )

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 460.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            when (step) {
                ReserveStep.DATE -> {
                    StepTitle("Which date can you take?")
                    options.forEach { option ->
                        SelectableCard(
                            isSelected = option.id == slotId,
                            tag = "supportTrainReserveDate-${option.id}",
                            onClick = { slotId = option.id },
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                                Text(
                                    text = option.dateLabel,
                                    color = PantopusColors.appText,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    text = listOfNotNull(option.slotLabel, option.windowLabel).joinToString(" · "),
                                    color = PantopusColors.appTextSecondary,
                                    fontSize = 12.5.sp,
                                )
                            }
                        }
                    }
                }

                ReserveStep.MODE -> {
                    StepTitle("How would you like to help?")
                    context.enabledModes.forEach { option ->
                        SelectableCard(
                            isSelected = option.wire == mode,
                            tag = "supportTrainReserveMode-${option.wire}",
                            onClick = { mode = option.wire },
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                            ) {
                                PantopusIconImage(
                                    icon = modeIcon(option),
                                    contentDescription = null,
                                    size = 18.dp,
                                    tint =
                                        if (option.wire == mode) {
                                            PantopusColors.primary600
                                        } else {
                                            PantopusColors.appTextSecondary
                                        },
                                )
                                Text(
                                    text = option.label,
                                    color = PantopusColors.appText,
                                    fontSize = 15.sp,
                                    fontWeight = if (option.wire == mode) FontWeight.SemiBold else FontWeight.Normal,
                                )
                            }
                        }
                    }
                    Reminders(context)
                }

                ReserveStep.DETAILS -> {
                    StepTitle("Any details? (optional)")
                    if (mode == SupportTrainContributionMode.COOK.wire || mode == SupportTrainContributionMode.TAKEOUT.wire) {
                        SheetField(
                            label = if (mode == SupportTrainContributionMode.COOK.wire) "What are you making?" else "Dish name",
                            value = dishTitle,
                            placeholder = "e.g. Chicken soup",
                            tag = "supportTrainReserveDishField",
                            onValueChange = { dishTitle = it },
                        )
                    }
                    if (mode == SupportTrainContributionMode.TAKEOUT.wire) {
                        SheetField(
                            label = "Restaurant name",
                            value = restaurantName,
                            placeholder = "e.g. Thai Palace",
                            tag = "supportTrainReserveRestaurantField",
                            onValueChange = { restaurantName = it },
                        )
                    }
                    SheetField(
                        label = "Note to recipient",
                        value = noteToRecipient,
                        placeholder = "Any message for the family",
                        tag = "supportTrainReserveNoteField",
                        minHeight = 90.dp,
                        onValueChange = { noteToRecipient = it },
                    )
                }

                ReserveStep.CONFIRM -> {
                    StepTitle("Confirm your signup")
                    Column(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(Radii.lg))
                                .background(PantopusColors.appSurface)
                                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                                .padding(Spacing.s3),
                    ) {
                        SummaryRow("Date", selected?.dateLabel.orEmpty())
                        SummaryRow("Slot", selected?.slotLabel.orEmpty())
                        SummaryRow("Contributing", selectedMode?.label.orEmpty())
                        if (dishTitle.isNotBlank()) SummaryRow("Dish", dishTitle)
                        if (restaurantName.isNotBlank()) SummaryRow("Restaurant", restaurantName)
                        selected?.windowLabel?.let { SummaryRow("Time window", it) }
                    }
                    Text(
                        text =
                            "You'll get a reminder before your date. The organizer shares the " +
                                "exact address here when it's time to deliver.",
                        color = PantopusColors.appTextMuted,
                        fontSize = 12.5.sp,
                    )
                }

                ReserveStep.SUCCESS -> {
                    Column(
                        modifier = Modifier.fillMaxWidth().testTag("supportTrainReserveSuccess"),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.CheckCircle,
                            contentDescription = null,
                            size = 54.dp,
                            tint = PantopusColors.success,
                        )
                        Text(
                            text = "You're signed up!",
                            color = PantopusColors.appText,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "Thank you for helping out. You'll get a reminder before your date.",
                            color = PantopusColors.appTextSecondary,
                            fontSize = 14.sp,
                        )
                        Reminders(context)
                    }
                }
            }

            errorMessage?.let { message ->
                Text(
                    text = message,
                    color = PantopusColors.error,
                    fontSize = 13.sp,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.errorBg)
                            .padding(Spacing.s3)
                            .testTag("supportTrainReserveError"),
                )
            }
        }

        SheetFooter(
            step = step,
            isSubmitting = isSubmitting,
            canAdvance =
                when (step) {
                    ReserveStep.DATE -> slotId != null
                    ReserveStep.MODE -> mode != null
                    ReserveStep.DETAILS, ReserveStep.SUCCESS -> true
                    ReserveStep.CONFIRM -> !isSubmitting
                },
            onBack = {
                step =
                    when (step) {
                        ReserveStep.MODE -> if (options.size > 1) ReserveStep.DATE else ReserveStep.MODE
                        ReserveStep.DETAILS -> ReserveStep.MODE
                        ReserveStep.CONFIRM -> ReserveStep.DETAILS
                        else -> step
                    }
            },
            onAdvance = {
                errorMessage = null
                when (step) {
                    ReserveStep.DATE -> step = ReserveStep.MODE
                    ReserveStep.MODE -> step = ReserveStep.DETAILS
                    ReserveStep.DETAILS -> step = ReserveStep.CONFIRM
                    ReserveStep.CONFIRM -> {
                        val chosenSlot = slotId
                        val chosenMode = mode
                        if (chosenSlot != null && chosenMode != null) {
                            onSubmit(
                                chosenSlot,
                                ReserveSlotBody(
                                    contributionMode = chosenMode,
                                    dishTitle = dishTitle.takeIf { it.isNotBlank() },
                                    restaurantName = restaurantName.takeIf { it.isNotBlank() },
                                    noteToRecipient = noteToRecipient.takeIf { it.isNotBlank() },
                                ),
                            ) { failure ->
                                if (failure == null) step = ReserveStep.SUCCESS else errorMessage = failure
                            }
                        }
                    }
                    ReserveStep.SUCCESS -> onClose()
                }
            },
        )
    }
}

private fun modeIcon(mode: SupportTrainContributionMode): PantopusIcon =
    when (mode) {
        SupportTrainContributionMode.COOK -> PantopusIcon.Utensils
        SupportTrainContributionMode.TAKEOUT -> PantopusIcon.Truck
        SupportTrainContributionMode.GROCERIES -> PantopusIcon.ShoppingBag
    }

@Composable
private fun SheetHeader(
    title: String,
    onClose: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(PantopusColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = title,
            color = PantopusColors.appText,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() },
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = Spacing.s2)
                    .size(44.dp)
                    .clickable(onClick = onClose)
                    .testTag("supportTrainReserveCloseButton")
                    .semantics {
                        contentDescription = "Close"
                        role = Role.Button
                    },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun SheetFooter(
    step: ReserveStep,
    isSubmitting: Boolean,
    canAdvance: Boolean,
    onBack: () -> Unit,
    onAdvance: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (step != ReserveStep.DATE && step != ReserveStep.SUCCESS) {
            Box(
                modifier =
                    Modifier
                        .height(48.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable(onClick = onBack)
                        .padding(horizontal = Spacing.s5)
                        .testTag("supportTrainReserveBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Back",
                    color = PantopusColors.appText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (canAdvance) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                    .clickable(enabled = canAdvance, onClick = onAdvance)
                    .testTag("supportTrainReservePrimaryCTA"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text =
                    when (step) {
                        ReserveStep.DATE, ReserveStep.MODE -> "Next"
                        ReserveStep.DETAILS -> "Review"
                        ReserveStep.CONFIRM -> if (isSubmitting) "Signing up…" else "Confirm signup"
                        ReserveStep.SUCCESS -> "Done"
                    },
                color = PantopusColors.appTextInverse,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun StepTitle(text: String) {
    Text(
        text = text,
        color = PantopusColors.appText,
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.semantics { heading() },
    )
}

@Composable
private fun SelectableCard(
    isSelected: Boolean,
    tag: String,
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    if (isSelected) 2.dp else 1.dp,
                    if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.md),
                )
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.weight(1f)) { content() }
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun Reminders(context: ReserveSheetContext) {
    if (context.restrictionChips.isNotEmpty()) {
        ReminderBox("Remember: ${context.restrictionChips.joinToString(", ")}")
    }
    if (context.contactlessPreferred) {
        ReminderBox("Contactless drop-off preferred")
    }
}

@Composable
private fun ReminderBox(text: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .padding(Spacing.s3)
                .testTag("supportTrainReserveReminder"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertTriangle,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.warning,
        )
        Text(text = text, color = PantopusColors.warning, fontSize = 12.5.sp)
    }
}

@Composable
private fun SheetField(
    label: String,
    value: String,
    placeholder: String,
    tag: String,
    onValueChange: (String) -> Unit,
    minHeight: androidx.compose.ui.unit.Dp = 56.dp,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = label,
            color = PantopusColors.appTextSecondary,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth().heightIn(min = minHeight).testTag(tag),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    focusedBorderColor = PantopusColors.primary600,
                    unfocusedBorderColor = PantopusColors.appBorder,
                ),
            placeholder = {
                Text(text = placeholder, color = PantopusColors.appTextMuted, fontSize = 14.sp)
            },
        )
    }
}

@Composable
private fun SummaryRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, color = PantopusColors.appTextSecondary, fontSize = 13.5.sp)
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = value,
            color = PantopusColors.appText,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 760)
@Composable
private fun ReserveSheetPreview() {
    ReserveSlotSheet(
        preselectedSlotId = null,
        options =
            listOf(
                ReserveSlotOption("s1", "Tuesday, June 3", "Dinner", "5:00 pm – 7:00 pm"),
                ReserveSlotOption("s2", "Thursday, June 5", "Groceries", null),
            ),
        context =
            ReserveSheetContext(
                enabledModes = SupportTrainContributionMode.entries.toList(),
                restrictionChips = listOf("No peanuts", "Vegetarian"),
                contactlessPreferred = true,
            ),
        isSubmitting = false,
        onSubmit = { _, _, done -> done(null) },
        onClose = {},
    )
}
