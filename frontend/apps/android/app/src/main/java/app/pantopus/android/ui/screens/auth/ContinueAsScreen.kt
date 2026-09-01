@file:Suppress("LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.auth

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.findFragmentActivity
import app.pantopus.android.data.auth.SessionEndReason
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Test tags — mirror the iOS `ContinueAsView` accessibility identifiers
 * (`auth.continueAs.*`) one for one.
 */
object ContinueAsTags {
    const val ROOT = "auth.continueAs.root"
    const val AVATAR = "auth.continueAs.avatar"
    const val TITLE = "auth.continueAs.title"
    const val EMAIL = "auth.continueAs.email"
    const val CONTINUE = "auth.continueAs.continue"
    const val DIFFERENT_ACCOUNT = "auth.continueAs.differentAccount"
    const val REMOVE = "auth.continueAs.remove"
    const val REMOVE_CONFIRM = "auth.continueAs.removeConfirm"
    const val REMOVE_CANCEL = "auth.continueAs.removeCancel"
    const val ERROR = "auth.continueAs.error"
    const val SECURITY_BANNER = "auth.continueAs.securityBanner"
    const val SECURITY_BANNER_DISMISS = "auth.continueAs.securityBannerDismiss"
}

/**
 * The L2 "Continue as Ying" card (design §3 state **B**). A card, not a
 * form: avatar, name, masked email, primary *Continue* (runs the presence
 * prompt + `POST /api/auth/resume`), secondary *Use a different account*,
 * tertiary *Not you? Remove*. The prompt is auto-shown once on first
 * appearance; a cancel leaves the user on the card.
 *
 * Shown by `PantopusNavHost` for [app.pantopus.android.data.auth.AuthRepository.State.Resumable];
 * a state flip (SignedIn → home, SignedOut → login prefilled) swaps it out.
 */
@Composable
fun ContinueAsScreen(viewModel: ContinueAsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = remember(context) { context.findFragmentActivity() }
    var confirmRemove by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.autoContinue(activity) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s5, vertical = Spacing.s10)
                .testTag(ContinueAsTags.ROOT),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ContinueAsBrand()
        Box(modifier = Modifier.height(Spacing.s8))

        state.sessionEndReason?.let { reason ->
            SessionEndBanner(
                reason = reason,
                onDismiss = viewModel::dismissSessionEndBanner,
                modifier = Modifier.fillMaxWidth().testTag(ContinueAsTags.SECURITY_BANNER),
                dismissTag = ContinueAsTags.SECURITY_BANNER_DISMISS,
            )
            Box(modifier = Modifier.height(Spacing.s4))
        }

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl2))
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s6),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AvatarWithIdentityRing(
                name = state.displayName,
                identity = IdentityPillar.Personal,
                ringProgress = 0f,
                imageUrl = state.hint?.avatarUrl,
                size = Spacing.s16,
                modifier = Modifier.testTag(ContinueAsTags.AVATAR),
            )
            Box(modifier = Modifier.height(Spacing.s4))
            Text(
                text = "WELCOME BACK",
                style = PantopusTextStyle.overline,
                color = PantopusColors.primary600,
            )
            Box(modifier = Modifier.height(Spacing.s1))
            Text(
                text = "Continue as ${state.displayName}",
                style = PantopusTextStyle.h2,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .testTag(ContinueAsTags.TITLE)
                        .semantics { heading() },
            )
            state.hint?.maskedEmail?.let { masked ->
                Box(modifier = Modifier.height(Spacing.s1))
                Text(
                    text = masked,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag(ContinueAsTags.EMAIL),
                )
            }
            Box(modifier = Modifier.height(Spacing.s2))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Lock,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = PantopusColors.appTextMuted,
                )
                Text(
                    text = "You'll confirm with your screen lock",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                )
            }

            state.errorMessage?.let { message ->
                Box(modifier = Modifier.height(Spacing.s4))
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.errorBg)
                            .padding(Spacing.s3)
                            .testTag(ContinueAsTags.ERROR)
                            .semantics { liveRegion = LiveRegionMode.Polite },
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    verticalAlignment = Alignment.Top,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.error,
                    )
                    Text(
                        text = message,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.error,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Box(modifier = Modifier.height(Spacing.s6))
            PrimaryButton(
                title = "Continue",
                onClick = { viewModel.continueAs(activity) },
                isLoading = state.isResuming,
                isEnabled = state.canAct,
                modifier = Modifier.testTag(ContinueAsTags.CONTINUE),
            )
            Box(modifier = Modifier.height(Spacing.s3))
            GhostButton(
                title = "Use a different account",
                onClick = viewModel::useDifferentAccount,
                isEnabled = state.canAct,
                modifier = Modifier.testTag(ContinueAsTags.DIFFERENT_ACCOUNT),
            )
            Box(modifier = Modifier.height(Spacing.s4))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Not you?",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = if (state.isRemoving) "Removing…" else "Remove",
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clickable(enabled = state.canAct) { confirmRemove = true }
                            .testTag(ContinueAsTags.REMOVE)
                            .semantics { contentDescription = "Remove this account from this device" },
                )
            }
        }

        Box(modifier = Modifier.height(Spacing.s10))
        AuthTrustFooter()
    }

    if (confirmRemove) {
        AlertDialog(
            onDismissRequest = { confirmRemove = false },
            title = { Text("Remove this account?") },
            text = {
                Text(
                    "Pantopus will forget ${state.displayName} on this device. " +
                        "You can always sign in again.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmRemove = false
                        viewModel.removeAccount()
                    },
                    modifier = Modifier.testTag(ContinueAsTags.REMOVE_CONFIRM),
                ) { Text("Remove") }
            },
            dismissButton = {
                TextButton(
                    onClick = { confirmRemove = false },
                    modifier = Modifier.testTag(ContinueAsTags.REMOVE_CANCEL),
                ) { Text("Cancel") }
            },
        )
    }
}

/**
 * "You were signed out for security. Sign in again." (or the plain
 * expiry copy) — shared by the continue-as card and the login screen.
 * Warning tone for security codes, neutral info tone for plain expiry.
 */
@Composable
fun SessionEndBanner(
    reason: SessionEndReason,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    dismissTag: String? = null,
) {
    val background = if (reason.isSecurity) PantopusColors.warningBg else PantopusColors.infoBg
    val tint = if (reason.isSecurity) PantopusColors.warning else PantopusColors.info
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .padding(Spacing.s3)
                .semantics { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = if (reason.isSecurity) PantopusIcon.ShieldAlert else PantopusIcon.Info,
            contentDescription = null,
            size = Radii.xl,
            tint = tint,
        )
        Text(
            text = reason.message,
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .clickable(onClick = onDismiss)
                    .then(if (dismissTag != null) Modifier.testTag(dismissTag) else Modifier)
                    .semantics { contentDescription = "Dismiss" },
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun ContinueAsBrand() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = Spacing.s12,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Pantopus",
            style = PantopusTextStyle.h1,
            color = PantopusColors.appText,
        )
    }
}
