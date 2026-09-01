@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

const val FOLLOW_UP_TAG = "scheduling.followUp"
private const val SUCCESS_DISMISS_MS = 1300L

@Composable
fun PostMeetingFollowupScreen(
    bookingId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: PostMeetingFollowupViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(state.didSend) {
        if (state.didSend) {
            delay(SUCCESS_DISMISS_MS)
            onBack()
        }
    }

    Scaffold(
        modifier = Modifier.testTag(FOLLOW_UP_TAG),
        containerColor = PantopusColors.appBg,
        topBar = {
            SchedulingTopBar(
                title = "Follow up",
                leading = SchedulingTopBarLeading.Back,
                onLeading = onBack,
                applyStatusBarInset = true,
            )
        },
        bottomBar = {
            if (!state.loading && state.loadError == null && !state.didSend) {
                FollowUpFooter(state = state, onSave = viewModel::submit, onSend = viewModel::submit)
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> SchedulingLoadingSkeleton(rows = 4)
                state.loadError != null -> ErrorState(message = state.loadError!!, onRetry = viewModel::load)
                state.didSend -> FollowUpSuccess(inviteeName = state.inviteeName)
                else ->
                    FollowUpContent(
                        state = state,
                        onSelectOutcome = viewModel::selectOutcome,
                        onMessage = viewModel::setMessage,
                        onPrivateNote = viewModel::setPrivateNote,
                        onPush = viewModel::setPush,
                        onRebookLink = viewModel::appendRebookLink,
                    )
            }
        }
    }
}

@Composable
internal fun FollowUpContent(
    state: FollowUpUiState,
    onSelectOutcome: (FollowUpOutcome) -> Unit,
    onMessage: (String) -> Unit,
    onPrivateNote: (String) -> Unit,
    onPush: (Boolean) -> Unit,
    onRebookLink: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Selected outcome chips use the owner pillar accent; the rebook chip, push
    // toggle, and CTA stay on brand PRIMARY (spec keeps those functional
    // controls blue — only the outcome chip is owner-tinted).
    val accent = state.pillar.accent
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = "Follow up", style = ExtrasType.header, color = PantopusColors.appText)
            if (state.headerSubtitle.isNotBlank()) {
                Text(
                    text = state.headerSubtitle,
                    style = ExtrasType.note115.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Normal),
                    color = PantopusColors.appTextSecondary,
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ExtrasOverline("Outcome")
            ExtrasChipFlow {
                FollowUpOutcome.entries.forEach { outcome ->
                    ExtrasPillChip(
                        label = outcome.label,
                        selected = state.outcome == outcome,
                        onClick = { onSelectOutcome(outcome) },
                        accent = accent,
                    )
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ExtrasOverline("Message to ${state.inviteeName}")
            ExtrasMessageBox(
                value = state.message,
                onValueChange = onMessage,
                placeholder = "Write a message, or pick an outcome above to start from a template.",
                accent = PantopusColors.primary600,
                minHeight = 84.dp,
            )
            if (state.canAppendRebookLink) {
                ExtrasChipButton(
                    label = "Send rebook link",
                    icon = PantopusIcon.Link,
                    onClick = onRebookLink,
                    accent = PantopusColors.primary600,
                    enabled = !state.appendingLink,
                )
            }
            state.sendError?.let { ExtrasInlineError(message = it) }
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextMuted)
                ExtrasOverline("Private note")
            }
            ExtrasMessageBox(
                value = state.privateNote,
                onValueChange = onPrivateNote,
                placeholder = "Outcome notes, next steps…",
                accent = PantopusColors.primary600,
                minHeight = 46.dp,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                PantopusIconImage(icon = PantopusIcon.EyeOff, contentDescription = null, size = 11.dp, tint = PantopusColors.appTextMuted)
                Text(text = "Only you can see this", style = ExtrasType.detail11, color = PantopusColors.appTextMuted)
            }
        }

        ExtrasChannelRow(
            icon = PantopusIcon.Bell,
            label = "Send via push + message",
            checked = state.pushOn,
            onCheckedChange = onPush,
            accent = PantopusColors.primary600,
        )
    }
}

@Composable
private fun FollowUpFooter(
    state: FollowUpUiState,
    onSave: () -> Unit,
    onSend: () -> Unit,
) {
    // Sticky footer: top hairline over the surface, 48dp icon CTA. Save-note-only
    // is the design's ghost lock CTA; send/try-again is the solid primary.
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        HorizontalDivider(color = PantopusColors.appBorder)
        Box(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s4)) {
            if (state.isSaveNoteOnly) {
                ExtrasIconLabelButton(
                    icon = PantopusIcon.Lock,
                    label = "Save note only",
                    onClick = onSave,
                    modifier = Modifier.fillMaxWidth(),
                    accent = PantopusColors.appSurfaceSunken,
                    enabled = !state.sending,
                )
            } else {
                ExtrasIconLabelButton(
                    icon = if (state.sendError != null) PantopusIcon.RefreshCw else PantopusIcon.Send,
                    label = if (state.sendError != null) "Try again" else "Send follow-up",
                    onClick = onSend,
                    modifier = Modifier.fillMaxWidth(),
                    accent = PantopusColors.primary600,
                    enabled = state.canSubmit,
                    loading = state.sending,
                )
            }
        }
    }
}

/**
 * JSX frame 4 (Sent): a dimmed scrim over the parent with a centered 72dp
 * successBg/successLight-ringed disc + heavy check, a bold "Follow-up sent"
 * headline, and a dark pinned bottom toast naming the recipient. Mirrors iOS
 * `BookingFollowUpSheet.successOverlay`.
 */
@Composable
private fun FollowUpSuccess(inviteeName: String) {
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appText.copy(alpha = SUCCESS_SCRIM_ALPHA))) {
        Column(
            modifier = Modifier.fillMaxSize().padding(Spacing.s6),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.successBg)
                        .border(1.dp, PantopusColors.successLight, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 34.dp, tint = PantopusColors.success)
            }
            Text(text = "Follow-up sent", style = ExtrasType.header.copy(fontSize = 17.sp), color = PantopusColors.appTextInverse)
        }
        Row(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s8)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appText)
                    .padding(horizontal = Spacing.s3 + 2.dp, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 18.dp, tint = PantopusColors.successLight)
            Text(
                text = "Follow-up sent to $inviteeName",
                style = ExtrasType.body125,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

private const val SUCCESS_SCRIM_ALPHA = 0.42f
