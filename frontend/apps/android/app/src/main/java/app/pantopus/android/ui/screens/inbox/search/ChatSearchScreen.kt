@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.inbox.search

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.inbox.chat.ConversationIdentityChip
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Chat Search screen — the Inbox `onOpenSearch` destination. Searches
 * conversation names + message bodies via [ChatSearchViewModel], rendered
 * through the shared [SearchListShell]. Each result row highlights the
 * query term; tapping opens the conversation, scrolled to the matched
 * message when the hit came from a message body.
 */
@Composable
fun ChatSearchScreen(
    onOpenResult: (ChatSearchResult) -> Unit = {},
    onCancel: () -> Unit = {},
    viewModel: ChatSearchViewModel = hiltViewModel(),
) {
    val query by viewModel.query.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    SearchListShell(
        placeholder = "Search people and messages",
        query = query,
        onQueryChange = viewModel::setQuery,
        results = results,
        isLoading = isLoading,
        emptyState =
            EmptyStateContent(
                icon = PantopusIcon.Search,
                headline = "No matches",
                subcopy = "Try a name or a word from a message.",
            ),
        row = { result -> ChatSearchResultRow(result = result, onClick = { onOpenResult(result) }) },
        onCancel = onCancel,
    )
}

@Composable
internal fun ChatSearchResultRow(
    result: ChatSearchResult,
    onClick: () -> Unit,
) {
    val clickLabel =
        if (result.matchedMessageId != null) {
            "Opens the conversation at the matching message"
        } else {
            "Opens the conversation"
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClickLabel = clickLabel, onClick = onClick)
                .testTag("chatSearchResult_${result.conversationId}")
                .semantics { contentDescription = description(result) },
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            ResultAvatar(initials = result.initials, verified = result.verified)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = ChatSearchText.highlighted(result.displayName, result.query),
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    result.identityChip?.let { IdentityChip(it) }
                }
                Text(
                    text = ChatSearchText.highlighted(result.snippet, result.query),
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
    }
}

private fun description(result: ChatSearchResult): String =
    buildList {
        add(result.displayName)
        result.identityChip?.let { add(it.label) }
        if (result.verified) add("verified")
        add(result.snippet)
    }.joinToString(". ")

@Composable
private fun ResultAvatar(
    initials: String,
    verified: Boolean,
) {
    Box(modifier = Modifier.size(42.dp), contentAlignment = Alignment.BottomEnd) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appBorderStrong),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (verified) {
            Box(
                modifier =
                    Modifier
                        .size(15.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.md,
                    strokeWidth = 3.5f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun IdentityChip(chip: ConversationIdentityChip) {
    val foreground =
        if (chip == ConversationIdentityChip.Business) PantopusColors.business else PantopusColors.home
    val background =
        if (chip == ConversationIdentityChip.Business) PantopusColors.businessBg else PantopusColors.homeBg
    val icon =
        if (chip == ConversationIdentityChip.Business) PantopusIcon.ShoppingBag else PantopusIcon.Home
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(background)
                .padding(horizontal = 6.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = Radii.md,
            strokeWidth = 2.6f,
            tint = foreground,
        )
        Text(
            text = chip.label.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
        )
    }
}
