@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.inbox

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private const val INBOX_AVATAR_SIZE = 44
private const val INBOX_SKELETON_ROW_HEIGHT = 72
private const val INBOX_SKELETON_ROWS = 5

/**
 * The business-side inbox — an in-screen frame of the owner dashboard
 * (same idiom as the owner ↔ catalog toggle). Messages lists the rooms
 * addressed to the business identity; Mentions lists the neighborhood
 * posts matched to the business. Both ship loading / empty / loaded /
 * error.
 *
 * Mirrors iOS `BusinessInboxView.swift`.
 */
@Composable
fun BusinessInboxScreen(
    onBack: () -> Unit,
    /** Opens a chat room: (`roomId`, counterpart name, counterpart handle). */
    onOpenRoom: (String, String, String) -> Unit = { _, _, _ -> },
    /** Opens a matched neighborhood post by id. */
    onOpenPost: (String) -> Unit = {},
    viewModel: BusinessInboxViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val section by viewModel.section.collectAsStateWithLifecycle()
    val totalUnread by viewModel.totalUnread.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("businessInbox"),
    ) {
        ContentDetailTopBar(
            title = if (totalUnread > 0) "Inbox ($totalUnread)" else "Inbox",
            onBack = onBack,
        )
        SectionToggle(selected = section, onSelect = viewModel::selectSection)

        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            when (val current = state) {
                is BusinessInboxUiState.Loading -> LoadingFrame()
                is BusinessInboxUiState.Empty -> EmptyFrame(section)
                is BusinessInboxUiState.Error ->
                    EmptyState(
                        icon = PantopusIcon.AlertCircle,
                        headline =
                            if (section == BusinessInboxSection.Messages) {
                                "Couldn't load messages"
                            } else {
                                "Couldn't load mentions"
                            },
                        subcopy = current.message,
                        ctaTitle = "Retry",
                        onCta = viewModel::refresh,
                        tint = PantopusColors.businessBg,
                        accent = PantopusColors.business,
                        modifier = Modifier.testTag("businessInbox.error"),
                    )
                is BusinessInboxUiState.LoadedRooms ->
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().testTag("businessInbox.messagesList"),
                        contentPadding = PaddingValues(Spacing.s4),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        items(current.rooms, key = { it.id }) { room ->
                            RoomCard(room = room, onOpen = { onOpenRoom(room.id, room.title, room.handle) })
                        }
                    }
                is BusinessInboxUiState.LoadedMentions ->
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().testTag("businessInbox.mentionsList"),
                        contentPadding = PaddingValues(Spacing.s4),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        items(current.mentions, key = { it.id }) { mention ->
                            MentionCard(mention = mention, onOpen = { onOpenPost(mention.id) })
                        }
                    }
            }
        }
    }
}

// ── Section toggle ──

@Composable
private fun SectionToggle(
    selected: BusinessInboxSection,
    onSelect: (BusinessInboxSection) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("businessInbox.sections"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        BusinessInboxSection.entries.forEach { candidate ->
            val isSelected = candidate == selected
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (isSelected) PantopusColors.businessBg else PantopusColors.appSurface,
                        ).border(
                            width = 1.dp,
                            color = if (isSelected) PantopusColors.business else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        ).clickable { onSelect(candidate) }
                        .padding(horizontal = 14.dp, vertical = Spacing.s2)
                        .testTag("businessInbox.section.${candidate.wire}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = candidate.icon,
                    contentDescription = null,
                    size = 14.dp,
                    tint = if (isSelected) PantopusColors.business else PantopusColors.appTextMuted,
                )
                Text(
                    text = candidate.title,
                    fontSize = 13.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isSelected) PantopusColors.business else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// ── Rows ──

@Composable
private fun RoomCard(
    room: BusinessInboxRoom,
    onOpen: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onOpen)
                .padding(14.dp)
                .testTag("businessInbox.room.${room.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(INBOX_AVATAR_SIZE.dp)
                    .clip(CircleShape)
                    .background(
                        if (room.isUnread) PantopusColors.businessBg else PantopusColors.appSurfaceSunken,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = roomInitials(room.title),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = room.title,
                    fontSize = 14.sp,
                    fontWeight = if (room.isUnread) FontWeight.Bold else FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (room.timeAgo.isNotEmpty()) {
                    Text(
                        text = room.timeAgo,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextMuted,
                        modifier = Modifier.padding(start = Spacing.s2),
                    )
                }
            }
            if (room.preview.isNotEmpty()) {
                Text(
                    text = room.preview,
                    fontSize = 12.5.sp,
                    color =
                        if (room.isUnread) PantopusColors.appText else PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (room.isUnread) {
            Box(
                modifier =
                    Modifier
                        .widthIn(min = 20.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.business)
                        .padding(horizontal = Spacing.s2, vertical = 2.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = room.unreadCount.toString(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun MentionCard(
    mention: BusinessInboxMention,
    onOpen: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onOpen)
                .padding(14.dp)
                .testTag("businessInbox.mention.${mention.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(INBOX_AVATAR_SIZE.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.FileText,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = mention.authorName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (mention.timeAgo.isNotEmpty()) {
                    Text(
                        text = mention.timeAgo,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextMuted,
                        modifier = Modifier.padding(start = Spacing.s2),
                    )
                }
            }
            if (mention.body.isNotEmpty()) {
                Text(
                    text = mention.body,
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (mention.engagement.isNotEmpty()) {
                Text(
                    text = mention.engagement,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = Spacing.s1),
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

// ── States ──

@Composable
private fun LoadingFrame() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("businessInbox.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        repeat(INBOX_SKELETON_ROWS) {
            Shimmer(
                height = INBOX_SKELETON_ROW_HEIGHT.dp,
                cornerRadius = Radii.lg,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun EmptyFrame(section: BusinessInboxSection) {
    when (section) {
        BusinessInboxSection.Messages ->
            EmptyState(
                icon = PantopusIcon.MessageSquare,
                headline = "No messages yet",
                subcopy = "Conversations neighbors start with this business land here.",
                tint = PantopusColors.businessBg,
                accent = PantopusColors.business,
                modifier = Modifier.testTag("businessInbox.empty"),
            )
        BusinessInboxSection.Mentions ->
            EmptyState(
                icon = PantopusIcon.AtSign,
                headline = "No posts mention your business yet",
                subcopy = "Neighborhood posts matched to your categories show up here.",
                tint = PantopusColors.businessBg,
                accent = PantopusColors.business,
                modifier = Modifier.testTag("businessInbox.empty"),
            )
    }
}

/** Up to two uppercased initials from the counterpart name. */
private fun roomInitials(name: String): String {
    val source = name.removePrefix("@")
    val letters =
        source
            .split(" ")
            .take(2)
            .mapNotNull { it.firstOrNull()?.toString() }
            .joinToString("")
    return letters.ifEmpty { "?" }.uppercase()
}
