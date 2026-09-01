@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.home_records

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.SectionHeader
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.home_records.components.AssetLinkCard
import app.pantopus.android.ui.screens.mailbox.home_records.components.AutoDetectBanner
import app.pantopus.android.ui.screens.mailbox.home_records.components.warrantyTint
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Home Records — the linked-asset hub behind the Mailbox. Overview:
 * auto-detect banner, room filter chips, and the asset index. Drill-in:
 * asset details plus its linked mail, each row opening the mail item.
 *
 * Four states per the Block 2F rule: shimmer skeleton, [EmptyState],
 * loaded, [ErrorState] with Retry wired to `refresh()`.
 *
 * Mirrors iOS `HomeRecordsView`.
 */
@OptIn(ExperimentalMaterialApi::class, ExperimentalMaterial3Api::class)
@Composable
fun HomeRecordsScreen(
    onBack: () -> Unit,
    onOpenMail: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: HomeRecordsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val roomFilter by viewModel.roomFilter.collectAsStateWithLifecycle()
    val selectedAsset by viewModel.selectedAsset.collectAsStateWithLifecycle()
    val detailState by viewModel.detailState.collectAsStateWithLifecycle()
    val detections by viewModel.detections.collectAsStateWithLifecycle()
    val isScanning by viewModel.isScanning.collectAsStateWithLifecycle()
    val showsSuggestions by viewModel.showsSuggestions.collectAsStateWithLifecycle()
    val isLoadingSuggestions by viewModel.isLoadingSuggestions.collectAsStateWithLifecycle()
    val suggestions by viewModel.suggestions.collectAsStateWithLifecycle()
    val pendingLinkMailId by viewModel.pendingLinkMailId.collectAsStateWithLifecycle()
    val undoableLink by viewModel.undoableLink.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenMail = onOpenMail, onBack = onBack)
        viewModel.load()
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(2_200)
            viewModel.consumeToast()
        }
    }

    val pullState =
        rememberPullRefreshState(
            refreshing = state is HomeRecordsUiState.Loading,
            onRefresh = { viewModel.refresh() },
        )

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("homeRecords"),
    ) {
        OfflineBannerHost(isOffline = !online) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopBar(
                    title = selectedAsset?.name ?: "Home Records",
                    subtitle = subtitleFor(state, selectedAsset),
                    inDetail = selectedAsset != null,
                    onBack = { viewModel.tapBack() },
                )
                val asset = selectedAsset
                if (asset != null) {
                    AssetDetailBody(
                        asset = asset,
                        detailState = detailState,
                        onOpenMail = viewModel::openMail,
                        onRetry = { viewModel.retryAssetDetail() },
                    )
                } else {
                    Box(modifier = Modifier.fillMaxSize().pullRefresh(pullState)) {
                        OverviewBody(
                            state = state,
                            roomFilter = roomFilter,
                            filteredAssets = viewModel.filteredAssets(),
                            detectionCount = detections.size,
                            isScanning = isScanning,
                            onScan = { viewModel.runAutoDetect() },
                            onReview = { viewModel.openSuggestions() },
                            onSelectRoom = viewModel::selectRoom,
                            onOpenAsset = viewModel::openAsset,
                            onRefresh = { viewModel.refresh() },
                        )
                        PullRefreshIndicator(
                            refreshing = state is HomeRecordsUiState.Loading,
                            state = pullState,
                            modifier = Modifier.align(Alignment.TopCenter),
                            contentColor = PantopusColors.primary600,
                        )
                    }
                }
            }
        }

        Column(
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s10),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (undoableLink != null) {
                UndoBar(
                    assetName = undoableLink?.assetName.orEmpty(),
                    onUndo = { viewModel.undoLastLink() },
                )
            }
            if (toast != null) {
                Text(
                    text = toast.orEmpty(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(PantopusColors.appText.copy(alpha = 0.9f))
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                            .testTag("homeRecords_toast"),
                )
            }
        }
    }

    if (showsSuggestions) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.dismissSuggestions() },
            containerColor = PantopusColors.appBg,
        ) {
            SuggestionsSheet(
                isLoading = isLoadingSuggestions,
                suggestions = suggestions,
                canLink = viewModel.allAssets().isNotEmpty(),
                onLink = viewModel::requestLink,
            )
        }
    }

    if (pendingLinkMailId != null) {
        LinkPickerDialog(
            assets = viewModel.allAssets(),
            onPick = viewModel::linkPendingMail,
            onDismiss = { viewModel.cancelLink() },
        )
    }
}

private fun subtitleFor(
    state: HomeRecordsUiState,
    asset: HomeRecordAsset?,
): String {
    if (asset != null) {
        return listOfNotNull(asset.room, asset.manufacturer)
            .takeIf { it.isNotEmpty() }
            ?.joinToString(" · ")
            ?: "No room recorded"
    }
    return when (state) {
        is HomeRecordsUiState.Loaded -> {
            val noun = if (state.assets.size == 1) "asset" else "assets"
            "${state.assets.size} $noun tracked"
        }

        else -> "Warranties, receipts, and repairs"
    }
}

@Composable
private fun TopBar(
    title: String,
    subtitle: String,
    inDetail: Boolean,
    onBack: () -> Unit,
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
                    .testTag("homeRecords_back"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowLeft,
                contentDescription = if (inDetail) "Back to records" else "Back to Mailbox",
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        Column {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = subtitle,
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

// ─── Overview ──────────────────────────────────────────────────

@Composable
private fun OverviewBody(
    state: HomeRecordsUiState,
    roomFilter: String?,
    filteredAssets: List<HomeRecordAsset>,
    detectionCount: Int,
    isScanning: Boolean,
    onScan: () -> Unit,
    onReview: () -> Unit,
    onSelectRoom: (String?) -> Unit,
    onOpenAsset: (HomeRecordAsset) -> Unit,
    onRefresh: () -> Unit,
) {
    when (state) {
        HomeRecordsUiState.Loading -> LoadingBody()
        is HomeRecordsUiState.Loaded ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().testTag("homeRecords_list"),
                contentPadding = PaddingValues(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                item {
                    AutoDetectBanner(
                        detectionCount = detectionCount,
                        isScanning = isScanning,
                        onScan = onScan,
                        onReview = onReview,
                    )
                }
                if (state.rooms.size > 1) {
                    item {
                        RoomChips(
                            rooms = state.rooms,
                            selected = roomFilter,
                            onSelect = onSelectRoom,
                        )
                    }
                }
                items(filteredAssets, key = { it.id }) { asset ->
                    AssetLinkCard(asset = asset, onTap = { onOpenAsset(asset) })
                }
                if (filteredAssets.isEmpty()) {
                    item {
                        Text(
                            text = "No assets in this room.",
                            fontSize = 13.sp,
                            color = PantopusColors.appTextMuted,
                            textAlign = TextAlign.Center,
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = Spacing.s10)
                                    .testTag("homeRecords_roomEmpty"),
                        )
                    }
                }
            }

        HomeRecordsUiState.Empty ->
            Column(
                modifier = Modifier.fillMaxSize().padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                AutoDetectBanner(
                    detectionCount = detectionCount,
                    isScanning = isScanning,
                    onScan = onScan,
                    onReview = onReview,
                )
                EmptyState(
                    icon = PantopusIcon.Home,
                    headline = "No assets yet",
                    subcopy =
                        "Link mail items to home assets to track warranties, receipts, " +
                            "and repairs in one place.",
                    modifier = Modifier.testTag("homeRecords_empty"),
                    ctaTitle = "Scan mail for assets",
                    onCta = onScan,
                    tint = PantopusColors.homeBg,
                    accent = PantopusColors.home,
                )
            }

        is HomeRecordsUiState.Error ->
            ErrorState(
                headline = "Couldn't load home records",
                message = state.message,
                modifier = Modifier.testTag("homeRecords_error"),
                onRetry = onRefresh,
            )
    }
}

@Composable
private fun RoomChips(
    rooms: List<String>,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RoomChip(label = "All", room = null, selected = selected, onSelect = onSelect)
        rooms.forEach { room ->
            RoomChip(label = room, room = room, selected = selected, onSelect = onSelect)
        }
    }
}

@Composable
private fun RoomChip(
    label: String,
    room: String?,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    val active = selected == room
    Text(
        text = label,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .clip(CircleShape)
                .background(if (active) PantopusColors.home else PantopusColors.appSurfaceSunken)
                .clickable { onSelect(room) }
                .padding(horizontal = 14.dp, vertical = 6.dp)
                .testTag("homeRecords_room_${room ?: "all"}"),
    )
}

@Composable
private fun LoadingBody() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("homeRecords_loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(5) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 42.dp, height = 42.dp, cornerRadius = Radii.md)
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Shimmer(width = 150.dp, height = 11.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 90.dp, height = 9.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 120.dp, height = 9.dp, cornerRadius = Radii.xs)
                }
            }
        }
    }
}

// ─── Asset detail ──────────────────────────────────────────────

@Composable
private fun AssetDetailBody(
    asset: HomeRecordAsset,
    detailState: AssetDetailUiState,
    onOpenMail: (String) -> Unit,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("homeRecords_assetDetail"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Card {
            SectionHeader(title = "DETAILS")
            if (asset.modelNumber != null) {
                DetailRow(label = "Model", value = asset.modelNumber)
            }
            if (asset.purchasedLabel != null) {
                DetailRow(label = "Purchased", value = asset.purchasedLabel)
            }
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Warranty",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = asset.warranty.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = warrantyTint(asset.warranty),
                )
            }
        }

        Card {
            when (detailState) {
                AssetDetailUiState.Loading -> {
                    SectionHeader(title = "LINKED MAIL")
                    repeat(3) { Shimmer(width = 200.dp, height = 12.dp, cornerRadius = Radii.xs) }
                }

                is AssetDetailUiState.Loaded -> {
                    SectionHeader(title = "LINKED MAIL (${detailState.mail.size})")
                    if (detailState.mail.isEmpty()) {
                        Text(
                            text = "No mail linked to this asset yet.",
                            fontSize = 13.sp,
                            color = PantopusColors.appTextMuted,
                            modifier = Modifier.testTag("homeRecords_assetMail_empty"),
                        )
                    } else {
                        detailState.mail.forEach { row ->
                            MailRow(row = row, onOpenMail = onOpenMail)
                        }
                    }
                }

                is AssetDetailUiState.Error -> {
                    SectionHeader(title = "LINKED MAIL")
                    Text(
                        text = detailState.message,
                        fontSize = 13.sp,
                        color = PantopusColors.appTextMuted,
                    )
                    TextButton(
                        onClick = onRetry,
                        modifier = Modifier.testTag("homeRecords_assetMail_retry"),
                    ) {
                        Text("Try again", color = PantopusColors.primary600)
                    }
                }
            }
        }
    }
}

@Composable
private fun Card(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        content()
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun MailRow(
    row: HomeRecordMailRow,
    onOpenMail: (String) -> Unit,
) {
    val caption =
        listOfNotNull(row.senderName, row.deliveredLabel)
            .takeIf { it.isNotEmpty() }
            ?.joinToString(" · ")
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clickable { onOpenMail(row.id) }
                .testTag("homeRecords_mail_${row.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Mail,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.home,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = row.subject,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (caption != null) {
                Text(
                    text = caption,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appBorderStrong,
        )
    }
}

// ─── Suggestions + link picker ─────────────────────────────────

@Composable
private fun SuggestionsSheet(
    isLoading: Boolean,
    suggestions: List<HomeRecordSuggestion>,
    canLink: Boolean,
    onLink: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("homeRecords_suggestions"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SectionHeader(title = "LINK SUGGESTIONS")
        when {
            isLoading ->
                repeat(4) { Shimmer(width = 260.dp, height = 46.dp, cornerRadius = Radii.lg) }

            suggestions.isEmpty() ->
                Text(
                    text = "Every asset mention we found in your recent mail is already linked.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.testTag("homeRecords_suggestions_empty"),
                )

            else ->
                suggestions.forEach { suggestion ->
                    SuggestionRow(suggestion = suggestion, canLink = canLink, onLink = onLink)
                }
        }
    }
}

@Composable
private fun SuggestionRow(
    suggestion: HomeRecordSuggestion,
    canLink: Boolean,
    onLink: (String) -> Unit,
) {
    val brand = suggestion.candidateBrand?.let { "$it · " }.orEmpty()
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s3)
                .testTag("homeRecords_suggestion_${suggestion.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Sparkles,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.warning,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = suggestion.candidateName,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "$brand${suggestion.confidencePercent}% match",
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
            )
        }
        Text(
            text = "Link",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(if (canLink) PantopusColors.home else PantopusColors.appBorderStrong)
                    .clickable(enabled = canLink) { onLink(suggestion.id) }
                    .padding(horizontal = Spacing.s3, vertical = 7.dp)
                    .testTag("homeRecords_suggestion_link_${suggestion.id}"),
        )
    }
}

@Composable
private fun LinkPickerDialog(
    assets: List<HomeRecordAsset>,
    onPick: (HomeRecordAsset) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Link to which asset?") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 320.dp).verticalScroll(rememberScrollState()),
            ) {
                assets.forEach { asset ->
                    Text(
                        text = asset.name,
                        fontSize = 15.sp,
                        color = PantopusColors.appText,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 44.dp)
                                .clickable { onPick(asset) }
                                .padding(vertical = Spacing.s3)
                                .testTag("homeRecords_linkTo_${asset.id}"),
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun UndoBar(
    assetName: String,
    onUndo: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appText.copy(alpha = 0.92f))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("homeRecords_undoBar"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Linked to $assetName",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextInverse,
        )
        Text(
            text = "Undo",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clickable(onClick = onUndo)
                    .testTag("homeRecords_undoLink"),
        )
    }
}
