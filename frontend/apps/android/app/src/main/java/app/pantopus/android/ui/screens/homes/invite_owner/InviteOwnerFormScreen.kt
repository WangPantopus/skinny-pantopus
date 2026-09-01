@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.invite_owner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/** Test tag on the Invite Owner form root. */
const val INVITE_OWNER_FORM_TAG = "inviteOwnerForm"

/**
 * A13.2 Invite Owner form. ViewModel reads `homeId` and debug-only
 * `currentUserEmail` via [androidx.lifecycle.SavedStateHandle].
 */
@Composable
fun InviteOwnerFormScreen(
    onClose: () -> Unit,
    viewModel: InviteOwnerFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(state.shouldDismiss) {
        if (state.shouldDismiss) {
            viewModel.acknowledgeDismiss()
            onClose()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(INVITE_OWNER_FORM_TAG),
    ) {
        InviteOwnerFormScreenContent(
            state = state,
            onClose = onClose,
            onRetry = viewModel::refresh,
            onCommit = viewModel::submit,
            onFieldChange = viewModel::update,
            onGrantChange = viewModel::updateGrantPercent,
            onSnapToAvailable = viewModel::snapGrantToAvailablePool,
            onRebalance = viewModel::rebalanceShares,
            onFastTrackChange = viewModel::updateFastTrack,
        )

        state.toast?.let { toast ->
            InviteOwnerToastView(
                toast = toast,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s8),
            )
        }
    }
}

@Deprecated("Use InviteOwnerFormScreen; Invite Owner is now a single-screen A13 form.")
@Composable
fun InviteOwnerWizardScreen(
    onClose: () -> Unit,
    viewModel: InviteOwnerFormViewModel = hiltViewModel(),
) {
    InviteOwnerFormScreen(onClose = onClose, viewModel = viewModel)
}

@Composable
internal fun InviteOwnerFormScreenContent(
    state: InviteOwnerUiState,
    onClose: () -> Unit,
    onRetry: () -> Unit,
    onCommit: () -> Unit,
    onFieldChange: (InviteOwnerField, String) -> Unit,
    onGrantChange: (Int) -> Unit,
    onSnapToAvailable: () -> Unit,
    onRebalance: () -> Unit,
    onFastTrackChange: (Boolean) -> Unit = {},
) {
    when (val phase = state.phase) {
        InviteOwnerPhase.Loading -> InviteOwnerLoadingForm(onClose = onClose)
        InviteOwnerPhase.Empty -> InviteOwnerEmptyForm(onClose = onClose, onRetry = onRetry)
        is InviteOwnerPhase.Error ->
            InviteOwnerErrorForm(message = phase.message, onClose = onClose, onRetry = onRetry)
        InviteOwnerPhase.Editing ->
            InviteOwnerLoadedForm(
                state = state,
                onClose = onClose,
                onCommit = onCommit,
                onFieldChange = onFieldChange,
                onGrantChange = onGrantChange,
                onSnapToAvailable = onSnapToAvailable,
                onRebalance = onRebalance,
                onFastTrackChange = onFastTrackChange,
            )
    }
}

/** Snapshot-friendly loaded form surface. */
@Composable
internal fun InviteOwnerLoadedForm(
    state: InviteOwnerUiState,
    onClose: () -> Unit,
    onCommit: () -> Unit,
    onFieldChange: (InviteOwnerField, String) -> Unit,
    onGrantChange: (Int) -> Unit,
    onSnapToAvailable: () -> Unit,
    onRebalance: () -> Unit,
    onFastTrackChange: (Boolean) -> Unit = {},
) {
    FormShell(
        title = "Invite owner",
        rightActionLabel = "Send",
        isValid = state.isValid,
        isDirty = state.isDirty,
        isSaving = state.isSaving,
        onClose = onClose,
        onCommit = onCommit,
    ) {
        InviteOwnerFormContent(
            state = state,
            onFieldChange = onFieldChange,
            onGrantChange = onGrantChange,
            onSnapToAvailable = onSnapToAvailable,
            onRebalance = onRebalance,
            onFastTrackChange = onFastTrackChange,
        )
    }
}

@Composable
private fun InviteOwnerFormContent(
    state: InviteOwnerUiState,
    onFieldChange: (InviteOwnerField, String) -> Unit,
    onGrantChange: (Int) -> Unit,
    onSnapToAvailable: () -> Unit,
    onRebalance: () -> Unit,
    onFastTrackChange: (Boolean) -> Unit,
) {
    HomeContextStrip(context = state.homeContext)

    FormFieldGroup(title = "Contact info") {
        FieldFor(
            label = "Email",
            placeholder = "name@example.com",
            keyboardType = KeyboardType.Email,
            field = InviteOwnerField.Email,
            state = state,
            onChange = onFieldChange,
            testTag = "inviteOwnerEmailField",
            isRequired = true,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            FieldFor(
                label = "Phone (optional)",
                placeholder = "(415) 555-...",
                keyboardType = KeyboardType.Phone,
                field = InviteOwnerField.Phone,
                state = state,
                onChange = onFieldChange,
                testTag = "inviteOwnerPhoneField",
                isRequired = false,
            )
            Text(
                text = "Used only for SMS verification code.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }

    FormFieldGroup(title = "Ownership share") {
        OwnershipSummaryCard(summary = state.ownershipSummary)
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            RequiredFieldLabel(label = "Share to grant", required = true)
            StatefulSlider(
                value = state.grantPercent,
                isError = state.hasShareConflict,
                onValueChange = onGrantChange,
            )
            if (!state.hasShareConflict) {
                Text(
                    text = state.retentionHint,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    fontStyle = FontStyle.Italic,
                    modifier = Modifier.testTag("inviteOwnerShareHint"),
                )
            }
        }
        if (state.hasShareConflict) {
            OwnershipConflictBlock(
                state = state,
                onSnapToAvailable = onSnapToAvailable,
                onRebalance = onRebalance,
            )
        }
    }

    FormFieldGroup(title = "Verification") {
        FastTrackToggleRow(isOn = state.fastTrack, onCheckedChange = onFastTrackChange)
    }

    FormFieldGroup(title = "Role") {
        RoleNoteEditor(
            value = state.fields[InviteOwnerField.Role]?.value.orEmpty(),
            maxLength = InviteOwnerSampleData.NOTE_MAX_LENGTH,
            onValueChange = { onFieldChange(InviteOwnerField.Role, it) },
        )
        Text(
            text = "Visible to other owners. Helps avoid stepping on each other.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            fontStyle = FontStyle.Italic,
        )
    }
}

@Composable
private fun InviteOwnerLoadingForm(onClose: () -> Unit) {
    FormShell(
        title = "Invite owner",
        rightActionLabel = "Send",
        isValid = false,
        isDirty = false,
        onClose = onClose,
        onCommit = {},
    ) {
        Shimmer(
            width = 328.dp,
            height = 52.dp,
            cornerRadius = Radii.lg,
            modifier = Modifier.padding(horizontal = Spacing.s4).testTag("inviteOwnerLoading"),
        )
        FormFieldGroup(title = "Contact info") {
            Shimmer(width = 296.dp, height = 64.dp, cornerRadius = Radii.md)
            Shimmer(width = 296.dp, height = 64.dp, cornerRadius = Radii.md)
        }
        FormFieldGroup(title = "Ownership share") {
            Shimmer(width = 296.dp, height = 44.dp, cornerRadius = Radii.md)
            Shimmer(width = 296.dp, height = 44.dp, cornerRadius = Radii.md)
        }
        FormFieldGroup(title = "Role") {
            Shimmer(width = 296.dp, height = 128.dp, cornerRadius = Radii.md)
        }
    }
}

@Composable
private fun InviteOwnerEmptyForm(
    onClose: () -> Unit,
    onRetry: () -> Unit,
) {
    FormShell(
        title = "Invite owner",
        rightActionLabel = "Send",
        isValid = false,
        isDirty = false,
        onClose = onClose,
        onCommit = {},
    ) {
        EmptyState(
            icon = PantopusIcon.Home,
            headline = "No ownership context",
            subcopy = "Add or verify this home before inviting another owner.",
            ctaTitle = "Reload",
            onCta = onRetry,
            tint = PantopusColors.homeBg,
            accent = PantopusColors.home,
            modifier = Modifier.heightIn(min = 520.dp).testTag("inviteOwnerEmpty"),
        )
    }
}

@Composable
private fun InviteOwnerErrorForm(
    message: String,
    onClose: () -> Unit,
    onRetry: () -> Unit,
) {
    FormShell(
        title = "Invite owner",
        rightActionLabel = "Send",
        isValid = false,
        isDirty = false,
        onClose = onClose,
        onCommit = {},
    ) {
        EmptyState(
            icon = PantopusIcon.AlertCircle,
            headline = "Couldn't load ownership",
            subcopy = message,
            ctaTitle = "Try again",
            onCta = onRetry,
            tint = PantopusColors.errorBg,
            accent = PantopusColors.error,
            modifier = Modifier.heightIn(min = 520.dp).testTag("inviteOwnerError"),
        )
    }
}

@Composable
private fun FieldFor(
    label: String,
    placeholder: String,
    keyboardType: KeyboardType,
    field: InviteOwnerField,
    state: InviteOwnerUiState,
    onChange: (InviteOwnerField, String) -> Unit,
    testTag: String,
    isRequired: Boolean,
) {
    val snapshot = state.fields[field]
    val fieldState =
        when {
            snapshot == null || !snapshot.touched -> PantopusFieldState.Default
            snapshot.error != null -> PantopusFieldState.Error(snapshot.error)
            snapshot.value.trim().isEmpty() -> PantopusFieldState.Default
            else -> PantopusFieldState.Valid
        }
    PantopusTextField(
        label = label,
        value = snapshot?.value.orEmpty(),
        onValueChange = { onChange(field, it) },
        placeholder = placeholder,
        state = fieldState,
        keyboardType = keyboardType,
        isRequired = isRequired,
        fieldTestTag = testTag,
    )
}

/**
 * RN's fast-track switch (`src/app/homes/[id]/owners/invite.tsx:98-110`),
 * copy from `constants/ownershipCopy.ts` `CO_OWNER_INVITE`. Defaults ON
 * and sends `fast_track` so the backend files the claim as a vouch.
 */
@Composable
private fun FastTrackToggleRow(
    isOn: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("inviteOwnerFastTrackToggle"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Fast track (vouch)",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Still requires verification",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = isOn,
            onCheckedChange = onCheckedChange,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appSurface,
                    checkedTrackColor = PantopusColors.primary600,
                ),
        )
    }
}

@Composable
private fun HomeContextStrip(context: InviteOwnerHomeContext) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("inviteOwnerHomeContext")
                .semantics { contentDescription = "Owner invite for ${context.title}, ${context.subtitle}" },
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
                text = context.title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = context.subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "OWNER INVITE",
            style = PantopusTextStyle.overline,
            color = PantopusColors.primary700,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.primary100)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
        )
    }
}

@Composable
private fun OwnershipSummaryCard(summary: InviteOwnershipSummary) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .testTag("inviteOwnerOwnershipSummary")
                .semantics {
                    val ownerShares = summary.owners.joinToString(", ") { "${it.name} ${it.sharePercent}%" }
                    contentDescription = "$ownerShares. ${summary.availablePercent}% available."
                }
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
            summary.owners.forEach { owner -> OwnerAvatar(owner = owner) }
        }
        Text(
            text = ownerSummaryText(summary),
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "${summary.availablePercent}% left",
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            color = if (summary.hasConflict) PantopusColors.error else PantopusColors.success,
            style = PantopusTextStyle.caption,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(if (summary.hasConflict) PantopusColors.errorBg else PantopusColors.successBg)
                    .testTag("inviteOwnerAvailablePill")
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
        )
    }
}

@Composable
private fun OwnerAvatar(owner: InviteOwnerOwnerShare) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(owner.tone.fillColor())
                .border(2.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = owner.initials,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.Bold,
            style = PantopusTextStyle.caption,
        )
    }
}

@Composable
private fun StatefulSlider(
    value: Int,
    isError: Boolean,
    onValueChange: (Int) -> Unit,
) {
    val active = if (isError) PantopusColors.error else PantopusColors.primary600
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Slider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.roundToInt().coerceIn(0, 100)) },
            valueRange = 0f..100f,
            colors =
                SliderDefaults.colors(
                    thumbColor = active,
                    activeTrackColor = active,
                    inactiveTrackColor = PantopusColors.appSurfaceSunken,
                ),
            modifier =
                Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp)
                    .testTag("inviteOwnerShareSlider")
                    .semantics { contentDescription = "Share to grant $value percent" },
        )
        Text(
            text = "$value%",
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            color = if (isError) PantopusColors.error else PantopusColors.primary700,
            style = PantopusTextStyle.small,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(if (isError) PantopusColors.errorBg else PantopusColors.primary50)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                    .semantics { contentDescription = "$value percent" },
        )
    }
}

@Composable
private fun OwnershipConflictBlock(
    state: InviteOwnerUiState,
    onSnapToAvailable: () -> Unit,
    onRebalance: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.md))
                .testTag("inviteOwnerConflictBlock")
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.error,
            )
            Text(
                text = state.conflictMessage.orEmpty(),
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
            )
        }
        Row(
            modifier = Modifier.padding(start = Spacing.s6 - 2.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ConflictAction(
                label = "Snap to ${state.availablePool}%",
                icon = PantopusIcon.Download,
                testTag = "inviteOwnerSnapButton",
                onClick = onSnapToAvailable,
            )
            ConflictAction(
                label = "Snap & Rebalance",
                icon = PantopusIcon.ArrowRight,
                testTag = "inviteOwnerRebalanceButton",
                onClick = onRebalance,
            )
        }
    }
}

@Composable
private fun ConflictAction(
    label: String,
    icon: PantopusIcon,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 48.dp)
                .clickable(onClick = onClick)
                .testTag(testTag)
                .semantics { contentDescription = label },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.small,
            color = PantopusColors.error,
            fontWeight = FontWeight.SemiBold,
        )
        PantopusIconImage(icon = icon, contentDescription = null, size = Radii.lg, tint = PantopusColors.error)
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
private fun RoleNoteEditor(
    value: String,
    maxLength: Int,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        RequiredFieldLabel(label = "What they are responsible for (optional)", required = false)
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
                    text = "e.g. Maintenance lead, deals with the super and contractors.",
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
                        .testTag("inviteOwnerRoleField")
                        .semantics { contentDescription = "Owner responsibility note" },
            )
        }
        Text(
            text = "${value.length} / $maxLength",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.fillMaxWidth().testTag("inviteOwnerRoleCharCount"),
        )
    }
}

@Composable
internal fun InviteOwnerToastView(
    toast: ToastPayload,
    modifier: Modifier = Modifier,
) {
    Toast(
        message =
            ToastMessage(
                text = toast.text,
                kind = if (toast.isError) ToastKind.Error else ToastKind.Success,
            ),
        modifier = modifier.testTag("inviteOwnerToast"),
    )
}

private fun ownerSummaryText(summary: InviteOwnershipSummary): String =
    summary.owners.joinToString(" · ") { "${it.name} ${it.sharePercent}%" }

private fun InviteOwnerTone.fillColor(): Color =
    when (this) {
        InviteOwnerTone.Personal -> PantopusColors.personal
        InviteOwnerTone.Home -> PantopusColors.home
        InviteOwnerTone.Business -> PantopusColors.business
    }
