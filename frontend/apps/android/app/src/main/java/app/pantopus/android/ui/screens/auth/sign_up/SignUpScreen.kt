@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.auth.sign_up

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DisplayMode
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.OAuthBrowserCommand
import app.pantopus.android.data.auth.OAuthProvider
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.auth.AuthLegalSentence
import app.pantopus.android.ui.screens.auth.AuthOAuthTermsLine
import app.pantopus.android.ui.screens.auth.OAuthButtonGroup
import app.pantopus.android.ui.screens.auth.openOAuthUrl
import app.pantopus.android.ui.screens.settings.legal.LegalDocument
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

object SignUpScreenTags {
    const val ROOT = "signUpScreen"
    const val ERROR_BANNER = "signUpErrorBanner"
    const val EMAIL = "signUpEmailField"
    const val PASSWORD = "signUpPasswordField"
    const val CONFIRM_PASSWORD = "signUpConfirmPasswordField"
    const val USERNAME = "signUpUsernameField"
    const val FIRST_NAME = "signUpFirstNameField"
    const val MIDDLE_NAME = "signUpMiddleNameField"
    const val LAST_NAME = "signUpLastNameField"
    const val DATE_OF_BIRTH = "signUpDateOfBirthField"
    const val PHONE = "signUpPhoneField"
    const val ADDRESS = "signUpAddressField"
    const val CITY = "signUpCityField"
    const val STATE = "signUpStateField"
    const val ZIPCODE = "signUpZipField"
    const val INVITE_CODE = "signUpInviteCodeField"
    const val INVITED_BANNER = "signUpInvitedBanner"
    const val ACCOUNT_TYPE = "signUpAccountTypePicker"
    const val TERMS = "signUpTermsCheckbox"
    const val STRENGTH = "signUpPasswordStrengthMeter"
    const val GOOGLE_BUTTON = "signUpGoogleButton"
    const val APPLE_BUTTON = "signUpAppleButton"
    const val LEGAL_TERMS_LINE = "signUpLegalTermsLine"
    const val TERMS_TOGGLE = "signUpTermsCheckboxToggle"
    const val TERMS_LINKS = "signUpTermsLinks"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignUpScreen(
    onClose: () -> Unit = {},
    onOpenLegal: (LegalDocument) -> Unit = {},
    onSuccess: (String) -> Unit = {},
    viewModel: SignUpViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(state.didSucceed) {
        if (state.didSucceed) {
            val email = state.email.trim().lowercase()
            viewModel.acknowledgeSuccess()
            onSuccess(email)
        }
    }

    LaunchedEffect(Unit) {
        viewModel.browserAuth.collect { command ->
            when (command) {
                is OAuthBrowserCommand.Open -> openOAuthUrl(context, command.url)
            }
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_PAUSE -> viewModel.onHostPaused()
                    Lifecycle.Event.ON_RESUME -> viewModel.onHostResumed()
                    else -> Unit
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    FormShell(
        title = "Create account",
        rightActionLabel = null,
        bottomActionLabel = "Create account",
        isValid = state.isValid,
        isDirty = true,
        isSaving = state.isSubmitting,
        onClose = onClose,
        onCommit = viewModel::submit,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().testTag(SignUpScreenTags.ROOT),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            state.topLevelError?.let { error ->
                ErrorBanner(
                    error = error,
                    onDismiss = viewModel::clearTopLevelError,
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s4)
                            .testTag(SignUpScreenTags.ERROR_BANNER),
                )
            }

            if (viewModel.arrivedByInvite) {
                InvitedNote()
            }

            OAuthButtonGroup(
                isLoading = state.isSubmitting,
                onGoogle = { viewModel.signInWithOAuth(OAuthProvider.Google) },
                onApple = { viewModel.signInWithOAuth(OAuthProvider.Apple) },
                googleTag = SignUpScreenTags.GOOGLE_BUTTON,
                appleTag = SignUpScreenTags.APPLE_BUTTON,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )

            AuthOAuthTermsLine(
                testTag = SignUpScreenTags.LEGAL_TERMS_LINE,
                onOpenLegal = onOpenLegal,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )

            FormFieldGroup("Account") {
                FieldWithLiveError(state, SignUpField.Email) {
                    PantopusTextField(
                        label = "Email",
                        value = state.email,
                        onValueChange = viewModel::onEmailChange,
                        placeholder = "you@email.com",
                        state = fieldState(state, SignUpField.Email),
                        keyboardType = KeyboardType.Email,
                        fieldTestTag = SignUpScreenTags.EMAIL,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PasswordField(
                        label = "Password",
                        value = state.password,
                        onValueChange = viewModel::onPasswordChange,
                        state = fieldState(state, SignUpField.Password),
                        testTag = SignUpScreenTags.PASSWORD,
                    )
                    PasswordStrengthMeter(state)
                }
                PasswordField(
                    label = "Confirm password",
                    value = state.confirmPassword,
                    onValueChange = viewModel::onConfirmPasswordChange,
                    state = fieldState(state, SignUpField.ConfirmPassword),
                    testTag = SignUpScreenTags.CONFIRM_PASSWORD,
                )
            }

            FormFieldGroup("Profile") {
                FieldWithLiveError(state, SignUpField.Username) {
                    PantopusTextField(
                        label = "Username",
                        value = state.username,
                        onValueChange = viewModel::onUsernameChange,
                        placeholder = "your_handle",
                        state = fieldState(state, SignUpField.Username),
                        fieldTestTag = SignUpScreenTags.USERNAME,
                    )
                }
                FieldWithLiveError(state, SignUpField.FirstName) {
                    PantopusTextField(
                        label = "First name",
                        value = state.firstName,
                        onValueChange = viewModel::onFirstNameChange,
                        placeholder = "Maria",
                        state = fieldState(state, SignUpField.FirstName),
                        fieldTestTag = SignUpScreenTags.FIRST_NAME,
                    )
                }
                PantopusTextField(
                    label = "Middle name (optional)",
                    value = state.middleName,
                    onValueChange = viewModel::onMiddleNameChange,
                    placeholder = "Optional",
                    fieldTestTag = SignUpScreenTags.MIDDLE_NAME,
                )
                FieldWithLiveError(state, SignUpField.LastName) {
                    PantopusTextField(
                        label = "Last name",
                        value = state.lastName,
                        onValueChange = viewModel::onLastNameChange,
                        placeholder = "Kowalski",
                        state = fieldState(state, SignUpField.LastName),
                        fieldTestTag = SignUpScreenTags.LAST_NAME,
                    )
                }
                DateOfBirthField(state = state, onChange = viewModel::onDateOfBirthChange)
            }

            FormFieldGroup("Address") {
                FieldWithLiveError(state, SignUpField.Address) {
                    PantopusTextField(
                        label = "Street address",
                        value = state.address,
                        onValueChange = viewModel::onAddressChange,
                        placeholder = "123 Main St",
                        state = fieldState(state, SignUpField.Address),
                        fieldTestTag = SignUpScreenTags.ADDRESS,
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Box(modifier = Modifier.weight(2f)) {
                        FieldWithLiveError(state, SignUpField.City) {
                            PantopusTextField(
                                label = "City",
                                value = state.city,
                                onValueChange = viewModel::onCityChange,
                                placeholder = "Cambridge",
                                state = fieldState(state, SignUpField.City),
                                fieldTestTag = SignUpScreenTags.CITY,
                            )
                        }
                    }
                    Box(modifier = Modifier.width(80.dp)) {
                        FieldWithLiveError(state, SignUpField.State) {
                            PantopusTextField(
                                label = "State",
                                value = state.state,
                                onValueChange = viewModel::onStateChange,
                                placeholder = "MA",
                                state = fieldState(state, SignUpField.State),
                                fieldTestTag = SignUpScreenTags.STATE,
                            )
                        }
                    }
                    Box(modifier = Modifier.width(100.dp)) {
                        FieldWithLiveError(state, SignUpField.Zipcode) {
                            PantopusTextField(
                                label = "ZIP",
                                value = state.zipcode,
                                onValueChange = viewModel::onZipcodeChange,
                                placeholder = "02139",
                                state = fieldState(state, SignUpField.Zipcode),
                                keyboardType = KeyboardType.Number,
                                fieldTestTag = SignUpScreenTags.ZIPCODE,
                            )
                        }
                    }
                }
            }

            FormFieldGroup("Account type") {
                AccountTypePicker(
                    selection = state.accountType,
                    onSelect = viewModel::onAccountTypeChange,
                )
            }

            FormFieldGroup("Optional") {
                FieldWithLiveError(state, SignUpField.PhoneNumber) {
                    PantopusTextField(
                        label = "Phone (optional)",
                        value = state.phoneNumber,
                        onValueChange = viewModel::onPhoneChange,
                        placeholder = "+15555550123",
                        state = fieldState(state, SignUpField.PhoneNumber),
                        keyboardType = KeyboardType.Phone,
                        fieldTestTag = SignUpScreenTags.PHONE,
                    )
                }
                PantopusTextField(
                    label = "Invite code (optional)",
                    value = state.inviteCode,
                    onValueChange = viewModel::onInviteCodeChange,
                    placeholder = "abc123",
                    fieldTestTag = SignUpScreenTags.INVITE_CODE,
                )
            }

            TermsCheckbox(
                isOn = state.agreedToTerms,
                onToggle = viewModel::onTermsToggle,
                onOpenLegal = onOpenLegal,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .testTag(SignUpScreenTags.TERMS),
            )
        }
    }
}

/**
 * RN swaps the sign-up subtitle for the invited copy when the register route
 * carries `invite_code`
 * (`pantopus/frontend/apps/mobile/src/app/(auth)/register.tsx:174`). Mirrors
 * iOS `SignUpView.invitedNote`.
 */
@Composable
private fun InvitedNote() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .padding(Spacing.s3)
                .testTag(SignUpScreenTags.INVITED_BANNER),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.UserPlus,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = SignUpViewModel.INVITED_MESSAGE,
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun fieldState(
    state: SignUpViewModel.UiState,
    field: SignUpField,
): PantopusFieldState {
    val active = state.fieldErrors[field]
    if (active != null) return PantopusFieldState.Error(active)
    if (state.hasAttemptedSubmit) {
        state.validate(field)?.let { return PantopusFieldState.Error(it) }
    }
    return PantopusFieldState.Default
}

@Composable
@Suppress("UnusedParameter")
private fun FieldWithLiveError(
    state: SignUpViewModel.UiState,
    field: SignUpField,
    content: @Composable () -> Unit,
) {
    // PantopusTextField already renders the error from its state. This
    // wrapper exists for parity with iOS — both platforms gate the live
    // error on `hasAttemptedSubmit`.
    content()
}

/**
 * Token-styled segmented control for Personal / Business. Local to SignUp
 * for now; promote to `ui/components/` when a second screen needs it.
 */
@Composable
private fun AccountTypePicker(
    selection: SignUpAccountTypeChoice,
    onSelect: (SignUpAccountTypeChoice) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(
                    color = PantopusColors.appSurfaceSunken,
                    shape = RoundedCornerShape(Radii.md),
                ).padding(Spacing.s1)
                .testTag(SignUpScreenTags.ACCOUNT_TYPE),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s0),
    ) {
        SignUpAccountTypeChoice.values().forEach { choice ->
            val isSelected = choice == selection
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(36.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(
                            if (isSelected) PantopusColors.primary600 else PantopusColors.appSurface,
                        ).clickable { onSelect(choice) }
                        .semantics { contentDescription = choice.label },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = choice.label,
                    style = PantopusTextStyle.small,
                    color =
                        if (isSelected) PantopusColors.appTextInverse else PantopusColors.appText,
                )
            }
        }
    }
}

@Composable
private fun PasswordStrengthMeter(state: SignUpViewModel.UiState) {
    val color =
        when (state.passwordStrength) {
            1 -> PantopusColors.error
            2 -> PantopusColors.warning
            3 -> PantopusColors.success
            else -> PantopusColors.appBorder
        }
    Column(
        modifier = Modifier.testTag(SignUpScreenTags.STRENGTH),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            repeat(3) { index ->
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(5.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(
                                if (index < state.passwordStrength) color else PantopusColors.appSurfaceSunken,
                            ),
                )
            }
            Text(
                text = state.passwordStrengthLabel,
                style = PantopusTextStyle.caption,
                color = color,
                modifier = Modifier.width(48.dp),
            )
        }
        Text(
            text = "Min 8 chars · letters + numbers. Symbols make it stronger.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * Password input with show/hide toggle. Local to auth flows for now.
 */
@Composable
fun PasswordField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    state: PantopusFieldState,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    var visible by remember { mutableStateOf(false) }
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        borderState(state),
                        RoundedCornerShape(Radii.md),
                    ).padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                visualTransformation =
                    if (visible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag(testTag),
            )
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clickable { visible = !visible }
                        .semantics {
                            contentDescription = if (visible) "Hide password" else "Show password"
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Eye,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        if (state is PantopusFieldState.Error) {
            Text(
                text = state.message,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

private fun borderState(state: PantopusFieldState) =
    BorderStroke(
        width = 1.dp,
        color =
            when (state) {
                is PantopusFieldState.Error -> PantopusColors.error
                PantopusFieldState.Valid -> PantopusColors.success
                PantopusFieldState.Default -> PantopusColors.appBorder
            },
    )

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateOfBirthField(
    state: SignUpViewModel.UiState,
    onChange: (LocalDate?) -> Unit,
) {
    var showPicker by remember { mutableStateOf(false) }
    val displayText =
        state.dateOfBirth?.toString() ?: "Tap to choose"
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Date of birth",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        borderState(fieldState(state, SignUpField.DateOfBirth)),
                        RoundedCornerShape(Radii.md),
                    ).clickable { showPicker = true }
                    .padding(horizontal = Spacing.s3)
                    .testTag(SignUpScreenTags.DATE_OF_BIRTH),
            contentAlignment = Alignment.CenterStart,
        ) {
            Text(
                text = displayText,
                style = PantopusTextStyle.body,
                color =
                    if (state.dateOfBirth != null) {
                        PantopusColors.appText
                    } else {
                        PantopusColors.appTextMuted
                    },
            )
        }
        val live = fieldState(state, SignUpField.DateOfBirth)
        if (live is PantopusFieldState.Error) {
            Text(
                text = live.message,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
    if (showPicker) {
        val today = LocalDate.now()
        val maxDate = today.minusYears(18)
        val datePickerState =
            rememberDatePickerState(
                initialSelectedDateMillis =
                    state.dateOfBirth
                        ?.atStartOfDay(ZoneOffset.UTC)
                        ?.toInstant()
                        ?.toEpochMilli()
                        ?: today.minusYears(25).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
                initialDisplayMode = DisplayMode.Picker,
                selectableDates = MaxEighteenDates(maxDateMillis = maxDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()),
            )
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val millis = datePickerState.selectedDateMillis
                    if (millis != null) {
                        val chosen = Instant.ofEpochMilli(millis).atOffset(ZoneOffset.UTC).toLocalDate()
                        onChange(chosen)
                    }
                    showPicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showPicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
private class MaxEighteenDates(
    private val maxDateMillis: Long,
) : androidx.compose.material3.SelectableDates {
    override fun isSelectableDate(utcTimeMillis: Long): Boolean = utcTimeMillis <= maxDateMillis

    override fun isSelectableYear(year: Int): Boolean = year <= LocalDate.now().year
}

/**
 * Terms agreement checkbox with individually tappable Terms / Privacy
 * links.
 *
 * The checkbox and the sentence are **separate** hit targets: tapping a
 * link opens the A19 document and leaves [isOn] untouched, exactly like
 * RN's register screen, where the checkbox is its own `TouchableOpacity`
 * and the two link runs carry their own `onPress`
 * (`src/app/(auth)/register.tsx:303-341`). Wrapping the whole row in one
 * clickable (the previous native shape) is what made the documents
 * unreachable before sign-in. Mirrors iOS `TermsCheckbox`.
 */
@Composable
private fun TermsCheckbox(
    isOn: Boolean,
    onToggle: () -> Unit,
    onOpenLegal: (LegalDocument) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(if (isOn) PantopusColors.primary600 else PantopusColors.appSurface)
                    .border(
                        BorderStroke(
                            width = 1.5.dp,
                            color = if (isOn) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        ),
                        RoundedCornerShape(Radii.xs),
                    )
                    .clickable(onClick = onToggle)
                    .testTag(SignUpScreenTags.TERMS_TOGGLE)
                    .semantics {
                        contentDescription =
                            if (isOn) "Agreed to terms and privacy" else "Not agreed to terms and privacy"
                    },
            contentAlignment = Alignment.Center,
        ) {
            if (isOn) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        AuthLegalSentence(
            lead = "I agree to the ",
            termsLabel = "Terms",
            privacyLabel = "Privacy Policy",
            onOpenLegal = onOpenLegal,
            testTag = SignUpScreenTags.TERMS_LINKS,
            modifier = Modifier.weight(1f),
            style = PantopusTextStyle.small,
            plainColor = PantopusColors.appText,
        )
    }
}

@Composable
fun ErrorBanner(
    error: AuthError,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .background(PantopusColors.errorBg, RoundedCornerShape(Radii.md))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.error,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = "Couldn't complete that",
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
            )
            Text(
                text = error.message,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
        Box(
            modifier =
                Modifier
                    .clickable(onClick = onDismiss)
                    .semantics { contentDescription = "Dismiss error" },
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.error,
            )
        }
    }
}
