@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mail_party

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.CompactButton
import app.pantopus.android.ui.components.CompactButtonSize
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.SectionHeader
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private const val TOAST_MS = 2_500L
private const val MS_PER_SECOND = 1_000L

/**
 * Family Mail Party — two frames behind one view-model. The discover frame
 * lists the household's live sessions plus the Home-drawer items a party
 * can start from; joining or starting swaps in the live-session frame
 * (reactions + hand-it-to roster).
 *
 * Both frames ship the four states: shimmer skeleton, [EmptyState], loaded
 * body, [ErrorState] with Retry.
 *
 * Mirrors iOS `MailPartyView`.
 */
@Composable
fun MailPartyScreen(
    onBack: () -> Unit,
    onOpenMail: (String) -> Unit,
    viewModel: MailPartyViewModel = hiltViewModel(),
) {
    val discover by viewModel.discover.collectAsStateWithLifecycle()
    val live by viewModel.live.collectAsStateWithLifecycle()
    val isStarting by viewModel.isStarting.collectAsStateWithLifecycle()
    val assigningMemberId by viewModel.assigningMemberId.collectAsStateWithLifecycle()
    val sendingReaction by viewModel.sendingReaction.collectAsStateWithLifecycle()
    val reactionEcho by viewModel.reactionEcho.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(TOAST_MS)
            viewModel.dismissToast()
        }
    }
    LaunchedEffect(reactionEcho) {
        val echo = reactionEcho ?: return@LaunchedEffect
        delay(echo.ttlSeconds.coerceAtLeast(1) * MS_PER_SECOND)
        viewModel.clearReactionEcho()
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("mailParty"),
    ) {
        OfflineBannerHost(isOffline = !online) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopBar(
                    subtitle = viewModel.liveSession?.status?.label ?: viewModel.discoverSubtitle,
                    isInSession = live != null,
                    // The live frame owns Back while it is up, so leaving a
                    // party lands on the discover list rather than popping
                    // the whole screen.
                    onBack = { if (live == null) onBack() else viewModel.closeSession() },
                )
                if (live == null) {
                    DiscoverFrame(
                        state = discover,
                        canStart = !isStarting,
                        onStart = viewModel::startParty,
                        onJoin = viewModel::join,
                        onDecline = { card -> viewModel.decline(card, onOpenMail) },
                        onRetry = viewModel::refresh,
                    )
                } else {
                    LiveFrame(
                        state = live,
                        sendingReaction = sendingReaction,
                        reactionGlyph = reactionEcho?.glyph,
                        assigningMemberId = assigningMemberId,
                        onReact = viewModel::send,
                        onAssign = viewModel::assign,
                        onRetry = viewModel::retryLiveSession,
                    )
                }
            }
        }
        toast?.let { payload ->
            Text(
                text = payload.text,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (payload.isError) PantopusColors.error else PantopusColors.appTextStrong)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("mailParty_toast"),
            )
        }
    }
}

// ── Chrome ────────────────────────────────────────────────────────

@Composable
private fun TopBar(
    subtitle: String,
    isInSession: Boolean,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBack)
                    .testTag("mailParty_back"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowLeft,
                contentDescription = if (isInSession) "Leave this party" else "Back to Mailbox",
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        Column {
            Text(
                text = "Mail Party",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = subtitle,
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun LoadingSkeleton(tag: String) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag(tag),
    ) {
        // [Shimmer] sizes itself from `width`; the modifier alone can't
        // stretch it, so the bars carry the same explicit width the rest
        // of the app's skeletons use.
        Shimmer(width = 160.dp, height = 14.dp, cornerRadius = Radii.xs)
        repeat(3) {
            Shimmer(width = 320.dp, height = 84.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        }
    }
}

// ── Discover frame ────────────────────────────────────────────────

@Composable
private fun DiscoverFrame(
    state: MailPartyDiscoverUiState,
    canStart: Boolean,
    onStart: (MailPartyStartableItem) -> Unit,
    onJoin: (MailPartySessionCard) -> Unit,
    onDecline: (MailPartySessionCard) -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is MailPartyDiscoverUiState.Loading -> LoadingSkeleton("mailParty_discoverLoading")

        is MailPartyDiscoverUiState.Empty ->
            EmptyState(
                icon = PantopusIcon.PartyPopper,
                headline = "No mail party right now",
                subcopy =
                    "Household mail lands in your Home drawer. When something " +
                        "arrives worth opening together, start a party here.",
                modifier = Modifier.testTag("mailParty_discoverEmpty"),
                ctaTitle = "Refresh",
                onCta = onRetry,
                tint = PantopusColors.homeBg,
                accent = PantopusColors.home,
            )

        is MailPartyDiscoverUiState.Loaded ->
            DiscoverBody(
                state = state,
                canStart = canStart,
                onStart = onStart,
                onJoin = onJoin,
                onDecline = onDecline,
            )

        is MailPartyDiscoverUiState.Error ->
            ErrorState(
                headline = "Couldn't load mail parties",
                message = state.message,
                modifier = Modifier.testTag("mailParty_discoverError"),
                onRetry = onRetry,
            )
    }
}

@Composable
private fun DiscoverBody(
    state: MailPartyDiscoverUiState.Loaded,
    canStart: Boolean,
    onStart: (MailPartyStartableItem) -> Unit,
    onJoin: (MailPartySessionCard) -> Unit,
    onDecline: (MailPartySessionCard) -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4)
                .testTag("mailParty_discoverList"),
    ) {
        if (state.sessions.isNotEmpty()) {
            item(key = "header-happening") { SectionHeader(title = "Happening now") }
            items(state.sessions, key = { it.sessionId }) { session ->
                SessionCard(
                    session = session,
                    canAct = canStart,
                    onJoin = { onJoin(session) },
                    onDecline = { onDecline(session) },
                )
            }
        }
        if (state.startable.isNotEmpty()) {
            item(key = "header-start") { SectionHeader(title = "Start a party") }
            items(state.startable, key = { it.mailId }) { item ->
                StartableRow(
                    item = item,
                    canStart = canStart,
                    onStart = { onStart(item) },
                )
            }
        }
    }
}

@Composable
private fun SessionCard(
    session: MailPartySessionCard,
    canAct: Boolean,
    onJoin: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("mailParty_session.${session.sessionId}"),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = session.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            StatusChip(
                text = session.status.label,
                variant =
                    if (session.status == MailPartyStatus.Active) {
                        StatusChipVariant.Success
                    } else {
                        StatusChipVariant.Warning
                    },
            )
        }
        Text(
            text = session.senderDisplay,
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        // [CompactButton] has no `enabled` flag, so a blocked CTA is dimmed
        // the way the rest of the app dims one — matching iOS's 0.5 opacity.
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CompactButton(
                title = "Join",
                variant = CompactButtonVariant.Primary,
                size = CompactButtonSize.Footer,
                onClick = { if (canAct) onJoin() },
                modifier =
                    Modifier
                        .weight(1f)
                        .alpha(if (canAct) 1f else 0.5f)
                        .testTag("mailParty_join.${session.sessionId}"),
            )
            CompactButton(
                title = "Open solo",
                variant = CompactButtonVariant.Ghost,
                size = CompactButtonSize.Footer,
                onClick = { if (canAct) onDecline() },
                modifier =
                    Modifier
                        .weight(1f)
                        .alpha(if (canAct) 1f else 0.5f)
                        .testTag("mailParty_decline.${session.sessionId}"),
            )
        }
    }
}

@Composable
private fun StartableRow(
    item: MailPartyStartableItem,
    canStart: Boolean,
    onStart: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .heightIn(min = 56.dp)
                .testTag("mailParty_startable.${item.mailId}"),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Mailbox,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.home,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = item.senderDisplay,
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        CompactButton(
            title = "Start",
            variant = CompactButtonVariant.Primary,
            size = CompactButtonSize.InlineAction,
            onClick = { if (canStart) onStart() },
            modifier =
                Modifier
                    .alpha(if (canStart) 1f else 0.5f)
                    .testTag("mailParty_start.${item.mailId}"),
        )
    }
}

// ── Live-session frame ────────────────────────────────────────────

@Composable
private fun LiveFrame(
    state: MailPartyLiveUiState?,
    sendingReaction: MailPartyReaction?,
    reactionGlyph: String?,
    assigningMemberId: String?,
    onReact: (MailPartyReaction) -> Unit,
    onAssign: (MailPartyMember) -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        null, is MailPartyLiveUiState.Loading -> LoadingSkeleton("mailParty_sessionLoading")

        is MailPartyLiveUiState.Empty ->
            LiveBody(
                session = state.session,
                rosterIsEmpty = true,
                sendingReaction = sendingReaction,
                reactionGlyph = reactionGlyph,
                assigningMemberId = assigningMemberId,
                onReact = onReact,
                onAssign = onAssign,
            )

        is MailPartyLiveUiState.Loaded ->
            LiveBody(
                session = state.session,
                rosterIsEmpty = false,
                sendingReaction = sendingReaction,
                reactionGlyph = reactionGlyph,
                assigningMemberId = assigningMemberId,
                onReact = onReact,
                onAssign = onAssign,
            )

        is MailPartyLiveUiState.Error ->
            ErrorState(
                headline = "Couldn't open the party",
                message = state.message,
                modifier = Modifier.testTag("mailParty_sessionError"),
                onRetry = onRetry,
            )
    }
}

@Composable
private fun LiveBody(
    session: MailPartyLiveSession,
    rosterIsEmpty: Boolean,
    sendingReaction: MailPartyReaction?,
    reactionGlyph: String?,
    assigningMemberId: String?,
    onReact: (MailPartyReaction) -> Unit,
    onAssign: (MailPartyMember) -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4)
                .testTag("mailParty_session"),
    ) {
        item(key = "opening") { OpeningCard(session) }
        item(key = "header-react") { SectionHeader(title = "React") }
        item(key = "reactions") {
            ReactionRow(
                sendingReaction = sendingReaction,
                reactionGlyph = reactionGlyph,
                onReact = onReact,
            )
        }
        item(key = "header-assign") { SectionHeader(title = "Hand it to") }
        if (rosterIsEmpty) {
            item(key = "roster-empty") { RosterEmptyCard() }
        } else {
            items(session.members, key = { it.userId }) { member ->
                MemberRow(
                    member = member,
                    isAssigning = assigningMemberId == member.userId,
                    canAssign = assigningMemberId == null,
                    onAssign = { onAssign(member) },
                )
            }
        }
    }
}

@Composable
private fun OpeningCard(session: MailPartyLiveSession) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("mailParty_sessionHeader"),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.PartyPopper,
            contentDescription = null,
            size = 28.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = session.title,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = session.senderDisplay,
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
        StatusChip(
            text = session.status.label,
            variant =
                if (session.status == MailPartyStatus.Active) {
                    StatusChipVariant.Success
                } else {
                    StatusChipVariant.Warning
                },
        )
    }
}

@Composable
private fun ReactionRow(
    sendingReaction: MailPartyReaction?,
    reactionGlyph: String?,
    onReact: (MailPartyReaction) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.fillMaxWidth(),
    ) {
        MailPartyReaction.entries.forEach { reaction ->
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, CircleShape)
                        .clickable(enabled = sendingReaction == null) { onReact(reaction) }
                        .testTag("mailParty_reaction.${reaction.slug}")
                        .semantics { contentDescription = reaction.label },
            ) {
                Text(text = reaction.glyph, fontSize = 22.sp)
            }
        }
        if (reactionGlyph != null) {
            Text(
                text = reactionGlyph,
                fontSize = 20.sp,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.successBg)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("mailParty_reactionEcho")
                        .semantics { contentDescription = "You reacted" },
            )
        }
    }
}

@Composable
private fun RosterEmptyCard() {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3)
                .testTag("mailParty_rosterEmpty"),
    ) {
        Text(
            text = "No one to hand this to",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Only household members can take this item. Invite someone to your home first.",
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun MemberRow(
    member: MailPartyMember,
    isAssigning: Boolean,
    canAssign: Boolean,
    onAssign: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(enabled = canAssign, onClick = onAssign)
                .padding(Spacing.s3)
                .heightIn(min = 56.dp)
                .testTag("mailParty_assign.${member.userId}")
                .semantics { contentDescription = "Hand it to ${member.name}" },
    ) {
        PantopusIconImage(
            icon = PantopusIcon.User,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextMuted,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = member.name,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            member.roleLabel?.let { role ->
                Text(
                    text = role,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        if (isAssigning) {
            CircularProgressIndicator(
                color = PantopusColors.primary600,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
            )
        } else {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}
