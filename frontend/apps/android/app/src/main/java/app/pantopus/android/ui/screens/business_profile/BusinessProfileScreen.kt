@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "LongParameterList",
    "ComplexMethod",
)

package app.pantopus.android.ui.screens.business_profile

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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.BizBannerHeader
import app.pantopus.android.ui.components.BizStatusBadge
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.GalleryStrip
import app.pantopus.android.ui.components.GalleryTile
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.MapPreview
import app.pantopus.android.ui.components.RatingDistribution
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.VerifiedBadge
import app.pantopus.android.ui.screens.business_profile.components.ActionBar
import app.pantopus.android.ui.screens.business_profile.components.BizStarGlyph
import app.pantopus.android.ui.screens.business_profile.components.CategoryRow
import app.pantopus.android.ui.screens.business_profile.components.EmptyBlock
import app.pantopus.android.ui.screens.business_profile.components.HoursTable
import app.pantopus.android.ui.screens.business_profile.components.ServicesList
import app.pantopus.android.ui.screens.business_profile.components.StatStrip
import app.pantopus.android.ui.screens.saved_places.PendingSavePlace
import app.pantopus.android.ui.screens.saved_places.SaveBookmarkButton
import app.pantopus.android.ui.screens.saved_places.SavePlaceSheet
import app.pantopus.android.ui.screens.saved_places.SavedPlaceUndo
import app.pantopus.android.ui.screens.saved_places.SavedPlacesStoreViewModel
import app.pantopus.android.ui.screens.saved_places.SavedPlacesToast
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.util.Locale

/**
 * A10.6 — public Business Profile, reshaped (B3.1) from the old tabbed
 * layout to a single-scroll sectioned design. Mirrors iOS: a
 * `BizBannerHeader` + stat strip, category chips, then About / Hours /
 * Service area / Services / Recent work / Reviews sections over a sticky
 * Contact + Book (or Call) dock, with floating controls over the banner.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessProfileScreen(
    onBack: () -> Unit,
    onOpenMessages: (roomId: String, displayName: String, initials: String, verified: Boolean) -> Unit =
        { _, _, _, _ -> },
    onShare: () -> Unit = {},
    onOpenReport: () -> Unit = {},
    onOpenWebsite: (String) -> Unit = {},
    onBook: () -> Unit = {},
    onEdit: () -> Unit = {},
    viewModel: BusinessProfileViewModel = hiltViewModel(),
    savedPlacesStore: SavedPlacesStoreViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toastMessage.collectAsStateWithLifecycle()
    val showOverflow by viewModel.showOverflow.collectAsStateWithLifecycle()
    val namedPage by viewModel.namedPage.collectAsStateWithLifecycle()
    val savedPlaces by savedPlacesStore.saved.collectAsStateWithLifecycle()
    val pendingSave by savedPlacesStore.pendingSave.collectAsStateWithLifecycle()
    val undo by savedPlacesStore.undo.collectAsStateWithLifecycle()
    val savedPlacesToast by savedPlacesStore.toast.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState()

    LaunchedEffect(Unit) {
        viewModel.load()
        savedPlacesStore.loadIfNeeded()
    }
    LaunchedEffect(Unit) {
        viewModel.openChatEvents.collect { event ->
            onOpenMessages(event.roomId, event.displayName, event.initials, event.verified)
        }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }
    LaunchedEffect(undo) {
        if (undo != null) {
            delay(4_000)
            savedPlacesStore.dismissUndo()
        }
    }
    LaunchedEffect(savedPlacesToast) {
        if (savedPlacesToast != null) {
            delay(2_500)
            savedPlacesStore.dismissToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("businessProfile"),
    ) {
        when (val current = state) {
            BusinessProfileUiState.Loading -> LoadingLayout(onBack = onBack)
            BusinessProfileUiState.NotFound -> NotFoundLayout(onBack = onBack, onRetry = viewModel::refresh)
            is BusinessProfileUiState.Error ->
                ErrorLayout(onBack = onBack, message = current.message, onRetry = viewModel::refresh)
            is BusinessProfileUiState.Loaded ->
                run {
                    val pending = current.content.savedPlace
                    val isSaved = pending != null && savedPlaces.isSaved(pending)
                    BusinessProfileLoadedFrame(
                        content = current.content,
                        isSaved = isSaved,
                        onBack = onBack,
                        onShare = onShare,
                        onMore = { viewModel.setShowOverflow(true) },
                        onToggleSavedPlace = { pending?.let(savedPlacesStore::toggle) },
                        onContact = viewModel::startInquiry,
                        onBook = onBook,
                        onCall = { telUri(current.content.phoneNumber)?.let(onOpenWebsite) },
                        namedPage = namedPage,
                    )
                }
        }

        toast?.let { message ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 100.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText.copy(alpha = 0.9f))
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(text = message, style = PantopusTextStyle.small, color = PantopusColors.appTextInverse)
            }
        }
        undo?.let { snapshot ->
            BusinessProfileSaveUndoSnackbar(
                undo = snapshot,
                onUndo = savedPlacesStore::undoRemove,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 112.dp),
            )
        }
        savedPlacesToast?.let { saveToast ->
            BusinessProfileSaveToast(
                toast = saveToast,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 100.dp),
            )
        }

        pendingSave?.let {
            SavePlaceSheet(
                pending = it,
                onSave = savedPlacesStore::commitSave,
                onClose = savedPlacesStore::closeSheet,
            )
        }

        if (showOverflow) {
            val content = (state as? BusinessProfileUiState.Loaded)?.content
            val viewerIsOwner = content?.viewerIsOwner == true
            val pending = content?.savedPlace
            val isSaved = pending != null && savedPlaces.isSaved(pending)
            ModalBottomSheet(onDismissRequest = { viewModel.setShowOverflow(false) }, sheetState = sheetState) {
                OverflowSheetContent(
                    showEdit = viewerIsOwner,
                    showSave = pending != null,
                    saveLabel = if (isSaved) "Remove saved place" else "Save business",
                    onEdit = {
                        viewModel.setShowOverflow(false)
                        onEdit()
                    },
                    onSave = {
                        viewModel.setShowOverflow(false)
                        pending?.let(savedPlacesStore::toggle)
                    },
                    onShare = {
                        viewModel.setShowOverflow(false)
                        onShare()
                    },
                    onReport = {
                        viewModel.setShowOverflow(false)
                        onOpenReport()
                    },
                    onCancel = { viewModel.setShowOverflow(false) },
                )
            }
        }
    }
}

private fun telUri(phone: String?): String? {
    if (phone.isNullOrEmpty()) return null
    val digits = phone.filter { it.isDigit() || it == '+' }
    return "tel:$digits"
}

// MARK: - Loaded frame

/**
 * The loaded body extracted as an `internal` composable so the Paparazzi
 * snapshot test can render it off [BusinessProfileContent]. Mirrors iOS
 * `BusinessProfileLoadedView`.
 */
@Composable
internal fun BusinessProfileLoadedFrame(
    content: BusinessProfileContent,
    isSaved: Boolean,
    onBack: () -> Unit,
    onShare: () -> Unit,
    onMore: () -> Unit,
    onToggleSavedPlace: () -> Unit,
    onContact: () -> Unit,
    onBook: () -> Unit,
    onCall: () -> Unit,
    // C4 — the named custom page from `pantopus://b/:username/:slug`.
    // Defaults to `None` so every existing call site is untouched.
    namedPage: BusinessProfileNamedPageState = BusinessProfileNamedPageState.None,
) {
    Box(modifier = Modifier.fillMaxSize().testTag("businessProfile.loaded")) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        ) {
            BizBannerHeader(
                name = content.header.displayName,
                handle = content.header.handle?.let { "@$it" } ?: "",
                locality = content.header.locality ?: "",
                identity = IdentityPillar.Business,
                logoIcon = content.header.logoIcon,
                verified = content.header.isVerified,
                status = bannerStatus(content.status),
            )
            StatStrip(stats = content.stats)
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4)
                        .padding(top = 14.dp, bottom = 132.dp),
            ) {
                BusinessProfileNamedPageSection(state = namedPage)
                Sections(content)
            }
        }

        FloatingControls(
            onBack = onBack,
            onShare = onShare,
            onMore = onMore,
            showsSave = content.savedPlace != null,
            isSaved = isSaved,
            onToggleSavedPlace = onToggleSavedPlace,
            modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding(),
        )

        ActionBar(
            dock = content.dock,
            onContact = onContact,
            onBook = onBook,
            onCall = onCall,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding(),
        )
    }
}

private fun bannerStatus(status: BusinessOpenState?): BizStatusBadge? =
    status?.let {
        if (it.isOpen) BizStatusBadge.open(it.chipLabel) else BizStatusBadge.closed(it.chipLabel)
    }

// MARK: - Sections

@Composable
private fun Sections(content: BusinessProfileContent) {
    if (content.isNewlyClaimed) {
        JustOpenedNote(modifier = Modifier.padding(bottom = Spacing.s1))
    }
    CategoryRow(
        categories = content.categories,
        modifier = Modifier.padding(top = if (content.isNewlyClaimed) Spacing.s2 else Spacing.s0),
    )

    // About
    SectionHeader(title = "About")
    if (!content.about.isNullOrEmpty()) {
        Text(
            text = content.about,
            color = PantopusColors.appTextStrong,
            fontSize = 13.5.sp,
            letterSpacing = (-0.05).sp,
        )
        if (content.aboutChips.isNotEmpty()) {
            Row(
                modifier = Modifier.padding(top = 10.dp).horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                content.aboutChips.forEach { chip ->
                    Row(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.businessBg)
                                .padding(horizontal = 9.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(
                            icon = chip.icon,
                            contentDescription = null,
                            size = 11.dp,
                            strokeWidth = 2.2f,
                            tint = PantopusColors.business,
                        )
                        Text(
                            text = chip.label,
                            color = PantopusColors.business,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    } else {
        EmptyBlock(
            icon = PantopusIcon.FileText,
            title = "No description yet",
            body = "This business hasn't written an About blurb. It'll appear here once they do.",
        )
    }

    // Hours
    SectionHeader(title = "Hours")
    val status = content.status
    if (status != null && content.hours.isNotEmpty()) {
        HoursTable(status = status, rows = content.hours)
    } else {
        EmptyBlock(
            icon = PantopusIcon.Clock,
            title = "Hours not set",
            body = "Opening hours haven't been published yet.",
        )
    }

    // Service area
    SectionHeader(title = "Service area")
    val area = content.serviceArea
    if (area != null) {
        ServiceAreaCard(area = area)
    } else {
        EmptyBlock(
            icon = PantopusIcon.MapPin,
            title = "Service area not set",
            body = "This business hasn't shared where they work yet.",
        )
    }

    // Services
    SectionHeader(title = "Services", seeAll = if (content.services.isEmpty()) null else "See all")
    if (content.services.isEmpty()) {
        EmptyBlock(
            icon = PantopusIcon.Tag,
            title = "No services yet",
            body = "Services and prices show up here once they're listed.",
        )
    } else {
        ServicesList(services = content.services)
    }

    // Recent work
    SectionHeader(title = "Recent work", seeAll = if (content.gallery.isEmpty()) null else "See all")
    if (content.gallery.isEmpty()) {
        EmptyBlock(
            icon = PantopusIcon.Image,
            title = "No photos yet",
            body = "Work photos will appear here after the first few jobs.",
        )
    } else {
        GalleryStrip(tiles = content.gallery.map { galleryTile(it) })
    }

    // Reviews
    val summary = content.reviewSummary
    SectionHeader(title = "Reviews", seeAll = if (summary != null && summary.count > 0) "See all ${summary.count}" else null)
    if (summary != null && summary.count > 0) {
        RatingDistribution(
            average = summary.average,
            count = summary.count,
            distribution = summary.distribution.map { it.toFloat() },
        )
        content.reviews.forEach { review ->
            ReviewCard(card = review, modifier = Modifier.padding(top = Spacing.s2))
        }
    } else {
        EmptyBlock(
            icon = PantopusIcon.MessageSquarePlus,
            title = "No reviews yet",
            body =
                "Be the first to hire ${content.header.displayName}. Your review helps the next " +
                    "neighbor decide.",
            ctaLabel = "Hire to review",
            ctaIcon = PantopusIcon.Pencil,
            onCta = {},
        )
    }

    // Footer
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterHorizontally),
    ) {
        FooterItem(icon = PantopusIcon.Flag, label = "Report")
        FooterItem(icon = PantopusIcon.Share, label = "Share")
    }
}

@Composable
private fun SectionHeader(
    title: String,
    seeAll: String? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.weight(1f))
        if (seeAll != null) {
            Text(
                text = seeAll,
                color = PantopusColors.business,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun FooterItem(
    icon: PantopusIcon,
    label: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier = Modifier.semantics { contentDescription = label },
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = PantopusColors.appTextMuted)
        Text(text = label, color = PantopusColors.appTextMuted, fontSize = 11.sp)
    }
}

@Composable
private fun JustOpenedNote(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.businessBg)
                .border(1.dp, PantopusColors.business.copy(alpha = 0.25f), RoundedCornerShape(Radii.lg))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.business),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.BadgeCheck,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Just opened on Pantopus",
                color = PantopusColors.businessDark,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text =
                    "Address and business identity are verified. Reviews and photos build up after " +
                        "the first few jobs — early neighbors set the tone.",
                color = PantopusColors.appTextStrong,
                fontSize = 11.5.sp,
            )
        }
    }
}

@Composable
private fun ServiceAreaCard(area: BusinessServiceArea) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface),
    ) {
        MapPreview(
            identity = IdentityPillar.Business,
            serviceAreaRadius = if (area.hasCoordinates) 56.dp else null,
            pinGlyph = PantopusIcon.Building2,
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 11.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = area.title,
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.1).sp,
                )
                if (!area.detail.isNullOrEmpty()) {
                    Text(text = area.detail, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
                }
                if (!area.serviceArea.isNullOrEmpty()) {
                    Row(
                        modifier = Modifier.padding(top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Navigation,
                            contentDescription = null,
                            size = 11.dp,
                            tint = PantopusColors.success,
                        )
                        Text(
                            text = area.serviceArea,
                            color = PantopusColors.success,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.businessBg)
                        .padding(horizontal = 11.dp, vertical = 7.dp)
                        .semantics { contentDescription = "Directions" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Navigation,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.business,
                )
                Text(
                    text = "Directions",
                    color = PantopusColors.business,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun ReviewCard(
    card: BusinessReviewCard,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(horizontal = 14.dp, vertical = 13.dp)
                .semantics {
                    contentDescription = "${card.reviewerName}, ${card.rating} star review, ${card.timestamp}"
                },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(modifier = Modifier.size(36.dp), contentAlignment = Alignment.BottomEnd) {
                AvatarWithIdentityRing(
                    name = card.reviewerName,
                    identity = IdentityPillar.Personal,
                    ringProgress = 1f,
                    imageUrl = card.reviewerAvatarUrl,
                    size = 32.dp,
                    modifier = Modifier.align(Alignment.TopStart),
                )
                if (card.verified) {
                    VerifiedBadge(size = 13.dp)
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = card.reviewerName,
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.1).sp,
                )
                Text(text = card.timestamp, color = PantopusColors.appTextSecondary, fontSize = 10.5.sp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                repeat(5) { index ->
                    BizStarGlyph(
                        color = if (index < card.rating) PantopusColors.star else PantopusColors.appBorder,
                        size = 12.dp,
                    )
                }
            }
        }
        if (card.body.isNotEmpty()) {
            Text(text = card.body, color = PantopusColors.appTextStrong, fontSize = 12.5.sp)
        }
    }
}

@Composable
private fun FloatingControls(
    onBack: () -> Unit,
    onShare: () -> Unit,
    onMore: () -> Unit,
    showsSave: Boolean,
    isSaved: Boolean,
    onToggleSavedPlace: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ControlButton(icon = PantopusIcon.ChevronLeft, label = "Back", onClick = onBack)
        Spacer(modifier = Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (showsSave) {
                SaveBookmarkButton(isSaved = isSaved, onToggle = onToggleSavedPlace, size = 34.dp)
            }
            ControlButton(icon = PantopusIcon.Share, label = "Share", onClick = onShare)
            ControlButton(icon = PantopusIcon.MoreHorizontal, label = "More actions", onClick = onMore)
        }
    }
}

@Composable
private fun ControlButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(PantopusColors.appText.copy(alpha = 0.32f))
                .clickable(onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 19.dp, tint = PantopusColors.appTextInverse)
    }
}

private fun galleryTile(item: BusinessGalleryItem): GalleryTile =
    GalleryTile(
        id = item.id,
        imageUrl = item.imageUrl,
        label = item.label,
        tint = galleryTint(item.tint),
        icon = if (item.moreCount == null) PantopusIcon.Image else null,
        moreCount = item.moreCount,
    )

private fun galleryTint(tint: BusinessGalleryTint): Color =
    when (tint) {
        BusinessGalleryTint.Primary -> PantopusColors.business
        BusinessGalleryTint.Success -> PantopusColors.success
        BusinessGalleryTint.Slate -> PantopusColors.slate
        BusinessGalleryTint.Deep -> PantopusColors.businessDark
    }

// MARK: - Loading / NotFound / Error / overflow

@Composable
internal fun LoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().testTag("businessProfile.loading")) {
        ContentDetailTopBar(title = null, onBack = onBack)
        Box(modifier = Modifier.fillMaxWidth().height(116.dp).background(PantopusColors.businessBg))
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 68.dp, height = 68.dp, cornerRadius = 18.dp)
            Shimmer(width = 200.dp, height = 22.dp, cornerRadius = Radii.sm)
            Shimmer(width = 130.dp, height = 14.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 64.dp, cornerRadius = Radii.lg)
            Shimmer(width = 320.dp, height = 120.dp, cornerRadius = Radii.lg)
        }
    }
}

@Composable
internal fun NotFoundLayout(
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("businessProfile.notFound")) {
        ContentDetailTopBar(title = null, onBack = onBack)
        EmptyState(
            icon = PantopusIcon.Building2,
            headline = "Business not found",
            subcopy = "This business may have moved or unpublished their profile.",
            ctaTitle = "Try again",
            onCta = onRetry,
        )
    }
}

@Composable
private fun ErrorLayout(
    onBack: () -> Unit,
    message: String,
    onRetry: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("businessProfile.error")) {
        ContentDetailTopBar(title = null, onBack = onBack)
        EmptyState(
            icon = PantopusIcon.AlertCircle,
            headline = "Couldn't load this business",
            subcopy = message,
            ctaTitle = "Try again",
            onCta = onRetry,
        )
    }
}

@Composable
private fun OverflowSheetContent(
    onSave: () -> Unit,
    onShare: () -> Unit,
    onReport: () -> Unit,
    onCancel: () -> Unit,
    showEdit: Boolean = false,
    showSave: Boolean = true,
    saveLabel: String = "Save business",
    onEdit: () -> Unit = {},
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (showEdit) {
            OverflowRow(label = "Edit business page", onClick = onEdit)
        }
        if (showSave) {
            OverflowRow(label = saveLabel, onClick = onSave)
        }
        OverflowRow(label = "Share business", onClick = onShare)
        OverflowRow(label = "Report", destructive = true, onClick = onReport)
        OverflowRow(label = "Cancel", onClick = onCancel)
    }
}

@Composable
private fun BusinessProfileSaveUndoSnackbar(
    undo: SavedPlaceUndo,
    onUndo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText.copy(alpha = 0.95f))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("savedPlaces.undoSnackbar"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(PantopusIcon.CheckCircle, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextInverse)
        Text(
            text = "Removed \"${undo.dto.label}\"",
            color = PantopusColors.appTextInverse,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(start = Spacing.s3).weight(1f),
        )
        Text(
            text = "Undo",
            color = PantopusColors.primary300,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onUndo)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                    .testTag("savedPlaces.undoSnackbar.undo"),
        )
    }
}

@Composable
private fun BusinessProfileSaveToast(
    toast: SavedPlacesToast,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (toast.isError) PantopusColors.error else PantopusColors.appText.copy(alpha = 0.9f))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("savedPlaces.toast"),
    ) {
        Text(text = toast.text, style = PantopusTextStyle.small, color = PantopusColors.appTextInverse)
    }
}

private fun List<SavedPlaceDto>.isSaved(pending: PendingSavePlace): Boolean =
    any { dto ->
        savedPlaceMatchKey(dto.geocodePlaceId, dto.latitude, dto.longitude) ==
            savedPlaceMatchKey(pending.geocodePlaceId, pending.latitude, pending.longitude)
    }

private fun savedPlaceMatchKey(
    geocodePlaceId: String?,
    latitude: Double,
    longitude: Double,
): String =
    if (!geocodePlaceId.isNullOrBlank()) {
        "gid:$geocodePlaceId"
    } else {
        String.format(Locale.US, "ll:%.5f,%.5f", latitude, longitude)
    }

@Composable
private fun OverflowRow(
    label: String,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.body,
            color = if (destructive) PantopusColors.error else PantopusColors.appText,
        )
    }
}
