@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")
@file:OptIn(ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.creator_audience

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
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
import kotlinx.coroutines.delay

private const val AVATAR_SIZE = 44
private const val DIVIDER_INSET = 68

/** Pixels from the bottom of the scroll extent that count as "end reached". */
private const val END_REACHED_SLOP = 240

@Composable
fun YourAudienceScreen(
    onBack: () -> Unit = {},
    viewModel: YourAudienceViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val counts by viewModel.counts.collectAsStateWithLifecycle()
    val tierNames by viewModel.tierNames.collectAsStateWithLifecycle()
    val overflowTarget by viewModel.overflowTarget.collectAsStateWithLifecycle()
    val blockTarget by viewModel.blockTarget.collectAsStateWithLifecycle()
    val sort by viewModel.sort.collectAsStateWithLifecycle()
    val isLoadingMore by viewModel.isLoadingMore.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val pendingUndo by viewModel.pendingUndo.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("audienceScreen"),
    ) {
        TopBar(
            countLine = audienceCountLine(counts),
            sortLabel = sort.label,
            onBack = onBack,
            onCycleSort = viewModel::cycleSort,
        )

        if (state is YourAudienceUiState.Loaded) {
            FilterChips(
                counts = counts,
                tierNames = tierNames,
                selected = filter,
                onSelect = viewModel::selectFilter,
            )
        }

        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            when (val current = state) {
                is YourAudienceUiState.Loading -> LoadingFrame()
                is YourAudienceUiState.Empty -> EmptyFrame(onShareBeacon = viewModel::shareBeacon)
                is YourAudienceUiState.Error -> ErrorFrame(message = current.message, onRetry = viewModel::refresh)
                is YourAudienceUiState.Loaded ->
                    LoadedContent(
                        loaded = current.loaded,
                        filter = filter,
                        pendingCount = counts.pending,
                        isLoadingMore = isLoadingMore,
                        onApprove = viewModel::approve,
                        onDecline = viewModel::decline,
                        onOverflow = viewModel::openOverflow,
                        onEndReached = viewModel::loadMore,
                    )
            }

            UndoToastOverlay(pending = pendingUndo, onUndo = viewModel::undoPendingAction)
            if (pendingUndo == null) {
                ToastOverlay(message = toast, onDismiss = viewModel::consumeToast)
            }
        }
    }

    overflowTarget?.let { member ->
        ModalBottomSheet(onDismissRequest = viewModel::dismissOverflow) {
            OverflowSheetContent(
                member = member,
                onMessage = { viewModel.message(member) },
                onChangeTier = { viewModel.changeTier(member) },
                onMute = { viewModel.mute(member) },
                onUnmute = { viewModel.unmute(member) },
                onRemove = { viewModel.remove(member) },
                onBlock = { viewModel.requestBlock(member) },
            )
        }
    }

    blockTarget?.let { member ->
        AlertDialog(
            onDismissRequest = viewModel::dismissBlock,
            title = { Text("Block follower?") },
            text = { Text(viewModel.blockConfirmationMessage(member)) },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmBlock(member) },
                    modifier = Modifier.testTag("audienceBlockConfirm"),
                ) {
                    Text("Block", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissBlock) { Text("Cancel") }
            },
        )
    }
}

// ── Top bar ──

@Composable
private fun TopBar(
    countLine: String,
    sortLabel: String,
    onBack: () -> Unit,
    onCycleSort: () -> Unit,
) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .background(PantopusColors.appSurface),
        ) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .padding(start = Spacing.s1)
                        .size(40.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 24.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appText,
                )
            }
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = Spacing.s1)
                        .size(40.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onCycleSort)
                        .testTag("audienceSortButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ArrowDownUp,
                    contentDescription = "Sort: $sortLabel",
                    size = 20.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appText,
                )
            }
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "Your audience",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = countLine,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

// ── Filter chips ──

@Composable
private fun FilterChips(
    counts: AudienceCounts,
    tierNames: Map<Int, String>,
    selected: AudienceFilter,
    onSelect: (AudienceFilter) -> Unit,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("audienceFilterChips"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            ChipButton(
                label = "All",
                count = null,
                selected = selected is AudienceFilter.All,
                testTag = "audienceChip.all",
                onClick = { onSelect(AudienceFilter.All) },
            )
            ChipButton(
                label = "Pending",
                count = counts.pending,
                selected = selected is AudienceFilter.Pending,
                testTag = "audienceChip.pending",
                onClick = { onSelect(AudienceFilter.Pending) },
            )
            audienceTierChips(counts, tierNames).forEach { chip ->
                ChipButton(
                    label = chip.name,
                    count = chip.count,
                    selected = (selected as? AudienceFilter.Tier)?.rank == chip.rank,
                    testTag = "audienceChip.tier${chip.rank}",
                    onClick = { onSelect(AudienceFilter.Tier(chip.rank)) },
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Composable
private fun ChipButton(
    label: String,
    count: Int?,
    selected: Boolean,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.primary600 else PantopusColors.appSurface)
                .then(
                    if (selected) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    },
                )
                .clickable(onClick = onClick)
                .height(30.dp)
                .padding(horizontal = Spacing.s3)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
        )
        if (count != null) {
            Text(
                text = "· $count",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
            )
        }
    }
}

// ── Loaded content ──

@Composable
private fun LoadedContent(
    loaded: AudienceLoaded,
    filter: AudienceFilter,
    pendingCount: Int,
    isLoadingMore: Boolean,
    onApprove: (AudienceMember) -> Unit,
    onDecline: (AudienceMember) -> Unit,
    onOverflow: (AudienceMember) -> Unit,
    onEndReached: () -> Unit,
) {
    val scrollState = rememberScrollState()
    // Mirrors RN's `onEndReached` — the view-model no-ops unless the server
    // reported another page. The list is a plain scrolling Column (tier
    // sections, not a flat lazy list), so the trigger keys off scroll extent.
    LaunchedEffect(scrollState.value, scrollState.maxValue) {
        if (scrollState.maxValue > 0 && scrollState.value >= scrollState.maxValue - END_REACHED_SLOP) {
            onEndReached()
        }
    }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(top = Spacing.s2, bottom = Spacing.s6),
    ) {
        if (filter.showsPendingSection) {
            SectionHeader(
                label = "Pending requests",
                count = pendingCount,
                tint = PantopusColors.warning,
                testTag = "audienceSection.pending",
            )
            if (loaded.pending.isEmpty()) {
                InlineNoPending()
            } else {
                GroupCard {
                    loaded.pending.forEachIndexed { index, member ->
                        if (index > 0) RowDivider()
                        PendingRow(member = member, onApprove = onApprove, onDecline = onDecline)
                    }
                }
            }
            if (filter is AudienceFilter.Pending) {
                HelperText()
            }
        }

        if (filter.showsTierGroups) {
            loaded.tierGroups.forEach { group ->
                SectionHeader(
                    label = group.name,
                    count = group.members.size,
                    tint = audienceTierColor(group.rank),
                    testTag = "audienceSection.tier${group.rank}",
                )
                GroupCard {
                    group.members.forEachIndexed { index, member ->
                        if (index > 0) RowDivider()
                        MemberRow(member = member, onOverflow = onOverflow)
                    }
                }
            }
        }

        if (isLoadingMore) {
            LoadMoreFooter()
        }
    }
}

/** Next-page indicator. RN renders the same footer under its
 *  `onEndReached` loader (`src/app/audience/members.tsx:320-326`). */
@Composable
private fun LoadMoreFooter() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.s4)
                .testTag("audienceLoadingMore"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Shimmer(width = 90.dp, height = 12.dp)
        Text(
            text = "Loading more…",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun PendingRow(
    member: AudienceMember,
    onApprove: (AudienceMember) -> Unit,
    onDecline: (AudienceMember) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s3)
                .testTag("audienceRow.${member.membershipId}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MemberAvatar(member)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                NameLine(member)
                Text(
                    text = member.handle,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    TierPill(rank = member.tierRank, name = member.tierName)
                    Text(
                        text = AudienceFormat.requestedLabel(member.joinedMonth),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextMuted,
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.End),
        ) {
            PillButton(
                label = "Decline",
                icon = PantopusIcon.X,
                filled = false,
                testTag = "audiencePending.decline",
                onClick = { onDecline(member) },
            )
            PillButton(
                label = "Approve",
                icon = PantopusIcon.Check,
                filled = true,
                testTag = "audiencePending.approve",
                onClick = { onApprove(member) },
            )
        }
    }
}

@Composable
private fun MemberRow(
    member: AudienceMember,
    onOverflow: (AudienceMember) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s3)
                .testTag("audienceRow.${member.membershipId}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MemberAvatar(member)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            NameLine(member)
            Text(
                text = member.handle,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            AudienceFormat.memberSinceLabel(member.joinedMonth)?.let { since ->
                Text(
                    text = since,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        if (member.isMuted) {
            PantopusIconImage(
                icon = PantopusIcon.BellOff,
                contentDescription = "Muted",
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .clickable { onOverflow(member) }
                    .testTag("audienceRow.overflow"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = "More options for ${member.displayName}",
                size = 18.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

// ── Row pieces ──

@Composable
private fun NameLine(member: AudienceMember) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = member.displayName,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.widthIn(max = 200.dp),
        )
        if (member.verifiedLocal) {
            LocalBadge()
        }
    }
}

@Composable
private fun LocalBadge() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successLight)
                .padding(horizontal = Spacing.s1, vertical = 1.dp)
                .testTag("audienceRow.localBadge"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = 9.dp,
            strokeWidth = 2.6f,
            tint = PantopusColors.success,
        )
        Text(text = "Local", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.success)
    }
}

@Composable
private fun TierPill(
    rank: Int,
    name: String,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(audienceTierBg(rank))
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = audienceTierIcon(rank),
            contentDescription = null,
            size = 9.dp,
            strokeWidth = 2.5f,
            tint = audienceTierColor(rank),
        )
        Text(text = name, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = audienceTierColor(rank))
    }
}

@Composable
private fun PillButton(
    label: String,
    icon: PantopusIcon,
    filled: Boolean,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (filled) PantopusColors.primary600 else PantopusColors.appSurface)
                .then(
                    if (filled) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill))
                    },
                )
                .clickable(onClick = onClick)
                .height(32.dp)
                .padding(horizontal = Spacing.s4)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = if (filled) 3f else 2.6f,
            tint = if (filled) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
        )
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = if (filled) FontWeight.Bold else FontWeight.SemiBold,
            color = if (filled) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun SectionHeader(
    label: String,
    count: Int,
    tint: Color,
    testTag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s2)
                .padding(top = Spacing.s3)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            color = tint,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(text = "·", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextMuted)
        Text(text = "$count", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextMuted)
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

@Composable
private fun GroupCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        content()
    }
}

@Composable
private fun RowDivider() {
    Box(
        modifier =
            Modifier
                .padding(start = DIVIDER_INSET.dp)
                .fillMaxWidth()
                .height(1.dp)
                .background(PantopusColors.appBorderSubtle),
    )
}

@Composable
private fun InlineNoPending() {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4)
                .testTag("audienceNoPending"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Inbox,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "No pending requests",
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun HelperText() {
    Text(
        text = "Approve to add someone to their requested tier. Declining is silent — they aren't notified.",
        fontSize = 12.sp,
        color = PantopusColors.appTextMuted,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4),
    )
}

@Composable
private fun MemberAvatar(
    member: AudienceMember,
    size: Dp = AVATAR_SIZE.dp,
) {
    val palette =
        listOf(
            PantopusColors.primary600,
            PantopusColors.business,
            PantopusColors.success,
            PantopusColors.warning,
        )
    val tint = palette[audienceStableIndex(member.handle, palette.size)]
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(tint),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = audienceInitials(member.displayName),
            color = PantopusColors.appTextInverse,
            fontSize = if (size >= AVATAR_SIZE.dp) 16.sp else 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// ── Empty / error / loading ──

@Composable
private fun EmptyFrame(onShareBeacon: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s6)
                .testTag("audienceEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
    ) {
        Box(
            modifier = Modifier.size(76.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UsersRound,
                contentDescription = null,
                size = 33.dp,
                strokeWidth = 1.7f,
                tint = PantopusColors.primary600,
            )
        }
        Text(text = "No audience yet", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "When people follow your Beacon, they'll appear here — and join requests land at the top to approve.",
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.widthIn(max = 280.dp),
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onShareBeacon)
                    .height(46.dp)
                    .padding(horizontal = Spacing.s6)
                    .testTag("audienceShareBeacon"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Share,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
            Text(text = "Share your Beacon", fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Megaphone,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Post a broadcast to get discovered nearby",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
        }
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
                .padding(horizontal = Spacing.s6)
                .testTag("audienceError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UsersRound,
                contentDescription = null,
                size = 32.dp,
                strokeWidth = 1.7f,
                tint = PantopusColors.appTextMuted,
            )
        }
        Text(text = "Couldn't load your audience", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .height(44.dp)
                    .padding(horizontal = Spacing.s6)
                    .testTag("audienceRetry"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = "Retry", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
    }
}

@Composable
private fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(top = Spacing.s2)
                .testTag("audienceLoading"),
    ) {
        repeat(2) {
            Shimmer(
                width = 120.dp,
                height = 12.dp,
                modifier = Modifier.padding(start = Spacing.s5, top = Spacing.s4, bottom = Spacing.s2),
            )
            Column(
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s3)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
            ) {
                repeat(2) { row ->
                    if (row > 0) RowDivider()
                    Row(
                        modifier = Modifier.padding(Spacing.s3),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        Shimmer(width = AVATAR_SIZE.dp, height = AVATAR_SIZE.dp, cornerRadius = Radii.pill)
                        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                            Shimmer(width = 150.dp, height = 12.dp)
                            Shimmer(width = 90.dp, height = 10.dp)
                        }
                    }
                }
            }
        }
    }
}

// ── Overflow sheet ──

@Composable
private fun OverflowSheetContent(
    member: AudienceMember,
    onMessage: () -> Unit,
    onChangeTier: () -> Unit,
    onMute: () -> Unit,
    onUnmute: () -> Unit,
    onRemove: () -> Unit,
    onBlock: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .padding(bottom = Spacing.s6)
                .testTag("audienceOverflowSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(text = member.displayName, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(text = member.handle, fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
        Spacer(modifier = Modifier.height(Spacing.s2))
        OverflowAction(
            icon = PantopusIcon.MessageCircle,
            label = "Message",
            tint = PantopusColors.appText,
            testTag = "audienceOverflow.message",
            onClick = onMessage,
        )
        OverflowAction(
            icon = PantopusIcon.Crown,
            label = "Change tier",
            tint = PantopusColors.appText,
            testTag = "audienceOverflow.changeTier",
            onClick = onChangeTier,
        )
        // Reversible action first, so Remove/Block are harder to fat-finger —
        // mirrors RN's AudienceMemberSheet ordering.
        if (member.isMuted) {
            OverflowAction(
                icon = PantopusIcon.Bell,
                label = "Unmute",
                subtitle = "Restore their access to your updates",
                tint = PantopusColors.appText,
                testTag = "audienceOverflow.unmute",
                onClick = onUnmute,
            )
        } else {
            OverflowAction(
                icon = PantopusIcon.BellOff,
                label = "Mute this member",
                subtitle = "They won't receive your broadcasts. Reversible.",
                tint = PantopusColors.appText,
                testTag = "audienceOverflow.mute",
                onClick = onMute,
            )
        }
        OverflowAction(
            icon = PantopusIcon.UserMinus,
            label = "Remove",
            tint = PantopusColors.error,
            testTag = "audienceOverflow.remove",
            onClick = onRemove,
        )
        OverflowAction(
            icon = PantopusIcon.Ban,
            label = "Block",
            subtitle = "They lose access to follower-only updates.",
            tint = PantopusColors.error,
            testTag = "audienceOverflow.block",
            onClick = onBlock,
        )
    }
}

@Composable
private fun OverflowAction(
    icon: PantopusIcon,
    label: String,
    tint: Color,
    testTag: String,
    onClick: () -> Unit,
    subtitle: String? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, strokeWidth = 2f, tint = tint)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = label, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = tint)
            if (subtitle != null) {
                Text(text = subtitle, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

// ── Toast ──

@Composable
private fun BoxScope.ToastOverlay(
    message: String?,
    onDismiss: () -> Unit,
) {
    if (message == null) return
    LaunchedEffect(message) {
        delay(2500)
        onDismiss()
    }
    Box(
        modifier =
            Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = Spacing.s8)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("audienceToast"),
    ) {
        Text(text = message, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextInverse)
    }
}

/**
 * Destructive-action undo toast. The row is already gone; tapping the toast
 * puts it back and cancels the pending `PATCH`. The view-model owns the
 * 5-second window, so this overlay simply mirrors it.
 */
@Composable
private fun BoxScope.UndoToastOverlay(
    pending: PendingAudienceUndo?,
    onUndo: () -> Unit,
) {
    if (pending == null) return
    Row(
        modifier =
            Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = Spacing.s8)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .clickable(onClick = onUndo)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("audienceUndoToast"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Undo2,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = pending.message,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextInverse,
        )
    }
}

// ── Avatar helpers ──

private fun audienceInitials(name: String): String {
    val letters =
        name.trim().split(" ")
            .filter { it.isNotEmpty() }
            .take(2)
            .map { it.first().uppercaseChar() }
            .joinToString("")
    return letters.ifEmpty { "?" }
}

private fun audienceStableIndex(
    seed: String,
    count: Int,
): Int {
    if (count <= 0) return 0
    var sum = 0
    for (ch in seed) {
        sum = (sum + ch.code) % count
    }
    return sum
}
