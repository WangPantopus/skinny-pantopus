@file:Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList", "MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.you.me

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.MonthlyReceiptDto
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.identity.IdentityOption
import app.pantopus.android.ui.screens.shared.identity.IdentitySwitcherPillRow
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Designed Me tab — one chrome, three identity bindings. Hosts the
 * pill row (top of the gradient header), the 72pt verification-ring
 * avatar + name + tagline, the 3-tile stats card, the 2×3 action
 * grid, the section groups, and the destructive card at the bottom.
 * T6.2b re-skin.
 */
@Composable
fun MeView(
    onAction: (MeActionTile) -> Unit = {},
    onSection: (MeSectionRow) -> Unit = {},
    onLogOut: () -> Unit = {},
    /** True when opened from the `monthly_receipt` push — the receipt card
     *  renders expanded (RN `/(tabs)/profile?tab=receipt`). */
    expandMonthlyReceipt: Boolean = false,
    viewModel: MeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeIdentity by viewModel.activeIdentity.collectAsStateWithLifecycle()
    val monthlyReceipt by viewModel.monthlyReceipt.collectAsStateWithLifecycle()
    val inviteProgress by viewModel.inviteProgress.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.load() }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("meScreen")) {
        when (val s = state) {
            MeUiState.Loading -> LoadingFrame()
            is MeUiState.Error -> ErrorFrame(message = s.message, onRetry = { viewModel.refresh() })
            is MeUiState.Loaded -> {
                val active =
                    when (activeIdentity) {
                        MeIdentity.Personal -> s.personal
                        MeIdentity.Home -> s.home
                        MeIdentity.Business -> s.business
                    }
                PopulatedFrame(
                    active = active,
                    onSwitch = viewModel::selectIdentity,
                    onAction = onAction,
                    onSection = onSection,
                    onDestructive = {
                        when (active.identity) {
                            MeIdentity.Personal -> onLogOut()
                            else -> viewModel.selectIdentity(MeIdentity.Personal)
                        }
                    },
                    monthlyReceipt = monthlyReceipt,
                    expandMonthlyReceipt = expandMonthlyReceipt,
                    inviteProgress = inviteProgress,
                    onShareReceipt = {
                        viewModel.receiptShareMessage()?.let { shareText(context, it) }
                    },
                    onShareInvite = { shareText(context, viewModel.inviteShareMessage()) },
                )
            }
        }
    }
}

@Composable
private fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("meLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 320.dp, height = 200.dp, cornerRadius = Radii.lg)
        Shimmer(width = 320.dp, height = 70.dp, cornerRadius = Radii.lg)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Shimmer(width = 100.dp, height = 72.dp, cornerRadius = Radii.md)
            Shimmer(width = 100.dp, height = 72.dp, cornerRadius = Radii.md)
            Shimmer(width = 100.dp, height = 72.dp, cornerRadius = Radii.md)
        }
        Shimmer(width = 320.dp, height = 140.dp, cornerRadius = Radii.md)
    }
}

@Composable
internal fun PopulatedFrame(
    active: MeIdentityContent,
    onSwitch: (MeIdentity) -> Unit,
    onAction: (MeActionTile) -> Unit,
    onSection: (MeSectionRow) -> Unit,
    onDestructive: () -> Unit,
    monthlyReceipt: MonthlyReceiptDto? = null,
    expandMonthlyReceipt: Boolean = false,
    inviteProgress: InviteProgressDto? = null,
    onShareReceipt: () -> Unit = {},
    onShareInvite: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
    ) {
        MeHeader(content = active, onSwitch = onSwitch)
        if (!active.isUnbound) {
            MeStatsRow(
                stats = active.stats,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .padding(top = Spacing.s3),
            )
        }
        MeActionGrid(
            tiles = active.actionTiles,
            accent = active.identity.accent,
            isUnbound = active.isUnbound,
            onTap = onAction,
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s4),
        )
        // Personal-only profile insight cards (RN parity — the
        // `(tabs)/profile` screen renders both under the stats row).
        if (active.identity == MeIdentity.Personal) {
            monthlyReceipt?.let { receipt ->
                MonthlyReceiptCard(
                    receipt = receipt,
                    startExpanded = expandMonthlyReceipt,
                    onShare = onShareReceipt,
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s4)
                            .padding(top = Spacing.s4),
                )
            }
            inviteProgress?.let { progress ->
                InviteProgressCard(
                    progress = progress,
                    onShare = onShareInvite,
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s4)
                            .padding(top = Spacing.s4),
                )
            }
        }
        active.sections.forEach { section ->
            MeSectionGroup(
                section = section,
                onTap = onSection,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .padding(top = Spacing.s4),
            )
        }
        MeDestructiveCard(
            identity = active.identity,
            onClick = onDestructive,
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .padding(vertical = Spacing.s5),
        )
    }
}

@Composable
private fun MeHeader(
    content: MeIdentityContent,
    onSwitch: (MeIdentity) -> Unit,
) {
    val brush =
        Brush.verticalGradient(
            colors = content.identity.headerGradient,
        )
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(brush)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4)
                .testTag("meHeader_${content.identity.key}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        IdentitySwitcherPillRow(
            options =
                MeIdentity.entries.map { identity ->
                    IdentityOption(
                        id = identity.key,
                        label = identity.label,
                        icon = identity.icon,
                        accent = identity.accent,
                    )
                },
            activeId = content.identity.key,
            identifierPrefix = "meIdentityPill",
            onSelect = { key -> onSwitch(MeIdentity.fromKey(key)) },
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Avatar(content)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = content.displayName,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                    maxLines = 1,
                )
                Text(
                    text = content.handle,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextInverse.copy(alpha = 0.85f),
                    maxLines = 1,
                )
                if (!content.locality.isNullOrEmpty()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        PantopusIconImage(
                            icon = PantopusIcon.MapPin,
                            contentDescription = null,
                            size = 11.dp,
                            tint = PantopusColors.appTextInverse.copy(alpha = 0.85f),
                        )
                        Text(
                            text = content.locality,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appTextInverse.copy(alpha = 0.85f),
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        if (!content.tagline.isNullOrEmpty()) {
            Text(
                text = content.tagline,
                fontSize = 13.5.sp,
                color = PantopusColors.appTextInverse.copy(alpha = 0.9f),
                maxLines = 2,
            )
        }
    }
}

@Composable
private fun Avatar(content: MeIdentityContent) {
    Box(modifier = Modifier.size(76.dp), contentAlignment = Alignment.TopStart) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .shadow(elevation = 6.dp, shape = CircleShape)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors =
                                listOf(
                                    content.identity.accent,
                                    content.identity.accent.copy(alpha = 0.8f),
                                ),
                        ),
                    )
                    .border(3.dp, PantopusColors.appSurface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = content.initials,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (content.verified) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface)
                        .border(2.dp, content.identity.accent, CircleShape)
                        .testTag("meVerificationBadge")
                        .semantics { contentDescription = "Verified" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun MeStatsRow(
    stats: List<MeStat>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .testTag("meStatsRow"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        stats.forEachIndexed { index, stat ->
            Column(
                modifier = Modifier.weight(1f).padding(vertical = Spacing.s3),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = stat.value,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = stat.label.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (index < stats.size - 1) {
                Box(
                    modifier =
                        Modifier
                            .width(1.dp)
                            .height(36.dp)
                            .background(PantopusColors.appBorderSubtle),
                )
            }
        }
    }
}

@Composable
private fun MeActionGrid(
    tiles: List<MeActionTile>,
    accent: Color,
    isUnbound: Boolean,
    onTap: (MeActionTile) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        tiles.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                row.forEach { tile ->
                    ActionTile(
                        tile = tile,
                        accent = accent,
                        isUnbound = isUnbound,
                        onClick = { onTap(tile) },
                        modifier = Modifier.weight(1f),
                    )
                }
                // Pad the last row if it has fewer than 3 items.
                repeat(3 - row.size) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ActionTile(
    tile: MeActionTile,
    accent: Color,
    isUnbound: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val clickable =
        if (isUnbound) {
            modifier
        } else {
            modifier.clickable(onClick = onClick)
        }
    Box(
        modifier =
            clickable
                .height(72.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .testTag("meActionTile_${tile.id}"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(
                icon = tile.icon,
                contentDescription = null,
                size = Radii.xl2,
                tint = if (isUnbound) PantopusColors.appTextMuted else accent,
            )
            Text(
                text = tile.label,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (isUnbound) PantopusColors.appTextMuted else PantopusColors.appText,
                maxLines = 1,
            )
        }
        if (tile.badge != null && !isUnbound) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .heightIn(min = 16.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .padding(horizontal = 5.dp, vertical = 1.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "${tile.badge}",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun MeSectionGroup(
    section: MeSection,
    onTap: (MeSectionRow) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = section.header.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(start = Spacing.s1),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface),
        ) {
            section.rows.forEachIndexed { index, row ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { onTap(row) }
                            .heightIn(min = 48.dp)
                            .padding(horizontal = 14.dp, vertical = Spacing.s3)
                            .testTag(row.testTag ?: "meSectionRow_${section.id}_${row.id}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    PantopusIconImage(
                        icon = row.icon,
                        contentDescription = null,
                        size = 17.dp,
                        tint = PantopusColors.appTextStrong,
                    )
                    Text(
                        text = row.label,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    if (!row.value.isNullOrEmpty()) {
                        Text(
                            text = row.value,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronRight,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
                if (index < section.rows.size - 1) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .padding(start = 14.dp + 17.dp + 12.dp)
                                .background(PantopusColors.appBorderSubtle),
                    )
                }
            }
        }
    }
}

@Composable
private fun MeDestructiveCard(
    identity: MeIdentity,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val (icon, label) =
        when (identity) {
            MeIdentity.Personal -> PantopusIcon.ArrowLeft to "Log out"
            MeIdentity.Home -> PantopusIcon.User to "Switch identity → Personal"
            MeIdentity.Business -> PantopusIcon.User to "Switch identity → Personal"
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick)
                .heightIn(min = 48.dp)
                .padding(horizontal = 14.dp, vertical = 14.dp)
                .testTag("meDestructiveCard_${identity.key}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = label,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.error,
        )
    }
}

@Composable
private fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("meError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "Couldn't load this tab",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(text = message, fontSize = 13.5.sp, color = PantopusColors.appTextSecondary)
        Spacer(modifier = Modifier.height(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
