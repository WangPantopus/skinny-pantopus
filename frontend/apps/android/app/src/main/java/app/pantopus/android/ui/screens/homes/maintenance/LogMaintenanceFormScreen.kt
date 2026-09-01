@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.homes.maintenance

import android.app.DatePickerDialog
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Calendar
import java.util.UUID

/**
 * P2.9 — Log / Edit maintenance form. Wraps a [FormShellLike]-style
 * scaffold: 44dp top bar (X + title + right-action), scrolling body of
 * card-grouped fields, no bottom CTA (the top-right `Log` / `Save`
 * action commits).
 *
 * Photos are picked via the system Photo Picker; receipts via
 * [ActivityResultContracts.OpenDocument] so PDFs are accepted alongside
 * images.
 */
@Composable
fun LogMaintenanceFormScreen(
    onClose: () -> Unit,
    onSubmitted: (String) -> Unit,
    viewModel: LogMaintenanceFormViewModel = hiltViewModel(),
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val isDirty by viewModel.isDirty.collectAsStateWithLifecycle()
    val event by viewModel.event.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Picker launchers live on the screen (not the content composable)
    // so the content can be exercised under Paparazzi — which does not
    // provide an `ActivityResultRegistryOwner`.
    val photoPicker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickVisualMedia(),
        ) { uri: Uri? ->
            if (uri == null) return@rememberLauncherForActivityResult
            scope.launch {
                val resolver = context.contentResolver
                val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
                if (bytes != null) {
                    viewModel.addPhoto(
                        MaintenanceDraftFile(
                            id = UUID.randomUUID().toString(),
                            filename = "photo-${UUID.randomUUID().toString().take(6)}.jpg",
                            mimeType = "image/jpeg",
                            bytes = bytes,
                        ),
                    )
                }
            }
        }

    val receiptPicker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.OpenDocument(),
        ) { uri: Uri? ->
            if (uri == null) return@rememberLauncherForActivityResult
            scope.launch {
                val resolver = context.contentResolver
                val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
                val name = uri.lastPathSegment?.substringAfterLast('/') ?: "receipt"
                val mime = resolver.getType(uri) ?: "application/octet-stream"
                if (bytes != null) {
                    viewModel.pickReceipt(
                        MaintenanceDraftFile(
                            filename = name,
                            mimeType = mime,
                            bytes = bytes,
                        ),
                    )
                }
            }
        }

    LaunchedEffect(Unit) {
        Analytics.track(AnalyticsEvent.ScreenLogMaintenanceViewed)
        viewModel.loadIfNeeded()
    }

    LaunchedEffect(event) {
        when (val current = event) {
            null -> Unit
            LogMaintenanceFormEvent.Dismiss -> {
                viewModel.consumeEvent()
                onClose()
            }
            is LogMaintenanceFormEvent.Created -> {
                viewModel.consumeEvent()
                onSubmitted(current.taskId)
            }
            is LogMaintenanceFormEvent.Updated -> {
                viewModel.consumeEvent()
                onSubmitted(current.taskId)
            }
        }
    }

    LogMaintenanceFormContent(
        form = form,
        isDirty = isDirty,
        screenTitle = viewModel.screenTitle,
        submitLabel = viewModel.submitLabel,
        callbacks =
            LogMaintenanceFormCallbacks(
                onUpdateCategory = viewModel::updateCategory,
                onUpdateTitle = viewModel::updateTitle,
                onUpdateDateCompleted = viewModel::updateDateCompleted,
                onUpdatePerformedBy = viewModel::updatePerformedBy,
                onUpdatePerformerName = viewModel::updatePerformerName,
                onUpdatePerformerContact = viewModel::updatePerformerContact,
                onUpdateCost = viewModel::updateCost,
                onUpdateNotes = viewModel::updateNotes,
                onToggleNextDue = viewModel::toggleNextDue,
                onUpdateNextDueDate = viewModel::updateNextDueDate,
                onUpdateRecurrence = viewModel::updateRecurrence,
                onRemovePhoto = viewModel::removePhoto,
                onClearReceipt = { viewModel.pickReceipt(null) },
                onLaunchPhotoPicker = {
                    photoPicker.launch(
                        PickVisualMediaRequest(
                            ActivityResultContracts.PickVisualMedia.ImageOnly,
                        ),
                    )
                },
                onLaunchReceiptPicker = {
                    receiptPicker.launch(arrayOf("image/*", "application/pdf"))
                },
                onSubmit = viewModel::submit,
                onCancel = viewModel::cancel,
            ),
    )
}

/**
 * Bundle of [LogMaintenanceFormContent] callbacks. Grouped into one
 * type so the composable stays under detekt's `LongParameterList`
 * threshold and so call sites (real screen + Paparazzi tests) read
 * straight down. The activity-result launchers (`onLaunchPhotoPicker`
 * / `onLaunchReceiptPicker`) live on the parent screen so the content
 * can be rendered in a Paparazzi host that has no
 * `ActivityResultRegistryOwner`.
 */
internal data class LogMaintenanceFormCallbacks(
    val onUpdateCategory: (MaintenanceCategory) -> Unit = {},
    val onUpdateTitle: (String) -> Unit = {},
    val onUpdateDateCompleted: (Instant) -> Unit = {},
    val onUpdatePerformedBy: (MaintenancePerformedBy) -> Unit = {},
    val onUpdatePerformerName: (String) -> Unit = {},
    val onUpdatePerformerContact: (String) -> Unit = {},
    val onUpdateCost: (String) -> Unit = {},
    val onUpdateNotes: (String) -> Unit = {},
    val onToggleNextDue: (Boolean) -> Unit = {},
    val onUpdateNextDueDate: (Instant) -> Unit = {},
    val onUpdateRecurrence: (MaintenanceRecurrence) -> Unit = {},
    val onRemovePhoto: (String) -> Unit = {},
    val onClearReceipt: () -> Unit = {},
    val onLaunchPhotoPicker: () -> Unit = {},
    val onLaunchReceiptPicker: () -> Unit = {},
    val onSubmit: () -> Unit = {},
    val onCancel: () -> Unit = {},
)

@Composable
internal fun LogMaintenanceFormContent(
    form: LogMaintenanceFormState,
    isDirty: Boolean,
    screenTitle: String,
    submitLabel: String,
    callbacks: LogMaintenanceFormCallbacks,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .windowInsetsPadding(WindowInsets.statusBars)
                .testTag("logMaintenanceForm"),
    ) {
        FormTopBar(
            title = screenTitle,
            rightActionLabel = submitLabel,
            rightActionEnabled = form.canSubmit && isDirty && !form.isSubmitting,
            isSaving = form.isSubmitting,
            onClose = callbacks.onCancel,
            onCommit = callbacks.onSubmit,
        )

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            FieldGroup("CATEGORY") {
                CategoryGrid(
                    selected = form.category,
                    onSelect = callbacks.onUpdateCategory,
                )
            }

            FieldGroup("DETAILS") {
                LabeledTextField(
                    label = "Title",
                    value = form.title,
                    onValueChange = callbacks.onUpdateTitle,
                    placeholder = "Fall HVAC tune-up",
                    testTag = "logMaintenance_title",
                )
                Spacer(modifier = Modifier.height(Spacing.s3))
                DatePickerRow(
                    label = "Date completed",
                    value = form.dateCompleted,
                    onChange = callbacks.onUpdateDateCompleted,
                    pickMax = Instant.now(),
                    testTag = "logMaintenance_dateCompleted",
                )
            }

            FieldGroup("PERFORMED BY") {
                PerformedByTabs(
                    selected = form.performedBy,
                    onSelect = callbacks.onUpdatePerformedBy,
                )
                if (form.performedBy != MaintenancePerformedBy.Self) {
                    Spacer(modifier = Modifier.height(Spacing.s3))
                    LabeledTextField(
                        label =
                            if (form.performedBy == MaintenancePerformedBy.Member) {
                                "Member name"
                            } else {
                                "Contractor name"
                            },
                        value = form.performerName,
                        onValueChange = callbacks.onUpdatePerformerName,
                        placeholder =
                            if (form.performedBy == MaintenancePerformedBy.Member) {
                                "Alex"
                            } else {
                                "Riverside HVAC"
                            },
                        testTag = "logMaintenance_performerName",
                    )
                }
                if (form.performedBy == MaintenancePerformedBy.Contractor) {
                    Spacer(modifier = Modifier.height(Spacing.s3))
                    LabeledTextField(
                        label = "Contact (optional)",
                        value = form.performerContact,
                        onValueChange = callbacks.onUpdatePerformerContact,
                        placeholder = "(555) 555-0142 · hello@riverside.com",
                        testTag = "logMaintenance_performerContact",
                    )
                }
            }

            FieldGroup("COST & SCHEDULE") {
                LabeledTextField(
                    label = "Cost",
                    value = form.costText,
                    onValueChange = callbacks.onUpdateCost,
                    placeholder = "$0",
                    testTag = "logMaintenance_cost",
                )
                Spacer(modifier = Modifier.height(Spacing.s3))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Set next-due reminder",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = form.nextDueEnabled,
                        onCheckedChange = callbacks.onToggleNextDue,
                        colors =
                            SwitchDefaults.colors(
                                checkedThumbColor = PantopusColors.appSurface,
                                checkedTrackColor = PantopusColors.primary600,
                            ),
                        modifier = Modifier.testTag("logMaintenance_nextDueToggle"),
                    )
                }
                if (form.nextDueEnabled) {
                    Spacer(modifier = Modifier.height(Spacing.s3))
                    DatePickerRow(
                        label = "Next due",
                        value = form.nextDueDate,
                        onChange = callbacks.onUpdateNextDueDate,
                        pickMin = Instant.now(),
                        testTag = "logMaintenance_nextDueDate",
                    )
                    Spacer(modifier = Modifier.height(Spacing.s3))
                    RecurrenceTabs(
                        selected = form.recurrence,
                        onSelect = callbacks.onUpdateRecurrence,
                    )
                    Spacer(modifier = Modifier.height(Spacing.s2))
                    Text(
                        text = "We'll add this to the home calendar as a reminder.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }

            FieldGroup("NOTES") {
                NotesField(
                    value = form.notes,
                    onValueChange = callbacks.onUpdateNotes,
                )
            }

            FieldGroup("PHOTOS") {
                Text(
                    text = "Up to 4 photos.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
                Spacer(modifier = Modifier.height(Spacing.s2))
                PhotoGrid(
                    slots = form.photoSlots(),
                    onPick = callbacks.onLaunchPhotoPicker,
                    onRemove = callbacks.onRemovePhoto,
                )
            }

            FieldGroup("RECEIPT") {
                ReceiptBlock(
                    file = form.receipt,
                    onPick = callbacks.onLaunchReceiptPicker,
                    onRemove = callbacks.onClearReceipt,
                )
            }

            form.submitError?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.error,
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s4)
                            .testTag("logMaintenance_error"),
                )
            }

            Spacer(modifier = Modifier.height(Spacing.s10))
        }
    }
}

// MARK: - Top bar

@Composable
private fun FormTopBar(
    title: String,
    rightActionLabel: String,
    rightActionEnabled: Boolean,
    isSaving: Boolean,
    onClose: () -> Unit,
    onCommit: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorderSubtle),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clickable(onClick = onClose)
                    .testTag("formCloseButton"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Close",
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        Text(
            text = title,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .weight(1f)
                    .semantics { heading() },
            fontWeight = FontWeight.SemiBold,
        )
        Box(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clickable(enabled = rightActionEnabled, onClick = onCommit)
                    .padding(horizontal = Spacing.s3)
                    .testTag("formCommitButton"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (isSaving) "Saving…" else rightActionLabel,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color =
                    if (rightActionEnabled) {
                        PantopusColors.primary600
                    } else {
                        PantopusColors.appTextMuted
                    },
            )
        }
    }
}

// MARK: - Field grouping

@Composable
private fun FieldGroup(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = title,
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s2)
                    .semantics { heading() },
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s4),
        ) {
            content()
        }
    }
}

// MARK: - Sub-components

@Composable
private fun CategoryGrid(
    selected: MaintenanceCategory,
    onSelect: (MaintenanceCategory) -> Unit,
) {
    val tiles =
        listOf(
            MaintenanceCategory.Hvac,
            MaintenanceCategory.Plumbing,
            MaintenanceCategory.Electrical,
            MaintenanceCategory.Appliance,
            MaintenanceCategory.Landscape,
            MaintenanceCategory.Roof,
            MaintenanceCategory.Generic,
        )
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 84.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(max = 240.dp)
                .testTag("logMaintenance_category"),
        userScrollEnabled = false,
        contentPadding = PaddingValues(0.dp),
    ) {
        items(tiles, key = { it.rawValue }) { category ->
            CategoryTile(
                category = category,
                isSelected = category == selected,
                onClick = { onSelect(category) },
            )
        }
    }
}

@Composable
private fun CategoryTile(
    category: MaintenanceCategory,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    val displayLabel = if (category == MaintenanceCategory.Landscape) "Yard" else category.label
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appBg)
                .border(
                    BorderStroke(
                        width = if (isSelected) 2.dp else 1.dp,
                        color =
                            if (isSelected) {
                                PantopusColors.primary600
                            } else {
                                PantopusColors.appBorderSubtle
                            },
                    ),
                    RoundedCornerShape(Radii.md),
                )
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s2)
                .testTag("logMaintenance_category_${category.rawValue}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(category.background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = category.icon,
                contentDescription = displayLabel,
                size = 18.dp,
                tint = category.foreground,
            )
        }
        Text(
            text = displayLabel,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appText,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun LabeledTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    testTag: String,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s1),
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, color = PantopusColors.appTextMuted) },
            singleLine = true,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag(testTag),
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appBg,
                    unfocusedContainerColor = PantopusColors.appBg,
                    focusedIndicatorColor = PantopusColors.primary600,
                    unfocusedIndicatorColor = PantopusColors.appBorder,
                ),
        )
    }
}

@Composable
private fun NotesField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Notes (optional)",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s1),
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = {
                Text(
                    "Replaced filter, topped off coolant…",
                    color = PantopusColors.appTextMuted,
                )
            },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .testTag("logMaintenance_notes"),
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appBg,
                    unfocusedContainerColor = PantopusColors.appBg,
                    focusedIndicatorColor = PantopusColors.primary600,
                    unfocusedIndicatorColor = PantopusColors.appBorder,
                ),
        )
    }
}

@Composable
private fun DatePickerRow(
    label: String,
    value: Instant,
    onChange: (Instant) -> Unit,
    pickMin: Instant? = null,
    pickMax: Instant? = null,
    testTag: String,
) {
    val context = LocalContext.current
    // `LocalDate.ofInstant` is API 34+; the equivalent atZone + toLocalDate
    // works on the minSdk 26 baseline without core-library desugaring.
    val local = remember(value) { value.atZone(ZoneId.of("UTC")).toLocalDate() }
    val display =
        remember(local) {
            "${local.month.name.lowercase().replaceFirstChar { it.titlecase() }} ${local.dayOfMonth}, ${local.year}"
        }
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s1),
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(
                        BorderStroke(1.dp, PantopusColors.appBorder),
                        RoundedCornerShape(Radii.md),
                    )
                    .clickable {
                        val calendar = Calendar.getInstance()
                        calendar.set(local.year, local.monthValue - 1, local.dayOfMonth)
                        val dialog =
                            DatePickerDialog(
                                context,
                                { _, y, m, d ->
                                    val picked =
                                        LocalDate
                                            .of(y, m + 1, d)
                                            .atStartOfDay(ZoneId.of("UTC"))
                                            .toInstant()
                                    onChange(picked)
                                },
                                local.year,
                                local.monthValue - 1,
                                local.dayOfMonth,
                            )
                        pickMin?.let { dialog.datePicker.minDate = it.toEpochMilli() }
                        pickMax?.let { dialog.datePicker.maxDate = it.toEpochMilli() }
                        dialog.show()
                    }
                    .padding(Spacing.s3)
                    .testTag(testTag),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
            Spacer(modifier = Modifier.width(Spacing.s2))
            Text(
                text = display,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun PerformedByTabs(
    selected: MaintenancePerformedBy,
    onSelect: (MaintenancePerformedBy) -> Unit,
) {
    val options = MaintenancePerformedBy.entries
    val selectedIndex = options.indexOf(selected).coerceAtLeast(0)
    TabRow(
        selectedTabIndex = selectedIndex,
        containerColor = PantopusColors.appBg,
        contentColor = PantopusColors.primary600,
        modifier = Modifier.testTag("logMaintenance_performedBy"),
    ) {
        options.forEach { option ->
            Tab(
                selected = option == selected,
                onClick = { onSelect(option) },
                text = {
                    Text(
                        text =
                            when (option) {
                                MaintenancePerformedBy.Self -> "Self"
                                MaintenancePerformedBy.Member -> "Member"
                                MaintenancePerformedBy.Contractor -> "Contractor"
                            },
                        style = PantopusTextStyle.small,
                    )
                },
            )
        }
    }
}

@Composable
private fun RecurrenceTabs(
    selected: MaintenanceRecurrence,
    onSelect: (MaintenanceRecurrence) -> Unit,
) {
    val options = MaintenanceRecurrence.entries
    val selectedIndex = options.indexOf(selected).coerceAtLeast(0)
    TabRow(
        selectedTabIndex = selectedIndex,
        containerColor = PantopusColors.appBg,
        contentColor = PantopusColors.primary600,
        modifier = Modifier.testTag("logMaintenance_recurrence"),
    ) {
        options.forEach { option ->
            Tab(
                selected = option == selected,
                onClick = { onSelect(option) },
                text = {
                    Text(text = option.label, style = PantopusTextStyle.small)
                },
            )
        }
    }
}

@Composable
private fun PhotoGrid(
    slots: List<LogMaintenanceFormState.PhotoSlot>,
    onPick: () -> Unit,
    onRemove: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("logMaintenance_photos"),
    ) {
        slots.chunked(2).forEach { pair ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = Spacing.s2),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                pair.forEach { slot ->
                    Box(modifier = Modifier.weight(1f)) {
                        PhotoTile(
                            slot = slot,
                            onPick = onPick,
                            onRemove = onRemove,
                        )
                    }
                }
                // Pad the row when the last chunk has only one slot.
                if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun PhotoTile(
    slot: LogMaintenanceFormState.PhotoSlot,
    onPick: () -> Unit,
    onRemove: (String) -> Unit,
) {
    val file = slot.file
    if (file != null) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(96.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceMuted)
                    .testTag("logMaintenance_photo_${slot.index}"),
            contentAlignment = Alignment.Center,
        ) {
            // Don't try to decode bytes during snapshot tests — keep
            // the tile content deterministic.
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = "Photo",
                size = 28.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(Spacing.s1)
                        .size(24.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText.copy(alpha = 0.65f))
                        .clickable { onRemove(file.id) }
                        .testTag("logMaintenance_photo_remove_${slot.index}"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Remove",
                    size = 14.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    } else {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(96.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .border(
                        BorderStroke(1.dp, PantopusColors.appBorderSubtle),
                        RoundedCornerShape(Radii.md),
                    )
                    .clickable(onClick = onPick)
                    .testTag("logMaintenance_photo_add_${slot.index}"),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Camera,
                    contentDescription = "Add photo",
                    size = Radii.xl2,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Add photo",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun ReceiptBlock(
    file: MaintenanceDraftFile?,
    onPick: () -> Unit,
    onRemove: () -> Unit,
) {
    if (file != null) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(
                        BorderStroke(1.dp, PantopusColors.appBorderSubtle),
                        RoundedCornerShape(Radii.md),
                    )
                    .padding(Spacing.s3)
                    .testTag("logMaintenance_receipt"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.appSurfaceMuted),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon =
                        if (file.mimeType == "application/pdf") {
                            PantopusIcon.FileText
                        } else {
                            PantopusIcon.Image
                        },
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Spacer(modifier = Modifier.width(Spacing.s3))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = file.filename,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                Text(
                    text = if (file.mimeType == "application/pdf") "PDF" else "Image",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clickable(onClick = onRemove)
                        .testTag("logMaintenance_receipt_remove"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Remove receipt",
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    } else {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50)
                    .clickable(onClick = onPick)
                    .padding(Spacing.s3)
                    .testTag("logMaintenance_receipt_pick"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Paperclip,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
            Spacer(modifier = Modifier.width(Spacing.s2))
            Text(
                text = "Attach receipt (PDF or image)",
                style = PantopusTextStyle.body,
                color = PantopusColors.primary600,
            )
        }
    }
}
