@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.persona_dm

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A15.5 "Fan thread". When the fan already has a thread with this persona the
 * thread surface takes over the screen; otherwise this is the "Start a
 * conversation" frame — quota gate strip above a composer whose copy states
 * the cost. Mirrors iOS `FanInboxView.swift`.
 */
@Composable
fun FanInboxScreen(
    onBack: () -> Unit = {},
    onChangeTier: () -> Unit = {},
    onOpenThread: (String) -> Unit = {},
    viewModel: FanInboxViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val draft by viewModel.draft.collectAsStateWithLifecycle()
    val isOpening by viewModel.isOpening.collectAsStateWithLifecycle()
    val confirmation by viewModel.openConfirmation.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    // A resolved thread replaces this screen with the thread surface (the
    // host pops the inbox off the back stack) so Back lands on the
    // membership screen rather than bouncing back into this resolver.
    val current = state
    LaunchedEffect(current) {
        if (current is FanInboxUiState.Thread) onOpenThread(current.threadId)
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .imePadding()
                .testTag("fanInbox"),
    ) {
        TopBar(onBack = onBack)
        when (current) {
            is FanInboxUiState.Loading, is FanInboxUiState.Thread -> LoadingFrame()
            is FanInboxUiState.Error ->
                Box(modifier = Modifier.fillMaxSize().testTag("fanInboxError")) {
                    ErrorState(
                        headline = "Couldn't load your messages",
                        message = current.message,
                        onRetry = viewModel::refresh,
                    )
                }
            is FanInboxUiState.Start ->
                StartFrame(
                    content = current.content,
                    draft = draft,
                    isOpening = isOpening,
                    confirmation = confirmation,
                    canOpen = viewModel.canOpen(),
                    onDraftChange = viewModel::onDraftChange,
                    onSend = viewModel::openThread,
                    onChangeTier = onChangeTier,
                )
        }
    }
}

@Composable
private fun TopBar(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().height(52.dp).padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("fanInboxBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "Messages",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.size(44.dp))
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

@Composable
private fun LoadingFrame() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("fanInboxLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 220.dp, height = 28.dp, cornerRadius = Radii.pill)
        Shimmer(width = 320.dp, height = 120.dp, cornerRadius = Radii.lg)
        Shimmer(width = 140.dp, height = 44.dp, cornerRadius = Radii.lg)
    }
}

@Composable
private fun ColumnScope.StartFrame(
    content: FanInboxStartContent,
    draft: String,
    isOpening: Boolean,
    confirmation: String?,
    canOpen: Boolean,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
    onChangeTier: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s4, bottom = Spacing.s5)
                .testTag("fanInboxStart"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        PersonaHeader(content)
        val gate = content.gate
        if (gate != null) {
            GateCard(gate = gate, onChangeTier = onChangeTier)
        } else {
            StartCard(
                draft = draft,
                isOpening = isOpening,
                confirmation = confirmation,
                canOpen = canOpen,
                onDraftChange = onDraftChange,
                onSend = onSend,
            )
        }
    }
    QuotaGate(content.quota)
}

@Composable
private fun PersonaHeader(content: FanInboxStartContent) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("fanInboxPersonaHeader"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = content.initials,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.business,
            )
        }
        Column {
            Text(
                text = content.personaName,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = content.personaTitle,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun StartCard(
    draft: String,
    isOpening: Boolean,
    confirmation: String?,
    canOpen: Boolean,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4)
                .testTag("fanInboxStartCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Start a conversation",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                "Opening a thread uses one of your monthly message-thread credits. " +
                    "The creator decides if and when they reply.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 88.dp, max = 180.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appBg)
                    .padding(Spacing.s3),
            contentAlignment = Alignment.TopStart,
        ) {
            if (draft.isEmpty()) {
                Text(text = "Say hi…", fontSize = 14.sp, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = draft,
                onValueChange = onDraftChange,
                textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth().testTag("fanInboxDraft"),
            )
        }
        if (confirmation != null) {
            Text(
                text = confirmation,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.success,
                modifier = Modifier.testTag("fanInboxConfirmation"),
            )
        }
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (canOpen) PantopusColors.primary600 else PantopusColors.primary200)
                    .clickable(enabled = canOpen && !isOpening, onClick = onSend)
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s3)
                    .testTag("fanInboxSend"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = if (isOpening) "Sending…" else "Send",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

/**
 * The four first-class rejection states. Copy comes from [FanInboxGate] so
 * iOS and Android read identically.
 */
@Composable
private fun GateCard(
    gate: FanInboxGate,
    onChangeTier: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .padding(Spacing.s4)
                .testTag("fanInboxGate"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = if (gate == FanInboxGate.QuotaExhausted) PantopusIcon.Hourglass else PantopusIcon.Lock,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.warning,
            )
            Text(
                text = gate.headline,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
        }
        Text(text = gate.body, fontSize = 12.sp, color = PantopusColors.appTextStrong)
        gate.ctaTitle?.let { ctaTitle ->
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onChangeTier)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                        .testTag("fanInboxGateCta"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = ctaTitle,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

/** A15.5 composer quota gate — "3 of 5 left · resets when your membership renews". */
@Composable
private fun QuotaGate(quota: FanInboxQuota) {
    Column(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).testTag("fanInboxQuotaGate"),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.infoBg)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MessageSquare,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary700,
                )
                Text(
                    text = quota.chipLabel,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.RefreshCw,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Resets when your membership renews",
                fontSize = 10.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}
