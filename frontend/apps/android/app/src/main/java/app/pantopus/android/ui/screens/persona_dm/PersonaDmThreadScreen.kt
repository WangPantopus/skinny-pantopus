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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
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
 * A15.4 "Creator thread" / A15.5 "Fan thread". Top bar (back · avatar ·
 * @handle + display name) → fan-side reply-policy banner → message bubbles
 * (viewer right, counterparty left) → composer.
 *
 * Deliberately NOT the generic chat screen: persona DMs are addressed by
 * thread id and carry no counterparty user id, so the chat surface can't
 * model them. Mirrors iOS `PersonaDmThreadView.swift`.
 */
@Composable
fun PersonaDmThreadScreen(
    onBack: () -> Unit = {},
    viewModel: PersonaDmThreadViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val draft by viewModel.draft.collectAsStateWithLifecycle()
    val isSending by viewModel.isSending.collectAsStateWithLifecycle()
    val sendError by viewModel.sendError.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    val header =
        when (val current = state) {
            is PersonaDmThreadUiState.Loaded -> current.content
            is PersonaDmThreadUiState.Empty -> current.content
            else -> null
        }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .imePadding()
                .testTag("personaDmThread"),
    ) {
        TopBar(header = header, onBack = onBack)
        when (val current = state) {
            is PersonaDmThreadUiState.Loading -> LoadingFrame()
            is PersonaDmThreadUiState.Error ->
                Box(modifier = Modifier.fillMaxSize().testTag("personaDmThreadError")) {
                    ErrorState(
                        headline = "Couldn't load this thread",
                        message = current.message,
                        onRetry = viewModel::refresh,
                    )
                }
            is PersonaDmThreadUiState.Loaded ->
                ThreadBody(
                    content = current.content,
                    messages = current.content.messages,
                    draft = draft,
                    isSending = isSending,
                    sendError = sendError,
                    onDraftChange = viewModel::onDraftChange,
                    canSend = viewModel.canSend(),
                    onSend = viewModel::send,
                )
            is PersonaDmThreadUiState.Empty ->
                ThreadBody(
                    content = current.content,
                    messages = emptyList(),
                    draft = draft,
                    isSending = isSending,
                    sendError = sendError,
                    onDraftChange = viewModel::onDraftChange,
                    canSend = viewModel.canSend(),
                    onSend = viewModel::send,
                )
        }
    }
}

@Composable
private fun TopBar(
    header: PersonaDmThreadLoaded?,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = Spacing.s2)
                    .testTag("personaDmThreadHeader"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("personaDmThreadBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            if (header != null) {
                Box(
                    modifier = Modifier.size(34.dp).clip(CircleShape).background(PantopusColors.businessBg),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = header.initials,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.business,
                    )
                }
                Column {
                    Text(
                        text = header.title,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        text = header.subtitle,
                        fontSize = 11.5.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            } else {
                Text(
                    text = "Conversation",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

@Composable
private fun LoadingFrame() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("personaDmThreadLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 180.dp, height = 40.dp, cornerRadius = Radii.lg)
        Shimmer(width = 220.dp, height = 52.dp, cornerRadius = Radii.lg, modifier = Modifier.align(Alignment.End))
        Shimmer(width = 160.dp, height = 40.dp, cornerRadius = Radii.lg)
    }
}

@Composable
private fun ColumnScope.ThreadBody(
    content: PersonaDmThreadLoaded,
    messages: List<PersonaDmMessageContent>,
    draft: String,
    isSending: Boolean,
    sendError: String?,
    onDraftChange: (String) -> Unit,
    canSend: Boolean,
    onSend: () -> Unit,
) {
    content.policyBanner?.let { PolicyBanner(it) }

    val listState = rememberLazyListState()
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    LazyColumn(
        state = listState,
        modifier =
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("personaDmThreadMessages"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (messages.isEmpty()) {
            item {
                Text(
                    text = "No messages yet. Say hi to start the thread.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = Spacing.s10)
                            .testTag("personaDmThreadEmpty"),
                )
            }
        }
        items(messages, key = { it.id }) { message -> BubbleRow(message) }
    }

    Composer(
        draft = draft,
        isSending = isSending,
        sendError = sendError,
        onDraftChange = onDraftChange,
        canSend = canSend,
        onSend = onSend,
    )
}

@Composable
private fun PolicyBanner(banner: PersonaDmPolicyBanner) {
    val missed = banner.kind == PersonaDmPolicyBannerKind.Missed
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (missed) PantopusColors.errorBg else PantopusColors.infoBg)
                .testTag(if (missed) "personaDmThreadSlaMissedBanner" else "personaDmThreadPolicyBanner"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            PantopusIconImage(
                icon = if (missed) PantopusIcon.AlertTriangle else PantopusIcon.Info,
                contentDescription = null,
                size = 14.dp,
                tint = if (missed) PantopusColors.error else PantopusColors.primary700,
            )
            Text(
                text = banner.text,
                fontSize = 12.sp,
                color = if (missed) PantopusColors.error else PantopusColors.primary700,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(if (missed) PantopusColors.errorLight else PantopusColors.infoLight),
        )
    }
}

@Composable
private fun BubbleRow(message: PersonaDmMessageContent) {
    val bubbleShape =
        if (message.fromViewer) {
            RoundedCornerShape(
                topStart = Radii.xl,
                topEnd = Radii.xl,
                bottomStart = Radii.xl,
                bottomEnd = Radii.xs,
            )
        } else {
            RoundedCornerShape(
                topStart = Radii.xl,
                topEnd = Radii.xl,
                bottomStart = Radii.xs,
                bottomEnd = Radii.xl,
            )
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics {
                    contentDescription =
                        "${if (message.fromViewer) "You" else "They"} said ${message.body}, ${message.timeLabel}"
                },
        horizontalAlignment = if (message.fromViewer) Alignment.End else Alignment.Start,
    ) {
        Text(
            text = message.body,
            fontSize = 14.sp,
            color = if (message.fromViewer) PantopusColors.appTextInverse else PantopusColors.appText,
            modifier =
                Modifier
                    .clip(bubbleShape)
                    .background(
                        if (message.fromViewer) PantopusColors.primary600 else PantopusColors.appSurfaceSunken,
                    ).padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = message.timeLabel, fontSize = 10.sp, color = PantopusColors.appTextMuted)
            if (message.readByCounterparty) {
                PantopusIconImage(
                    icon = PantopusIcon.CheckCheck,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun Composer(
    draft: String,
    isSending: Boolean,
    sendError: String?,
    onDraftChange: (String) -> Unit,
    canSend: Boolean,
    onSend: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("personaDmThreadComposer"),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        if (sendError != null) {
            Text(
                text = sendError,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.error,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s3)
                        .padding(top = Spacing.s2)
                        .testTag("personaDmThreadSendError"),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Bottom,
        ) {
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 40.dp, max = 120.dp)
                        .clip(RoundedCornerShape(Radii.xl))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (draft.isEmpty()) {
                    Text(
                        text = "Type a message…",
                        fontSize = 14.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
                BasicTextField(
                    value = draft,
                    onValueChange = onDraftChange,
                    textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    modifier = Modifier.fillMaxWidth().testTag("personaDmThreadInput"),
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(if (canSend) PantopusColors.primary600 else PantopusColors.primary200)
                        .clickable(enabled = canSend && !isSending, onClick = onSend)
                        .testTag("personaDmThreadSend"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ArrowUp,
                    contentDescription = "Send message",
                    size = 17.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
