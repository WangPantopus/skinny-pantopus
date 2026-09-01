@file:Suppress("MagicNumber", "UnusedPrivateMember", "LongMethod", "LongParameterList", "TopLevelPropertyNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.hub.sections

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.ActionChip
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.SectionHeader
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.hub.ActionChipContent
import app.pantopus.android.ui.screens.hub.ActivityEntry
import app.pantopus.android.ui.screens.hub.DiscoveryCardContent
import app.pantopus.android.ui.screens.hub.DiscoveryKind
import app.pantopus.android.ui.screens.hub.FirstRunContent
import app.pantopus.android.ui.screens.hub.HubDiscoveryFilter
import app.pantopus.android.ui.screens.hub.JumpBackItem
import app.pantopus.android.ui.screens.hub.PillarTile
import app.pantopus.android.ui.screens.hub.SetupBannerContent
import app.pantopus.android.ui.screens.hub.TodaySummary
import app.pantopus.android.ui.screens.hub.TopBarContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

// MARK: - Top bar

@Composable
fun HubTopBar(
    content: TopBarContent,
    onAvatarTap: () -> Unit,
    onBellTap: () -> Unit,
    onMenuTap: () -> Unit,
    /**
     * S5 — Beacon-zone megaphone shortcut. Rendered only when the account
     * has unread audience notifications (RN gates the same button on the
     * `audience_profile` flag, which native doesn't carry; the backend's
     * `byContext.audience` count is the honest native equivalent). `null`
     * hides the button entirely.
     */
    onAudienceTap: (() -> Unit)? = null,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .clickable(onClick = onAvatarTap)
                        .testTag("hubAvatarButton")
                        .semantics { contentDescription = "Profile" },
            ) {
                AvatarWithIdentityRing(
                    name = content.name,
                    identity = content.identity,
                    ringProgress = content.ringProgress,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    content.greeting,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    content.name,
                    style = PantopusTextStyle.body.copy(fontSize = 17.sp, fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clickable(onClick = onBellTap)
                        .testTag("hubBellButton")
                        .semantics { contentDescription = "Notifications" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Bell,
                    contentDescription = null,
                    size = Radii.xl2,
                    tint = PantopusColors.appText,
                )
                if (content.unreadCount > 0) {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.TopEnd)
                                .padding(6.dp)
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.error)
                                .border(2.dp, PantopusColors.appSurface, CircleShape),
                    )
                }
            }
            if (onAudienceTap != null) {
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clickable(onClick = onAudienceTap)
                            .testTag("hubAudienceBellButton")
                            .semantics { contentDescription = "Audience notifications" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Megaphone,
                        contentDescription = null,
                        size = Radii.xl2,
                        tint = PantopusColors.success,
                    )
                    if (content.audienceUnreadCount > 0) {
                        Box(
                            modifier =
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(6.dp)
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(PantopusColors.success)
                                    .border(2.dp, PantopusColors.appSurface, CircleShape),
                        )
                    }
                }
            }
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clickable(onClick = onMenuTap)
                        .testTag("hubMenuButton")
                        .semantics { contentDescription = "Menu" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Menu,
                    contentDescription = null,
                    size = Radii.xl2,
                    tint = PantopusColors.appText,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
    }
}

// MARK: - Action strip

@Composable
fun HubActionStrip(
    chips: List<ActionChipContent>,
    onTap: (ActionChipContent.Kind) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        chips.forEach { chip ->
            ActionChip(
                icon = chip.icon,
                label = chip.label,
                onClick = { onTap(chip.kind) },
                isActive = chip.active,
            )
        }
    }
}

// MARK: - Setup banner

@Composable
fun HubSetupBanner(
    content: SetupBannerContent,
    onStart: () -> Unit,
    onDismiss: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("hubSetupBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.warningLight),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.warning,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                content.title,
                style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                "Unlock gigs + mail receiving.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.warning)
                    .clickable(onClick = onStart)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                    .testTag("hubSetupBannerStartButton")
                    .semantics { contentDescription = "${content.ctaTitle} ${content.title}" },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                content.ctaTitle,
                style = PantopusTextStyle.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appTextInverse,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clickable(onClick = onDismiss)
                    .semantics { contentDescription = "Dismiss banner" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: - First-run hero (VerifyHero)

@Composable
fun HubFirstRunHero(
    content: FirstRunContent,
    onStart: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.xl))
                .background(
                    Brush.linearGradient(
                        colors =
                            listOf(
                                PantopusColors.primary600,
                                PantopusColors.primary700,
                                PantopusColors.primary900,
                            ),
                    ),
                ).semantics {
                    contentDescription = "Verify your home to unlock Pantopus. Takes 4 minutes."
                },
    ) {
        // 54dp mail-icon disk (top-right).
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = Spacing.s2, end = Spacing.s3)
                    .size(54.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(Color.White.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Mailbox,
                contentDescription = null,
                size = 26.dp,
                tint = Color.White,
            )
        }

        Column(
            modifier = Modifier.padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            // "GET STARTED" pill.
            Row(
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.18f))
                        .padding(horizontal = Spacing.s2, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Sparkles,
                    contentDescription = null,
                    size = 10.dp,
                    tint = Color.White,
                )
                Text(
                    "GET STARTED",
                    style =
                        PantopusTextStyle.caption.copy(
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                        ),
                    color = Color.White,
                )
            }
            Text(
                "Verify your home to unlock Pantopus",
                style =
                    PantopusTextStyle.body.copy(
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                color = Color.White,
                modifier = Modifier.width(220.dp).semantics { heading() },
            )
            Text(
                "Takes 4 minutes. Gets you mail, gigs, and neighbor features.",
                style = PantopusTextStyle.caption.copy(fontSize = 13.sp),
                color = Color.White.copy(alpha = 0.82f),
                modifier = Modifier.width(240.dp),
            )
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(Color.White)
                        .clickable(onClick = onStart)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("hubFirstRunStartButton"),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        "Start verification",
                        style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                        color = PantopusColors.primary700,
                    )
                    PantopusIconImage(
                        icon = PantopusIcon.ArrowRight,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.primary700,
                    )
                }
            }
        }
    }
}

// MARK: - Today

@Composable
fun HubTodayCard(
    summary: TodaySummary,
    onTap: () -> Unit = {},
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("hubTodayCard")
                .semantics { contentDescription = "Today" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(PantopusColors.primary100, PantopusColors.primary600),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Sun,
                contentDescription = null,
                size = Radii.xl2,
                tint = Color.White,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                summary.temperatureFahrenheit?.let { temp ->
                    Text(
                        "$temp°F",
                        style = PantopusTextStyle.body.copy(fontSize = 20.sp, fontWeight = FontWeight.Bold),
                        color = PantopusColors.appText,
                    )
                }
                summary.conditions?.let {
                    Text(it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                summary.aqiLabel?.let { aqi ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text("AQI", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                        Text(
                            aqi,
                            style = PantopusTextStyle.caption.copy(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.success,
                        )
                    }
                    if (summary.commuteLabel != null) {
                        Text("·", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                    }
                }
                summary.commuteLabel?.let {
                    Text(it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appTextMuted,
        )
    }
}

// MARK: - Pillar grid

@Composable
fun HubPillarGrid(
    tiles: List<PillarTile>,
    onTap: (PillarTile.Pillar) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        tiles.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                pair.forEach { tile ->
                    PillarTileView(tile, onTap, modifier = Modifier.weight(1f))
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun PillarTileView(
    tile: PillarTile,
    onTap: (PillarTile.Pillar) -> Unit,
    modifier: Modifier = Modifier,
) {
    val tileBg = if (tile.chipSetupState) PantopusColors.appSurfaceRaised else PantopusColors.appSurface
    val iconBg =
        if (tile.chipSetupState) PantopusColors.appSurfaceSunken else tile.tint.backgroundColor
    val iconFg =
        if (tile.chipSetupState) PantopusColors.appTextMuted else tile.tint.color

    Column(
        modifier =
            modifier
                .defaultMinSize(minHeight = 94.dp)
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(tileBg)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable { onTap(tile.pillar) }
                .padding(Spacing.s3)
                .testTag("hub.pillar.${tile.pillar.name.lowercase()}")
                .semantics {
                    contentDescription = "${tile.label}${tile.chip?.let { ", $it" }.orEmpty()}"
                },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(iconBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = tile.icon,
                    contentDescription = null,
                    size = 17.dp,
                    tint = iconFg,
                )
            }
            tile.chip?.let {
                PillarChip(label = it, setupState = tile.chipSetupState, tint = tile.tint)
            }
        }
        Column {
            Text(
                tile.label,
                style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
            )
            tile.caption?.let {
                Text(
                    it,
                    style = PantopusTextStyle.caption.copy(fontSize = 11.sp),
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun PillarChip(
    label: String,
    setupState: Boolean,
    tint: IdentityPillar,
) {
    val bg = if (setupState) PantopusColors.appSurfaceSunken else tint.backgroundColor
    val fg = if (setupState) PantopusColors.appTextSecondary else tint.color
    Text(
        if (setupState) label.uppercase() else label,
        style =
            PantopusTextStyle.caption.copy(
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = if (setupState) 0.5.sp else 0.2.sp,
            ),
        color = fg,
        modifier =
            Modifier
                .clip(CircleShape)
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
    )
}

// MARK: - Discovery rail

@Composable
fun HubDiscoveryRail(
    items: List<DiscoveryCardContent>,
    onTap: (DiscoveryCardContent) -> Unit,
    activeFilter: HubDiscoveryFilter = HubDiscoveryFilter.Gigs,
    onFilterChange: ((HubDiscoveryFilter) -> Unit)? = null,
    isLoading: Boolean = false,
    onSeeAll: (() -> Unit)? = null,
    onExploreMap: (() -> Unit)? = null,
    onFindBusinesses: (() -> Unit)? = null,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SectionHeader("Discover nearby")
            Spacer(Modifier.weight(1f))
            if (onFindBusinesses != null) {
                DiscoveryHeaderLink(
                    label = "Find Businesses",
                    tint = PantopusColors.home,
                    tag = "hubDiscoveryRail.findBusinesses",
                    onClick = onFindBusinesses,
                )
            }
            if (onExploreMap != null) {
                DiscoveryHeaderLink(
                    label = "Explore Map",
                    tint = PantopusColors.primary600,
                    tag = "hubDiscoveryRail.exploreMap",
                    onClick = onExploreMap,
                )
            }
            if (onSeeAll != null) {
                Row(
                    modifier =
                        Modifier
                            .clickable { onSeeAll() }
                            .testTag("hubDiscoveryRail.seeAll")
                            .semantics { contentDescription = "See all discovery" },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        "See all",
                        style = PantopusTextStyle.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.primary600,
                    )
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronRight,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.primary600,
                    )
                }
            }
        }
        if (onFilterChange != null) {
            DiscoveryFilterTabs(active = activeFilter, onSelect = onFilterChange)
        }
        when {
            isLoading -> DiscoverySkeletonRail()
            items.isEmpty() -> DiscoveryEmptyRow()
            else ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = Spacing.s4),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    items.forEach { item ->
                        DiscoveryCard(item = item, onTap = { onTap(item) })
                    }
                }
        }
    }
}

@Composable
private fun DiscoveryHeaderLink(
    label: String,
    tint: Color,
    tag: String,
    onClick: () -> Unit,
) {
    Text(
        label,
        style = PantopusTextStyle.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
        color = tint,
        maxLines = 1,
        modifier =
            Modifier
                .clickable { onClick() }
                .testTag(tag)
                .semantics { contentDescription = label },
    )
}

/**
 * Tasks / People / Businesses / Posts — RN
 * `src/components/hub/HubDiscovery.tsx:9-14`. Selecting a tab re-requests
 * `GET /api/hub/discovery?filter=…`.
 */
@Composable
private fun DiscoveryFilterTabs(
    active: HubDiscoveryFilter,
    onSelect: (HubDiscoveryFilter) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .testTag("hubDiscoveryFilters"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        HubDiscoveryFilter.entries.forEach { tab ->
            val selected = tab == active
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (selected) PantopusColors.primary600 else PantopusColors.appSurface)
                        .border(
                            1.dp,
                            if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onSelect(tab) }
                        .padding(horizontal = 14.dp, vertical = 7.dp)
                        .testTag("hubDiscoveryFilter_${tab.queryValue}"),
            ) {
                Text(
                    tab.label,
                    style = PantopusTextStyle.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold),
                    color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun DiscoverySkeletonRail() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .testTag("hubDiscoverySkeleton"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        repeat(3) {
            Column(
                modifier =
                    Modifier
                        .width(140.dp)
                        .height(180.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
            ) {
                Shimmer(width = 140.dp, height = 80.dp, cornerRadius = Radii.xs)
                Column(
                    modifier = Modifier.padding(Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Shimmer(width = 116.dp, height = 11.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 70.dp, height = 9.dp, cornerRadius = Radii.xs)
                }
            }
        }
    }
}

@Composable
private fun DiscoveryEmptyRow() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(vertical = Spacing.s6)
                .testTag("hubDiscoveryEmpty"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "Nothing nearby yet",
            style = PantopusTextStyle.caption.copy(fontSize = 13.sp),
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun DiscoveryCard(
    item: DiscoveryCardContent,
    onTap: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .width(140.dp)
                .height(180.dp)
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .semantics { contentDescription = "${item.title}, ${item.meta}" },
    ) {
        // Top 80dp colored region with avatar / icon.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(item.tint.backgroundColor, item.tint.color),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            when (item.kind) {
                DiscoveryKind.Person ->
                    Box(
                        modifier =
                            Modifier
                                .size(54.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                                .border(BorderStroke(3.dp, Color.White), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            item.avatarInitials,
                            style = PantopusTextStyle.caption.copy(fontSize = 16.sp, fontWeight = FontWeight.Bold),
                            color = item.tint.color,
                        )
                    }
                DiscoveryKind.Business,
                DiscoveryKind.Gig,
                DiscoveryKind.Post,
                DiscoveryKind.Unknown,
                ->
                    PantopusIconImage(
                        icon = PantopusIcon.ShoppingBag,
                        contentDescription = null,
                        size = 32.dp,
                        tint = Color.White.copy(alpha = 0.85f),
                    )
            }
        }
        Column(
            modifier = Modifier.padding(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                item.title,
                style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                item.meta,
                style = PantopusTextStyle.caption.copy(fontSize = 11.sp),
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
            )
            Spacer(Modifier.weight(1f))
            Text(
                item.category.uppercase(),
                style =
                    PantopusTextStyle.caption.copy(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.3.sp,
                    ),
                color = item.tint.color,
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(item.tint.backgroundColor)
                        .padding(horizontal = Spacing.s2, vertical = 2.dp),
            )
        }
    }
}

// MARK: - Jump back in

@Composable
fun HubJumpBackIn(
    items: List<JumpBackItem>,
    onTap: (JumpBackItem) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.padding(horizontal = Spacing.s4)) { SectionHeader("Jump back in") }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            items.forEach { item ->
                JumpBackCard(item = item, onTap = { onTap(item) }, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun JumpBackCard(
    item: JumpBackItem,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .defaultMinSize(minHeight = 124.dp)
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .semantics { contentDescription = "${item.kicker}, ${item.title}" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(item.tint.backgroundColor),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = item.icon,
                contentDescription = null,
                size = 17.dp,
                tint = item.tint.color,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                item.kicker.uppercase(),
                style =
                    PantopusTextStyle.caption.copy(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp,
                    ),
                color = PantopusColors.appTextSecondary,
            )
            Text(
                item.title,
                style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                maxLines = 2,
            )
        }
        Spacer(Modifier.weight(1f))
        item.progressFraction?.let { fraction ->
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurfaceSunken),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                                .height(4.dp)
                                .clip(CircleShape)
                                .background(item.tint.color),
                    )
                }
                item.progressLabel?.let {
                    Text(it, style = PantopusTextStyle.caption.copy(fontSize = 10.sp), color = PantopusColors.appTextSecondary)
                }
            }
        }
    }
}

// MARK: - Recent activity

@Composable
fun HubRecentActivity(
    entries: List<ActivityEntry>,
    onSeeAll: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SectionHeader("Recent activity")
            Spacer(Modifier.weight(1f))
            Row(
                modifier =
                    Modifier
                        .clickable { onSeeAll() }
                        .testTag("hubRecentActivity.seeAll")
                        .semantics { contentDescription = "See all activity" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    "See all",
                    style = PantopusTextStyle.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.lg))
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        ) {
            entries.forEachIndexed { index, entry ->
                ActivityRow(entry)
                if (index < entries.size - 1) {
                    HorizontalDivider(
                        color = PantopusColors.appBorderSubtle,
                        thickness = 1.dp,
                        modifier = Modifier.padding(start = Spacing.s3 + 30.dp + Spacing.s2),
                    )
                }
            }
        }
    }
}

@Composable
private fun ActivityRow(entry: ActivityEntry) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = "${entry.title}, ${entry.timeAgo}" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(entry.tint.backgroundColor),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = entry.icon,
                contentDescription = null,
                size = 15.dp,
                tint = entry.tint.color,
            )
        }
        Text(
            entry.title,
            style = PantopusTextStyle.caption.copy(fontSize = 12.sp),
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
            maxLines = 2,
        )
        Text(
            entry.timeAgo,
            style = PantopusTextStyle.caption.copy(fontSize = 11.sp),
            color = PantopusColors.appTextMuted,
        )
    }
}

// MARK: - Floating setup-progress bar (first-run)

@Composable
fun HubFloatingProgress(
    fraction: Float,
    stepsDone: Int,
    stepsTotal: Int,
    onContinue: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .pantopusShadow(PantopusElevations.md, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        ProgressRing(fraction = fraction)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Complete your setup",
                style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
            )
            val remaining = (stepsTotal - stepsDone).coerceAtLeast(0)
            Text(
                "$stepsDone of $stepsTotal steps done · $remaining left",
                style = PantopusTextStyle.caption.copy(fontSize = 11.sp),
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onContinue)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                    .testTag("hubFloatingProgressContinue")
                    .semantics { contentDescription = "Continue setup" },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "Continue",
                style = PantopusTextStyle.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun ProgressRing(fraction: Float) {
    Box(
        modifier =
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.Canvas(modifier = Modifier.size(36.dp)) {
            val stroke = 5.dp.toPx()
            val sweep = (fraction.coerceIn(0f, 1f)) * 360f
            drawArc(
                color = PantopusColors.primary600,
                startAngle = -90f,
                sweepAngle = sweep,
                useCenter = false,
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "${(fraction * 100f).toInt()}%",
                style = PantopusTextStyle.caption.copy(fontSize = 11.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
            )
        }
    }
}

// MARK: - Skeleton

@Composable
fun HubSkeleton() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(top = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 40.dp, height = 40.dp, cornerRadius = Radii.xl2)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Shimmer(width = 80.dp, height = 11.dp)
                Shimmer(width = 160.dp, height = 16.dp)
            }
            Spacer(Modifier.weight(1f))
            Shimmer(width = 36.dp, height = 36.dp, cornerRadius = Radii.sm)
            Shimmer(width = 36.dp, height = 36.dp, cornerRadius = Radii.sm)
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            repeat(4) { Shimmer(width = 100.dp, height = 36.dp, cornerRadius = Radii.md) }
        }
        Shimmer(modifier = Modifier.padding(horizontal = Spacing.s4), width = 328.dp, height = 56.dp, cornerRadius = Radii.md)
        Shimmer(modifier = Modifier.padding(horizontal = Spacing.s4), width = 328.dp, height = 64.dp, cornerRadius = Radii.lg)
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            repeat(2) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 160.dp, height = 94.dp, cornerRadius = Radii.xl)
                    Shimmer(width = 160.dp, height = 94.dp, cornerRadius = Radii.xl)
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Shimmer(width = 110.dp, height = 11.dp)
            Spacer(Modifier.weight(1f))
            Shimmer(width = 44.dp, height = 11.dp)
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            repeat(3) { Shimmer(width = 140.dp, height = 180.dp, cornerRadius = Radii.lg) }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Shimmer(width = 110.dp, height = 11.dp)
            Spacer(Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Shimmer(width = 160.dp, height = 124.dp, cornerRadius = Radii.lg)
            Shimmer(width = 160.dp, height = 124.dp, cornerRadius = Radii.lg)
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Shimmer(width = 110.dp, height = 11.dp)
            Spacer(Modifier.weight(1f))
            Shimmer(width = 44.dp, height = 11.dp)
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        ) {
            repeat(3) { index ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Shimmer(width = 30.dp, height = 30.dp, cornerRadius = Radii.sm)
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        Shimmer(width = 220.dp, height = 10.dp)
                        Shimmer(width = 120.dp, height = 9.dp)
                    }
                    Shimmer(width = 22.dp, height = 9.dp)
                }
                if (index < 2) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
                }
            }
        }
        Spacer(Modifier.height(Spacing.s10))
    }
}
