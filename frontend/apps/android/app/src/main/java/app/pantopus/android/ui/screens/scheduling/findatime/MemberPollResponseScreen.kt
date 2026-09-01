@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "MagicNumber", "LongParameterList", "UNUSED_PARAMETER")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MEMBER_POLL_RESPONSE_TAG = "memberPollResponseScreen"

/**
 * F6 Find a Time — Member Poll Response. The household member marks which
 * proposed times work (Works / If needed / Can't) and submits one public vote.
 */
@Composable
fun MemberPollResponseScreen(
    pollId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: MemberPollResponseViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) { viewModel.start() }
    val state by viewModel.state.collectAsStateWithLifecycle()

    MemberPollResponseContent(
        state = state,
        onBack = onBack,
        onRetry = viewModel::load,
        onVote = viewModel::setVote,
        onName = viewModel::setVoterName,
        onEmail = viewModel::setVoterEmail,
        onSubmit = viewModel::submit,
    )
}

@Composable
fun MemberPollResponseContent(
    state: PollResponseUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onVote: (String, VoteValue) -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
    // Retained (defaulted) for the signed-in voter's name/email recorded on submit;
    // the design has no in-flow capture UI, so these are no longer rendered.
    onName: (String) -> Unit = {},
    onEmail: (String) -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag(MEMBER_POLL_RESPONSE_TAG)) {
        FtTopBar(title = "Respond", onBack = onBack, backIcon = PantopusIcon.X)
        when (state) {
            is PollResponseUiState.Loading -> PollSkeleton()
            is PollResponseUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
            is PollResponseUiState.Loaded ->
                // F6 blocker fix: show success state when submitted=true (previously ignored).
                if (state.submitted) {
                    PollSubmittedBody(onDone = onBack)
                } else {
                    LoadedPoll(
                        state = state,
                        onVote = onVote,
                        onSubmit = onSubmit,
                    )
                }
            is PollResponseUiState.Closed -> ClosedPoll(state = state)
        }
    }
}

@Composable
private fun OrganizerHeader(header: PollHeader) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Spec shows the organizer's person photo here; the public poll read carries no
        // organizer avatar, so a 38dp person disc stands in (mirrors iOS' organizer disc).
        Box(
            modifier = Modifier.size(38.dp).clip(CircleShape).background(HomeAccentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.UserRound, contentDescription = null, size = 20.dp, tint = HomeAccentDark)
        }
        Column(modifier = Modifier.weight(1f).padding(start = Spacing.s3)) {
            Text(text = header.title, style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                text = header.subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        FtChip(label = "POLL", icon = PantopusIcon.Vote)
    }
}

@Composable
private fun LoadedPoll(
    state: PollResponseUiState.Loaded,
    onVote: (String, VoteValue) -> Unit,
    onSubmit: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            OrganizerHeader(state.header)
            // Spec's conflicts-detected frame: an info banner above the slots when any
            // slot collides with the member's personal calendar.
            if (state.options.any { it.conflict }) {
                FtBanner(
                    tone = FtBannerTone.Info,
                    icon = PantopusIcon.Info,
                    body = "We pre-filled a \"Can't\" where you're already busy. Change any you can still make.",
                )
            }
            FtOverline("Mark which times work", color = PantopusColors.appTextSecondary)
            state.options.forEach { option ->
                PollOptionCard(option = option, locked = false, onVote = { onVote(option.id, it) })
            }
            if (state.error != null) {
                FtBanner(tone = FtBannerTone.Error, icon = PantopusIcon.AlertCircle, body = state.error)
            }
        }
        Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(Spacing.s4)) {
            FtPrimaryButton(
                label = "Submit response",
                icon = PantopusIcon.Send,
                enabled = state.canSubmit,
                onClick = onSubmit,
                modifier = Modifier.testTag("submitResponseButton"),
            )
        }
    }
}

@Composable
private fun ClosedPoll(state: PollResponseUiState.Closed) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        OrganizerHeader(state.header)
        FtBanner(
            tone = FtBannerTone.Home,
            icon = PantopusIcon.CheckCircle,
            title = "This proposal closed",
            body = state.finalizedLabel?.let { "Booked $it. It's on the family calendar." } ?: "Voting has ended for this poll.",
        )
        FtOverline("Proposed times", color = PantopusColors.appTextMuted)
        Column(
            modifier = Modifier.alpha(0.55f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            state.options.forEach { option ->
                PollOptionCard(option = option, locked = true, onVote = {})
            }
        }
    }
}

@Composable
private fun PollOptionCard(
    option: PollOptionUi,
    locked: Boolean,
    onVote: (VoteValue) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "${option.dayLabel} · ${option.timeLabel}",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            if (option.conflict) {
                FtChip(
                    label = "Conflicts",
                    icon = PantopusIcon.AlertTriangle,
                    bg = PantopusColors.errorBg,
                    fg = PantopusColors.error,
                )
            }
        }
        VoteControl(optionId = option.id, selected = option.vote, locked = locked, onVote = onVote)
        if (option.conflict) {
            Row(
                modifier = Modifier.padding(top = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Calendar,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "From your personal calendar",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(start = Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun VoteControl(
    optionId: String,
    selected: VoteValue?,
    locked: Boolean,
    onVote: (VoteValue) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        VoteValue.entries.forEach { value ->
            val on = value == selected
            val onColor =
                when (value) {
                    VoteValue.Works -> HomeAccent
                    VoteValue.Maybe -> PantopusColors.warning
                    VoteValue.Cant -> PantopusColors.error
                }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (on) onColor else Color.Transparent)
                        .clickable(enabled = !locked, onClickLabel = value.label) { onVote(value) }
                        .padding(vertical = Spacing.s2)
                        .testTag("vote_${optionId}_${value.wire}"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = value.label,
                    style = PantopusTextStyle.caption,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (on) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/**
 * F6 blocker fix — submitted/success state. Design Frame 2 (Answered) transitions
 * to a full-screen confirmation: check-circle, "Response submitted" headline,
 * body copy, and a "Done" CTA. Mirrors iOS PollResponseView submittedView.
 */
@Composable
private fun PollSubmittedBody(onDone: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s6)
                .testTag("pollResponseSubmitted"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(84.dp).clip(CircleShape).background(HomeAccentBg),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier.size(52.dp).clip(CircleShape).background(HomeAccent),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CheckCircle,
                    contentDescription = null,
                    size = 28.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Text(
            text = "Response submitted",
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s4),
        )
        Text(
            text = "Thanks for weighing in. The organizer will pick the best time.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Box(modifier = Modifier.padding(top = Spacing.s4).fillMaxWidth()) {
            FtPrimaryButton(
                label = "Done",
                icon = PantopusIcon.Check,
                onClick = onDone,
                modifier = Modifier.testTag("pollResponseDoneButton"),
            )
        }
    }
}

@Composable
private fun PollSkeleton() {
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        repeat(4) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 140.dp, height = 12.dp, cornerRadius = Radii.xs)
                Shimmer(width = 220.dp, height = 28.dp, cornerRadius = Radii.sm)
            }
        }
    }
}
