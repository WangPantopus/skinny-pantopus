@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.status.waiting_room

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.HaloCircle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.status.StatusCta
import app.pantopus.android.ui.screens.status.StatusPillView
import app.pantopus.android.ui.screens.status.StatusTimeline
import app.pantopus.android.ui.screens.status.StatusWaitingScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Hilt-backed host for the A18.4 waiting room. Reads the home id + frame off
 * the [WaitingRoomViewModel] (seeded from the nav arg) and forwards the
 * stubbed action handlers. [onBack] is the only live navigation.
 */
@Composable
fun WaitingRoomRoute(
    onBack: () -> Unit,
    onNav: (WaitingRoomNav) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: WaitingRoomViewModel = hiltViewModel(),
) {
    val content by viewModel.content.collectAsStateWithLifecycle()
    val phase by viewModel.phase.collectAsStateWithLifecycle()
    val navEvent by viewModel.navEvent.collectAsStateWithLifecycle()

    // Mirrors the iOS `.task` on `WaitingRoomView`: refetch on every
    // appearance so returning from evidence upload shows fresh claim state.
    LaunchedEffect(Unit) { viewModel.refresh() }

    LaunchedEffect(navEvent) {
        navEvent?.let {
            onNav(it)
            viewModel.consumeNavEvent()
        }
    }

    WaitingRoomScreen(
        content = content,
        modifier = modifier,
        phase = phase,
        onBack = onBack,
        onBell = viewModel::openNotifications,
        onInlineAction = viewModel::handleInlineAction,
        onPrimary = viewModel::handlePrimary,
        onSecondary = viewModel::handleSecondary,
        onRetry = viewModel::refresh,
        onVerificationAction = viewModel::handleVerificationAction,
    )
}

/**
 * A18.4 — the persistent waiting room. Mirrors iOS `WaitingRoomView`.
 * Bespoke single-frame layout that reuses the A18.2/A18.3 ceremonial
 * primitives ([HaloCircle], [StatusTimeline], [StatusPillView]) but adds the
 * room-only chrome the one-shot `StatusWaitingScreen` doesn't carry: a back +
 * bell top bar, a monospace claim-ref address row, an optional reviewer-note
 * card, and a 2-column "Manage this claim" inline-action grid.
 *
 * Pure presentational — the caller owns the content + stubbed action
 * handlers; [onBack] is the only live navigation.
 */
@Composable
fun WaitingRoomScreen(
    content: WaitingRoomContent,
    modifier: Modifier = Modifier,
    phase: WaitingRoomPhase = WaitingRoomPhase.Loaded,
    onBack: () -> Unit = {},
    onBell: () -> Unit = {},
    onInlineAction: (WaitingRoomInlineAction) -> Unit = {},
    onPrimary: (StatusCta) -> Unit = {},
    onSecondary: (StatusCta) -> Unit = {},
    onRetry: () -> Unit = {},
    onVerificationAction: (HomeVerificationAction) -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("waitingRoom"),
    ) {
        val title =
            if (phase is WaitingRoomPhase.Verification) {
                HomeVerificationContent.SCREEN_TITLE
            } else {
                content.title
            }
        TopBarWaitingRoom(title = title, onBack = onBack, onBell = onBell)
        when (phase) {
            is WaitingRoomPhase.Loading -> LoadingFrame(modifier = Modifier.weight(1f))
            is WaitingRoomPhase.Verification ->
                // RN's Verification Center — served on the same route when
                // the caller has no claim in review but their occupancy
                // still isn't verified.
                HomeVerificationFrame(
                    content = phase.content,
                    modifier = Modifier.weight(1f),
                    onAction = onVerificationAction,
                    onDone = onBack,
                )
            is WaitingRoomPhase.Notice ->
                NoticeFrame(
                    notice = phase.notice,
                    modifier = Modifier.weight(1f),
                    onCta = { if (phase.notice.isRetry) onRetry() else onBack() },
                )
            is WaitingRoomPhase.Approved ->
                // A18.2 "You're the owner". `StatusWaitingScreen` carries its
                // own sticky dock, so no extra chrome is added here.
                StatusWaitingScreen(
                    content = phase.content,
                    onPrimary = onPrimary,
                    onSecondary = onSecondary,
                    modifier = Modifier.weight(1f),
                    rootTestTag = "waitingRoomApproved",
                )
            is WaitingRoomPhase.Loaded -> {
                LoadedFrame(
                    content = content,
                    modifier = Modifier.weight(1f),
                    onInlineAction = onInlineAction,
                )
                StickyDock(
                    content = content,
                    onPrimary = onPrimary,
                    onSecondary = { cta ->
                        onSecondary(cta)
                        onBack()
                    },
                )
            }
        }
    }
}

@Composable
private fun LoadedFrame(
    content: WaitingRoomContent,
    modifier: Modifier = Modifier,
    onInlineAction: (WaitingRoomInlineAction) -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        HaloCircle(
            tone = content.halo.tone,
            icon = content.halo.icon,
            isPulsing = content.halo.isPulsing,
        )
        HeadlineBlock(content)
        AddressRow(address = content.address, claimRef = content.claimRef)
        content.reviewerNote?.let { ReviewerNoteCard(it) }
        StatusTimeline(
            stages = content.timeline,
            currentStageId = null,
            paused = content.timelinePaused,
            modifier = Modifier.testTag("waitingRoomTimeline"),
        )
        StatusPillView(content.etaPill)
        ManageSection(content, onInlineAction)
        Spacer(modifier = Modifier.height(Spacing.s4))
    }
}

/** Skeleton that mirrors the loaded geometry. Mirrors iOS `WaitingRoomLoadingFrame`. */
@Composable
private fun LoadingFrame(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                .testTag("waitingRoomLoading"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Shimmer(width = 96.dp, height = 96.dp, cornerRadius = Radii.pill)
        Shimmer(width = 200.dp, height = 24.dp, cornerRadius = Radii.sm)
        Shimmer(width = 260.dp, height = 14.dp, cornerRadius = Radii.sm)
        Shimmer(width = 240.dp, height = 30.dp, cornerRadius = Radii.pill)
        Shimmer(width = 320.dp, height = 140.dp, cornerRadius = Radii.lg)
    }
}

/**
 * Load failure / no claim / decided claim. Mirrors iOS
 * `WaitingRoomNoticeFrame` — the room never falls back to the seeded fixture.
 */
@Composable
private fun NoticeFrame(
    notice: WaitingRoomNotice,
    modifier: Modifier = Modifier,
    onCta: () -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .testTag("waitingRoomNotice"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3, Alignment.CenterVertically),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 32.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = notice.headline,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() }.testTag("waitingRoomNoticeHeadline"),
        )
        Text(
            text = notice.body,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 290.dp).testTag("waitingRoomNoticeBody"),
        )
        Box(
            modifier =
                Modifier
                    .widthIn(max = 240.dp)
                    .fillMaxWidth()
                    .height(50.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onCta)
                    .testTag("waitingRoomNoticeCta"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = notice.ctaLabel,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

/**
 * RN's Verification Center frame — halo + headline/body + optional date
 * card + full-width action cards + a ghost "Done"
 * (`src/app/homes/[id]/waiting-room.tsx:83-225`). Mirrors iOS
 * `HomeVerificationFrame`.
 */
@Composable
private fun HomeVerificationFrame(
    content: HomeVerificationContent,
    modifier: Modifier = Modifier,
    onAction: (HomeVerificationAction) -> Unit = {},
    onDone: () -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                .testTag("waitingRoomVerification"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        HaloCircle(
            tone = content.halo.tone,
            icon = content.halo.icon,
            isPulsing = content.halo.isPulsing,
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = content.headline,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() }.testTag("verificationHeadline"),
            )
            Text(
                text = content.body,
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 320.dp).testTag("verificationBody"),
            )
        }
        content.countdown?.let { CountdownCard(it) }
        Column(
            modifier = Modifier.fillMaxWidth().testTag("verificationActions"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
        ) {
            content.actions.forEach { action ->
                VerificationActionCard(action = action, onTap = { onAction(action) })
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                    .clickable(onClick = onDone)
                    .testTag("verificationDone"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = content.doneLabel,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
        Spacer(modifier = Modifier.height(Spacing.s4))
    }
}

@Composable
private fun CountdownCard(countdown: HomeVerificationCountdown) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(14.dp)
                .testTag("verificationCountdown"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = countdown.icon,
            contentDescription = null,
            size = 20.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = countdown.label,
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = countdown.value,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun VerificationActionCard(
    action: HomeVerificationAction,
    onTap: () -> Unit,
) {
    val palette =
        when (action.tone) {
            WaitingRoomActionTone.Standard -> ActionPalette(PantopusColors.appText, PantopusColors.appBorder)
            WaitingRoomActionTone.Primary -> ActionPalette(PantopusColors.primary700, PantopusColors.primary200)
            WaitingRoomActionTone.Danger -> ActionPalette(PantopusColors.error, PantopusColors.errorLight)
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, palette.border, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(14.dp)
                .testTag("verificationAction_${action.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = action.icon,
            contentDescription = null,
            size = 22.dp,
            strokeWidth = 2.2f,
            tint = palette.fg,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = action.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = palette.fg,
            )
            action.subtitle?.let {
                Text(
                    text = it,
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun TopBarWaitingRoom(
    title: String,
    onBack: () -> Unit,
    onBell: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(PantopusColors.appSurface),
    ) {
        Text(
            text = title,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.align(Alignment.Center).semantics { heading() },
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = Spacing.s2)
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBack)
                    .testTag("waitingRoomBack"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                size = 20.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appText,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = Spacing.s2)
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBell)
                    .testTag("waitingRoomBell"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Bell,
                contentDescription = "Notifications",
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

@Composable
private fun HeadlineBlock(content: WaitingRoomContent) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = content.headline,
            fontSize = 23.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() }.testTag("waitingRoomHeadline"),
        )
        Text(
            text = content.subcopy,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 290.dp).testTag("waitingRoomSubcopy"),
        )
    }
}

@Composable
private fun AddressRow(
    address: String,
    claimRef: String,
) {
    Row(
        modifier =
            Modifier
                .widthIn(max = 300.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3 + 2.dp, vertical = Spacing.s2)
                .testTag("waitingRoomAddress"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = address,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Box(modifier = Modifier.size(width = 1.dp, height = 12.dp).background(PantopusColors.appBorder))
        Text(
            text = claimRef,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ReviewerNoteCard(note: WaitingRoomReviewerNote) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .testTag("waitingRoomReviewerNote"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.warningLight, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.User,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.warning,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                text = note.eyebrow.uppercase(),
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.warning,
                letterSpacing = 0.4.sp,
            )
            Text(
                text = note.body,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun ManageSection(
    content: WaitingRoomContent,
    onInlineAction: (WaitingRoomInlineAction) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("waitingRoomManage"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = content.manageSectionTitle.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextMuted,
            letterSpacing = 0.6.sp,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            content.inlineActions.forEach { action ->
                InlineActionButton(
                    action = action,
                    onTap = { onInlineAction(action) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

private data class ActionPalette(val fg: Color, val border: Color)

@Composable
private fun InlineActionButton(
    action: WaitingRoomInlineAction,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette =
        when (action.tone) {
            WaitingRoomActionTone.Standard -> ActionPalette(PantopusColors.appTextSecondary, PantopusColors.appBorder)
            WaitingRoomActionTone.Primary -> ActionPalette(PantopusColors.primary700, PantopusColors.primary200)
            WaitingRoomActionTone.Danger -> ActionPalette(PantopusColors.error, PantopusColors.errorLight)
        }
    Box(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, palette.border, RoundedCornerShape(Radii.md))
                .clickable(onClick = onTap)
                .testTag("waitingRoomAction_${action.id}"),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(
                icon = action.icon,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = palette.fg,
            )
            Text(text = action.label, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = palette.fg)
        }
    }
}

@Composable
private fun StickyDock(
    content: WaitingRoomContent,
    onPrimary: (StatusCta) -> Unit,
    onSecondary: (StatusCta) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable { onPrimary(content.primaryCta) }
                        .testTag("waitingRoomPrimaryCta"),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    content.primaryCta.icon?.let { icon ->
                        PantopusIconImage(
                            icon = icon,
                            contentDescription = null,
                            size = 15.dp,
                            strokeWidth = 2.4f,
                            tint = PantopusColors.appTextInverse,
                        )
                    }
                    Text(
                        text = content.primaryCta.label,
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .clickable { onSecondary(content.secondaryCta) }
                        .testTag("waitingRoomSecondaryCta"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = content.secondaryCta.label,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}
