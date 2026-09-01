@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.community

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.community.components.CommunityFeedCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.4 — Community mail. The neighborhood / civic feed: type filter
 * chips, pull-to-refresh, the four reaction types, RSVP on neighborhood
 * events, and flag-for-review behind a destructive confirm.
 *
 * Four states per the Block 2F rule: shimmer skeleton, [EmptyState],
 * loaded feed, [ErrorState] with Retry wired to `refresh()`.
 *
 * Mirrors iOS `CommunityMailView`.
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun CommunityMailScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: CommunityMailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.selectedFilter.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val pendingFlagId by viewModel.pendingFlagItemId.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(2_200)
            viewModel.consumeToast()
        }
    }

    val pullState =
        rememberPullRefreshState(
            refreshing = state is CommunityMailUiState.Loading,
            onRefresh = { viewModel.refresh() },
        )

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("communityMail"),
    ) {
        OfflineBannerHost(isOffline = !online) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopBar(onBack = onBack, subtitle = subtitleFor(state))
                FilterChips(selected = filter, onSelect = viewModel::selectFilter)
                Box(modifier = Modifier.fillMaxSize().pullRefresh(pullState)) {
                    when (val current = state) {
                        CommunityMailUiState.Loading -> LoadingBody()
                        is CommunityMailUiState.Loaded ->
                            FeedBody(
                                items = current.items,
                                onReact = viewModel::react,
                                onRsvp = viewModel::rsvp,
                                onFlag = viewModel::requestFlag,
                            )

                        CommunityMailUiState.Empty ->
                            EmptyState(
                                icon = PantopusIcon.Megaphone,
                                headline = "No community items",
                                subcopy =
                                    "Civic notices, neighborhood events, and shared mail from " +
                                        "your block will appear here.",
                                modifier = Modifier.testTag("communityMail_empty"),
                                ctaTitle = "Refresh",
                                onCta = { viewModel.refresh() },
                                tint = PantopusColors.businessBg,
                                accent = PantopusColors.business,
                            )

                        is CommunityMailUiState.Error ->
                            ErrorState(
                                headline = "Couldn't load community mail",
                                message = current.message,
                                modifier = Modifier.testTag("communityMail_error"),
                                onRetry = { viewModel.refresh() },
                            )
                    }
                    PullRefreshIndicator(
                        refreshing = state is CommunityMailUiState.Loading,
                        state = pullState,
                        modifier = Modifier.align(Alignment.TopCenter),
                        contentColor = PantopusColors.primary600,
                    )
                }
            }
        }

        if (toast != null) {
            Text(
                text = toast.orEmpty(),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10)
                        .clip(CircleShape)
                        .background(PantopusColors.appText.copy(alpha = 0.9f))
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("communityMail_toast"),
            )
        }
    }

    if (pendingFlagId != null) {
        val title = viewModel.pendingFlagTitle()
        AlertDialog(
            onDismissRequest = { viewModel.cancelFlag() },
            title = { Text("Flag this item?") },
            text = {
                Text(
                    if (title != null) {
                        "This will report “$title” for review."
                    } else {
                        "This will report the item for review."
                    },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmFlag() },
                    modifier = Modifier.testTag("communityMail_flagConfirm"),
                ) {
                    Text("Flag", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelFlag() }) { Text("Cancel") }
            },
        )
    }
}

private fun subtitleFor(state: CommunityMailUiState): String =
    when (state) {
        is CommunityMailUiState.Loaded -> {
            val noun = if (state.total == 1) "item" else "items"
            "${state.total} $noun in your neighborhood"
        }

        else -> "Your neighborhood feed"
    }

@Composable
private fun TopBar(
    onBack: () -> Unit,
    subtitle: String,
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
                    .testTag("communityMail_back"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowLeft,
                contentDescription = "Back to Mailbox",
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        Column {
            Text(
                text = "Community Mail",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(text = subtitle, fontSize = 11.sp, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun FilterChips(
    selected: CommunityFeedFilter,
    onSelect: (CommunityFeedFilter) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CommunityFeedFilter.entries.forEach { filter ->
            val active = filter == selected
            Row(
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(
                            if (active) PantopusColors.business else PantopusColors.appSurfaceSunken,
                        )
                        .clickable { onSelect(filter) }
                        .padding(horizontal = Spacing.s3, vertical = 6.dp)
                        .testTag("communityMail_filter_${filter.slug}"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = filter.icon,
                    contentDescription = null,
                    size = 14.dp,
                    tint =
                        if (active) {
                            PantopusColors.appTextInverse
                        } else {
                            PantopusColors.appTextSecondary
                        },
                )
                Text(
                    text = filter.label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color =
                        if (active) {
                            PantopusColors.appTextInverse
                        } else {
                            PantopusColors.appTextSecondary
                        },
                )
            }
        }
    }
}

@Composable
private fun FeedBody(
    items: List<CommunityFeedItem>,
    onReact: (String, CommunityReactionType) -> Unit,
    onRsvp: (String) -> Unit,
    onFlag: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("communityMail_feed"),
        contentPadding = PaddingValues(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        items(items, key = { it.id }) { item ->
            CommunityFeedCard(
                item = item,
                onReact = { reaction -> onReact(item.id, reaction) },
                onRsvp = { onRsvp(item.id) },
                onFlag = { onFlag(item.id) },
            )
        }
    }
}

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s4)
                .testTag("communityMail_loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(4) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 34.dp, height = 34.dp, cornerRadius = Radii.md)
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Shimmer(width = 110.dp, height = 10.dp, cornerRadius = Radii.xs)
                        Shimmer(width = 70.dp, height = 9.dp, cornerRadius = Radii.xs)
                    }
                }
                Shimmer(width = 220.dp, height = 11.dp, cornerRadius = Radii.xs)
                Shimmer(width = 180.dp, height = 9.dp, cornerRadius = Radii.xs)
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    repeat(4) { Shimmer(width = 52.dp, height = 22.dp, cornerRadius = Radii.pill) }
                }
            }
        }
    }
}
