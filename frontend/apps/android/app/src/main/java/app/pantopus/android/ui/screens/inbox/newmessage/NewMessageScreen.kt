@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "CyclomaticComplexMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.inbox.newmessage

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Contact picker for the New Message flow (T6.6b P25). Modal-style
 * top bar (Cancel + title), sticky search bar (the primary
 * affordance), then stacked card-style sections — Connections,
 * Recent, All verified — each with avatar-first contact rows. Tap a
 * row → emit a [NewMessageDestination] via the VM; the host
 * (RootTabScreen) pops the picker and pushes the chat-conversation
 * route in `person(otherUserId)` mode.
 */
@Composable
fun NewMessageScreen(
    onCancel: () -> Unit,
    onSelect: (NewMessageDestination) -> Unit,
    onInvite: () -> Unit = {},
    viewModel: NewMessageViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val searchText by viewModel.searchText.collectAsStateWithLifecycle()
    val destination by viewModel.destination.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(destination) {
        destination?.let {
            viewModel.consumeDestination()
            onSelect(it)
        }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("newMessage"),
    ) {
        TopBar(onCancel = onCancel)
        SearchBar(
            query = searchText,
            onChange = viewModel::updateSearch,
            onClear = viewModel::clearSearch,
        )
        Box(modifier = Modifier.fillMaxSize()) {
            when (val s = state) {
                NewMessageUiState.Loading -> LoadingFrame()
                NewMessageUiState.Empty ->
                    EmptyFrame(
                        headline = viewModel.emptyHeadline,
                        body = viewModel.emptyBody,
                        hints = viewModel.emptySearchHints,
                        onInvite = onInvite,
                    )
                is NewMessageUiState.Loaded ->
                    LoadedFrame(sections = s.sections, onTap = viewModel::tapRow)
                is NewMessageUiState.Error ->
                    ErrorFrame(message = s.message, onRetry = viewModel::refresh)
            }
        }
    }
}

// MARK: - Top bar

@Composable
private fun TopBar(onCancel: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(PantopusColors.appSurface),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Cancel",
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s2)
                        .heightIn(min = 36.dp)
                        .clickable(onClick = onCancel)
                        .testTag("newMessageCancel"),
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "New message",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .semantics { heading() }
                        .testTag("newMessageTitle"),
            )
            Spacer(modifier = Modifier.weight(1f))
            // Spacer matching Cancel's footprint so the title stays centered.
            Box(modifier = Modifier.size(width = 60.dp, height = 36.dp))
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder)
                    .align(Alignment.BottomCenter),
        )
    }
}

// MARK: - Search bar

@Composable
private fun SearchBar(
    query: String,
    onChange: (String) -> Unit,
    onClear: () -> Unit,
) {
    val hasText = query.isNotEmpty()
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s3, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
            Box(modifier = Modifier.weight(1f)) {
                if (query.isEmpty()) {
                    Text(
                        text = "Search by name or neighborhood",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onChange,
                    textStyle =
                        TextStyle(
                            fontSize = 13.sp,
                            color = PantopusColors.appText,
                        ),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(),
                    singleLine = true,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .testTag("newMessageSearchField"),
                )
            }
            if (hasText) {
                Box(
                    modifier =
                        Modifier
                            .size(20.dp)
                            .clickable(onClick = onClear)
                            .testTag("newMessageSearchClear"),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = "Clear search",
                        size = 14.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder)
                    .align(Alignment.BottomCenter),
        )
    }
}

// MARK: - Frames

@Composable
private fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("newMessageLoading"),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        repeat(2) {
            SectionSkeleton()
        }
    }
}

@Composable
private fun SectionSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            modifier =
                Modifier
                    .padding(start = Spacing.s1)
                    .height(11.dp)
                    .size(width = 100.dp, height = 11.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.appSurfaceSunken),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
        ) {
            repeat(3) { idx ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.appSurfaceSunken),
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(1f)) {
                        Box(
                            modifier =
                                Modifier
                                    .size(width = 140.dp, height = 12.dp)
                                    .clip(RoundedCornerShape(Radii.xs))
                                    .background(PantopusColors.appSurfaceSunken),
                        )
                        Box(
                            modifier =
                                Modifier
                                    .size(width = 100.dp, height = 10.dp)
                                    .clip(RoundedCornerShape(Radii.xs))
                                    .background(PantopusColors.appSurfaceSunken),
                        )
                    }
                }
                if (idx < 2) {
                    Box(
                        modifier =
                            Modifier
                                .padding(start = 14.dp)
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyFrame(
    headline: String,
    body: String,
    hints: List<String>,
    onInvite: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s8, vertical = Spacing.s8)
                .testTag("newMessageEmpty"),
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
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = 32.dp,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.size(18.dp))
        Text(
            text = headline,
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.size(8.dp))
        Text(
            text = body,
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.size(24.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            hints.forEach { hint -> HintChip(label = hint) }
        }
        Spacer(modifier = Modifier.size(24.dp))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(onClick = onInvite)
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s3)
                    .testTag("newMessageInvite"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UserPlus,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appText,
            )
            Text(
                text = "Invite someone to Pantopus",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun HintChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun LoadedFrame(
    sections: List<NewMessageSection>,
    onTap: (NewMessageContactRow) -> Unit,
) {
    if (sections.isEmpty()) {
        SearchEmptyState()
        return
    }
    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("newMessageContent"),
        contentPadding = PaddingValues(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        items(items = sections, key = { it.id.key }) { section ->
            SectionCard(section = section, onTap = onTap)
        }
    }
}

@Composable
private fun SearchEmptyState() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(top = Spacing.s10)
                .testTag("newMessageNoMatches"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.size(12.dp))
        Text(
            text = "No matches",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(6.dp))
        Text(
            text = "Try a different name or neighborhood.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SectionCard(
    section: NewMessageSection,
    onTap: (NewMessageContactRow) -> Unit,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = Spacing.s1, end = Spacing.s1, top = Spacing.s1, bottom = 10.dp)
                    .testTag("newMessageSection_${section.id.key}"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = section.label.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
            Text(
                text = "(${section.rows.size})",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
        ) {
            section.rows.forEachIndexed { index, row ->
                ContactRow(row = row, onTap = onTap)
                if (index < section.rows.size - 1) {
                    Box(
                        modifier =
                            Modifier
                                .padding(start = 14.dp)
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
                    )
                }
            }
        }
    }
}

@Composable
private fun ContactRow(
    row: NewMessageContactRow,
    onTap: (NewMessageContactRow) -> Unit,
) {
    val rowDescription =
        remember(row.id) {
            buildList {
                add(row.name)
                row.locality?.let { add(it) }
                row.sub?.let { add(it) }
                if (row.verified) add("verified")
            }.joinToString(", ")
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap(row) }
                .heightIn(min = 56.dp)
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .semantics { contentDescription = rowDescription }
                .testTag("newMessageRow_${row.userId}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        AvatarWithBadge(row = row)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = row.name,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            row.locality?.let { locality ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MapPin,
                        contentDescription = null,
                        size = 10.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = locality,
                        fontSize = 11.5.sp,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            row.sub?.let { sub ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    row.subIcon?.let { icon ->
                        PantopusIconImage(
                            icon = icon,
                            contentDescription = null,
                            size = 10.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                    }
                    Text(
                        text = sub,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun AvatarWithBadge(row: NewMessageContactRow) {
    val badgeColor: Color =
        when (row.identity) {
            NewMessageIdentityBadge.Personal -> PantopusColors.personal
            NewMessageIdentityBadge.Home -> PantopusColors.home
            NewMessageIdentityBadge.Business -> PantopusColors.business
        }
    Box(modifier = Modifier.size(42.dp), contentAlignment = Alignment.BottomEnd) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary500),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = row.initials,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (row.verified) {
            Box(
                modifier =
                    Modifier
                        .size(14.dp)
                        .clip(CircleShape)
                        .background(badgeColor)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.md,
                    strokeWidth = 4f,
                    tint = PantopusColors.appTextInverse,
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
                .padding(Spacing.s6)
                .testTag("newMessageError"),
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
            text = "Couldn't load contacts",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.size(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp)
                    .testTag("newMessageRetry"),
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
