@file:Suppress("LongMethod", "MatchingDeclarationName")

package app.pantopus.android.core.security

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Test tags for the step-up password sheet. Mirrors iOS
 * `Features/Auth/StepUpPasswordPrompt.swift`, which uses
 * `auth.stepUp.{passwordSheet,passwordField,cancel,confirm}` — same prefix
 * family as `auth.continueAs.*`. [TITLE] and [ERROR] have no iOS
 * counterpart yet (SwiftUI addresses those two by text); they follow the
 * same naming so the identifier can simply be added there later.
 */
object StepUpTags {
    const val SHEET = "auth.stepUp.passwordSheet"
    const val TITLE = "auth.stepUp.title"
    const val PASSWORD_FIELD = "auth.stepUp.passwordField"
    const val CONFIRM = "auth.stepUp.confirm"
    const val CANCEL = "auth.stepUp.cancel"
    const val ERROR = "auth.stepUp.error"
}

/**
 * Mounts the [StepUpCoordinator] into the signed-in UI: attaches the host
 * Activity (so biometric prompts and the 403 `STEP_UP_REQUIRED`
 * interceptor can run a step-up) and renders the password sheet whenever
 * the coordinator asks for one ([StepUpCoordinator.passwordRequest]).
 *
 * Place it once, inside the signed-in branch of `PantopusNavHost` (under
 * `AppLockHost` so the lock seal still outranks the sheet).
 */
@Composable
fun StepUpHost(coordinator: StepUpCoordinator) {
    val context = LocalContext.current
    val activity = remember(context) { context.findFragmentActivity() }
    val request by coordinator.passwordRequest.collectAsStateWithLifecycle()

    DisposableEffect(activity) {
        activity?.let(coordinator::attach)
        onDispose { activity?.let(coordinator::detach) }
    }

    request?.let { pending ->
        StepUpPasswordSheet(
            request = pending,
            onSubmit = coordinator::submitPassword,
            onCancel = coordinator::cancelPassword,
        )
    }
}

/**
 * The in-app password step-up sheet (the `password` method of
 * `POST /api/auth/step-up`). Wrong password → inline error, field kept
 * focused; *Cancel* / swipe-down → the coordinator reports
 * `Outcome.Cancelled`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StepUpPasswordSheet(
    request: StepUpCoordinator.PasswordRequest,
    onSubmit: (String) -> Unit,
    onCancel: () -> Unit,
) {
    var password by remember(request.purpose) { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // A fresh attempt after a wrong password starts with an empty field.
    LaunchedEffect(request.error) {
        if (request.error != null && !request.isSubmitting) password = ""
    }

    ModalBottomSheet(
        onDismissRequest = { if (!request.isSubmitting) onCancel() },
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .padding(horizontal = Spacing.s6)
                    .padding(bottom = Spacing.s6)
                    .testTag(StepUpTags.SHEET),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ShieldCheck,
                    contentDescription = null,
                    size = Radii.xl3,
                    tint = PantopusColors.primary600,
                )
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = request.title,
                        style = PantopusTextStyle.h2,
                        color = PantopusColors.appText,
                        modifier = Modifier.testTag(StepUpTags.TITLE),
                    )
                    Text(
                        text = "Enter your password to confirm it's you.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            PantopusTextField(
                label = "Password",
                value = password,
                onValueChange = { if (!request.isSubmitting) password = it },
                isSecure = true,
                keyboardType = KeyboardType.Password,
                state =
                    request.error?.let { PantopusFieldState.Error(it) }
                        ?: PantopusFieldState.Default,
                fieldTestTag = StepUpTags.PASSWORD_FIELD,
                modifier =
                    Modifier.then(
                        if (request.error != null) Modifier.testTag(StepUpTags.ERROR) else Modifier,
                    ),
            )
            Spacer(modifier = Modifier.height(Spacing.s1))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                GhostButton(
                    title = "Cancel",
                    onClick = onCancel,
                    isEnabled = !request.isSubmitting,
                    modifier = Modifier.weight(1f).testTag(StepUpTags.CANCEL),
                )
                PrimaryButton(
                    // Same word as iOS `StepUpPasswordPrompt` — this sheet is
                    // the one surface both platforms render for `password`
                    // step-up, so the copy has to match too.
                    title = "Confirm",
                    onClick = { onSubmit(password) },
                    isLoading = request.isSubmitting,
                    isEnabled = password.isNotBlank() && !request.isSubmitting,
                    modifier = Modifier.weight(1f).testTag(StepUpTags.CONFIRM),
                )
            }
        }
    }
}
