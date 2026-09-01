@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.settings.password

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PasswordStrength
import app.pantopus.android.ui.components.StrengthMeter
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.settings.password.PasswordChangeViewModel.FieldKey
import app.pantopus.android.ui.screens.settings.password.PasswordChangeViewModel.FormBannerContent
import app.pantopus.android.ui.screens.settings.password.components.ContextBand
import app.pantopus.android.ui.screens.settings.password.components.FormBanner
import app.pantopus.android.ui.screens.settings.password.components.FormBannerTone
import app.pantopus.android.ui.screens.settings.password.components.PasswordEntryField
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * A13.14 — Settings → Change password (reshape). Mirrors the iOS
 * `PasswordChangeView` 1:1.
 *
 * Bespoke shell rather than `FormShell`: the top bar carries only a back
 * chevron + title (no top-right Save), and the commit lives inline at the
 * bottom of the body as an `Update password` button. A `ContextBand` pins
 * under the top bar; the body stacks the "Verify it's you" + "Choose a new
 * one" sections, a `StrengthMeter`, the inline CTA, a Cancel link, and an
 * info chip. A `FormBanner` appears at the top after a rejected submit.
 */
@Composable
fun PasswordChangeScreen(
    onBack: () -> Unit = {},
    viewModel: PasswordChangeViewModel = hiltViewModel(),
) {
    val fields by viewModel.fields.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val shouldDismiss by viewModel.shouldDismiss.collectAsStateWithLifecycle()
    val hasPassword by viewModel.hasPassword.collectAsStateWithLifecycle()
    val formError by viewModel.formError.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(shouldDismiss) {
        if (shouldDismiss) {
            viewModel.acknowledgeDismiss()
            delay(700)
            onBack()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("passwordChange"),
    ) {
        PasswordChangeContent(
            state =
                PasswordChangeLoadedState(
                    email = viewModel.accountEmail,
                    lastChanged = viewModel.lastChangedLabel,
                    requiresCurrent = hasPassword,
                    fields = fields,
                    strength = viewModel.strength,
                    formError = formError,
                    isCurrentValid = viewModel.isCurrentValid,
                    isNewValid = viewModel.isNewValid,
                    isConfirmValid = viewModel.isConfirmValid,
                    isValid = viewModel.isValid,
                    isSaving = isSaving,
                ),
            onBack = onBack,
            onUpdate = viewModel::update,
            onSubmit = viewModel::save,
            onReset = viewModel::requestResetLink,
        )

        toast?.let { message ->
            Toast(
                message = ToastMessage(text = message, kind = ToastKind.Success),
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10)
                        .testTag("passwordChangeToast"),
            )
        }
    }
}

internal data class PasswordChangeLoadedState(
    val email: String,
    val lastChanged: String,
    val requiresCurrent: Boolean,
    val fields: Map<FieldKey, FormFieldState>,
    val strength: PasswordStrength,
    val formError: FormBannerContent?,
    val isCurrentValid: Boolean,
    val isNewValid: Boolean,
    val isConfirmValid: Boolean,
    val isValid: Boolean,
    val isSaving: Boolean,
)

@Composable
internal fun PasswordChangeContent(
    state: PasswordChangeLoadedState,
    onBack: () -> Unit,
    onUpdate: (FieldKey, String) -> Unit,
    onSubmit: () -> Unit,
    onReset: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PasswordChangeTopBar(onBack = onBack)
        ContextBand(email = state.email, lastChanged = state.lastChanged)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            state.formError?.let { banner ->
                FormBanner(tone = FormBannerTone.Error, title = banner.title, message = banner.message)
            }
            if (state.requiresCurrent) {
                VerifySection(state = state, onUpdate = onUpdate, onReset = onReset)
            }
            ChooseNewSection(state = state, onUpdate = onUpdate)
            Actions(state = state, onSubmit = onSubmit, onBack = onBack)
            if (state.formError == null) {
                InfoChip()
            }
        }
    }
}

@Composable
private fun PasswordChangeTopBar(onBack: () -> Unit) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .background(PantopusColors.appSurface),
        ) {
            Text(
                text = "Change password",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                modifier = Modifier.align(Alignment.Center).semantics { heading() },
            )
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .size(44.dp)
                        .clickable(onClick = onBack)
                        .testTag("passwordChangeBack")
                        .semantics { contentDescription = "Back" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
    }
}

@Composable
private fun VerifySection(
    state: PasswordChangeLoadedState,
    onUpdate: (FieldKey, String) -> Unit,
    onReset: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Overline("Verify it's you")
        PasswordEntryField(
            label = "Current password",
            value = state.fields[FieldKey.Current]?.value.orEmpty(),
            onValueChange = { onUpdate(FieldKey.Current, it) },
            state = fieldState(state.fields[FieldKey.Current], state.isCurrentValid),
            isRequired = true,
            leftIcon = PantopusIcon.Lock,
            fieldTestTag = "field_current",
        )
        if (state.fields[FieldKey.Current]?.error != null) {
            Row(
                modifier =
                    Modifier
                        .clickable(onClick = onReset)
                        .testTag("passwordChangeResetLink"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Mail,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Email me a reset link instead",
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun ChooseNewSection(
    state: PasswordChangeLoadedState,
    onUpdate: (FieldKey, String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Overline("Choose a new one")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PasswordEntryField(
                label = "New password",
                value = state.fields[FieldKey.New]?.value.orEmpty(),
                onValueChange = { onUpdate(FieldKey.New, it) },
                state = fieldState(state.fields[FieldKey.New], state.isNewValid),
                isRequired = true,
                revealedByDefault = state.isNewValid,
                fieldTestTag = "field_new",
            )
            StrengthMeter(strength = state.strength)
        }
        PasswordEntryField(
            label = "Confirm new password",
            value = state.fields[FieldKey.Confirm]?.value.orEmpty(),
            onValueChange = { onUpdate(FieldKey.Confirm, it) },
            state = fieldState(state.fields[FieldKey.Confirm], state.isConfirmValid),
            isRequired = true,
            helper = if (state.isConfirmValid) "Matches new password." else null,
            fieldTestTag = "field_confirm",
        )
    }
}

@Composable
private fun Actions(
    state: PasswordChangeLoadedState,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 50.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (state.isValid) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                    .clickable(enabled = state.isValid && !state.isSaving, onClick = onSubmit)
                    .testTag("passwordChangeUpdateButton")
                    .semantics { contentDescription = "Update password" },
            contentAlignment = Alignment.Center,
        ) {
            if (state.isSaving) {
                CircularProgressIndicator(
                    color = PantopusColors.appTextInverse,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp),
                )
            } else {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PantopusIconImage(
                        icon = if (state.isValid) PantopusIcon.KeyRound else PantopusIcon.Lock,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = if (state.isValid) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                    )
                    Text(
                        text = "Update password",
                        style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
                        color = if (state.isValid) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 38.dp)
                    .clickable(onClick = onBack)
                    .testTag("passwordChangeCancel"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Cancel",
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textDecoration = TextDecoration.Underline),
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun InfoChip() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(width = 1.dp, color = PantopusColors.primary200, shape = RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("passwordChangeInfoChip"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "You'll be signed out of other devices after updating.",
            style = TextStyle(fontSize = 11.5.sp),
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun Overline(title: String) {
    Text(
        text = title.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.semantics { heading() },
    )
}

private fun fieldState(
    snapshot: FormFieldState?,
    valid: Boolean,
): PantopusFieldState {
    val error = snapshot?.error
    return when {
        error != null -> PantopusFieldState.Error(error)
        valid -> PantopusFieldState.Valid
        else -> PantopusFieldState.Default
    }
}
