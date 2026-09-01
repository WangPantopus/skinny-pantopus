@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.token_accept

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun TokenAcceptScreen(
    onDismiss: () -> Unit = {},
    viewModel: TokenAcceptViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val dismissEvents by viewModel.dismissEvents.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(dismissEvents) {
        if (dismissEvents > 0) onDismiss()
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("tokenAccept"),
    ) {
        TopBar()
        when (val current = state) {
            is TokenAcceptUiState.Loading -> LoadingFrame()
            is TokenAcceptUiState.Ready ->
                OfferBody(
                    offer = current.offer,
                    submitting = false,
                    onAccept = viewModel::accept,
                    onDecline = viewModel::decline,
                )
            is TokenAcceptUiState.Accepting ->
                OfferBody(
                    offer = current.offer,
                    submitting = true,
                    onAccept = {},
                    onDecline = {},
                )
            is TokenAcceptUiState.Accepted ->
                AcceptedFrame(message = current.message, onDone = viewModel::dismiss)
            is TokenAcceptUiState.Declined -> DeclinedFrame(onDone = viewModel::dismiss)
            is TokenAcceptUiState.Expired -> ExpiredFrame(message = current.message, onDone = viewModel::dismiss)
            is TokenAcceptUiState.Error ->
                ErrorFrame(message = current.message, onRetry = viewModel::load, onDone = viewModel::dismiss)
        }
    }
}

@Composable
private fun TopBar() {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().height(52.dp).padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(modifier = Modifier.size(36.dp))
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "Invitation",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.size(36.dp))
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

@Composable
private fun LoadingFrame() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("tokenAcceptLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 360.dp, height = 130.dp, cornerRadius = 14.dp)
        Shimmer(width = 360.dp, height = 80.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 120.dp, cornerRadius = Radii.lg)
    }
}

@Composable
internal fun OfferBody(
    offer: TokenAcceptOffer,
    submitting: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("tokenAcceptOffer")) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            HeaderCard(offer)
            RoleCard(offer)
            if (offer.benefits.isNotEmpty()) BenefitsCard(offer)
            SafetyBandRow(offer.safetyBand)
            offer.expiry?.let { ExpiryPill(text = it) }
            Spacer(modifier = Modifier.height(Spacing.s8))
        }
        StickyCtas(offer = offer, submitting = submitting, onAccept = onAccept, onDecline = onDecline)
    }
}

@Composable
private fun HeaderCard(offer: TokenAcceptOffer) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        InviteTypeChip(offer.inviteType)
        Text(
            text = offer.sender,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = offer.title,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.Home,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(text = offer.venue, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        }
        IdentityChip(offer.identityChip)
    }
}

@Composable
private fun InviteTypeChip(type: InviteType) {
    val (label, bg, fg) =
        when (type) {
            InviteType.HomeInvite -> Triple("Home invite", PantopusColors.successBg, PantopusColors.success)
            InviteType.BusinessSeat -> Triple("Business seat", PantopusColors.businessBg, PantopusColors.business)
            InviteType.GuestPass -> Triple("Guest pass", PantopusColors.warningBg, PantopusColors.warning)
        }
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .testTag("tokenAcceptTypeChip"),
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
            letterSpacing = 0.8.sp,
        )
    }
}

@Composable
private fun IdentityChip(chip: IdentityChipContent) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("tokenAcceptIdentityChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.User,
            contentDescription = null,
            size = Radii.lg,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = chip.label,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun RoleCard(offer: TokenAcceptOffer) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(14.dp)
                .testTag("tokenAcceptRoleCard"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UserPlus,
                contentDescription = null,
                size = Radii.xl2,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "ROLE OFFERED",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextSecondary,
                letterSpacing = 0.6.sp,
            )
            Text(
                text = offer.roleOffered,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun BenefitsCard(offer: TokenAcceptOffer) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(14.dp)
                .testTag("tokenAcceptBenefits"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "WHAT YOU GET",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.6.sp,
        )
        offer.benefits.forEach { benefit ->
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.success,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(
                    text = benefit,
                    fontSize = 13.5.sp,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

@Composable
private fun SafetyBandRow(band: SafetyBand) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.primary50)
                .padding(Spacing.s3)
                .testTag("tokenAcceptSafetyBand"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(
            icon = band.icon,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
            modifier = Modifier.padding(top = 1.dp),
        )
        Text(text = band.text, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun ExpiryPill(text: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .padding(horizontal = 10.dp, vertical = 6.dp)
                .testTag("tokenAcceptExpiry"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.warning,
        )
        Text(
            text = text,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.warning,
        )
    }
}

@Composable
private fun StickyCtas(
    offer: TokenAcceptOffer,
    submitting: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(enabled = !submitting, onClick = onDecline)
                        .testTag("tokenAcceptDecline"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = offer.secondaryCtaLabel,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(PantopusColors.primary600)
                        .clickable(enabled = !submitting, onClick = onAccept)
                        .testTag("tokenAcceptAccept"),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (submitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            color = PantopusColors.appTextInverse,
                            strokeWidth = 2.dp,
                        )
                    }
                    Text(
                        text = if (submitting) "Accepting…" else offer.primaryCtaLabel,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

@Composable
private fun AcceptedFrame(
    message: String,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s5).testTag("tokenAcceptAccepted"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(PantopusColors.successBg),
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
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "You're in",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s5))
        DoneButton(onDone = onDone)
    }
}

@Composable
private fun DeclinedFrame(onDone: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s5).testTag("tokenAcceptDeclined"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = "Invitation declined",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "We told the sender you're not joining. You can always be invited again.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s5))
        DoneButton(onDone = onDone)
    }
}

@Composable
private fun ExpiredFrame(
    message: String,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s5).testTag("tokenAcceptExpiredFrame"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 36.dp,
            strokeWidth = 2f,
            tint = PantopusColors.warning,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = "Link no longer valid",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        Spacer(modifier = Modifier.height(Spacing.s5))
        DoneButton(onDone = onDone)
    }
}

@Composable
private fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s5).testTag("tokenAcceptError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 36.dp,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = "Couldn't load this invite",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        Spacer(modifier = Modifier.height(Spacing.s4))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(onClick = onDone)
                        .padding(horizontal = Spacing.s4)
                        .height(36.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "Close", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            }
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onRetry)
                        .padding(horizontal = Spacing.s4)
                        .height(36.dp)
                        .testTag("tokenAcceptRetry"),
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
}

@Composable
private fun DoneButton(onDone: () -> Unit) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary600)
                .clickable(onClick = onDone)
                .padding(horizontal = 22.dp)
                .height(40.dp)
                .testTag("tokenAcceptDone"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Done",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}
