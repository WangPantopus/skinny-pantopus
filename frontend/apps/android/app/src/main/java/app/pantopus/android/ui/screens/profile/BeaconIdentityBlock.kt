@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.BeaconIdentity
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileStatCell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * P8.6 (A21.1 / A21.2) — Bespoke identity card for the public Beacon
 * profile archetype, overlapping the [app.pantopus.android.ui.components.BeaconBanner]
 * hero. Carries a 72dp avatar + identity-tinted verif dot, a caller-
 * supplied [actions] slot (share + Follow for personas; Connect +
 * Message for locals), name + handle + kind chip (gold "Persona ·
 * Verified" crown / green "Verified neighbor" shield) + locality, a
 * 3-line bio, and the StatCell row.
 *
 * Screen-private to the public profile (mirrors `PublicProfileChrome`).
 * Tokens only — no raw hex.
 */
@Composable
fun BeaconIdentityBlock(
    identity: BeaconIdentity,
    name: String,
    handle: String?,
    tierLabel: String?,
    isVerifiedNeighbor: Boolean,
    locality: String?,
    bio: String?,
    isVerified: Boolean,
    avatarUrl: String?,
    stats: List<ProfileStatCell>,
    modifier: Modifier = Modifier,
    actions: @Composable () -> Unit,
) {
    val accent = accentFor(identity)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .pantopusShadow(PantopusElevations.lg, RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4)
                .testTag("beaconIdentityBlock_${identity.identifier}"),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Box(modifier = Modifier.size(72.dp)) {
                AvatarWithIdentityRing(
                    name = name,
                    imageUrl = avatarUrl,
                    identity = avatarIdentity(identity),
                    ringProgress = 1f,
                    size = 72.dp,
                )
                if (isVerified) {
                    Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 2.dp, y = 2.dp)) {
                        BeaconVerifDot(color = accent)
                    }
                }
            }
            Spacer(Modifier.weight(1f))
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                actions()
            }
        }

        Spacer(Modifier.size(10.dp))
        Text(
            text = name,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            maxLines = 2,
            modifier = Modifier.semantics { heading() },
        )

        Spacer(Modifier.size(3.dp))
        BeaconMetaRow(
            handle = handle,
            tierLabel = tierLabel,
            isVerifiedNeighbor = isVerifiedNeighbor,
            locality = locality,
        )

        if (!bio.isNullOrEmpty()) {
            Spacer(Modifier.size(10.dp))
            Text(
                text = bio,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appTextStrong,
                maxLines = 3,
            )
        }

        if (stats.isNotEmpty()) {
            Spacer(Modifier.size(14.dp))
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(PantopusColors.appBorderSubtle),
            )
            Spacer(Modifier.size(12.dp))
            BeaconStatRow(stats = stats)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BeaconMetaRow(
    handle: String?,
    tierLabel: String?,
    isVerifiedNeighbor: Boolean,
    locality: String?,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (!handle.isNullOrEmpty()) {
            Text(
                text = if (handle.startsWith("@")) handle else "@$handle",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (!tierLabel.isNullOrEmpty()) {
            BeaconTierChip(label = tierLabel)
        }
        if (isVerifiedNeighbor) {
            BeaconNeighborChip()
        }
        if (!locality.isNullOrEmpty()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(text = locality, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun BeaconStatRow(stats: List<ProfileStatCell>) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics {
                    contentDescription = stats.joinToString(", ") { "${it.value} ${it.label}" }
                },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        stats.forEachIndexed { index, stat ->
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = stat.value,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Spacer(Modifier.size(2.dp))
                Text(
                    text = stat.label.uppercase(),
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (index < stats.size - 1) {
                Box(
                    modifier =
                        Modifier
                            .width(1.dp)
                            .height(24.dp)
                            .background(PantopusColors.appBorder),
                )
            }
        }
    }
}

// MARK: - Verif dot + chips

@Composable
private fun BeaconVerifDot(color: Color) {
    Box(
        modifier =
            Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(color)
                .border(2.5.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Check,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 4f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun BeaconTierChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .padding(horizontal = 7.dp, vertical = 2.dp)
                .semantics { contentDescription = "$label tier" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Crown,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.warning,
        )
        Text(
            text = label.uppercase(),
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.warning,
        )
    }
}

@Composable
private fun BeaconNeighborChip() {
    Row(
        modifier =
            Modifier
                .testTag("publicProfileVerifiedNeighborChip")
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .padding(horizontal = 7.dp, vertical = 2.dp)
                .semantics { contentDescription = "Verified neighbor" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.home,
        )
        Text(
            text = "VERIFIED NEIGHBOR",
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.home,
        )
    }
}

// MARK: - Header action buttons

/** Filled compact primary header action (Follow / Message) with a leading icon. */
@Composable
fun BeaconHeaderPrimaryButton(
    title: String,
    icon: PantopusIcon,
    onClick: () -> Unit,
    isProminent: Boolean = true,
) {
    Row(
        modifier =
            Modifier
                .height(36.dp)
                .pantopusShadow(
                    if (isProminent) PantopusElevations.primary else PantopusElevations.sm,
                    RoundedCornerShape(Radii.md),
                )
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isProminent) PantopusColors.primary600 else PantopusColors.appTextSecondary)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .semantics { contentDescription = title },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

/**
 * Outlined neutral header action (share / Connect). When [title] is null
 * it renders as a 36dp square icon-only button (the share kebab).
 */
@Composable
fun BeaconHeaderGhostButton(
    icon: PantopusIcon,
    actionLabel: String,
    onClick: () -> Unit,
    title: String? = null,
    enabled: Boolean = true,
) {
    if (title == null) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .alpha(if (enabled) 1f else DISABLED_ALPHA)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .clickable(enabled = enabled, onClick = onClick)
                    .semantics { contentDescription = actionLabel },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appText,
            )
        }
    } else {
        Row(
            modifier =
                Modifier
                    .height(36.dp)
                    .alpha(if (enabled) 1f else DISABLED_ALPHA)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .clickable(enabled = enabled, onClick = onClick)
                    .padding(horizontal = Spacing.s3)
                    .semantics { contentDescription = actionLabel },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appText,
            )
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

private fun accentFor(identity: BeaconIdentity): Color =
    when (identity) {
        BeaconIdentity.Personal -> PantopusColors.primary600
        BeaconIdentity.Home -> PantopusColors.home
        BeaconIdentity.Business -> PantopusColors.business
    }

private fun avatarIdentity(identity: BeaconIdentity): IdentityPillar =
    when (identity) {
        BeaconIdentity.Personal -> IdentityPillar.Personal
        BeaconIdentity.Home -> IdentityPillar.Home
        BeaconIdentity.Business -> IdentityPillar.Business
    }

/**
 * Dimming applied to a disabled beacon action. Matches iOS, which fades the
 * same Connect control with `.opacity(isConnectEnabled ? 1 : 0.7)`
 * (`Features/Profile/PublicProfileView.swift:410`).
 */
private const val DISABLED_ALPHA = 0.7f
