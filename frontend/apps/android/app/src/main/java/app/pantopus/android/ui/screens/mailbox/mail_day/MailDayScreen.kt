@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.mail_day

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.mail_day.components.DayHeader
import app.pantopus.android.ui.screens.mailbox.mail_day.components.MailboxEmptyHero
import app.pantopus.android.ui.screens.mailbox.mail_day.components.ReviewedRow
import app.pantopus.android.ui.screens.mailbox.mail_day.components.ScanMoreCard
import app.pantopus.android.ui.screens.mailbox.mail_day.components.SetupNudgeStack
import app.pantopus.android.ui.screens.mailbox.mail_day.components.UnreviewedItem
import app.pantopus.android.ui.screens.mailbox.mail_day.components.YesterdayRecapCard
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * A13.16 — My Mail Day. The mid-afternoon triage editor (populated +
 * empty variants), built on the Form archetype shell with a sticky
 * FinishDay footer pinned beneath the scroll body when there are
 * pieces to triage.
 *
 * The empty state renders [MailboxEmptyHero] (illustration + headline
 * + Scan CTA) with the yesterday recap card and two setup-nudge cards
 * beneath. No sticky bottom in the empty frame.
 *
 * The view drives [MailDayViewModel.tickUndo] from a `LaunchedEffect`
 * loop so the 5-second undo chip on the latest reviewed row counts
 * down once a second.
 */
@Composable
fun MailDayScreen(
    onClose: () -> Unit = {},
    onScan: () -> Unit = {},
    onSeeHistory: () -> Unit = {},
    onOpenNudge: (MailDaySetupNudge) -> Unit = {},
    viewModel: MailDayViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.configure(onScanRequested = onScan)
        viewModel.load()
    }

    // Tick the undo countdown every second when there's an active timer.
    val hasActiveCountdown =
        (state as? MailDayUiState.Populated)
            ?.content
            ?.reviewed
            ?.any { (it.undoCountdown ?: 0) > 0 } ?: false
    LaunchedEffect(hasActiveCountdown) {
        while (hasActiveCountdown) {
            delay(1000)
            viewModel.tickUndo()
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag("mailDay")) {
        when (val current = state) {
            is MailDayUiState.Loading ->
                MailDayShell(stickyBottom = null, onClose = onClose) { LoadingFrame() }
            is MailDayUiState.Populated ->
                MailDayShell(
                    stickyBottom = {
                        FinishDayBar(
                            isEnabled = viewModel.canFinishDay,
                            total = viewModel.total,
                            routed = viewModel.routedCount,
                            junked = viewModel.junkedCount,
                            returned = viewModel.returnedCount,
                            remaining = viewModel.remaining,
                            onFinish = { viewModel.finishDay() },
                        )
                    },
                    onClose = onClose,
                ) {
                    PopulatedBody(
                        content = current.content,
                        done = viewModel.done,
                        total = viewModel.total,
                        onScan = { viewModel.requestScan() },
                        onAccept = { id -> viewModel.acceptSuggestion(id) },
                    )
                }
            is MailDayUiState.Empty ->
                MailDayShell(stickyBottom = null, onClose = onClose) {
                    EmptyBody(
                        content = current.content,
                        onScan = { viewModel.requestScan() },
                        onSeeHistory = onSeeHistory,
                        onOpenNudge = onOpenNudge,
                    )
                }
            is MailDayUiState.Error ->
                MailDayShell(stickyBottom = null, onClose = onClose) {
                    ErrorFrame(message = current.message, onRetry = viewModel::load)
                }
        }
    }
}

@Composable
private fun MailDayShell(
    stickyBottom: (@Composable () -> Unit)?,
    onClose: () -> Unit,
    body: @Composable () -> Unit,
) {
    FormShell(
        title = "My Mail Day",
        isValid = true,
        isDirty = false,
        onClose = onClose,
        onCommit = {},
        leading = FormShellLeading.Back,
        rightActionLabel = null,
        stickyBottom = stickyBottom,
        body = body,
    )
}

/**
 * VM-free populated frame — rendered by paparazzi snapshots and exposed
 * here so tests don't have to spin up a Hilt view-model. Pass-through
 * to the same composables the production screen uses.
 */
@Composable
internal fun MailDayPopulatedFrame(
    content: MailDayContent,
    routedCount: Int = content.reviewed.count { it.action == ReviewedMailAction.Routed },
    junkedCount: Int = content.reviewed.count { it.action == ReviewedMailAction.Junked },
    returnedCount: Int = content.reviewed.count { it.action == ReviewedMailAction.Returned },
) {
    val total = content.unreviewed.size + content.reviewed.size
    val done = content.reviewed.size
    val remaining = content.unreviewed.size
    MailDayShell(
        stickyBottom = {
            FinishDayBar(
                isEnabled = remaining == 0 && total > 0,
                total = total,
                routed = routedCount,
                junked = junkedCount,
                returned = returnedCount,
                remaining = remaining,
                onFinish = {},
            )
        },
        onClose = {},
    ) {
        PopulatedBody(
            content = content,
            done = done,
            total = total,
            onScan = {},
            onAccept = {},
        )
    }
}

/** VM-free empty frame for paparazzi snapshots. */
@Composable
internal fun MailDayEmptyFrame(content: MailDayContent) {
    MailDayShell(stickyBottom = null, onClose = {}) {
        EmptyBody(content = content, onScan = {}, onSeeHistory = {}, onOpenNudge = {})
    }
}

@Composable
private fun PopulatedBody(
    content: MailDayContent,
    done: Int,
    total: Int,
    onScan: () -> Unit,
    onAccept: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(bottom = 120.dp)
                .testTag("mailDayPopulatedBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        DayHeader(
            dateLabel = content.dateLabel,
            streakDays = content.streakDays,
            done = done,
            total = total,
        )
        ScanMoreCard(lastScanLabel = content.lastScanLabel, onClick = onScan)
        if (content.unreviewed.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                SectionOverline(title = "Needs a call", count = content.unreviewed.size)
                content.unreviewed.forEach { item ->
                    UnreviewedItem(
                        item = item,
                        onRoute = { onAccept(item.id) },
                        onSecondary = { /* Other-recipient sheet — out of scope */ },
                    )
                }
            }
        }
        if (content.reviewed.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                SectionOverline(title = "Reviewed today", count = content.reviewed.size)
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface, shape = RoundedCornerShape(Radii.lg)),
                ) {
                    content.reviewed.forEachIndexed { index, item ->
                        ReviewedRow(
                            item = item,
                            isLast = index == content.reviewed.size - 1,
                            onUndo = { /* Undo individual — out of scope */ },
                        )
                    }
                }
                UndoAllButton()
            }
        }
    }
}

@Composable
private fun EmptyBody(
    content: MailDayContent,
    onScan: () -> Unit,
    onSeeHistory: () -> Unit,
    onOpenNudge: (MailDaySetupNudge) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("mailDayEmptyBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        MailboxEmptyHero(
            streakDays = content.streakDays,
            lastScanLabel = content.lastScanLabel,
            onScan = onScan,
        )
        content.yesterdayRecap?.let { recap ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                SectionOverline(title = "Yesterday's recap", count = recap.segments.size)
                YesterdayRecapCard(recap = recap, onSeeHistory = onSeeHistory)
            }
        }
        if (content.setupNudges.isNotEmpty()) {
            SetupNudgeStack(nudges = content.setupNudges, onTap = onOpenNudge)
        }
        Spacer(modifier = Modifier.height(Spacing.s5))
    }
}

@Composable
private fun SectionOverline(
    title: String,
    count: Int,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = title.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = "· $count",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun UndoAllButton() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .clickable { /* Undo all — out of scope */ }
                .padding(horizontal = 10.dp, vertical = 6.dp)
                .testTag("mailDayUndoAll")
                .semantics { contentDescription = "Undo all from today" },
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ArrowsRepeat,
            contentDescription = null,
            size = 12.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Undo all from today",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun LoadingFrame() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("mailDayLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Shimmer(width = 360.dp, height = 80.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 64.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 160.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 240.dp, cornerRadius = Radii.lg)
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
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s10)
                .testTag("mailDayError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Text(
            text = "Couldn't load your mail day",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
        PrimaryButton(title = "Try again", onClick = onRetry, modifier = Modifier.testTag("mailDayRetry"))
    }
}

// ─── Finish-day sticky footer ──────────────────────────────────

@Composable
private fun FinishDayBar(
    isEnabled: Boolean,
    total: Int,
    routed: Int,
    junked: Int,
    returned: Int,
    remaining: Int,
    onFinish: () -> Unit,
) {
    val ctaLabel =
        when {
            total == 0 -> "Finish day · nothing to close"
            isEnabled -> "Finish day · all done"
            else -> "Finish day · $remaining remaining"
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("mailDayFinishDay"),
    ) {
        HorizontalDivider(color = PantopusColors.appBorder, thickness = 1.dp)
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s4, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            SummaryLine(routed = routed, junked = junked, returned = returned, remaining = remaining)
            FinishCTA(isEnabled = isEnabled, label = ctaLabel, onFinish = onFinish)
        }
        Spacer(modifier = Modifier.height(Spacing.s6))
    }
}

@Composable
private fun SummaryLine(
    routed: Int,
    junked: Int,
    returned: Int,
    remaining: Int,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SummaryChip(
            icon = PantopusIcon.ArrowRight,
            count = routed,
            label = "routed",
            iconColor = PantopusColors.success,
        )
        DotSep()
        SummaryChip(
            icon = PantopusIcon.Trash2,
            count = junked,
            label = "junked",
            iconColor = PantopusColors.error,
        )
        if (returned > 0) {
            DotSep()
            SummaryChip(
                icon = PantopusIcon.RefreshCw,
                count = returned,
                label = "returned",
                iconColor = PantopusColors.appTextSecondary,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        if (remaining > 0) {
            Text(
                text = "$remaining still pending",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.warmAmber,
            )
        }
    }
}

@Composable
private fun SummaryChip(
    icon: PantopusIcon,
    count: Int,
    label: String,
    iconColor: Color,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = iconColor,
        )
        Text(text = "$count", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(text = label, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun DotSep() {
    Text(text = "·", fontSize = 11.sp, color = PantopusColors.appBorderStrong)
}

@Composable
private fun FinishCTA(
    isEnabled: Boolean,
    label: String,
    onFinish: () -> Unit,
) {
    val background = if (isEnabled) PantopusColors.primary600 else PantopusColors.appSurfaceSunken
    val foreground = if (isEnabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted
    val icon = if (isEnabled) PantopusIcon.Mailbox else PantopusIcon.Lock
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .shadow(
                    elevation = if (isEnabled) 6.dp else 0.dp,
                    shape = RoundedCornerShape(Radii.lg),
                    ambientColor = PantopusColors.primary600,
                    spotColor = PantopusColors.primary600,
                ).background(background, shape = RoundedCornerShape(Radii.lg))
                .clickable(enabled = isEnabled) { onFinish() }
                .testTag("mailDayFinishDayCTA")
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.4f,
                tint = foreground,
            )
            Text(
                text = label,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = foreground,
            )
        }
    }
}
