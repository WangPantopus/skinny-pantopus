@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:Suppress("LongMethod", "MagicNumber", "PackageNaming", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.profile

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Bottom-sheet host for [ReportUserSheetBody]. Wires the dismiss handler
 * and forwards a success-pulse so the parent screen can show its toast.
 */
@Composable
fun ReportUserSheet(
    userId: String,
    handle: String?,
    displayName: String,
    sheetState: SheetState,
    onDismiss: () -> Unit,
    onSubmitted: () -> Unit,
    viewModel: ReportUserSheetViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val reason by viewModel.selectedReason.collectAsStateWithLifecycle()
    val details by viewModel.details.collectAsStateWithLifecycle()

    LaunchedEffect(state) {
        if (state is ReportSheetUiState.Succeeded) {
            onSubmitted()
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("reportUserSheet"),
    ) {
        ReportUserSheetBody(
            handle = handle,
            displayName = displayName,
            state = state,
            selectedReason = reason,
            details = details,
            onSelectReason = viewModel::selectReason,
            onDetailsChange = viewModel::updateDetails,
            onSubmit = { viewModel.submit(userId) },
            onCancel = onDismiss,
        )
    }
}

/**
 * Render-only body for the Report-User sheet. Exposed for Paparazzi
 * baselines so the host's [ModalBottomSheet] isn't needed in tests.
 */
@Composable
fun ReportUserSheetBody(
    handle: String?,
    displayName: String,
    state: ReportSheetUiState,
    selectedReason: ReportReason?,
    details: String,
    onSelectReason: (ReportReason) -> Unit,
    onDetailsChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onCancel: () -> Unit,
) {
    val isSubmitting = state is ReportSheetUiState.Submitting
    val detailsRequired = selectedReason == ReportReason.Other
    val canSubmit =
        selectedReason != null &&
            (!detailsRequired || details.trim().isNotEmpty()) &&
            !isSubmitting

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s10),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = if (!handle.isNullOrEmpty()) "Report @$handle" else "Report $displayName",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .padding(top = Spacing.s2)
                    .semantics { heading() }
                    .testTag("reportUser_title"),
        )

        Text(
            text =
                "Tell us why you're reporting this account. Our moderators review " +
                    "every report.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )

        ReasonGroup(
            selected = selectedReason,
            onSelect = onSelectReason,
        )

        DetailsField(
            required = detailsRequired,
            value = details,
            onChange = onDetailsChange,
        )

        if (state is ReportSheetUiState.Failed) {
            Text(
                text = state.message,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("reportUser_error"),
            )
        }

        Spacer(modifier = Modifier.height(Spacing.s1))

        PrimaryButton(
            title = "Submit report",
            onClick = onSubmit,
            isEnabled = canSubmit,
            isLoading = isSubmitting,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("reportUser_submit"),
        )

        GhostButton(
            title = "Cancel",
            onClick = onCancel,
            isEnabled = !isSubmitting,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("reportUser_cancelGhost"),
        )
    }
}

@Composable
private fun ReasonGroup(
    selected: ReportReason?,
    onSelect: (ReportReason) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Reason",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = PantopusColors.appBorderSubtle,
                        shape = RoundedCornerShape(Radii.lg),
                    ).testTag("reportUser_reasons"),
        ) {
            val reasons = ReportReason.values().toList()
            reasons.forEachIndexed { index, reason ->
                ReasonRow(
                    reason = reason,
                    isSelected = selected == reason,
                    isLast = index == reasons.lastIndex,
                    onTap = { onSelect(reason) },
                )
            }
        }
    }
}

@Composable
private fun ReasonRow(
    reason: ReportReason,
    isSelected: Boolean,
    isLast: Boolean,
    onTap: () -> Unit,
) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clickable(onClick = onTap)
                    .padding(horizontal = Spacing.s4)
                    .testTag("reportUser_reason_${reason.key}")
                    .semantics {
                        contentDescription = reason.label
                        selected = isSelected
                    },
        ) {
            Text(
                text = reason.label,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            RadioDot(isSelected = isSelected)
        }
        if (!isLast) {
            Box(
                modifier =
                    Modifier
                        .padding(start = Spacing.s4)
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(PantopusColors.appBorderSubtle),
            )
        }
    }
}

@Composable
private fun RadioDot(isSelected: Boolean) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .border(
                    width = 1.5.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(11.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600),
            )
        }
    }
}

@Composable
private fun DetailsField(
    required: Boolean,
    value: String,
    onChange: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.semantics { heading() },
        ) {
            Text(
                text = "Details",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            if (required) {
                Text(
                    text = "Required",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("reportUser_detailsRequired"),
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = PantopusColors.appBorderSubtle,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(Spacing.s3),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 4,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("reportUser_details")
                        .semantics {
                            contentDescription =
                                if (required) "Details, required" else "Details"
                        },
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text =
                                if (required) {
                                    "Tell us what happened"
                                } else {
                                    "Add anything that helps (optional)"
                                },
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
    }
}
