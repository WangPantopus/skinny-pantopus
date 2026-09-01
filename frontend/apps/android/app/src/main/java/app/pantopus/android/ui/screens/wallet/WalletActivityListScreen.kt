@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.OfflineBanner
import app.pantopus.android.ui.screens.shared.feed.FeedSkeletonCard
import app.pantopus.android.ui.screens.wallet.components.ActivityRow
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** WS5.1 — paginated wallet transaction list. */
@Composable
fun WalletActivityListScreen(
    onBack: () -> Unit = {},
    viewModel: WalletActivityListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    SecureScreenEffect()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("walletActivityList"),
    ) {
        TopBar(title = viewModel.title, onBack = onBack)
        OfflineBanner()
        when (val ui = state) {
            WalletActivityListUiState.Loading ->
                Column(
                    modifier = Modifier.padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    repeat(6) { FeedSkeletonCard() }
                }
            WalletActivityListUiState.Empty ->
                EmptyState(
                    icon = PantopusIcon.History,
                    headline = "No activity yet",
                    subcopy = "Earnings, withdrawals, and tips will show up here.",
                    modifier = Modifier.fillMaxSize(),
                )
            is WalletActivityListUiState.Error ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load activity",
                    subcopy = ui.message,
                    modifier = Modifier.fillMaxSize(),
                    ctaTitle = "Retry",
                    onCta = { viewModel.refresh() },
                )
            is WalletActivityListUiState.Loaded ->
                ActivityGroupedList(
                    items = ui.items,
                    onLastVisible = { viewModel.loadMoreIfNeeded(it.id) },
                )
        }
    }
}

@Composable
private fun TopBar(
    title: String,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2).height(48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClick = onBack)
                        .testTag("walletActivityBack"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            Spacer(Modifier.weight(1f))
            Text(
                text = title,
                color = PantopusColors.appText,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.size(44.dp))
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

/**
 * Lazy: rows compose as they scroll into view, so the trailing paging hook
 * fires on scroll rather than immediately for every page at once. Mirrors the
 * iOS `LazyVStack` in `WalletActivityListView`.
 */
@Composable
private fun ActivityGroupedList(
    items: List<WalletActivityItem>,
    onLastVisible: (WalletActivityItem) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(Spacing.s4),
    ) {
        itemsIndexed(items = items, key = { _, item -> item.id }) { index, item ->
            val showDay = index == 0 || items[index - 1].day != item.day
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(cardCornerShape(index = index, lastIndex = items.lastIndex))
                        .background(PantopusColors.appSurface),
            ) {
                if (showDay) {
                    Text(
                        text = item.day.uppercase(),
                        color = PantopusColors.appTextMuted,
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.7.sp,
                        modifier =
                            Modifier
                                .padding(horizontal = 14.dp)
                                .padding(top = if (index == 0) Spacing.s2 else Spacing.s3, bottom = Spacing.s1),
                    )
                }
                ActivityRow(item = item, isLast = index == items.lastIndex)
            }
            if (index == items.lastIndex) {
                LaunchedEffect(item.id) { onLastVisible(item) }
            }
        }
    }
}

/** Rounds only the outer edges so the lazy rows still read as one card. */
private fun cardCornerShape(
    index: Int,
    lastIndex: Int,
): RoundedCornerShape {
    val radius = Radii.lg + 2.dp
    val zero = 0.dp
    return RoundedCornerShape(
        topStart = if (index == 0) radius else zero,
        topEnd = if (index == 0) radius else zero,
        bottomStart = if (index == lastIndex) radius else zero,
        bottomEnd = if (index == lastIndex) radius else zero,
    )
}
