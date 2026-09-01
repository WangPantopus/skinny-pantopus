@file:Suppress("LongMethod", "MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import app.pantopus.android.ui.components.DestructiveButton
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** The literal a user must type to arm the CTA — RN uses the same word. */
const val ACCOUNT_DELETE_CONFIRM_WORD = "DELETE"

/** RN's bullet list, verbatim (`AccountDeleteSheet.tsx:64-68`). */
private val ACCOUNT_DELETE_BULLETS =
    listOf(
        "Your profile and all personal data",
        "Your task history and reviews",
        "Your home memberships",
        "Your business profiles",
        "Your messages and connections",
    )

/**
 * T1 — the confirm gate in front of `DELETE /api/users/account`
 * (`backend/routes/users.js:3945`). Port of RN's
 * `src/components/profile/AccountDeleteSheet.tsx`, mirrored 1:1 with the
 * iOS `AccountDeleteSheet`.
 *
 * [onConfirm] does *not* delete on its own — the view-model runs a
 * device-credential re-auth first (RN's `useSensitiveActionGuard`) and
 * only then fires the request. Failures come back through [errorMessage]
 * and render in-sheet so a 409 ("finish your gigs first") stays readable
 * instead of flashing past in a toast.
 */
@Composable
fun AccountDeleteSheet(
    isDeleting: Boolean,
    errorMessage: String?,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var confirmText by rememberSaveable { mutableStateOf("") }
    val isConfirmed = remember(confirmText) { confirmText.trim().uppercase() == ACCOUNT_DELETE_CONFIRM_WORD }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s6)
                .padding(bottom = Spacing.s6)
                .testTag("accountDeleteSheet"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        WarningDisc()
        Text(
            text = "Delete your account?",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s4),
        )
        Text(
            text = "This will permanently delete your account, including:",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            ACCOUNT_DELETE_BULLETS.forEach { item -> BulletRow(item) }
        }
        Text(
            text = "This action cannot be undone.",
            style = PantopusTextStyle.body,
            color = PantopusColors.error,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        if (errorMessage != null) {
            ErrorBanner(errorMessage)
        }
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s5),
        ) {
            Text(
                text = "Type $ACCOUNT_DELETE_CONFIRM_WORD to confirm",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.padding(bottom = Spacing.s2),
            )
            PantopusTextField(
                label = "Confirmation",
                value = confirmText,
                onValueChange = { if (!isDeleting) confirmText = it },
                placeholder = ACCOUNT_DELETE_CONFIRM_WORD,
                fieldTestTag = "accountDeleteConfirmField",
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s5),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            GhostButton(
                title = "Cancel",
                onClick = onCancel,
                isEnabled = !isDeleting,
                modifier = Modifier.weight(1f).testTag("accountDeleteCancel"),
            )
            DestructiveButton(
                title = "Delete My Account",
                onClick = onConfirm,
                isLoading = isDeleting,
                isEnabled = isConfirmed && !isDeleting,
                modifier = Modifier.weight(1f).testTag("accountDeleteConfirm"),
            )
        }
    }
}

@Composable
private fun WarningDisc() {
    Box(
        modifier =
            Modifier
                .padding(top = Spacing.s5)
                .size(Spacing.s16 - Spacing.s2)
                .clip(CircleShape)
                .background(PantopusColors.errorBg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertTriangle,
            contentDescription = null,
            size = Spacing.s6 + Spacing.s1,
            tint = PantopusColors.error,
        )
    }
}

@Composable
private fun BulletRow(text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(text = "•", style = PantopusTextStyle.body, color = PantopusColors.error)
        Text(text = text, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun ErrorBanner(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s3)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(Spacing.s3)
                .testTag("accountDeleteSheetError"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = Spacing.s4,
            tint = PantopusColors.error,
        )
        Text(text = message, style = PantopusTextStyle.small, color = PantopusColors.error)
    }
}
