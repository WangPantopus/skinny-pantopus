@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.audience_profile.broadcast_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.audience_profile.UpdateVisibility
import app.pantopus.android.ui.screens.audience_profile.tierColor
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun BroadcastDetailScreen(
    onBack: () -> Unit = {},
    onOverflow: () -> Unit = {},
    onReply: () -> Unit = {},
    onBoost: (() -> Unit)? = null,
    onPin: (() -> Unit)? = null,
    viewModel: BroadcastDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("broadcastDetail"),
    ) {
        TopBar(onBack = onBack, onOverflow = onOverflow)
        when (val current = state) {
            is BroadcastDetailUiState.Loading -> LoadingFrame()
            is BroadcastDetailUiState.Error ->
                ErrorFrame(message = current.message, onRetry = viewModel::load)
            is BroadcastDetailUiState.Loaded ->
                LoadedFrame(
                    loaded = current.content,
                    onReply = onReply,
                    onBoost = onBoost,
                    onPin = onPin,
                )
        }
    }
}

@Composable
private fun TopBar(
    onBack: () -> Unit,
    onOverflow: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("broadcastDetailBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "Broadcast",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onOverflow)
                        .testTag("broadcastDetailOverflow"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MoreHorizontal,
                    contentDescription = "More actions",
                    size = 22.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// MARK: - States

@Composable
internal fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("broadcastDetailLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 360.dp, height = 180.dp, cornerRadius = Radii.xl)
        Shimmer(width = 360.dp, height = 72.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 96.dp, cornerRadius = Radii.lg)
        repeat(3) { Shimmer(width = 360.dp, height = 72.dp, cornerRadius = Radii.lg) }
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
                .testTag("broadcastDetailError"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "Couldn't load broadcast",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s4))
        PrimaryButton(
            title = "Try again",
            onClick = onRetry,
            modifier = Modifier.testTag("broadcastDetailRetry"),
        )
    }
}

@Composable
internal fun LoadedFrame(
    loaded: BroadcastDetailLoaded,
    onReply: () -> Unit,
    onBoost: (() -> Unit)?,
    onPin: (() -> Unit)?,
) {
    Scaffold(
        modifier = Modifier.fillMaxSize().testTag("broadcastDetailContent"),
        containerColor = PantopusColors.appBg,
        bottomBar = {
            StickyFooter(onReply = onReply, onBoost = onBoost, onPin = onPin)
        },
    ) { inner ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(inner)
                    .verticalScroll(rememberScrollState())
                    .padding(PaddingValues(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4, bottom = Spacing.s4)),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            HeroCard(loaded.hero)
            AnalyticsGrid(loaded.analyticsCells)
            TierBreakdownCard(loaded.tierBreakdown)
            RepliesSection(loaded)
        }
    }
}

// MARK: - Hero

@Composable
private fun HeroCard(hero: BroadcastDetailHero) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("broadcastDetailHero"),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                VisibilityChip(hero)
                Text(
                    text = hero.timestamp.ifEmpty { "Just now" },
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Text(
                text = hero.body,
                fontSize = 15.sp,
                color = PantopusColors.appText,
                modifier = Modifier.fillMaxWidth().testTag("broadcastDetailBody"),
            )
        }
        if (hero.mediaUrl != null) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(160.dp)
                        .background(PantopusColors.appSurfaceSunken)
                        .testTag("broadcastDetailMedia")
                        .semantics { contentDescription = "Broadcast media" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Image,
                    contentDescription = null,
                    size = 28.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun VisibilityChip(hero: BroadcastDetailHero) {
    val icon =
        when (hero.visibility) {
            UpdateVisibility.Public -> PantopusIcon.RadioTower
            UpdateVisibility.Followers -> PantopusIcon.Users
            UpdateVisibility.TierOrAbove -> PantopusIcon.Lock
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .padding(horizontal = 7.dp, vertical = 2.dp)
                .testTag("broadcastDetailVisibilityChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.primary700,
        )
        Text(
            text = hero.visibilityLabel.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
            letterSpacing = 0.4.sp,
        )
    }
}

// MARK: - Analytics grid

@Composable
private fun AnalyticsGrid(cells: List<BroadcastAnalyticsCell>) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("broadcastDetailAnalytics"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // 2x2 grid: render in pairs of two.
        cells.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                row.forEach { cell ->
                    AnalyticsCell(
                        cell = cell,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (row.size == 1) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun AnalyticsCell(
    cell: BroadcastAnalyticsCell,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3)
                .testTag("broadcastDetailCell_${cell.id}"),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = cell.label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.6.sp,
        )
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = cell.value,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            cell.sub?.let {
                Text(
                    text = it,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.success,
                )
            }
        }
    }
}

// MARK: - Tier breakdown

@Composable
private fun TierBreakdownCard(breakdown: BroadcastTierBreakdown) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("broadcastDetailTierBreakdown"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "READ BY TIER",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.6.sp,
            modifier = Modifier.semantics { heading() },
        )
        if (breakdown.segments.isEmpty()) {
            Text(
                text = "Per-tier breakdown will appear once reads roll in.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        } else {
            TierStackedBar(breakdown)
            TierLegend(breakdown)
        }
    }
}

@Composable
private fun TierStackedBar(breakdown: BroadcastTierBreakdown) {
    val summary = tierBarSummary(breakdown)
    BoxWithConstraints(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(10.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .semantics { contentDescription = summary }
                .testTag("broadcastDetailTierBar"),
    ) {
        val totalWidth = maxWidth
        if (breakdown.total <= 0) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .background(PantopusColors.appBorder),
            )
        } else {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s0)) {
                breakdown.segments.forEach { seg ->
                    val proportion = seg.count.toFloat() / breakdown.total.toFloat()
                    val width = totalWidth * proportion
                    val displayed = if (seg.count > 0 && width < 4.dp) 4.dp else width
                    Box(
                        modifier =
                            Modifier
                                .width(displayed)
                                .height(10.dp)
                                .background(tierColor(seg.rank)),
                    )
                }
            }
        }
    }
}

@Composable
private fun TierLegend(breakdown: BroadcastTierBreakdown) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        breakdown.segments.chunked(2).forEach { rowSegments ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                rowSegments.forEach { seg ->
                    LegendEntry(seg, breakdown.total, modifier = Modifier.weight(1f))
                }
                if (rowSegments.size == 1) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun LegendEntry(
    segment: BroadcastTierBreakdown.Segment,
    total: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .testTag("broadcastDetailTierLegend_${segment.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(tierColor(segment.rank)),
        )
        Text(
            text = segment.name,
            fontSize = 12.sp,
            color = PantopusColors.appTextStrong,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = "${segment.count}",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "· ${segment.percent(total)}%",
            fontSize = 11.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

private fun tierBarSummary(breakdown: BroadcastTierBreakdown): String {
    if (breakdown.segments.isEmpty()) return "No reads yet"
    val parts =
        breakdown.segments.joinToString(", ") {
            "${it.name} ${it.count}, ${it.percent(breakdown.total)} percent"
        }
    return "Reads by tier: $parts"
}

// MARK: - Replies

@Composable
private fun RepliesSection(loaded: BroadcastDetailLoaded) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("broadcastDetailRepliesSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "REPLIES · ${loaded.totalReplies}",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.6.sp,
            modifier = Modifier.semantics { heading() },
        )
        if (loaded.replies.isEmpty()) {
            EmptyRepliesCard()
        } else {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
            ) {
                loaded.replies.forEachIndexed { index, reply ->
                    ReplyRow(reply)
                    if (index < loaded.replies.lastIndex) {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(PantopusColors.appBorderSubtle),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyRepliesCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s5)
                .testTag("broadcastDetailEmptyReplies"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MessageCircle,
            contentDescription = null,
            size = 28.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "No replies yet",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Reply first — your followers will see your message under this broadcast.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ReplyRow(reply: BroadcastReplyRow) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("broadcastDetailReply_${reply.id}"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = reply.displayName.take(1).uppercase(),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary700,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = reply.handle,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                TierChip(name = reply.tierName, rank = reply.tierRank)
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = reply.timeAgo,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
            Text(
                text = reply.body,
                fontSize = 13.sp,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun TierChip(
    name: String,
    rank: Int,
) {
    val color = tierColor(rank)
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(color.copy(alpha = 0.12f))
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = name.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            letterSpacing = 0.4.sp,
        )
    }
}

// MARK: - Sticky footer

@Composable
private fun StickyFooter(
    onReply: () -> Unit,
    onBoost: (() -> Unit)?,
    onPin: (() -> Unit)?,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("broadcastDetailFooter")) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            onBoost?.let { boost ->
                SecondaryFooterButton(
                    icon = PantopusIcon.Rocket,
                    label = "Boost",
                    onClick = boost,
                    modifier = Modifier.testTag("broadcastDetailBoost"),
                )
            }
            onPin?.let { pin ->
                SecondaryFooterButton(
                    icon = PantopusIcon.Pin,
                    label = "Pin",
                    onClick = pin,
                    modifier = Modifier.testTag("broadcastDetailPin"),
                )
            }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onReply)
                        .padding(horizontal = Spacing.s4)
                        .testTag("broadcastDetailReply")
                        .semantics { contentDescription = "Reply to broadcast" },
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Reply,
                        contentDescription = null,
                        size = 14.dp,
                        strokeWidth = 2.4f,
                        tint = PantopusColors.appTextInverse,
                    )
                    Text(
                        text = "Reply",
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
private fun SecondaryFooterButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .widthIn(min = 88.dp)
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2.0f,
            tint = PantopusColors.appTextStrong,
        )
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}
