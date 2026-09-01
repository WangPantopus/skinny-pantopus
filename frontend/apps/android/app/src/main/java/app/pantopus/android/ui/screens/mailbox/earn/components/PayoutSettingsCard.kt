@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.earn.components

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.earn.EarnAutoCashOut
import app.pantopus.android.ui.screens.mailbox.earn.EarnPayoutMethod
import app.pantopus.android.ui.screens.wallet.components.WalletPalette
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.11 — payout settings. Two stacked rows: the linked Chase
 * debit-card tile + "Manage", and the "Auto cash out · Every Friday ·
 * cleared balance" recurring-payout row with a green toggle. The empty
 * new-earner frame swaps this for [EarnPayoutNudge]. Real Stripe Connect
 * wiring is out of scope; `Manage` / `Add bank` deep-link to the existing
 * Payments surface.
 */
@Composable
fun EarnPayoutSettingsCard(
    method: EarnPayoutMethod,
    autoCashOut: EarnAutoCashOut,
    modifier: Modifier = Modifier,
    onManage: () -> Unit = {},
) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape),
    ) {
        MethodRow(method = method, onManage = onManage)
        Row(modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.width(14.dp))
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(1.dp)
                        .background(PantopusColors.appBorderSubtle),
            )
        }
        AutoCashOutRow(autoCashOut = autoCashOut)
    }
}

@Composable
private fun MethodRow(
    method: EarnPayoutMethod,
    onManage: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        ChaseTile()
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = method.bankLabel,
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.1).sp,
                )
                Text(
                    text = "•••• ${method.last4}",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Zap,
                    contentDescription = null,
                    size = 11.dp,
                    strokeWidth = 2.3f,
                    tint = PantopusColors.home,
                )
                Text(
                    text = method.bodyText,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                    maxLines = 1,
                )
            }
        }
        Spacer(Modifier.width(Spacing.s2))
        Box(
            modifier =
                Modifier
                    .height(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(onClick = onManage)
                    .padding(horizontal = Spacing.s1)
                    .testTag("earnManagePayoutButton"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Manage",
                color = PantopusColors.primary600,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun AutoCashOutRow(autoCashOut: EarnAutoCashOut) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics {
                    contentDescription =
                        "${autoCashOut.title}. ${autoCashOut.detail}. " +
                        if (autoCashOut.isOn) "On" else "Off"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowsRepeat,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextStrong,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = autoCashOut.title,
                color = PantopusColors.appText,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = autoCashOut.detail,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
            )
        }
        Spacer(Modifier.width(Spacing.s2))
        EarnToggle(isOn = autoCashOut.isOn)
    }
}

@Composable
private fun ChaseTile() {
    Box(
        modifier =
            Modifier
                .size(width = 44.dp, height = 30.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(
                    Brush.linearGradient(
                        colors = listOf(WalletPalette.chaseBlueDark, WalletPalette.chaseBlueLight),
                    ),
                ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "CHASE",
            color = Color.White,
            fontSize = 8.5.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.5.sp,
        )
    }
}

/**
 * Decorative recurring-payout toggle. The real auto-cash-out switch lands
 * with the Connect integration; here it reflects the seeded state only
 * (non-interactive).
 */
@Composable
private fun EarnToggle(isOn: Boolean) {
    Box(
        modifier =
            Modifier
                .size(width = 38.dp, height = 23.dp)
                .clip(CircleShape)
                .background(if (isOn) PantopusColors.success else PantopusColors.appBorder)
                .padding(2.dp),
        contentAlignment = if (isOn) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier
                    .size(19.dp)
                    .clip(CircleShape)
                    .background(Color.White),
        )
    }
}

/**
 * Empty new-earner nudge — dashed "Add a payout method" card with an
 * "Add bank" button. Shown in place of [EarnPayoutSettingsCard].
 */
@Composable
fun EarnPayoutNudge(
    modifier: Modifier = Modifier,
    onAddBank: () -> Unit = {},
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .earnDashedBorder(PantopusColors.appBorder, 14.dp)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics {
                    contentDescription = "Add a payout method. Link a bank so you can cash out later."
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Building2,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = "Add a payout method",
                color = PantopusColors.appText,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = "Link a bank so you can cash out later",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
            )
        }
        Spacer(Modifier.width(Spacing.s2))
        Box(
            modifier =
                Modifier
                    .height(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50)
                    .clickable(onClick = onAddBank)
                    .padding(horizontal = Spacing.s3)
                    .testTag("earnAddBankButton"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Add bank",
                color = PantopusColors.primary700,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
