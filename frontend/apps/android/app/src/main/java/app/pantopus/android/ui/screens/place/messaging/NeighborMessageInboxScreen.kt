package app.pantopus.android.ui.screens.place.messaging

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.PlaceDetailHeader
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * The verified-neighbor inbox list. Each row is an anonymized heads-up ("a
 * verified neighbor nearby") with an unread dot; tapping opens the D2
 * detail. Parity twin of iOS `NeighborMessageInboxView`.
 */
@Composable
fun NeighborMessageInboxScreen(
    onBack: () -> Unit,
    onOpenMessage: (String) -> Unit,
    viewModel: NeighborMessageInboxViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PlaceDetailHeader(title = "Messages", address = "From verified neighbors", onBack = onBack)
        when (val current = state) {
            NeighborInboxUiState.Loading -> InboxSkeleton()
            NeighborInboxUiState.Empty ->
                EmptyState(
                    icon = PantopusIcon.Inbox,
                    headline = "No messages yet",
                    subcopy = "When a verified neighbor on your block sends you a heads-up, it'll show up here.",
                )
            is NeighborInboxUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
            is NeighborInboxUiState.Loaded ->
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(items = current.messages, key = { it.id }) { message ->
                        InboxRow(message = message, onClick = { onOpenMessage(message.id) })
                    }
                }
        }
    }
}

@Composable
private fun InboxRow(
    message: ReceivedNeighborMessage,
    onClick: () -> Unit,
) {
    val unread = message.readAt == null
    Row(
        modifier = Modifier.fillMaxWidth().placeCard().clickable(onClick = onClick).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.dp, PantopusColors.appBorder, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 20.dp,
                strokeWidth = 2f,
                tint = PantopusColors.home,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "A verified neighbor nearby",
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (unread) {
                    Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(PantopusColors.primary600))
                }
                Spacer(modifier = Modifier.weight(1f))
                Text(text = neighborRelativeTime(message.createdAt), fontSize = 12.sp, color = PantopusColors.appTextMuted)
            }
            Text(
                text = message.body,
                fontSize = 13.5.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.25f,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
@Suppress("MagicNumber")
private fun InboxSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).padding(top = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        repeat(4) {
            Row(
                modifier = Modifier.fillMaxWidth().placeCard().padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Shimmer(width = 40.dp, height = 40.dp, cornerRadius = 20.dp)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Shimmer(width = 170.dp, height = 13.dp)
                    Shimmer(width = 240.dp, height = 12.dp)
                }
            }
        }
    }
}
