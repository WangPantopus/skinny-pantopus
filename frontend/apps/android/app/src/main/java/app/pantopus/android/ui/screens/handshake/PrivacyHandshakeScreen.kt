@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.handshake

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun PrivacyHandshakeScreen(
    onDismiss: () -> Unit = {},
    viewModel: PrivacyHandshakeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val dismissEvents by viewModel.dismissEvents.collectAsStateWithLifecycle()
    val checkoutUrl by viewModel.openCheckoutUrl.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(dismissEvents) {
        if (dismissEvents > 0) onDismiss()
    }
    LaunchedEffect(checkoutUrl) {
        val url = checkoutUrl ?: return@LaunchedEffect
        runCatching {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
        viewModel.consumeCheckoutUrl()
    }

    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag("privacyHandshake"),
    ) {
        when (val current = state) {
            is HandshakeUiState.Loading -> LoadingBody()
            is HandshakeUiState.Error -> ErrorBody(message = current.message, onRetry = viewModel::load)
            is HandshakeUiState.Ready ->
                ReadyBody(
                    content = current.content,
                    onHandleChange = viewModel::setHandle,
                    onAcknowledgeUsername = viewModel::setAcknowledgedUsingUsername,
                    onSelectTier = viewModel::selectTier,
                )
        }
    }
}

@Composable
private fun LoadingBody() {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("privacyHandshakeLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 360.dp, height = 72.dp, cornerRadius = 14.dp)
        Shimmer(width = 360.dp, height = 44.dp, cornerRadius = 10.dp)
        Shimmer(width = 360.dp, height = 88.dp, cornerRadius = Radii.lg)
    }
}

@Composable
private fun ErrorBody(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("privacyHandshakeError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 36.dp,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Text(
            text = "Couldn't open the handshake",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(text = message, fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4)
                    .height(36.dp)
                    .testTag("privacyHandshakeRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
internal fun ReadyBody(
    content: HandshakeReadyContent,
    onHandleChange: (String) -> Unit = {},
    onAcknowledgeUsername: (Boolean) -> Unit = {},
    onSelectTier: (Int) -> Unit = {},
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        PersonaPreview(content.persona)
        when (val step = content.step) {
            HandshakeStep.HandleEntry ->
                HandleStepBody(
                    persona = content.persona,
                    handle = content.handle,
                    onHandleChange = onHandleChange,
                    onAcknowledgeUsername = onAcknowledgeUsername,
                )
            HandshakeStep.TierSelection, HandshakeStep.Submitting ->
                TierStepBody(
                    options = content.tierOptions,
                    selectedRank = content.selectedTierRank,
                    handleValue = content.handle.value,
                    onSelectTier = onSelectTier,
                )
            is HandshakeStep.OpensCheckout -> OpensCheckoutBody()
            HandshakeStep.CompletedFree -> CompletedFreeBody(persona = content.persona)
            HandshakeStep.AlreadyMember -> AlreadyMemberBody(persona = content.persona)
        }
    }
}

@Composable
private fun PersonaPreview(persona: HandshakePersonaPreview) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .padding(14.dp)
                .testTag("privacyHandshakePersona"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(52.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = persona.displayName.take(1).uppercase(),
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary700,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = persona.displayName,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(text = "@${persona.handle}", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            Text(
                text = "${persona.followerCount} ${persona.audienceLabel.lowercase()}",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
            persona.bio?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = it,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 3,
                    modifier = Modifier.padding(top = Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun HandleStepBody(
    persona: HandshakePersonaPreview,
    handle: HandshakeHandleState,
    onHandleChange: (String) -> Unit,
    onAcknowledgeUsername: (Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(
            text = "Choose your fan handle",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "This is what ${persona.displayName} sees about you. They never see your local identity.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        OutlinedTextField(
            value = handle.value,
            onValueChange = onHandleChange,
            enabled = !handle.locked,
            isError = handle.error != null,
            singleLine = true,
            placeholder = { Text(text = "yourhandle", color = PantopusColors.appTextMuted) },
            modifier = Modifier.fillMaxWidth().testTag("privacyHandshakeHandleField"),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    focusedBorderColor = PantopusColors.primary600,
                    unfocusedBorderColor = PantopusColors.appBorder,
                    errorBorderColor = PantopusColors.error,
                ),
            keyboardOptions =
                androidx.compose.foundation.text.KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                ),
        )
        handle.error?.let {
            Text(text = it, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, color = PantopusColors.error)
        } ?: Text(
            text = "3–40 letters, numbers, dots, dashes, or underscores.",
            fontSize = 11.sp,
            color = PantopusColors.appTextMuted,
        )
        if (handle.matchesUsername) {
            UsernameAckRow(handle, onAcknowledgeUsername)
        }
        PlatformTrustNote()
    }
}

@Composable
private fun UsernameAckRow(
    handle: HandshakeHandleState,
    onAcknowledge: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onAcknowledge(!handle.acknowledgedUsingUsername) }
                .testTag("privacyHandshakeUsernameAck"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(18.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(if (handle.acknowledgedUsingUsername) PantopusColors.primary600 else PantopusColors.appSurface)
                    .border(
                        2.dp,
                        if (handle.acknowledgedUsingUsername) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        RoundedCornerShape(Radii.xs),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (handle.acknowledgedUsingUsername) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.lg,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Use my Pantopus username as my fan handle",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "This intentionally links your local and public profiles for this creator.",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun PlatformTrustNote() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.primary50)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Your private account stays private",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Pantopus never shares your email, phone, address, or local profile with this creator.",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun TierStepBody(
    options: List<HandshakeTierOption>,
    selectedRank: Int,
    handleValue: String,
    onSelectTier: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(
            text = "Pick a tier",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "You can change or cancel any time.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        options.forEach { tier ->
            TierRow(
                tier = tier,
                isSelected = tier.rank == selectedRank,
                onSelect = { onSelectTier(tier.rank) },
            )
        }
        HandleEchoCard(handleValue)
    }
}

@Composable
private fun TierRow(
    tier: HandshakeTierOption,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.xl),
                )
                .clickable(onClick = onSelect)
                .padding(14.dp)
                .testTag("privacyHandshakeTier_${tier.rank}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .border(
                        2.dp,
                        if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        CircleShape,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (isSelected) {
                Box(modifier = Modifier.size(12.dp).clip(CircleShape).background(PantopusColors.primary600))
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row {
                Text(
                    text = tier.name,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = tier.priceLabel,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (tier.isFree) PantopusColors.success else PantopusColors.appText,
                )
            }
            tier.description?.takeIf { it.isNotBlank() }?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun HandleEchoCard(handleValue: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.UserPlus,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Following as ",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = "@$handleValue",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun OpensCheckoutBody() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s10).testTag("privacyHandshakeCheckout"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        CircularProgressIndicator(color = PantopusColors.primary600, strokeWidth = 3.dp)
        Text(
            text = "Opening Stripe Checkout…",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Finish your subscription in the browser, then come back here.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun CompletedFreeBody(persona: HandshakePersonaPreview) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s6).testTag("privacyHandshakeSuccess"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(CircleShape).background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 36.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.success,
            )
        }
        Text(
            text = "You're following ${persona.displayName}",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Updates from this creator will show up in your feed. We'll never reveal your local profile.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun AlreadyMemberBody(persona: HandshakePersonaPreview) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s6).testTag("privacyHandshakeAlreadyMember"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Star,
                contentDescription = null,
                size = 36.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.primary600,
            )
        }
        Text(
            text = "You already follow ${persona.displayName}",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Open your profile to manage notifications or change your handle for this creator.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}
