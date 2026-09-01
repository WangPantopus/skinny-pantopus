@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.shared.content_detail.ctas

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P6.5 — Per-kind sticky CTA for the Public Profile detail. The kind model
 * lives in [ActionRowCtaKind]:
 *
 * - `Persona` surfaces a single primary "Follow" CTA.
 * - `Local` surfaces a primary "Message" CTA + an outline "Connect" CTA.
 *
 * Sticky footer CTA. When [kind] is null the slot renders nothing,
 * preserving the legacy "actions live in the body" layout.
 */
@Composable
fun ActionRowCta(kind: ActionRowCtaKind? = null) {
    when (kind) {
        null -> Unit
        is ActionRowCtaKind.Persona ->
            PersonaFollowFooter(
                inFlight = kind.followInFlight,
                isFollowing = kind.isFollowing,
                onFollow = kind.onFollow,
            )
        is ActionRowCtaKind.Local ->
            LocalMessageConnectFooter(
                messageInFlight = kind.messageInFlight,
                connectInFlight = kind.connectInFlight,
                isConnectRequested = kind.isConnectRequested,
                onMessage = kind.onMessage,
                onConnect = kind.onConnect,
            )
    }
}

@Composable
private fun PersonaFollowFooter(
    inFlight: Boolean,
    isFollowing: Boolean,
    onFollow: () -> Unit,
) {
    androidx.compose.foundation.layout.Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface),
    ) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(Spacing.s4),
        ) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("publicProfileFollowCta")
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .alpha(if (inFlight) 0.7f else 1f)
                        .heightIn(min = 48.dp)
                        .clickable(enabled = !inFlight, onClick = onFollow)
                        .semantics { contentDescription = if (isFollowing) "Following" else "Follow" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = if (isFollowing) PantopusIcon.Check else PantopusIcon.Plus,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextInverse,
                )
                Box(modifier = Modifier.padding(start = Spacing.s2)) {
                    Text(
                        text = if (isFollowing) "Following" else "Follow",
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
private fun LocalMessageConnectFooter(
    messageInFlight: Boolean,
    connectInFlight: Boolean,
    isConnectRequested: Boolean,
    onMessage: () -> Unit,
    onConnect: () -> Unit,
) {
    androidx.compose.foundation.layout.Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface),
    ) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Connect (outline)
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("publicProfileConnectCta")
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .alpha(if (connectInFlight) 0.7f else 1f)
                        .heightIn(min = 48.dp)
                        .clickable(enabled = !connectInFlight, onClick = onConnect)
                        .semantics {
                            contentDescription = if (isConnectRequested) "Connection requested" else "Connect"
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = if (isConnectRequested) PantopusIcon.Check else PantopusIcon.UserPlus,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appText,
                )
                Box(modifier = Modifier.padding(start = Spacing.s2)) {
                    Text(
                        text = if (isConnectRequested) "Requested" else "Connect",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                }
            }
            // Message (primary)
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("publicProfileMessageCta")
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .alpha(if (messageInFlight) 0.7f else 1f)
                        .heightIn(min = 48.dp)
                        .clickable(enabled = !messageInFlight, onClick = onMessage)
                        .semantics { contentDescription = "Message" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MessageSquare,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextInverse,
                )
                Box(modifier = Modifier.padding(start = Spacing.s2)) {
                    Text(
                        text = "Message",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}
