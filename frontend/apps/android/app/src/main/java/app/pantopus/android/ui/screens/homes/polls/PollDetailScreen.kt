@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.polls

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.PollDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant

/**
 * Poll detail screen — read + cast vote (T6.3e / P13). Built on the
 * shared `ContentDetailShell`. Renders the question header, per-option
 * `PollResultBar` list, and a small meta grid below. Voting is
 * optimistic — taps update the local DTO immediately and roll back on
 * a server error.
 *
 * @param onBack Pops back to the Polls list.
 * @param onChanged Fired after a successful vote so the list can refresh.
 */
@Composable
fun PollDetailScreen(
    onBack: () -> Unit,
    onChanged: () -> Unit = {},
    viewModel: PollDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onChanged = onChanged)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenPollDetailViewed)
    }
    Box(Modifier.fillMaxSize().testTag("pollDetail")) {
        when (val current = state) {
            PollDetailUiState.Loading -> LoadingShell(onBack)
            is PollDetailUiState.Error -> ErrorShell(current.message, onBack) { viewModel.load() }
            is PollDetailUiState.Loaded ->
                LoadedShell(
                    poll = current.poll,
                    votingOptionId = current.votingOptionId,
                    voteError = current.voteError,
                    onBack = onBack,
                    onVote = viewModel::castVote,
                )
        }
    }
}

// MARK: - Shells

@Composable
private fun LoadingShell(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Poll",
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 220.dp, height = 18.dp, cornerRadius = Radii.sm)
                Shimmer(width = 140.dp, height = 14.dp, cornerRadius = Radii.sm)
            }
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.md)
                Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.md)
                Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.md)
            }
        },
    )
}

@Composable
private fun ErrorShell(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Poll",
        onBack = onBack,
        header = {},
        body = {
            EmptyState(
                icon = PantopusIcon.AlertCircle,
                headline = "Couldn't load this poll",
                subcopy = message,
                ctaTitle = "Try again",
                onCta = onRetry,
            )
        },
    )
}

@Composable
private fun LoadedShell(
    poll: PollDto,
    votingOptionId: String?,
    voteError: String?,
    onBack: () -> Unit,
    onVote: (String) -> Unit,
) {
    val projection = PollsListViewModel.project(poll, Instant.now())
    val totalVotes =
        poll.options.sumOf { option ->
            poll.optionCounts[option.id] ?: poll.optionCounts[option.label] ?: 0
        }
    val isActive = projection.chipStatus != PollChipStatus.Closed
    val topVotes =
        poll.options.maxOfOrNull { option ->
            poll.optionCounts[option.id] ?: poll.optionCounts[option.label] ?: 0
        } ?: 0
    ContentDetailShell(
        title = "Poll",
        onBack = onBack,
        header = {
            PollHeader(
                poll = poll,
                projection = projection,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                if (!poll.description.isNullOrEmpty()) {
                    Text(
                        text = poll.description.orEmpty(),
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    for (option in poll.options) {
                        val votes =
                            poll.optionCounts[option.id]
                                ?: poll.optionCounts[option.label] ?: 0
                        val isMyVote =
                            poll.myVote?.contains(option.id) == true ||
                                poll.myVote?.contains(option.label) == true
                        val isWinner = !isActive && votes == topVotes && topVotes > 0
                        PollResultBar(
                            label = option.label,
                            votes = votes,
                            totalVotes = totalVotes,
                            isMyVote = isMyVote,
                            isWinner = isWinner,
                            isLoading = votingOptionId == option.id,
                            onTap = if (isActive) ({ onVote(option.id) }) else null,
                        )
                    }
                }
                if (voteError != null) {
                    Text(
                        text = voteError,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.error,
                        modifier = Modifier.testTag("pollDetail_voteError"),
                    )
                }
                PollMetaGrid(poll = poll, projection = projection)
            }
        },
    )
}

@Composable
private fun PollHeader(
    poll: PollDto,
    projection: PollRowProjection,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(projection.kind.background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = projection.kind.icon,
                contentDescription = null,
                size = Radii.xl3,
                tint = projection.kind.foreground,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = projection.kind.label.uppercase(),
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = projection.kind.foreground,
            )
            Text(
                text = poll.title,
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
            )
            StatusChip(
                text = projection.chipText,
                variant = projection.chipVariant,
                icon = projection.chipIcon,
            )
        }
    }
}

@Composable
private fun PollMetaGrid(
    poll: PollDto,
    projection: PollRowProjection,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg)),
    ) {
        MetaRow(label = "Status", value = projection.chipText)
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        MetaRow(label = "Votes cast", value = poll.voteCount.toString())
        projection.timeMeta?.let { meta ->
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            MetaRow(
                label = if (projection.chipStatus == PollChipStatus.Closed) "Closed" else "Closes",
                value = meta,
            )
        }
        if (!poll.visibility.isNullOrEmpty()) {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            MetaRow(
                label = "Visibility",
                value = poll.visibility.orEmpty().replaceFirstChar { it.uppercase() },
            )
        }
    }
}

@Composable
private fun MetaRow(
    label: String,
    value: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        Box(modifier = Modifier.weight(1f))
        Text(value, style = PantopusTextStyle.body, color = PantopusColors.appText)
    }
}
