@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.auth.auth_error

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

object AuthErrorScreenTags {
    const val ROOT = "authErrorScreen"
    const val RETRY = "authErrorRetryButton"
    const val BACK = "authErrorBackButton"
}

/**
 * Full-screen auth error surface. Headline + body sourced from
 * [AuthErrorViewModel.copy]. Retryable errors expose the "Try again" CTA;
 * non-retryable degrades to a "Go back" only.
 */
@Composable
fun AuthErrorScreen(
    error: AuthError = AuthError.Unknown,
    onRetry: (() -> Unit)? = null,
    onBack: () -> Unit = {},
    viewModel: AuthErrorViewModel = hiltViewModel(),
) {
    val copy = remember(error) { AuthErrorViewModel.copy(error) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s5, vertical = Spacing.s5)
                .testTag(AuthErrorScreenTags.ROOT),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Spacer(modifier = Modifier.weight(1f))

        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 56.dp,
            tint = PantopusColors.error,
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = copy.headline,
                style = PantopusTextStyle.h2,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = copy.body,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (onRetry != null && viewModel.isRetryable(error)) {
                AuthPrimaryButton(
                    label = "Try again",
                    onClick = onRetry,
                    modifier = Modifier.testTag(AuthErrorScreenTags.RETRY),
                )
            }
            AuthGhostButton(
                label = "Go back",
                onClick = onBack,
                modifier = Modifier.testTag(AuthErrorScreenTags.BACK),
            )
        }
    }
}

@Composable
private fun AuthPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun AuthGhostButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
    }
}
