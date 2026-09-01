@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Stream A16 — H7 Message Preview (sheet). Shows the rendered message per
 * channel before saving, with all variables resolved to sample data. A channel
 * tab strip (Push / Email / In-app / SMS) swaps a realistic device mock over a
 * soft stage. "Send test to me" is a coming-soon affordance (no endpoint yet).
 * Reached inline from the workflow / template editors with a draft, or by saved
 * template id (iOS `messagePreview(owner:templateId:)` route parity — the A16
 * route registration wires this entry).
 */
@Composable
fun MessagePreviewSheet(
    subject: String?,
    body: String,
    channel: WorkflowChannel,
    onDismiss: () -> Unit,
    viewModel: MessagePreviewViewModel = hiltViewModel(),
) {
    LaunchedEffect(subject, body, channel) { viewModel.start(subject, body, channel) }
    PreviewSheetScaffold(
        viewModel = viewModel,
        onDismiss = onDismiss,
        onRetry = { viewModel.start(subject, body, channel) },
    )
}

/** Routed entry — renders a saved template resolved by id (H7 by template id). */
@Composable
fun MessagePreviewSheet(
    templateId: String,
    onDismiss: () -> Unit,
    viewModel: MessagePreviewViewModel = hiltViewModel(),
) {
    LaunchedEffect(templateId) { viewModel.startFromTemplate(templateId) }
    PreviewSheetScaffold(
        viewModel = viewModel,
        onDismiss = onDismiss,
        onRetry = { viewModel.startFromTemplate(templateId) },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PreviewSheetScaffold(
    viewModel: MessagePreviewViewModel,
    onDismiss: () -> Unit,
    onRetry: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeChannel by viewModel.activeChannel.collectAsStateWithLifecycle()
    val testNote by viewModel.testNote.collectAsStateWithLifecycle()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        dragHandle = null,
    ) {
        Column(modifier = Modifier.fillMaxWidth().testTag("scheduling.templates.preview")) {
            AutoSheetHeader(title = "Preview", onClose = onDismiss)
            when (val s = state) {
                // Transient render wait — small accent spinner (iOS
                // `ProgressView().tint(accent)` parity), not a screen skeleton.
                MessagePreviewUiState.Loading ->
                    Box(modifier = Modifier.fillMaxWidth().padding(Spacing.s10), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(
                            color = viewModel.pillar.accent,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                is MessagePreviewUiState.Error ->
                    AutoErrorView(message = s.message, onRetry = onRetry, headline = "Couldn't load message")
                is MessagePreviewUiState.Loaded ->
                    PreviewLoaded(
                        loaded = s,
                        activeChannel = activeChannel,
                        channelOrder = viewModel.channelOrder,
                        accent = viewModel.pillar.accent,
                        accentBg = viewModel.pillar.accentBg,
                        testNote = testNote,
                        onSelectChannel = viewModel::selectChannel,
                        onSendTest = viewModel::sendTest,
                        onClose = onDismiss,
                    )
            }
        }
    }
}

@Composable
private fun PreviewLoaded(
    loaded: MessagePreviewUiState.Loaded,
    activeChannel: WorkflowChannel,
    channelOrder: List<WorkflowChannel>,
    accent: Color,
    accentBg: Color,
    testNote: String?,
    onSelectChannel: (Int) -> Unit,
    onSendTest: () -> Unit,
    onClose: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        AutoUnderlineTabs(
            tabs = channelOrder.map { it.label },
            selectedIndex = channelOrder.indexOf(activeChannel).coerceAtLeast(0),
            accent = accent,
            onSelect = onSelectChannel,
        )
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = Spacing.s4, vertical = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().clip(stageShape()).background(PantopusColors.appSurfaceSunken).padding(Spacing.s4),
            ) {
                ChannelMock(channel = activeChannel, loaded = loaded, accent = accent, accentBg = accentBg)
            }
            AutoGhostButton(title = "Send test to me", icon = PantopusIcon.Send, onClick = onSendTest)
            if (testNote != null) {
                AutoNote(tone = AutoTone.Success, icon = PantopusIcon.CheckCircle, text = testNote)
            }
        }
        AutoSheetFooter {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                AutoGhostButton(title = "Edit", onClick = onClose)
                AutoPrimaryButton(title = "Looks good", icon = PantopusIcon.Check, onClick = onClose, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ChannelMock(
    channel: WorkflowChannel,
    loaded: MessagePreviewUiState.Loaded,
    accent: Color,
    accentBg: Color,
) {
    when (channel) {
        WorkflowChannel.Push -> PushMock(loaded.filledBody, accent)
        WorkflowChannel.Email -> EmailMock(loaded.filledSubject, loaded.filledBody, accent)
        WorkflowChannel.InApp -> InAppMock(loaded.filledBody, accent, accentBg)
        WorkflowChannel.Sms -> SmsMock(loaded.filledBody)
    }
}

private fun stageShape() = RoundedCornerShape(Radii.xl)

@Composable
private fun PushMock(
    body: String,
    accent: Color,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurface).padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        AutoIconTile(icon = PantopusIcon.Bell, bg = accent, fg = PantopusColors.appTextInverse)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Pantopus",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Text(text = "now", fontSize = 10.5.sp, color = PantopusColors.appTextMuted)
            }
            Text(text = body, fontSize = 12.sp, color = PantopusColors.appTextStrong, maxLines = 3)
        }
    }
}

@Composable
private fun EmailMock(
    subject: String?,
    body: String,
    accent: Color,
) {
    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurface).padding(12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.padding(bottom = Spacing.s2),
        ) {
            AutoIconTile(icon = PantopusIcon.Mail, bg = accent, fg = PantopusColors.appTextInverse, size = 30.dp, glyph = 14.dp)
            Column {
                Text(text = "Pantopus", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                Text(text = "hi@pantopus.co", fontSize = 10.5.sp, color = PantopusColors.appTextMuted)
            }
        }
        if (!subject.isNullOrEmpty()) {
            Text(
                text = subject,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(bottom = Spacing.s1),
            )
        }
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder, modifier = Modifier.padding(vertical = Spacing.s2))
        Text(text = body, fontSize = 12.5.sp, color = PantopusColors.appTextStrong)
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder, modifier = Modifier.padding(vertical = Spacing.s2))
        Text(text = "Sent by Pantopus scheduling", fontSize = 10.sp, color = PantopusColors.appTextMuted)
    }
}

@Composable
private fun InAppMock(
    body: String,
    accent: Color,
    accentBg: Color,
) {
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.fillMaxWidth(),
    ) {
        AutoIconTile(icon = PantopusIcon.MessageSquare, bg = accentBg, fg = accent, size = 28.dp, glyph = 14.dp)
        Text(
            text = body,
            fontSize = 12.5.sp,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = 12.dp, vertical = 9.dp),
        )
        Spacer(modifier = Modifier.size(Spacing.s6))
    }
}

@Composable
private fun SmsMock(body: String) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = body,
                fontSize = 12.5.sp,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = 12.dp, vertical = 9.dp),
            )
            Spacer(modifier = Modifier.size(Spacing.s6))
        }
        val segments = if (body.length > WorkflowChannel.SMS_SEGMENT_LIMIT) "2 messages" else "1 message"
        Text(text = "${body.length} characters · $segments", fontSize = 10.5.sp, color = PantopusColors.appTextMuted)
    }
}
