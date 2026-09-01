@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.homes.guests

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ChipPicker
import app.pantopus.android.ui.components.ChipPickerStyle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Test tag on the Add Guest form root. */
const val ADD_GUEST_FORM_TAG = "addGuestForm"

@Composable
fun AddGuestFormScreen(
    onClose: () -> Unit,
    onSent: () -> Unit,
    viewModel: AddGuestFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showsCustomRange by rememberSaveable { mutableStateOf(false) }
    val today = remember { LocalDate.now() }
    var customStartEpochDay by rememberSaveable { mutableLongStateOf(today.toEpochDay()) }
    var customEndEpochDay by rememberSaveable { mutableLongStateOf(today.plusDays(1).toEpochDay()) }

    // A13.6 — "Share this pass now?" confirm, raised the moment the create
    // call returns the one-time token (RN parity:
    // `src/app/homes/[id]/share.tsx:60-70`).
    val context = LocalContext.current
    var shareOffer by remember { mutableStateOf<GuestPassShare?>(null) }

    LaunchedEffect(state.createdShare) {
        state.createdShare?.let { shareOffer = it }
    }

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(state.shouldDismiss) {
        if (state.shouldDismiss) {
            viewModel.acknowledgeDismiss()
            delay(700)
            onSent()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(ADD_GUEST_FORM_TAG),
    ) {
        AddGuestFormLoaded(
            state = state,
            onClose = onClose,
            onCommit = viewModel::submit,
            onNameChange = viewModel::updateName,
            onContactChange = viewModel::updateContact,
            onDurationChange = { duration ->
                viewModel.setDuration(duration)
                if (duration == AddGuestSampleData.DURATION_CUSTOM_ID) {
                    showsCustomRange = true
                }
            },
            onAreasChange = viewModel::setAreas,
            onWelcomeChange = viewModel::updateWelcome,
        )

        state.toast?.let { toast ->
            AddGuestToastView(
                toast = toast,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s12),
            )
        }
    }

    shareOffer?.let { offer ->
        AlertDialog(
            onDismissRequest = {
                shareOffer = null
                viewModel.acknowledgeShare()
            },
            title = { Text("Guest pass created") },
            text = { Text("Share this pass now?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        shareOffer = null
                        context.shareText(offer.message, chooserTitle = "Share guest pass")
                        viewModel.acknowledgeShare()
                    },
                    modifier = Modifier.testTag("addGuest_shareNow"),
                ) { Text("Share") }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        shareOffer = null
                        viewModel.acknowledgeShare()
                    },
                    modifier = Modifier.testTag("addGuest_shareLater"),
                ) { Text("Later") }
            },
        )
    }

    if (showsCustomRange) {
        DateRangePickerSheet(
            startEpochDay = customStartEpochDay,
            endEpochDay = customEndEpochDay,
            onStartChange = { day ->
                customStartEpochDay = day
                if (customEndEpochDay < day) customEndEpochDay = day
            },
            onEndChange = { day -> customEndEpochDay = maxOf(day, customStartEpochDay) },
            onClear = {
                viewModel.clearCustomRange()
                showsCustomRange = false
            },
            onDone = {
                val start = LocalDate.ofEpochDay(customStartEpochDay)
                val end = LocalDate.ofEpochDay(customEndEpochDay)
                viewModel.setCustomRange(
                    start.shortLabel(),
                    end.shortLabel(),
                    customStartEpochDay,
                    customEndEpochDay,
                )
                showsCustomRange = false
            },
            onDismiss = { showsCustomRange = false },
        )
    }
}

/** Snapshot-friendly loaded form surface. */
@Composable
internal fun AddGuestFormLoaded(
    state: AddGuestUiState,
    onClose: () -> Unit,
    onCommit: () -> Unit,
    onNameChange: (String) -> Unit,
    onContactChange: (String) -> Unit,
    onDurationChange: (String?) -> Unit,
    onAreasChange: (Set<String>) -> Unit,
    onWelcomeChange: (String) -> Unit,
) {
    FormShell(
        title = "Add guest",
        rightActionLabel = null,
        bottomActionLabel = "Send pass",
        bottomActionIcon = PantopusIcon.KeyRound,
        isValid = state.isValid,
        isDirty = state.isDirty,
        isSaving = state.isSaving,
        onClose = onClose,
        onCommit = onCommit,
    ) {
        HomeContextStrip(title = state.homeTitle, subtitle = state.homeSubtitle)

        FormFieldGroup(title = "Guest") {
            PantopusTextField(
                label = "Name",
                value = state.nameField.value,
                onValueChange = onNameChange,
                placeholder = "Sasha Petrov",
                state = nameVisualState(state),
                isRequired = true,
                keyboardType = KeyboardType.Text,
                fieldTestTag = "field_guestName",
            )
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                PantopusTextField(
                    label = "Email or phone",
                    value = state.contactField.value,
                    onValueChange = onContactChange,
                    placeholder = "sasha@petrov.co or (415) 555-…",
                    state = contactVisualState(state),
                    isRequired = true,
                    keyboardType = KeyboardType.Email,
                    fieldTestTag = "field_guestContact",
                )
                Text(
                    text = "We'll text or email them a one-tap pass link.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }

        FormFieldGroup(title = "Access window") {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                RequiredFieldLabel(label = "Duration", required = true)
                ChipPicker(
                    options = state.durationOptions,
                    selectedId = state.duration,
                    onSelectionChange = onDurationChange,
                    style = ChipPickerStyle.Tinted,
                    testTag = "field_duration",
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier =
                        Modifier
                            .testTag("durationHint")
                            .semantics { contentDescription = state.durationHint },
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Clock,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = state.durationHint,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                        fontStyle = FontStyle.Italic,
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                RequiredFieldLabel(label = "Allowed areas", required = false)
                ChipPicker(
                    options = state.areaOptions,
                    selectedIds = state.selectedAreas,
                    onSelectionChange = onAreasChange,
                    style = ChipPickerStyle.Tinted,
                    testTag = "field_areas",
                )
                Text(
                    text = state.areasHint,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    fontStyle = FontStyle.Italic,
                    modifier = Modifier.testTag("areasHint"),
                )
            }
        }

        FormFieldGroup(title = "Note") {
            WelcomeMessageEditor(
                value = state.welcomeField.value,
                maxLength = state.welcomeMaxLength,
                onValueChange = onWelcomeChange,
            )
        }
    }
}

@Composable
private fun HomeContextStrip(
    title: String,
    subtitle: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = "Guest pass for $title, $subtitle" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.home),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Home,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "GUEST PASS",
            style = PantopusTextStyle.overline,
            color = PantopusColors.home,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.homeBg)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
        )
    }
}

@Composable
private fun RequiredFieldLabel(
    label: String,
    required: Boolean,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        if (required) {
            Text(
                text = "*",
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun WelcomeMessageEditor(
    value: String,
    maxLength: Int,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        RequiredFieldLabel(label = "Welcome message (optional)", required = false)
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 92.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(Spacing.s3),
        ) {
            if (value.isEmpty()) {
                Text(
                    text = "Anything they should know when they accept…",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextMuted,
                )
            }
            BasicTextField(
                value = value,
                onValueChange = { onValueChange(it.take(maxLength)) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 68.dp)
                        .testTag("field_welcome"),
            )
        }
        Text(
            text = "${value.length} / $maxLength",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("welcomeCharCount"),
        )
    }
}

@Composable
internal fun AddGuestToastView(
    toast: GuestToast,
    modifier: Modifier = Modifier,
) {
    Toast(
        message =
            ToastMessage(
                text = toast.text,
                kind = if (toast.isError) ToastKind.Error else ToastKind.Success,
            ),
        modifier = modifier.testTag("addGuestToast"),
    )
}

@Composable
private fun DateRangePickerSheet(
    startEpochDay: Long,
    endEpochDay: Long,
    onStartChange: (Long) -> Unit,
    onEndChange: (Long) -> Unit,
    onClear: () -> Unit,
    onDone: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("customRangeSheet"),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Custom range",
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                )
                Spacer(modifier = Modifier.weight(1f))
                TextButton(
                    onClick = onClear,
                    modifier = Modifier.testTag("customRange_clear"),
                ) {
                    Text("Clear", color = PantopusColors.appTextSecondary)
                }
            }
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            Column(
                modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                DateRow(
                    label = "Starts",
                    date = LocalDate.ofEpochDay(startEpochDay),
                    minDate = null,
                    onPick = onStartChange,
                    testTag = "customRange_start",
                )
                DateRow(
                    label = "Ends",
                    date = LocalDate.ofEpochDay(endEpochDay),
                    minDate = LocalDate.ofEpochDay(startEpochDay),
                    onPick = onEndChange,
                    testTag = "customRange_end",
                )
            }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(Spacing.s4)
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onDone)
                        .testTag("customRange_done")
                        .semantics { contentDescription = "Use these dates" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Use these dates",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextInverse,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun DateRow(
    label: String,
    date: LocalDate,
    minDate: LocalDate?,
    onPick: (Long) -> Unit,
    testTag: String,
) {
    val context = LocalContext.current
    val dialog =
        remember(date, minDate) {
            DatePickerDialog(
                context,
                { _, year, month, day ->
                    onPick(LocalDate.of(year, month + 1, day).toEpochDay())
                },
                date.year,
                date.monthValue - 1,
                date.dayOfMonth,
            ).apply {
                if (minDate != null) {
                    datePicker.minDate = minDate.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
                }
            }
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable { dialog.show() }
                .testTag(testTag)
                .semantics { contentDescription = "$label ${date.shortLabel()}" }
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = date.shortLabel(),
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

private fun nameVisualState(state: AddGuestUiState): PantopusFieldState =
    if (state.nameField.touched && state.nameField.value.trim().isNotEmpty()) {
        PantopusFieldState.Valid
    } else {
        PantopusFieldState.Default
    }

private fun contactVisualState(state: AddGuestUiState): PantopusFieldState =
    when {
        state.contactField.error != null -> PantopusFieldState.Error(state.contactField.error)
        state.contactField.touched && isGuestContactValid(state.contactField.value) -> PantopusFieldState.Valid
        else -> PantopusFieldState.Default
    }

private fun LocalDate.shortLabel(): String = format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
