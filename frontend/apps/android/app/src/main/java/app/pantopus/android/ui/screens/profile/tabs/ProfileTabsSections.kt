@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.profile.tabs

import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.RatingDistribution
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import java.util.Locale

/**
 * The three public-profile tab bodies: Portfolio (grid + filter chips +
 * add/delete), Gigs (rows that open gig detail) and Reviews (average /
 * total header, the worker | poster | all filter, and a media viewer).
 *
 * iOS counterpart: `Features/Profile/Tabs/ProfileTabsSections.swift` —
 * test tags mirror its `accessibilityIdentifier` strings one-for-one.
 */

// region Portfolio

/**
 * Portfolio tab body. [isOwnProfile] unlocks the add bar and the
 * per-card delete affordance.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfilePortfolioSection(
    userId: String,
    isOwnProfile: Boolean,
    modifier: Modifier = Modifier,
    viewModel: ProfilePortfolioViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeFilter by viewModel.activeFilter.collectAsStateWithLifecycle()
    val pendingDelete by viewModel.pendingDelete.collectAsStateWithLifecycle()
    val viewerItem by viewModel.viewerItem.collectAsStateWithLifecycle()
    val showAddSheet by viewModel.showAddSheet.collectAsStateWithLifecycle()
    val isMutating by viewModel.isMutating.collectAsStateWithLifecycle()
    val addSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(userId, isOwnProfile) { viewModel.load(userId, isOwnProfile) }

    Column(
        modifier = modifier.fillMaxWidth().testTag("profilePortfolioSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        when (val current = state) {
            ProfilePortfolioUiState.Loading -> SectionSkeleton(tag = "profilePortfolioSkeleton", cardHeight = 96.dp)
            ProfilePortfolioUiState.Empty ->
                Box(modifier = Modifier.fillMaxWidth().height(220.dp)) {
                    EmptyState(
                        icon = PantopusIcon.Image,
                        headline = if (isOwnProfile) "Showcase your best work" else "No portfolio items",
                        subcopy =
                            if (isOwnProfile) {
                                "Add projects, photos, certificates, or anything that highlights " +
                                    "your skills and experience."
                            } else {
                                "This user hasn't added any portfolio items yet."
                            },
                        ctaTitle = if (isOwnProfile) "Add portfolio item" else null,
                        onCta = if (isOwnProfile) ({ viewModel.setShowAddSheet(true) }) else null,
                    )
                }
            is ProfilePortfolioUiState.Loaded -> {
                if (isOwnProfile) {
                    AddPortfolioBar(onClick = { viewModel.setShowAddSheet(true) })
                }
                val filters = viewModel.availableFilters()
                if (filters.size > 1) {
                    PortfolioFilterChips(
                        filters = filters,
                        active = activeFilter,
                        totalCount = current.items.size,
                        countOf = viewModel::countOf,
                        onSelect = viewModel::setFilter,
                    )
                }
                viewModel.filteredItems().forEach { item ->
                    PortfolioCard(
                        item = item,
                        canDelete = isOwnProfile,
                        onOpen = { viewModel.openViewer(item) },
                        onDelete = { viewModel.requestDelete(item) },
                    )
                }
            }
            is ProfilePortfolioUiState.Error ->
                Box(modifier = Modifier.fillMaxWidth().height(220.dp)) {
                    ErrorState(
                        headline = "Couldn't load the portfolio",
                        message = current.message,
                        onRetry = { viewModel.refresh() },
                    )
                }
        }
    }

    pendingDelete?.let { item ->
        AlertDialog(
            onDismissRequest = { viewModel.requestDelete(null) },
            title = { Text("Delete \"${item.title}\"?") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmDelete() },
                    modifier = Modifier.testTag("profilePortfolioDeleteConfirm"),
                ) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.requestDelete(null) }) { Text("Cancel") }
            },
        )
    }

    if (showAddSheet) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.setShowAddSheet(false) },
            sheetState = addSheetState,
        ) {
            AddPortfolioItemSheet(
                isSaving = isMutating,
                onSubmit = { file, title, description, kind ->
                    viewModel.upload(file = file, title = title, description = description, category = kind)
                },
            )
        }
    }

    viewerItem?.let { item ->
        ProfileMediaViewer(
            url = item.fullUrl ?: item.imageUrl,
            title = item.title,
            onClose = { viewModel.openViewer(null) },
        )
    }
}

@Composable
private fun AddPortfolioBar(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("profilePortfolioAddButton"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Add portfolio item",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
    }
}

@Composable
private fun PortfolioFilterChips(
    filters: List<PortfolioItemKind>,
    active: PortfolioItemKind?,
    totalCount: Int,
    countOf: (PortfolioItemKind) -> Int,
    onSelect: (PortfolioItemKind?) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .testTag("profilePortfolioFilters"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PillChip(label = "All ($totalCount)", isActive = active == null, onClick = { onSelect(null) })
        filters.forEach { kind ->
            PillChip(
                label = "${kind.label} (${countOf(kind)})",
                isActive = active == kind,
                onClick = { onSelect(kind) },
            )
        }
    }
}

@Composable
private fun PortfolioCard(
    item: PortfolioItem,
    canDelete: Boolean,
    onOpen: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable(onClick = onOpen)
                    .testTag("profilePortfolioThumb_${item.id}"),
            contentAlignment = Alignment.Center,
        ) {
            if (item.imageUrl != null) {
                AsyncImage(
                    model = item.imageUrl,
                    contentDescription = "Open ${item.title}",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                PantopusIconImage(
                    icon = item.kind.icon,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = item.title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            item.subtitle?.let { subtitle ->
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = item.kind.icon,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.appTextMuted,
                )
                Text(text = item.kind.label, fontSize = 12.sp, color = PantopusColors.appTextMuted)
            }
        }
        if (canDelete) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clickable(onClick = onDelete)
                        .testTag("profilePortfolioDelete_${item.id}"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Trash,
                    contentDescription = "Delete ${item.title}",
                    size = 16.dp,
                    tint = PantopusColors.error,
                )
            }
        }
    }
}

/**
 * Add-portfolio-item sheet — cover file, title, description, type.
 * Mirrors iOS `AddPortfolioItemSheet`.
 */
@Composable
private fun AddPortfolioItemSheet(
    isSaving: Boolean,
    onSubmit: (PickedPortfolioFile?, String, String, PortfolioItemKind) -> Unit,
) {
    val context = LocalContext.current
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf(PortfolioItemKind.Photo) }
    var picked by remember { mutableStateOf<PickedPortfolioFile?>(null) }

    val picker =
        rememberLauncherForActivityResult(contract = ActivityResultContracts.GetContent()) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            val resolver = context.contentResolver
            val mime = resolver.getType(uri) ?: "application/octet-stream"
            val filename =
                resolver.query(uri, null, null, null, null)?.use { cursor ->
                    val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
                } ?: uri.lastPathSegment?.substringAfterLast('/') ?: "portfolio"
            val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return@rememberLauncherForActivityResult
            picked = PickedPortfolioFile(filename = filename, mimeType = mime, bytes = bytes)
            if (title.isBlank()) title = filename.substringBeforeLast('.')
        }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s10)
                .testTag("portfolioAddSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Add portfolio item",
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(140.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable { picker.launch("*/*") }
                    .testTag("portfolioAddPhotoButton"),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = if (picked == null) PantopusIcon.Camera else PantopusIcon.Check,
                    contentDescription = null,
                    size = 26.dp,
                    tint = if (picked == null) PantopusColors.appTextMuted else PantopusColors.success,
                )
                Text(
                    text = picked?.filename ?: "Tap to add a file",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (picked == null) {
                    Text(
                        text = "This will be the cover image",
                        fontSize = 12.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
            }
        }
        PantopusTextField(
            label = "Title",
            value = title,
            onValueChange = { title = it },
            placeholder = "What is this?",
            isRequired = true,
            fieldTestTag = "portfolioAddTitleField",
        )
        PantopusTextField(
            label = "Description",
            value = description,
            onValueChange = { description = it },
            placeholder = "Optional",
            fieldTestTag = "portfolioAddDescriptionField",
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .testTag("portfolioAddTypePicker"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PortfolioItemKind.entries.forEach { candidate ->
                PillChip(
                    label = candidate.label,
                    isActive = kind == candidate,
                    onClick = { kind = candidate },
                )
            }
        }
        PrimaryButton(
            title = "Add",
            onClick = { onSubmit(picked, title, description, kind) },
            isLoading = isSaving,
            // The server rejects a titleless or fileless upload, so the CTA
            // stays inert until both are present.
            isEnabled = !isSaving && title.isNotBlank() && picked != null,
            modifier = Modifier.testTag("portfolioAddSubmit"),
        )
    }
}

// endregion

// region Gigs

/**
 * Gigs tab body — the gigs this profile posted, each row opening gig
 * detail through [onOpenGig].
 */
@Composable
fun ProfileGigsSection(
    userId: String,
    onOpenGig: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProfileGigsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(userId) { viewModel.load(userId) }

    Column(
        modifier = modifier.fillMaxWidth().testTag("profileGigsSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        when (val current = state) {
            ProfileGigsUiState.Loading -> SectionSkeleton(tag = "profileGigsSkeleton", cardHeight = 104.dp)
            ProfileGigsUiState.Empty ->
                Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                    EmptyState(
                        icon = PantopusIcon.Briefcase,
                        headline = "No tasks posted yet",
                        subcopy = "This user hasn't posted any tasks.",
                    )
                }
            is ProfileGigsUiState.Loaded ->
                current.rows.forEach { row ->
                    ProfileGigCard(row = row, onClick = { onOpenGig(row.id) })
                }
            is ProfileGigsUiState.Error ->
                Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                    ErrorState(
                        headline = "Couldn't load tasks",
                        message = current.message,
                        onRetry = { viewModel.refresh() },
                    )
                }
        }
    }
}

@Composable
private fun ProfileGigCard(
    row: ProfileGigRow,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s4)
                .testTag("profileGigRow_${row.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.Top) {
            Text(
                text = row.title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = row.price,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
            )
        }
        row.summary?.let { summary ->
            Text(
                text = summary,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
            row.category?.let { category ->
                Badge(
                    text = category,
                    foreground = PantopusColors.primary600,
                    background = PantopusColors.personalBg,
                )
            }
            Badge(
                text = row.status.uppercase(Locale.US),
                foreground = if (row.isOpen) PantopusColors.success else PantopusColors.appTextSecondary,
                background = if (row.isOpen) PantopusColors.successBg else PantopusColors.appSurfaceSunken,
            )
        }
    }
}

// endregion

// region Gig reviews

/**
 * Reviews tab body — the summary header, the worker | poster | all
 * filter driven by `received_as`, and a full-screen media viewer.
 */
@Composable
fun ProfileGigReviewsSection(
    userId: String,
    modifier: Modifier = Modifier,
    onOpenReviewer: (String) -> Unit = {},
    viewModel: ProfileGigReviewsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeFilter by viewModel.activeFilter.collectAsStateWithLifecycle()
    val viewerUrl by viewModel.viewerUrl.collectAsStateWithLifecycle()

    LaunchedEffect(userId) { viewModel.load(userId) }

    Column(
        modifier = modifier.fillMaxWidth().testTag("profileReviewsSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        when (val current = state) {
            ProfileGigReviewsUiState.Loading -> SectionSkeleton(tag = "profileReviewsSkeleton", cardHeight = 88.dp)
            ProfileGigReviewsUiState.Empty ->
                Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                    EmptyState(
                        icon = PantopusIcon.Star,
                        headline = "No reviews yet",
                        subcopy = "Reviews appear here after completed gigs.",
                    )
                }
            is ProfileGigReviewsUiState.Loaded -> {
                // `RatingDistribution` stamps its own test tag, so the
                // section-level tag rides on a wrapper rather than being
                // overridden further down the modifier chain.
                Box(modifier = Modifier.fillMaxWidth().testTag("profileReviewsSummary")) {
                    RatingDistribution(
                        average = current.summary.average,
                        count = current.summary.total,
                        distribution = distributionFractions(current.summary),
                    )
                }
                ReviewFilterRow(
                    summary = current.summary,
                    active = activeFilter,
                    onSelect = viewModel::setFilter,
                )
                val visible = viewModel.filteredReviews()
                if (visible.isEmpty()) {
                    Text(
                        text = if (current.summary.total == 0) "No reviews yet" else "No reviews in this category",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextMuted,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 80.dp)
                                .testTag("profileReviewsFilterEmpty"),
                    )
                } else {
                    visible.forEach { review ->
                        GigReviewCard(
                            review = review,
                            onOpenReviewer = onOpenReviewer,
                            onOpenMedia = viewModel::openViewer,
                        )
                    }
                }
            }
            is ProfileGigReviewsUiState.Error ->
                Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                    ErrorState(
                        headline = "Couldn't load reviews",
                        message = current.message,
                        onRetry = { viewModel.refresh() },
                    )
                }
        }
    }

    viewerUrl?.let { url ->
        ProfileMediaViewer(
            url = url,
            title = "Review photo",
            onClose = { viewModel.openViewer(null) },
        )
    }
}

/** Star → count over the loaded page, ordered 5★→1★ as fractions. */
private fun distributionFractions(summary: ProfileReviewSummary): List<Float> {
    val denominator = summary.distribution.values.sum()
    if (denominator <= 0) return List(5) { 0f }
    return listOf(5, 4, 3, 2, 1).map { star ->
        (summary.distribution[star] ?: 0).toFloat() / denominator
    }
}

@Composable
private fun ReviewFilterRow(
    summary: ProfileReviewSummary,
    active: ProfileReviewFilter,
    onSelect: (ProfileReviewFilter) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ProfileReviewFilter.entries.forEach { filter ->
            val count =
                when (filter) {
                    ProfileReviewFilter.All -> summary.total
                    ProfileReviewFilter.Worker -> summary.workerCount
                    ProfileReviewFilter.Poster -> summary.posterCount
                }
            PillChip(
                label = "${filter.label} ($count)",
                isActive = active == filter,
                onClick = { onSelect(filter) },
                testTag = "profileReviewsFilter_${filter.slug}",
            )
        }
    }
}

@Composable
private fun GigReviewCard(
    review: ProfileGigReview,
    onOpenReviewer: (String) -> Unit,
    onOpenMedia: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s3)
                .testTag("profileReviewCard_${review.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .then(
                            review.reviewerId
                                ?.let { id -> Modifier.clickable { onOpenReviewer(id) } }
                                ?: Modifier,
                        ),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AvatarWithIdentityRing(
                    name = review.reviewerName,
                    imageUrl = review.reviewerAvatarUrl,
                    identity = IdentityPillar.Personal,
                    ringProgress = 1f,
                    size = 36.dp,
                )
                Column {
                    Text(
                        text = review.reviewerName,
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    review.reviewerHandle?.let { handle ->
                        Text(text = "@$handle", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                    }
                }
            }
            StarRow(rating = review.rating)
        }
        review.comment?.let { comment ->
            Text(text = comment, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
        }
        if (review.mediaUrls.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                review.mediaUrls.forEach { url ->
                    AsyncImage(
                        model = url,
                        contentDescription = "Open review photo",
                        contentScale = ContentScale.Crop,
                        modifier =
                            Modifier
                                .size(80.dp)
                                .clip(RoundedCornerShape(Radii.md))
                                .background(PantopusColors.appSurfaceSunken)
                                .clickable { onOpenMedia(url) },
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            review.dateLabel?.let { date ->
                Text(text = date, fontSize = 12.sp, color = PantopusColors.appTextMuted)
            }
            review.roleLabel?.let { role ->
                if (review.dateLabel != null) {
                    Text(text = "•", fontSize = 12.sp, color = PantopusColors.appTextMuted)
                }
                Text(text = role, fontSize = 12.sp, color = PantopusColors.appTextMuted)
            }
        }
    }
}

@Composable
private fun StarRow(rating: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        repeat(5) { index ->
            PantopusIconImage(
                icon = PantopusIcon.Star,
                contentDescription = null,
                size = 12.dp,
                tint = if (index < rating) PantopusColors.warning else PantopusColors.appTextMuted,
            )
        }
    }
}

// endregion

// region Shared

/**
 * Minimal full-screen media viewer shared by the Portfolio and Reviews
 * tabs. Mirrors iOS `ProfileMediaViewer`.
 */
@Composable
private fun ProfileMediaViewer(
    url: String?,
    title: String,
    onClose: () -> Unit,
) {
    Dialog(onDismissRequest = onClose) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appBg)
                    .testTag("profileMediaViewer"),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = title,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier.size(32.dp).clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = "Close",
                        size = 20.dp,
                        tint = PantopusColors.appText,
                    )
                }
            }
            if (url != null) {
                AsyncImage(
                    model = url,
                    contentDescription = title,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().height(320.dp),
                )
            } else {
                Box(modifier = Modifier.fillMaxWidth().height(220.dp)) {
                    EmptyState(
                        icon = PantopusIcon.AlertCircle,
                        headline = "Nothing to preview",
                        subcopy = "This item has no viewable file.",
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionSkeleton(
    tag: String,
    cardHeight: Dp,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag(tag),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(3) {
            Shimmer(height = cardHeight, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun PillChip(
    label: String,
    isActive: Boolean,
    onClick: () -> Unit,
    testTag: String? = null,
) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 7.dp)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun Badge(
    text: String,
    foreground: Color,
    background: Color,
) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.sm))
                .background(background)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
    ) {
        Text(text = text, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = foreground)
    }
}

// endregion
