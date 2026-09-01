@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.inbox.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Chat list (Inbox tab) screen. Three frames: shimmer skeleton,
 * verified-floor empty state, populated list. Underline filter tabs,
 * compose action on the top bar + empty-state CTA, row tap dispatches
 * to [onOpenConversation].
 */
@Composable
fun ChatListScreen(
    onOpenConversation: (ConversationRowContent) -> Unit = {},
    onCompose: () -> Unit = {},
    onOpenSearch: () -> Unit = {},
    viewModel: ChatListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeFilter by viewModel.activeFilter.collectAsStateWithLifecycle()
    val unreadByFilter by viewModel.unreadByFilter.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    DisposableEffect(Unit) {
        onDispose { viewModel.teardown() }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag("chatList"),
    ) {
        TopBar(onCompose = onCompose)
        SearchBar(skeleton = state is ChatListUiState.Loading, onTap = onOpenSearch)
        FilterTabs(
            active = activeFilter,
            unreadByFilter = unreadByFilter,
            skeleton = state is ChatListUiState.Loading,
            onSelect = viewModel::selectFilter,
        )
        when (val s = state) {
            ChatListUiState.Loading -> LoadingFrame()
            ChatListUiState.Empty -> EmptyFrame(onCompose = onCompose)
            is ChatListUiState.Loaded ->
                PopulatedFrame(
                    rows = s.rows,
                    onTap = onOpenConversation,
                    onMute = viewModel::toggleMute,
                    onHide = viewModel::hideConversation,
                )
            is ChatListUiState.Error -> ErrorFrame(message = s.message, onRetry = viewModel::refresh)
        }
    }
}

@Composable
private fun TopBar(onCompose: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s4, end = Spacing.s2, top = 10.dp, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Chat",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onCompose)
                    .testTag("chatListComposeButton"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Edit2,
                contentDescription = "New message",
                size = Radii.xl2,
                tint = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun SearchBar(
    skeleton: Boolean,
    onTap: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = Spacing.s4, vertical = Spacing.s1)) {
        if (skeleton) {
            Shimmer(width = 328.dp, height = 44.dp, cornerRadius = Radii.md, modifier = Modifier.fillMaxWidth())
        } else {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(onClick = onTap)
                        .padding(horizontal = 14.dp)
                        .heightIn(min = 44.dp)
                        .testTag("chatListSearchButton"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Search,
                    contentDescription = null,
                    size = 17.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Search people and messages",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
internal fun FilterTabs(
    active: ChatFilter,
    unreadByFilter: Map<ChatFilter, Int>,
    skeleton: Boolean,
    onSelect: (ChatFilter) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s4, top = Spacing.s3),
    ) {
        Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
            if (skeleton) {
                repeat(4) {
                    Shimmer(width = 48.dp, height = 14.dp, cornerRadius = Radii.xs)
                    Spacer(modifier = Modifier.size(24.dp))
                }
            } else {
                ChatFilter.entries.forEach { filter ->
                    FilterTab(
                        filter = filter,
                        active = filter == active,
                        badge = unreadByFilter[filter] ?: 0,
                        onClick = { onSelect(filter) },
                    )
                    Spacer(modifier = Modifier.size(24.dp))
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Composable
private fun FilterTab(
    filter: ChatFilter,
    active: Boolean,
    badge: Int,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .clickable(onClick = onClick)
                .padding(bottom = Spacing.s3)
                .testTag("chatListFilter_${filter.key}"),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = filter.label,
                fontSize = 13.5.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                color = if (active) PantopusColors.appText else PantopusColors.appTextSecondary,
            )
            if (filter == ChatFilter.Unread && badge > 0) {
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 16.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (active) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                            .padding(horizontal = 5.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "$badge",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                    )
                }
            }
        }
        if (active) {
            Box(
                modifier =
                    Modifier
                        .padding(top = Spacing.s2)
                        .height(2.dp)
                        .background(PantopusColors.primary600)
                        .fillMaxWidth(),
            )
        }
    }
}

@Composable
internal fun LoadingFrame() {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("chatListLoading"),
    ) {
        items(6) {
            SkeletonRow()
        }
    }
}

@Composable
private fun SkeletonRow() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 44.dp, height = 44.dp, cornerRadius = 22.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Shimmer(width = 140.dp, height = 12.dp, cornerRadius = Radii.xs)
            Shimmer(width = 220.dp, height = 10.dp, cornerRadius = Radii.xs)
        }
        Shimmer(width = 26.dp, height = 9.dp, cornerRadius = Radii.xs)
    }
}

@Composable
internal fun EmptyFrame(onCompose: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("chatListEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 30.dp,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = "No conversations yet",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(
            text = "Message someone you've verified nearby.",
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.size(Spacing.s3))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onCompose)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp)
                    .testTag("chatListNewMessage"),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PantopusIconImage(
                    icon = PantopusIcon.Edit2,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = "New message",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
        Spacer(modifier = Modifier.size(Spacing.s4))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceMuted)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = 14.dp, vertical = 10.dp)
                    .testTag("chatListVerifiedFloor"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Only verified neighbors can DM you",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
internal fun PopulatedFrame(
    rows: List<ConversationRowContent>,
    onTap: (ConversationRowContent) -> Unit,
    onMute: (String) -> Unit = {},
    onHide: (String) -> Unit = {},
) {
    LazyColumn(modifier = Modifier.fillMaxSize().testTag("chatListContent")) {
        items(items = rows, key = { it.id }) { row ->
            if (row.variant == ConversationRowVariant.AiAssistant) {
                ConversationRow(content = row, onTap = { onTap(row) })
            } else {
                SwipeableConversationRow(
                    content = row,
                    onTap = { onTap(row) },
                    onMute = { onMute(row.storageKey) },
                    onHide = { onHide(row.storageKey) },
                )
            }
        }
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
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("chatListError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = "Couldn't load chat",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(text = message, fontSize = 13.5.sp, color = PantopusColors.appTextSecondary)
        Spacer(modifier = Modifier.size(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp)
                    .testTag("chatListRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
