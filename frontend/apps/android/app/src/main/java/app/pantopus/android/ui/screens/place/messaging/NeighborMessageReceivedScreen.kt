@file:OptIn(ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.place.messaging

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.PlaceDetailHeader
import app.pantopus.android.ui.screens.place.detail.PlaceDetailSectionLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * D2 — a received verified-neighbor message. No identity is shown ("a
 * verified neighbor nearby"); the body is the neutral template the sender
 * picked. Replies are templated and stay anonymous both ways. Feedback,
 * block, and report are calm, in-control, and never notify the sender.
 * Parity twin of iOS `NeighborMessageReceivedView`.
 */
@Composable
fun NeighborMessageReceivedScreen(
    onBack: () -> Unit,
    viewModel: NeighborMessageReceivedViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PlaceDetailHeader(title = "Message", address = "Inbox · verified neighbors", onBack = onBack)
        when (val current = state) {
            NeighborReceivedUiState.Loading -> ReceivedSkeleton()
            NeighborReceivedUiState.NotFound ->
                EmptyState(
                    icon = PantopusIcon.HelpCircle,
                    headline = "Message not found",
                    subcopy = "This message may have been removed, or it isn't addressed to you.",
                    ctaTitle = "Back to Place",
                    onCta = onBack,
                )
            is NeighborReceivedUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::load)
            is NeighborReceivedUiState.Loaded -> Loaded(message = current.message, viewModel = viewModel)
        }
    }
}

@Composable
private fun Loaded(
    message: ReceivedNeighborMessage,
    viewModel: NeighborMessageReceivedViewModel,
) {
    val replies by viewModel.replies.collectAsStateWithLifecycle()
    val flags by viewModel.flags.collectAsStateWithLifecycle()
    val editingReply by viewModel.editingReply.collectAsStateWithLifecycle()
    val replying by viewModel.replying.collectAsStateWithLifecycle()

    NeighborReceivedContent(
        message = message,
        replies = replies,
        flags = flags,
        editingReply = editingReply,
        replying = replying,
        onReply = viewModel::reply,
        onChangeReply = viewModel::startEditingReply,
        onNotHelpful = viewModel::markNotHelpful,
        onBlock = viewModel::block,
        onReport = viewModel::report,
        modifier = Modifier.fillMaxSize(),
    )
}

/** Stateless presentation — container owns the fetch + mutations (parity
 * with the web pure/presentational split, and Paparazzi-snapshottable). */
@Composable
@Suppress("LongParameterList")
internal fun NeighborReceivedContent(
    message: ReceivedNeighborMessage,
    replies: List<app.pantopus.android.data.api.models.place.NeighborReplyTemplate>,
    flags: NeighborManageFlags,
    editingReply: Boolean,
    replying: Boolean,
    onReply: (String) -> Unit,
    onChangeReply: () -> Unit,
    onNotHelpful: () -> Unit,
    onBlock: () -> Unit,
    onReport: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val hasReply = message.reply != null && !editingReply
    val canReply = message.canReply && !flags.blocked

    Column(
        modifier =
            modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(top = 8.dp, bottom = 40.dp),
    ) {
        ReceivedCard(message = message)

        PlaceDetailSectionLabel(text = "Reply")
        when {
            hasReply && message.reply != null ->
                ReplySent(messageBody = message.reply!!.body, onChange = onChangeReply)
            canReply ->
                QuickReplyBar(
                    replies = replies,
                    replying = replying,
                    onReply = onReply,
                )
            else -> RepliesOffNote()
        }

        PlaceDetailSectionLabel(text = "Manage this message")
        ManageCard(
            flags = flags,
            onNotHelpful = onNotHelpful,
            onBlock = onBlock,
            onReport = onReport,
        )

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 14.dp, start = 2.dp, end = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Shield,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "You're in control. This neighbor doesn't know who you are, and you can stop messages from them at any time.",
                fontSize = 12.5.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

// ─── Received card ───────────────────────────────────────────

@Composable
private fun ReceivedCard(message: ReceivedNeighborMessage) {
    Column(modifier = Modifier.fillMaxWidth().placeCard().padding(17.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorder, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ShieldCheck,
                    contentDescription = null,
                    size = 23.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.home,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "From a verified neighbor nearby",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.19).sp,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "On your block · ${neighborRelativeTime(message.createdAt)}",
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
            PlaceChip(model = PlaceChipModel(tone = PlaceChipTone.SUCCESS, text = "Verified", icon = PantopusIcon.ShieldCheck))
        }
        Text(
            text = message.body,
            fontSize = 16.sp,
            lineHeight = 24.sp,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = 16.dp),
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle, modifier = Modifier.padding(top = 16.dp))
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.EyeOff,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "They chose this from a set of pre-written notes — they can't type freely, and they don't know who you are either.",
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

// ─── Quick-reply bar ─────────────────────────────────────────

@Composable
private fun QuickReplyBar(
    replies: List<app.pantopus.android.data.api.models.place.NeighborReplyTemplate>,
    replying: Boolean,
    onReply: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            replies.forEach { reply ->
                Text(
                    text = reply.body,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(PantopusColors.infoBg)
                            .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(999.dp))
                            .clickable(enabled = !replying) { onReply(reply.id) }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(
                icon = PantopusIcon.EyeOff,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
            Text(text = "Replies are templated and stay anonymous.", fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun ReplySent(
    messageBody: String,
    onChange: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(16.dp))
                .padding(14.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(PantopusColors.homeBg)
                        .border(1.dp, PantopusColors.successLight, RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 19.dp,
                    strokeWidth = 2.75f,
                    tint = PantopusColors.home,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "Reply sent", fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(
                    text = "“$messageBody”",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.successLight, modifier = Modifier.padding(vertical = 12.dp))
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.EyeOff,
                    contentDescription = null,
                    size = 13.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.home,
                )
                Text(text = "Delivered anonymously", fontSize = 12.5.sp, color = PantopusColors.home)
            }
            Text(
                text = "Change reply",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier = Modifier.clickable(onClick = onChange),
            )
        }
    }
}

@Composable
private fun RepliesOffNote() {
    Row(
        modifier = Modifier.fillMaxWidth().placeCard().padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Ban,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(text = "Replies are off for this neighbor.", fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
    }
}

// ─── Manage card ─────────────────────────────────────────────

private data class ManageRowConfig(
    val icon: PantopusIcon,
    val danger: Boolean,
    val title: String,
    val sub: String,
    val doneTitle: String,
    val done: Boolean,
    val onClick: () -> Unit,
)

@Composable
private fun ManageCard(
    flags: NeighborManageFlags,
    onNotHelpful: () -> Unit,
    onBlock: () -> Unit,
    onReport: () -> Unit,
) {
    val rows =
        listOf(
            ManageRowConfig(
                icon = PantopusIcon.CircleSlash,
                danger = false,
                title = "This isn't helpful",
                sub = "Tell us this note wasn't useful. The sender won't be told.",
                doneTitle = "Thanks for the feedback",
                done = flags.notHelpful,
                onClick = onNotHelpful,
            ),
            ManageRowConfig(
                icon = PantopusIcon.Ban,
                danger = false,
                title = "Block this neighbor",
                sub = "Stop messages from this verified home. They won't be notified.",
                doneTitle = "Neighbor blocked",
                done = flags.blocked,
                onClick = onBlock,
            ),
            ManageRowConfig(
                icon = PantopusIcon.Flag,
                danger = true,
                title = "Report this message",
                sub = "Flag it for the Pantopus trust team to review.",
                doneTitle = "Reported to the trust team",
                done = flags.reported,
                onClick = onReport,
            ),
        )
    Column(modifier = Modifier.fillMaxWidth().placeCard()) {
        rows.forEachIndexed { index, row ->
            ManageRow(config = row)
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun ManageRow(config: ManageRowConfig) {
    val fg = if (config.danger) PantopusColors.error else PantopusColors.appTextSecondary
    val tileBg = if (config.danger) PantopusColors.errorBg else PantopusColors.appSurfaceSunken
    val tileFg = if (config.danger) PantopusColors.error else PantopusColors.appTextMuted
    val tileBorder = if (config.danger) PantopusColors.errorLight else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = !config.done, onClick = config.onClick)
                .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(tileBg)
                    .border(1.dp, tileBorder, RoundedCornerShape(9.dp)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (config.done) PantopusIcon.Check else config.icon,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.25f,
                tint = if (config.done) PantopusColors.home else tileFg,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (config.done) config.doneTitle else config.title,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (config.done) PantopusColors.appTextMuted else fg,
            )
            if (!config.done) {
                Text(text = config.sub, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextMuted)
            }
        }
        if (!config.done) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.25f,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

// ─── Skeleton ────────────────────────────────────────────────

@Composable
private fun ReceivedSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth().placeCard().padding(17.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Shimmer(width = 44.dp, height = 44.dp, cornerRadius = 22.dp)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Shimmer(width = 180.dp, height = 14.dp)
                    Shimmer(width = 110.dp, height = 12.dp)
                }
            }
            Shimmer(width = 260.dp, height = 14.dp)
            Shimmer(width = 220.dp, height = 14.dp)
        }
    }
}
