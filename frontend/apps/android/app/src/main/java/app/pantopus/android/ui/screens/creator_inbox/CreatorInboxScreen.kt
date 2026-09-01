@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.creator_inbox

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P1.2 Creator Inbox — standalone DM thread list for creators. Mirrors
 * iOS `CreatorInboxView`: status banner counts, filter chip strip
 * (All / Unread / Bronze+ / Flagged) with live counts, avatar-first
 * thread rows reusing the chat-list visual language plus a tier chip
 * and flagged indicator. Tap a row to push the persona-DM thread
 * (`PersonaDmThreadScreen`) via [onOpenThread], addressed by thread id —
 * not generic chat.
 */
@Composable
fun CreatorInboxScreen(
    onBack: () -> Unit = {},
    onOpenThread: (CreatorInboxRowContent) -> Unit = {},
    onOpenBroadcast: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    viewModel: CreatorInboxViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeFilter by viewModel.activeFilter.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    val headerHandle =
        when (val current = state) {
            is CreatorInboxUiState.Loaded -> current.content.header.handle
            is CreatorInboxUiState.Empty -> current.header.handle
            else -> null
        }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("creatorInbox"),
    ) {
        TopBar(handle = headerHandle, onBack = onBack)
        when (val current = state) {
            is CreatorInboxUiState.Loading -> LoadingFrame()
            is CreatorInboxUiState.Loaded ->
                LoadedFrame(
                    loaded = current.content,
                    activeFilter = activeFilter,
                    onSelectFilter = viewModel::selectFilter,
                    onOpenThread = onOpenThread,
                    onOpenSettings = onOpenSettings,
                )
            is CreatorInboxUiState.Empty ->
                EmptyFrame(
                    onBroadcast = onOpenBroadcast,
                    onSettings = onOpenSettings,
                )
            is CreatorInboxUiState.Error ->
                ErrorFrame(message = current.message, onRetry = viewModel::refresh)
        }
    }
}

// MARK: - Top bar

@Composable
private fun TopBar(
    handle: String?,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("creatorInboxBackButton")
                        .semantics { contentDescription = "Back" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
            Column(
                modifier = Modifier.weight(1f).testTag("creatorInboxTitle"),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "Creator inbox",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                if (!handle.isNullOrEmpty()) {
                    Text(
                        text = handle,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(36.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 19.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextStrong,
                    )
                }
                Box(
                    modifier = Modifier.size(36.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.SlidersHorizontal,
                        contentDescription = null,
                        size = 19.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextStrong,
                    )
                }
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
                .padding(Spacing.s4)
                .testTag("creatorInboxLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 320.dp, height = 36.dp, cornerRadius = Radii.sm)
        Shimmer(width = 320.dp, height = 44.dp, cornerRadius = 22.dp)
        repeat(5) { Shimmer(width = 320.dp, height = 68.dp, cornerRadius = Radii.lg) }
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
                .testTag("creatorInboxError"),
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
            text = "Couldn't load your inbox",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s4))
        PrimaryButton(
            title = "Try again",
            onClick = onRetry,
            modifier = Modifier.testTag("creatorInboxRetry"),
        )
    }
}

// MARK: - Loaded frame

@Composable
internal fun LoadedFrame(
    loaded: CreatorInboxLoaded,
    activeFilter: CreatorInboxFilter,
    onSelectFilter: (CreatorInboxFilter) -> Unit,
    onOpenThread: (CreatorInboxRowContent) -> Unit,
    onOpenSettings: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        CountsBanner(counts = loaded.counts, onSettings = onOpenSettings)
        FilterStrip(chips = loaded.chips, activeFilter = activeFilter, onSelect = onSelectFilter)
        ThreadList(
            rows = loaded.rows,
            isCrossPersona = loaded.header.isCrossPersona,
            onOpenThread = onOpenThread,
        )
    }
}

@Composable
private fun CountsBanner(
    counts: CreatorInboxCounts,
    onSettings: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurfaceMuted)
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .testTag("creatorInboxCounts")
                .semantics {
                    contentDescription =
                        "${counts.total} threads, ${counts.unread} unread, ${counts.flagged} flagged"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Inbox,
            contentDescription = null,
            size = 15.dp,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = countsAnnotated(counts),
            fontSize = 12.sp,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            modifier =
                Modifier
                    .heightIn(min = 28.dp)
                    .clickable(onClick = onSettings)
                    .testTag("creatorInboxSettingsLink"),
        ) {
            Text(
                text = "Settings",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = Radii.lg,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
}

@Composable
private fun countsAnnotated(counts: CreatorInboxCounts) =
    buildAnnotatedString {
        withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.appText)) {
            append("${counts.total}")
        }
        append(" threads · ")
        withStyle(
            SpanStyle(
                fontWeight = FontWeight.Bold,
                color = if (counts.unread > 0) PantopusColors.primary700 else PantopusColors.appTextStrong,
            ),
        ) { append("${counts.unread}") }
        append(" unread · ")
        withStyle(
            SpanStyle(
                fontWeight = FontWeight.Bold,
                color = if (counts.flagged > 0) PantopusColors.warning else PantopusColors.appTextStrong,
            ),
        ) { append("${counts.flagged}") }
        append(" flagged")
    }

// MARK: - Filter strip

@Composable
private fun FilterStrip(
    chips: List<CreatorInboxChipContent>,
    activeFilter: CreatorInboxFilter,
    onSelect: (CreatorInboxFilter) -> Unit,
) {
    val scroll = rememberScrollState()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("creatorInboxFilterStrip"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(scroll)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            chips.forEach { chip ->
                FilterChip(chip = chip, isActive = chip.filter == activeFilter, onSelect = onSelect)
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

@Composable
private fun FilterChip(
    chip: CreatorInboxChipContent,
    isActive: Boolean,
    onSelect: (CreatorInboxFilter) -> Unit,
) {
    val bg = if (isActive) PantopusColors.primary600 else PantopusColors.appSurface
    val border = if (isActive) PantopusColors.primary600 else PantopusColors.appBorder
    val fg = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong
    Row(
        modifier =
            Modifier
                .heightIn(min = 28.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(width = 1.dp, color = border, shape = RoundedCornerShape(Radii.pill))
                .clickable { onSelect(chip.filter) }
                .padding(horizontal = 11.dp, vertical = 5.dp)
                .testTag("creatorInboxChip_${chip.id}")
                .semantics {
                    contentDescription = "${chip.label}, ${chip.count}"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Text(
            text = chip.label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = fg,
        )
        Text(
            text = "${chip.count}",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = fg.copy(alpha = 0.85f),
        )
    }
}

// MARK: - Thread list

@Composable
private fun ThreadList(
    rows: List<CreatorInboxRowContent>,
    isCrossPersona: Boolean,
    onOpenThread: (CreatorInboxRowContent) -> Unit,
) {
    if (rows.isEmpty()) {
        FilteredEmpty()
        return
    }
    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("creatorInboxList"),
        contentPadding = PaddingValues(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        itemsIndexed(items = rows, key = { _, row -> row.id }) { index, row ->
            ThreadCard(
                row = row,
                isFirst = index == 0,
                isLast = index == rows.size - 1,
                isCrossPersona = isCrossPersona,
                onTap = { onOpenThread(row) },
            )
        }
    }
}

@Composable
private fun FilteredEmpty() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("creatorInboxFilteredEmpty"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Inbox,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = "No threads in this view",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = "Try another filter to see the rest of your inbox.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ThreadCard(
    row: CreatorInboxRowContent,
    isFirst: Boolean,
    isLast: Boolean,
    isCrossPersona: Boolean,
    onTap: () -> Unit,
) {
    val shape = threadCardShape(isFirst = isFirst, isLast = isLast)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = shape)
                .clickable(onClick = onTap)
                .heightIn(min = 56.dp)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("creatorInboxRow_${row.id}")
                .semantics { contentDescription = rowAccessibility(row) },
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Avatar(row = row)
            Column(modifier = Modifier.weight(1f)) {
                ThreadHeader(row = row, isCrossPersona = isCrossPersona)
                Spacer(modifier = Modifier.height(3.dp))
                ThreadPreview(row = row)
            }
            UnreadDot(row.unread)
        }
    }
    ThreadDivider(show = !isLast)
}

private fun threadCardShape(
    isFirst: Boolean,
    isLast: Boolean,
): RoundedCornerShape =
    when {
        isFirst && isLast -> RoundedCornerShape(14.dp)
        isFirst -> RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomStart = 0.dp, bottomEnd = 0.dp)
        isLast -> RoundedCornerShape(topStart = 0.dp, topEnd = 0.dp, bottomStart = 14.dp, bottomEnd = 14.dp)
        else -> RoundedCornerShape(0.dp)
    }

@Composable
private fun ThreadHeader(
    row: CreatorInboxRowContent,
    isCrossPersona: Boolean,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = if (row.handle.isEmpty()) row.displayName else row.handle,
            fontSize = 13.sp,
            fontWeight = if (row.unread) FontWeight.Bold else FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            modifier = Modifier.widthIn(max = 140.dp),
        )
        val tier = row.tierName
        if (tier != null) {
            Spacer(modifier = Modifier.width(6.dp))
            TierChip(tier = tier, rank = row.tierRank)
        }
        if (isCrossPersona && !row.personaChip.isNullOrEmpty()) {
            Spacer(modifier = Modifier.width(6.dp))
            PersonaChip(label = row.personaChip)
        }
        if (row.flagged) {
            Spacer(modifier = Modifier.width(6.dp))
            PantopusIconImage(
                icon = PantopusIcon.Flag,
                contentDescription = "Flagged",
                size = 11.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.warning,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = row.timeAgo,
            fontSize = 10.sp,
            fontWeight = if (row.unread) FontWeight.Bold else FontWeight.Medium,
            color = if (row.unread) PantopusColors.primary600 else PantopusColors.appTextMuted,
            maxLines = 1,
        )
    }
}

@Composable
private fun ThreadPreview(row: CreatorInboxRowContent) {
    Text(
        text = row.preview,
        fontSize = 12.sp,
        fontWeight = if (row.unread) FontWeight.SemiBold else FontWeight.Normal,
        color = if (row.unread) PantopusColors.appText else PantopusColors.appTextSecondary,
        maxLines = 2,
    )
}

@Composable
private fun UnreadDot(visible: Boolean) {
    if (visible) {
        Box(
            modifier =
                Modifier
                    .padding(top = Spacing.s2)
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600),
        )
    }
}

@Composable
private fun ThreadDivider(show: Boolean) {
    if (show) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4)
                        .height(1.dp)
                        .background(PantopusColors.appBorderSubtle),
            )
        }
    }
}

@Composable
private fun Avatar(row: CreatorInboxRowContent) {
    Box(modifier = Modifier.size(46.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary500),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = row.initials.ifEmpty { "?" },
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (row.verifiedLocal) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600)
                        .border(width = 2.dp, color = PantopusColors.appSurface, shape = CircleShape)
                        .semantics { contentDescription = "Verified" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.md,
                    strokeWidth = 4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun TierChip(
    tier: String,
    rank: Int,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(tierBgColor(rank))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        when {
            rank >= 4 ->
                PantopusIconImage(
                    icon = PantopusIcon.Crown,
                    contentDescription = null,
                    size = 9.dp,
                    strokeWidth = 2.4f,
                    tint = tierColor(rank),
                )
            rank >= 2 ->
                PantopusIconImage(
                    icon = PantopusIcon.Shield,
                    contentDescription = null,
                    size = 9.dp,
                    strokeWidth = 2.4f,
                    tint = tierColor(rank),
                )
            else -> Unit
        }
        Text(
            text = tier.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = tierColor(rank),
        )
    }
}

@Composable
private fun PersonaChip(label: String) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(
            text = label,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
        )
    }
}

private fun rowAccessibility(row: CreatorInboxRowContent): String {
    val parts = mutableListOf<String>()
    parts.add(row.displayName.ifEmpty { row.handle })
    row.tierName?.let { parts.add("$it tier") }
    if (row.verifiedLocal) parts.add("verified")
    if (row.flagged) parts.add("flagged")
    parts.add(row.preview)
    if (row.unread) parts.add("unread")
    parts.add(row.timeAgo)
    return parts.joinToString(". ")
}

// MARK: - Tier colors (rank → semantic token)
//
// Mirrors the rank → semantic-token mapping used in AudienceProfile's
// Threads tab so the chip on a Creator Inbox row reads the same. The
// design names (bronze / silver / gold) intentionally render via the
// existing tokens — bronze/silver/gold aren't in the token set, and
// the preamble forbids introducing new color values.

internal fun tierColor(rank: Int): Color =
    when (rank) {
        1 -> PantopusColors.appTextSecondary
        2 -> PantopusColors.warning
        3 -> PantopusColors.appTextStrong
        4 -> PantopusColors.warning
        else -> PantopusColors.appTextSecondary
    }

internal fun tierBgColor(rank: Int): Color =
    when (rank) {
        1 -> PantopusColors.appSurfaceSunken
        2 -> PantopusColors.warningBg
        3 -> PantopusColors.appSurfaceSunken
        4 -> PantopusColors.warningLight
        else -> PantopusColors.appSurfaceSunken
    }

// MARK: - Empty state (no threads at all)

@Composable
private fun EmptyFrame(
    onBroadcast: () -> Unit,
    onSettings: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 28.dp, vertical = Spacing.s8)
                .testTag("creatorInboxEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(88.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Inbox,
                contentDescription = null,
                size = 38.dp,
                strokeWidth = 1.7f,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.height(18.dp))
        Text(
            text = "No DM threads yet",
            fontSize = 19.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text =
                "Your fans haven't reached out. DMs usually start after a broadcast, " +
                    "a paywall reply, or a tip — try one of these to get the inbox moving.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.widthIn(max = 280.dp),
        )
        Spacer(modifier = Modifier.height(22.dp))
        EmptyPromptRow(
            id = "broadcast",
            icon = PantopusIcon.Megaphone,
            title = "Send a broadcast",
            sub = "Fans can reply privately to anything you post",
            cta = "Compose",
            onClick = onBroadcast,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        EmptyPromptRow(
            id = "unlock",
            icon = PantopusIcon.Shield,
            title = "Unlock fan DMs",
            sub = "Bronze+ fans can message you directly",
            cta = "Settings",
            onClick = onSettings,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        EmptyPromptRow(
            id = "tip",
            icon = PantopusIcon.HandCoins,
            title = "Enable tip-with-message",
            sub = "Tips arrive as paid DMs at the top of inbox",
            cta = "Turn on",
            onClick = onSettings,
        )
        Spacer(modifier = Modifier.height(18.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = Radii.lg,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Only verified fans can message. Spam is filtered out by default.",
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun EmptyPromptRow(
    id: String,
    icon: PantopusIcon,
    title: String,
    sub: String,
    cta: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .heightIn(min = 48.dp)
                .padding(horizontal = 14.dp, vertical = 11.dp)
                .testTag("creatorInboxPrompt_$id"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = Radii.xl,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = cta,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(
                icon = PantopusIcon.ArrowRight,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
    }
}
