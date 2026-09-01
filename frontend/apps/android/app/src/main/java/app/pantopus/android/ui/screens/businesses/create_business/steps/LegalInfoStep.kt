@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessUiState
import app.pantopus.android.ui.screens.businesses.create_business.MIN_BUSINESS_USERNAME_LENGTH
import app.pantopus.android.ui.screens.businesses.create_business.UsernameCheckStatus
import app.pantopus.android.ui.screens.shared.wizard.blocks.FormFieldsBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * Create Business step 2 — Basic info Form (name, username, email,
 * optional description). Composed with Wizard + Form tokens.
 */
@Composable
fun LegalInfoStep(
    state: CreateBusinessUiState,
    onNameChange: (String) -> Unit,
    onUsernameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
) {
    BusinessIdentityChip()
    HeadlineBlock("Basic info")
    SubcopyBlock("Tell us about your business. Username must be unique.")
    FormFieldsBlock {
        PantopusTextField(
            label = "Business name",
            value = state.businessName,
            onValueChange = onNameChange,
            placeholder = "My Business",
            isRequired = true,
            fieldTestTag = "createBusiness_name",
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusTextField(
                label = "Username",
                value = state.username,
                onValueChange = onUsernameChange,
                placeholder = "mybusiness",
                state = usernameFieldState(state.usernameStatus),
                isRequired = true,
                fieldTestTag = "createBusiness_username",
            )
            UsernameStatusRow(username = state.username, status = state.usernameStatus)
        }
        PantopusTextField(
            label = "Email",
            value = state.email,
            onValueChange = onEmailChange,
            placeholder = "business@email.com",
            isRequired = true,
            keyboardType = KeyboardType.Email,
            fieldTestTag = "createBusiness_email",
        )
        PantopusTextField(
            label = "Description",
            value = state.description,
            onValueChange = onDescriptionChange,
            placeholder = "What does your business do?",
            fieldTestTag = "createBusiness_description",
        )
    }
    state.submitError?.let { error ->
        Text(
            text = error,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("createBusinessSubmitError"),
        )
    }
}

@Composable
private fun UsernameStatusRow(
    username: String,
    status: UsernameCheckStatus,
) {
    if (username.length < MIN_BUSINESS_USERNAME_LENGTH) return
    when (status) {
        UsernameCheckStatus.Checking -> {
            Text(
                text = "Checking…",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        UsernameCheckStatus.Available -> {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CheckCircle,
                    contentDescription = null,
                    size = Spacing.s3 + Spacing.s1,
                    tint = PantopusColors.success,
                )
                Text(
                    text = "Available",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.success,
                )
            }
        }
        is UsernameCheckStatus.Unavailable -> {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.XCircle,
                    contentDescription = null,
                    size = Spacing.s3 + Spacing.s1,
                    tint = PantopusColors.error,
                )
                Text(
                    text = usernameReasonLabel(status.reason),
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                )
            }
        }
        UsernameCheckStatus.Idle -> Unit
    }
}

private fun usernameFieldState(status: UsernameCheckStatus): PantopusFieldState =
    when (status) {
        UsernameCheckStatus.Available -> PantopusFieldState.Valid
        is UsernameCheckStatus.Unavailable ->
            PantopusFieldState.Error(usernameReasonLabel(status.reason))
        UsernameCheckStatus.Idle, UsernameCheckStatus.Checking -> PantopusFieldState.Default
    }

private fun usernameReasonLabel(reason: String?): String =
    when (reason) {
        "reserved" -> "Reserved username"
        "taken" -> "Already taken"
        else -> "Invalid username"
    }
