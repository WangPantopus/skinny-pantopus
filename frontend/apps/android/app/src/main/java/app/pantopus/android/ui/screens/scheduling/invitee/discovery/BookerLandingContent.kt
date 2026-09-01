@file:Suppress("PackageNaming", "LongParameterList", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val BANNER_HEIGHT = 96.dp
private val AVATAR_SIZE = 64.dp
private val CARD_OVERLAP = (-34).dp
private val AVATAR_LIFT = (-36).dp

/** The two gradient stops for a pillar's **avatar** disc (token-only). */
private fun avatarStops(pillar: SchedulingPillar): List<Color> =
    when (pillar) {
        SchedulingPillar.Personal -> listOf(PantopusColors.primary400, PantopusColors.primary800)
        SchedulingPillar.Home -> listOf(PantopusColors.home, PantopusColors.homeDark)
        SchedulingPillar.Business -> listOf(PantopusColors.business, PantopusColors.businessDark)
    }

/**
 * The three gradient stops for a pillar's hero **banner** (spec ramp:
 * light 0% → accent 58% → dark 100%), so the banner reads richer than a flat
 * two-stop fade.
 */
private fun bannerStops(pillar: SchedulingPillar): List<Color> =
    when (pillar) {
        SchedulingPillar.Personal -> listOf(PantopusColors.primary300, PantopusColors.primary600, PantopusColors.primary800)
        SchedulingPillar.Home -> listOf(PantopusColors.homeBg, PantopusColors.home, PantopusColors.homeDark)
        SchedulingPillar.Business -> listOf(PantopusColors.businessBg, PantopusColors.business, PantopusColors.businessDark)
    }

/** The pillar-tinted hero banner the header card overlaps. */
@Composable
fun PillarBanner(
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(BANNER_HEIGHT)
                .background(Brush.linearGradient(bannerStops(pillar))),
    )
}

/** Small green "verified" badge — success disc with a white check. */
@Composable
private fun VerifiedCheck(
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .padding(2.dp)
                .clip(CircleShape)
                .background(PantopusColors.success),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Check,
            contentDescription = "Verified",
            size = size * 0.5f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

/** Host avatar disc with initials + the verified badge. */
@Composable
fun HostAvatar(
    pillar: SchedulingPillar,
    initials: String,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = AVATAR_SIZE,
    verified: Boolean = true,
) {
    Box(modifier = modifier.size(size)) {
        Box(
            modifier =
                Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .padding(3.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(avatarStops(pillar))),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = initials, style = PantopusTextStyle.h3, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
        if (verified) {
            VerifiedCheck(size = 18.dp, modifier = Modifier.align(Alignment.BottomEnd))
        }
    }
}

/** The overlapping header card: avatar + share, host name, headline, blurb. */
@Composable
fun LandingHeaderCard(
    pillar: SchedulingPillar,
    hostName: String,
    initials: String,
    headline: String?,
    blurb: String?,
    onShare: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .offset(y = CARD_OVERLAP)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            HostAvatar(pillar = pillar, initials = initials, modifier = Modifier.offset(y = AVATAR_LIFT))
            Box(modifier = Modifier.weight(1f))
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .clickable(onClickLabel = "Share this link", onClick = onShare),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Share,
                    contentDescription = "Share this link",
                    size = 15.dp,
                    tint = PantopusColors.appTextStrong,
                )
            }
        }
        Text(
            text = hostName,
            // Spec host name is 18sp/700 — one notch below the 20sp h3 token.
            style = PantopusTextStyle.h3,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        if (headline != null) {
            Text(
                text = headline,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = pillar.accent,
                modifier = Modifier.padding(top = Spacing.s1),
            )
        }
        if (blurb != null) {
            Text(
                text = blurb,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.padding(top = Spacing.s2),
            )
        }
    }
}

/** "Get a faster booking experience · Open" deep-link banner → in-app interstitial. */
@Composable
fun OpenInAppBanner(
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var dismissed by remember { mutableStateOf(false) }
    if (dismissed) return
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Smartphone, contentDescription = null, size = 16.dp, tint = PantopusColors.primary600)
        }
        Text(
            text = "Get a faster booking experience",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onOpen)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        ) {
            Text(text = "Open", style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .clickable(onClickLabel = "Dismiss", onClick = { dismissed = true }),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = "Dismiss", size = 14.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

/** A bookable event-type row (leading tile + name + duration + mode chip + chevron). */
@Composable
fun EventTypeRow(
    row: EventTypeRowUi,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(38.dp).clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = row.locationIcon, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextStrong)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = row.name, style = PantopusTextStyle.small, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(
                        icon = PantopusIcon.Clock,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(text = row.durationLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
                ModeChip(icon = row.locationIcon, label = row.locationLabel)
            }
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextMuted)
    }
}

/** In-context paused card (the page exists but isn't taking bookings). */
@Composable
fun LandingPausedCard(
    hostName: String,
    modifier: Modifier = Modifier,
) {
    InfoCard(
        modifier = modifier,
        dashed = false,
        icon = PantopusIcon.PauseCircle,
        title = "This page isn't taking bookings right now",
        body = "Check back later, or reach out to $hostName directly.",
    )
}

/** In-context empty card (no event types / no availability set up). */
@Composable
fun LandingEmptyCard(
    hostName: String,
    modifier: Modifier = Modifier,
) {
    InfoCard(
        modifier = modifier,
        dashed = true,
        icon = PantopusIcon.CalendarX,
        title = "No times are set up yet",
        body = "$hostName hasn't added any availability. Check back soon.",
    )
}

@Composable
private fun InfoCard(
    icon: PantopusIcon,
    title: String,
    body: String,
    dashed: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, if (dashed) PantopusColors.appBorderStrong else PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s5, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(46.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 21.dp, tint = PantopusColors.appTextSecondary)
        }
        Text(text = title, style = PantopusTextStyle.small, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(
            text = body,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s2),
        )
    }
}

/** "View {name}'s profile" link + "Powered by Pantopus" footer. */
@Composable
fun LandingFooter(
    modifier: Modifier = Modifier,
    profileName: String? = null,
    onViewProfile: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(top = Spacing.s5, bottom = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (!profileName.isNullOrBlank()) {
            Row(
                modifier =
                    Modifier
                        .then(if (onViewProfile != null) Modifier.clickable(onClick = onViewProfile) else Modifier)
                        .padding(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "View $profileName's profile",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ArrowUpRight,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
        Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(
                icon = PantopusIcon.CalendarClock,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "Powered by Pantopus",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(start = Spacing.s1),
            )
        }
    }
}

/** Loading shimmer that mirrors the landing geometry (header + 3 rows). */
@Composable
fun LandingLoadingSkeleton(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appBg)) {
        Box(modifier = Modifier.fillMaxWidth().height(BANNER_HEIGHT).background(PantopusColors.appSurfaceSunken))
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3)
                    .offset(y = CARD_OVERLAP)
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Shimmer(width = AVATAR_SIZE, height = AVATAR_SIZE, cornerRadius = Radii.pill, modifier = Modifier.offset(y = AVATAR_LIFT))
            Shimmer(width = 150.dp, height = 16.dp, cornerRadius = Radii.sm)
            Shimmer(width = 120.dp, height = 12.dp, cornerRadius = Radii.sm)
            Shimmer(width = 220.dp, height = 11.dp, cornerRadius = Radii.sm)
        }
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            // Full-width row placeholders: Shimmer takes a fixed width, so fill the
            // row with a sunken block sized to the loaded event-type row geometry.
            repeat(3) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(64.dp)
                            .clip(RoundedCornerShape(Radii.xl))
                            .background(PantopusColors.appSurfaceSunken),
                )
            }
        }
    }
}
