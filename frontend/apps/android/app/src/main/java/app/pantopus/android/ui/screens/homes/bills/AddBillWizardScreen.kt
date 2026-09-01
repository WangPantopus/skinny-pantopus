@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.bills

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.text.DateFormat
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date

/**
 * 3-step Add / Edit Bill wizard.
 *
 * Create — `POST /api/homes/:id/bills` (`backend/routes/home.js:4539`).
 * Edit   — `PUT  /api/homes/:id/bills/:billId`
 *          (`backend/routes/home.js:4585`). The VM reads `billId` from
 *          `SavedStateHandle` so edit mode is entered by navigating to
 *          `homes/{homeId}/bills/{billId}/edit`.
 */
@Composable
fun AddBillWizardScreen(
    onClose: () -> Unit,
    onCreated: (String) -> Unit,
    onUpdated: (String) -> Unit = {},
    viewModel: AddBillWizardViewModel = hiltViewModel(),
) {
    val currentStep by viewModel.currentStep.collectAsStateWithLifecycle()
    val event by viewModel.events.collectAsStateWithLifecycle()
    val submitError by viewModel.submitError.collectAsStateWithLifecycle()
    // Collected so the screen recomposes when hydration completes —
    // the wizard chrome reads the flag via `model.chrome` and gates
    // the primary CTA on it.
    val isLoadingExisting by viewModel.isLoadingExisting.collectAsStateWithLifecycle()
    val loadError by viewModel.loadError.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        Analytics.track(AnalyticsEvent.ScreenAddBillWizardStepViewed(1, "details"))
    }

    LaunchedEffect(event) {
        when (val current = event) {
            null -> Unit
            AddBillEvent.Dismiss -> {
                viewModel.consumeEvent()
                onClose()
            }
            is AddBillEvent.Created -> {
                viewModel.consumeEvent()
                onCreated(current.billId)
            }
            is AddBillEvent.Updated -> {
                viewModel.consumeEvent()
                onUpdated(current.billId)
            }
        }
    }

    WizardShell(model = viewModel, modifier = Modifier.testTag("addBillWizard")) {
        when (currentStep) {
            AddBillStep.Details ->
                DetailsStep(
                    viewModel = viewModel,
                    isLoadingExisting = isLoadingExisting,
                    loadError = loadError,
                )
            AddBillStep.Schedule -> ScheduleStep(viewModel)
            AddBillStep.Review -> ReviewStep(viewModel, submitError)
            AddBillStep.Success -> SuccessStep(isEditing = viewModel.isEditing)
        }
    }
}

// MARK: - Step 1

@Composable
private fun DetailsStep(
    viewModel: AddBillWizardViewModel,
    @Suppress("UNUSED_PARAMETER")
    isLoadingExisting: Boolean,
    loadError: String?,
) {
    // `isLoadingExisting` is observed at the screen scope so the
    // wizard chrome (computed inside WizardShell from `model.chrome`)
    // re-reads `_isLoadingExisting.value` and re-gates the primary
    // CTA when hydration completes.
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        HeadlineBlock(
            title = if (viewModel.isEditing) "Edit bill" else "Add a bill",
            subtitle =
                if (viewModel.isEditing) {
                    "Update the payee, amount, due date, or schedule."
                } else {
                    "Track due dates, schedule payments, and keep the household on the same page."
                },
        )

        if (loadError != null) {
            Text(
                text = loadError,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("addBill_loadError"),
            )
        }

        FieldLabel("Payee")
        OutlinedField(testTag = "addBill_payee") {
            BasicTextField(
                value = viewModel.payee,
                onValueChange = { viewModel.payee = it },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                decorationBox = { inner ->
                    Box(modifier = Modifier.padding(Spacing.s3)) {
                        if (viewModel.payee.isEmpty()) {
                            Text(
                                text = "ConEd Electric",
                                style = PantopusTextStyle.body,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                        inner()
                    }
                },
            )
        }

        FieldLabel("Amount")
        OutlinedField(testTag = "addBill_amount") {
            Row(
                modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.DollarSign,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
                BasicTextField(
                    value = viewModel.amount,
                    onValueChange = { viewModel.amount = it },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    decorationBox = { inner ->
                        Box(modifier = Modifier.fillMaxWidth()) {
                            if (viewModel.amount.isEmpty()) {
                                Text(
                                    text = "0.00",
                                    style = PantopusTextStyle.body,
                                    color = PantopusColors.appTextMuted,
                                )
                            }
                            inner()
                        }
                    },
                )
            }
        }

        FieldLabel("Due date")
        var showPicker by remember { mutableStateOf(false) }
        OutlinedField(testTag = "addBill_dueDate") {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { showPicker = true }
                        .padding(Spacing.s3),
            ) {
                Text(
                    text = viewModel.dueDate?.toString() ?: "Pick a date",
                    style = PantopusTextStyle.body,
                    color =
                        if (viewModel.dueDate != null) {
                            PantopusColors.appText
                        } else {
                            PantopusColors.appTextMuted
                        },
                )
            }
        }
        if (showPicker) {
            SimpleDatePickerDialog(
                initial = viewModel.dueDate,
                onSelect = {
                    viewModel.dueDate = it
                    showPicker = false
                },
                onDismiss = { showPicker = false },
            )
        }
    }
}

// MARK: - Step 2

@Composable
private fun ScheduleStep(viewModel: AddBillWizardViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        HeadlineBlock("Schedule", "Pick how often this bill repeats.")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            AddBillSchedule.entries.forEach { schedule ->
                val selected = viewModel.schedule == schedule
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurface)
                            .border(
                                width = 1.dp,
                                color =
                                    if (selected) {
                                        PantopusColors.primary600
                                    } else {
                                        PantopusColors.appBorderSubtle
                                    },
                                shape = RoundedCornerShape(Radii.md),
                            )
                            .clickable { viewModel.schedule = schedule }
                            .padding(Spacing.s3)
                            .testTag("addBill_schedule_${schedule.name}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    PantopusIconImage(
                        icon =
                            if (schedule == AddBillSchedule.OneTime) {
                                PantopusIcon.Clock
                            } else {
                                PantopusIcon.ArrowsRepeat
                            },
                        contentDescription = null,
                        size = 18.dp,
                        tint = PantopusColors.primary600,
                    )
                    Text(
                        text = schedule.label,
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    if (selected) {
                        PantopusIconImage(
                            icon = PantopusIcon.CheckCircle,
                            contentDescription = null,
                            size = Radii.xl2,
                            tint = PantopusColors.primary600,
                        )
                    } else {
                        Box(
                            modifier =
                                Modifier
                                    .size(20.dp)
                                    .clip(CircleShape)
                                    .border(1.dp, PantopusColors.appBorder, CircleShape),
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Step 3

@Composable
private fun ReviewStep(
    viewModel: AddBillWizardViewModel,
    submitError: String?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        HeadlineBlock("Review", "Double-check the details before adding the bill.")
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg)),
        ) {
            ReviewRow("Payee", viewModel.payee.ifBlank { "—" })
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            ReviewRow(
                label = "Amount",
                value = viewModel.parsedAmount()?.let(BillsListViewModel::formatCurrency) ?: "—",
            )
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            ReviewRow(
                label = "Due date",
                value =
                    viewModel.dueDate?.let { date ->
                        val instant = date.atStartOfDay(ZoneId.systemDefault()).toInstant()
                        DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date.from(instant))
                    } ?: "—",
            )
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            ReviewRow("Schedule", viewModel.schedule.label)
        }
        if (submitError != null) {
            Text(
                text = submitError,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Users,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Splits with household members can be configured after the bill is added.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun ReviewRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        Spacer(Modifier.weight(1f))
        Text(value, style = PantopusTextStyle.body, color = PantopusColors.appText)
    }
}

// MARK: - Step 4

@Composable
private fun SuccessStep(isEditing: Boolean) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 32.dp,
                tint = PantopusColors.success,
            )
        }
        Text(
            text = if (isEditing) "Bill updated" else "Bill added",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
        )
        Text(
            text =
                if (isEditing) {
                    "Your changes are saved. The detail will reflect them now."
                } else {
                    "You can mark it paid or review the schedule from the Bills list."
                },
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Helpers

@Composable
private fun HeadlineBlock(
    title: String,
    subtitle: String?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(title, style = PantopusTextStyle.h2, color = PantopusColors.appText)
        if (subtitle != null) {
            Text(subtitle, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
}

@Composable
private fun OutlinedField(
    testTag: String,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.md))
                .testTag(testTag),
    ) { content() }
}

/**
 * Lightweight date-picker dialog. Wraps Material 3's stock
 * [androidx.compose.material3.DatePickerDialog] under the hood so the
 * shell stays token-only.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun SimpleDatePickerDialog(
    initial: LocalDate?,
    onSelect: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val initialMillis =
        (initial ?: LocalDate.now())
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    val state = androidx.compose.material3.rememberDatePickerState(initialSelectedDateMillis = initialMillis)
    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = {
                val picked = state.selectedDateMillis
                if (picked != null) {
                    val date =
                        java.time.Instant
                            .ofEpochMilli(picked)
                            .atZone(ZoneId.systemDefault())
                            .toLocalDate()
                    onSelect(date)
                } else {
                    onDismiss()
                }
            }) { Text("Done") }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    ) {
        androidx.compose.material3.DatePicker(state = state)
    }
}
