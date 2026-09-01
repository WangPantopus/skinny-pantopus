@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.owners.transfer

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.homes.owners.transfer.components.BiometricConfirmSheet
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Test tag on the Transfer Ownership form root. */
const val TRANSFER_OWNERSHIP_FORM_TAG = "transferOwnershipForm"

@Composable
fun TransferOwnershipScreen(
    onBack: () -> Unit,
    viewModel: TransferOwnershipViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.load() }

    val biometryLabel =
        remember(context) {
            val manager = BiometricManager.from(context)
            when (manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
                BiometricManager.BIOMETRIC_SUCCESS -> "Biometrics"
                else -> "Passcode"
            }
        }

    LaunchedEffect(biometryLabel) {
        viewModel.setBiometryLabel(biometryLabel)
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
            onBack()
        }
    }

    val authenticate: () -> Unit = {
        val fragmentActivity = context.findFragmentActivity()
        if (fragmentActivity == null) {
            viewModel.handleBiometricResult(
                success = false,
                errorMessage = "Biometric authentication isn't available.",
            )
        } else {
            viewModel.requestBiometric()
            launchBiometric(fragmentActivity, state) { success, message ->
                viewModel.handleBiometricResult(success, message)
            }
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(TRANSFER_OWNERSHIP_FORM_TAG),
    ) {
        TransferOwnershipLoaded(
            state = state,
            onBack = onBack,
            onRecipientChange = viewModel::updateRecipientEmail,
            onRecipientClear = viewModel::clearRecipientEmail,
            onConfirmationChange = viewModel::updateConfirmation,
            onArmCta = viewModel::presentConfirmSheet,
            onRetry = viewModel::refresh,
        )

        state.toast?.let { toast ->
            Toast(
                message =
                    ToastMessage(
                        text = toast.text,
                        kind = if (toast.isError) ToastKind.Error else ToastKind.Success,
                    ),
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s12)
                        .testTag("transferOwnershipToast"),
            )
        }

        if (state.sheetPhase != ConfirmSheetPhase.Hidden) {
            ConfirmOverlay(
                state = state,
                onCancel = viewModel::dismissConfirmSheet,
                onConfirm = authenticate,
            )
        }
    }
}

/** Snapshot-friendly loaded form surface. */
@Composable
internal fun TransferOwnershipLoaded(
    state: TransferOwnershipUiState,
    onBack: () -> Unit,
    onRecipientChange: (String) -> Unit,
    onRecipientClear: () -> Unit,
    onConfirmationChange: (String) -> Unit,
    onArmCta: () -> Unit,
    onRetry: () -> Unit,
) {
    FormShell(
        title = "Transfer ownership",
        leading = FormShellLeading.Back,
        rightActionLabel = null,
        isValid = state.isReadyToCommit,
        isDirty = state.isDirty,
        onClose = onBack,
        onCommit = onArmCta,
        stickyBottom = { StickyCta(state = state, onTap = onArmCta) },
    ) {
        when (val context = state.contextState) {
            is TransferContextState.Loading -> HomeStripSkeleton()
            is TransferContextState.Error -> TransferLoadError(message = context.message, onRetry = onRetry)
            is TransferContextState.Loaded ->
                HomeStrip(
                    title = state.homeTitle,
                    address = state.homeAddress,
                    ownerSummary = state.ownerSummary,
                )
        }
        FormFieldGroup(title = "Recipient") {
            PantopusTextField(
                label = "Buyer's email",
                value = state.recipientField.value,
                onValueChange = onRecipientChange,
                placeholder = "buyer@example.com",
                state = state.recipientFieldState,
                isRequired = true,
                keyboardType = KeyboardType.Email,
                fieldTestTag = "field_recipientEmail",
            )
            if (state.recipientIsValid) {
                RecipientCard(
                    email = state.recipientEmail,
                    initials = state.recipientInitials,
                    onClear = onRecipientClear,
                )
            }
        }
        FormFieldGroup(title = "Confirmation") {
            ConfirmationField(
                state = state,
                onChange = onConfirmationChange,
            )
            WarningBlock(text = state.warningCopy)
        }
    }
}

@Composable
private fun HomeStrip(
    title: String,
    address: String,
    ownerSummary: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md + 2.dp))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2 + 2.dp)
                .semantics {
                    contentDescription = "$address, $ownerSummary, transfer is irreversible"
                }.testTag("transferHomeStrip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(PantopusColors.success, PantopusColors.homeDark),
                        ),
                    ),
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
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text = ownerSummary,
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.warningLight.copy(alpha = 0.7f))
                    .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.xs))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertTriangle,
                contentDescription = null,
                size = 9.dp,
                tint = PantopusColors.warning,
            )
            Text(
                text = "IRREVERSIBLE",
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
                color = PantopusColors.warning,
            )
        }
    }
}

@Composable
private fun HomeStripSkeleton() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(PantopusColors.appSurfaceRaised)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2 + 2.dp)
                .testTag("transferHomeStripSkeleton"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
    ) {
        Shimmer(width = 32.dp, height = 32.dp, cornerRadius = 9.dp)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Shimmer(width = 140.dp, height = 11.dp, cornerRadius = Radii.xs)
            Shimmer(width = 96.dp, height = 9.dp, cornerRadius = Radii.xs)
        }
    }
}

@Composable
private fun TransferLoadError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md + 2.dp))
                .padding(Spacing.s3)
                .testTag("transferOwnershipLoadError"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Couldn't load this home",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = message,
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Retry",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .clickable(onClick = onRetry)
                    .testTag("transferOwnershipRetry"),
        )
    }
}

@Composable
private fun RecipientCard(
    email: String,
    initials: String,
    onClear: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.5.dp, PantopusColors.primary600, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3 + 2.dp)
                .semantics { contentDescription = "Transfer recipient $email" }
                .testTag("recipientCard"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            listOf(PantopusColors.business, PantopusColors.businessDark),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = email,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text =
                    "We'll notify this address. If they don't have a Pantopus account yet, " +
                        "the claim waits for them to sign up.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "Change",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .clickable(onClick = onClear)
                    .testTag("recipientClearButton"),
        )
    }
}

@Composable
private fun ConfirmationField(
    state: TransferOwnershipUiState,
    onChange: (String) -> Unit,
) {
    val borderColor =
        when (state.confirmationFieldState) {
            PantopusFieldState.Valid -> PantopusColors.success
            else -> PantopusColors.appBorder
        }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Type ",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
            Text(
                text = state.confirmationPhrase,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(3.dp))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = 5.dp, vertical = 1.dp),
            )
            Text(
                text = " to confirm",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
            Text(
                text = "*",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.error,
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        if (state.confirmationMatches) 2.dp else 1.dp,
                        borderColor,
                        RoundedCornerShape(Radii.md),
                    ).padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            BasicTextField(
                value = state.confirmationField.value,
                onValueChange = onChange,
                singleLine = true,
                textStyle =
                    TextStyle(
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace,
                        color = PantopusColors.appText,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions =
                    KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        capitalization = KeyboardCapitalization.Characters,
                        autoCorrectEnabled = false,
                    ),
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("field_confirmationPhrase")
                        .semantics { contentDescription = "Type ${state.confirmationPhrase} to confirm" },
            )
            if (state.confirmationMatches) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.success,
                )
            }
        }
    }
}

@Composable
private fun WarningBlock(text: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md + 2.dp))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2 + 2.dp)
                .testTag("transferIrreversibleWarning"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.warning,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(
            text = text,
            fontSize = 11.5.sp,
            color = PantopusColors.warning,
        )
    }
}

@Composable
private fun StickyCta(
    state: TransferOwnershipUiState,
    onTap: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .padding(bottom = Spacing.s6 + 4.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(
                        if (state.isReadyToCommit) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                    ).clickable(enabled = state.isReadyToCommit, onClick = onTap)
                    .semantics { contentDescription = state.ctaLabel }
                    .testTag("transferOwnershipCTA"),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRightLeft,
                    contentDescription = null,
                    size = 17.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = state.ctaLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                    maxLines = 1,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Lock,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Confirmed with ${state.biometryLabel} after tap",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun ConfirmOverlay(
    state: TransferOwnershipUiState,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appText.copy(alpha = 0.5f))
                .pointerInput(Unit) {
                    // Block taps from passing through to the form behind the scrim.
                }.clickable(onClick = onCancel)
                .semantics { contentDescription = "Confirmation sheet scrim" },
        verticalArrangement = Arrangement.Bottom,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = Radii.xl2, topEnd = Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .clickable(enabled = false, onClick = {}),
        ) {
            state.biometricErrorMessage?.let { message ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(PantopusColors.errorBg)
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                            .testTag("biometricConfirmError"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.error,
                    )
                    Text(
                        text = message,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.error,
                    )
                }
            }
            BiometricConfirmSheet(
                parties = state.confirmSheetParties,
                recipientName = state.recipientEmail,
                homeAddress = state.homeAddress,
                coOwnerNames = state.coOwnerNames,
                timestamp = state.confirmationTimestamp,
                biometryLabel = state.biometryLabel,
                isAuthenticating = state.sheetPhase == ConfirmSheetPhase.Authenticating,
                onCancel = onCancel,
                onConfirm = onConfirm,
            )
        }
    }
}

/**
 * Trigger the platform BiometricPrompt with the strong-biometric class
 * plus device-credential (PIN / pattern / passcode) fallback. The
 * caller-supplied callback runs on the main thread.
 */
private fun launchBiometric(
    activity: FragmentActivity,
    state: TransferOwnershipUiState,
    onResult: (Boolean, String?) -> Unit,
) {
    val executor = ContextCompat.getMainExecutor(activity)
    val prompt =
        BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(
                    errorCode: Int,
                    errString: CharSequence,
                ) {
                    onResult(false, errString.toString())
                }

                override fun onAuthenticationFailed() {
                    onResult(false, "Authentication failed. Try again.")
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onResult(true, null)
                }
            },
        )
    val info =
        BiometricPrompt.PromptInfo.Builder()
            .setTitle("Final confirmation")
            .setSubtitle("Confirm ownership transfer to ${state.recipientEmail}")
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL,
            ).build()
    prompt.authenticate(info)
}

private fun android.content.Context.findFragmentActivity(): FragmentActivity? {
    var ctx: android.content.Context? = this
    while (ctx is android.content.ContextWrapper) {
        if (ctx is FragmentActivity) return ctx
        ctx = ctx.baseContext
    }
    return null
}
