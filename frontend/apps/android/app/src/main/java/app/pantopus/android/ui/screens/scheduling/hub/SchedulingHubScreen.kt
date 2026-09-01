@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.hub

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.shared.identity.IdentityOption
import app.pantopus.android.ui.screens.shared.identity.IdentitySwitcherPillRow
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private const val COPY_TOAST_MS = 1800L

@Composable
fun SchedulingHubScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: SchedulingHubViewModel = hiltViewModel(),
) {
    val pillar by viewModel.pillar.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val copied by viewModel.copied.collectAsStateWithLifecycle()
    val shareRequest by viewModel.shareRequest.collectAsStateWithLifecycle()

    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current

    LaunchedEffect(Unit) { viewModel.start() }

    LaunchedEffect(shareRequest) {
        shareRequest?.let { url ->
            val send =
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, url)
                }
            runCatching { context.startActivity(Intent.createChooser(send, null)) }
            viewModel.shareRequestConsumed()
        }
    }

    LaunchedEffect(copied) {
        if (copied) {
            delay(COPY_TOAST_MS)
            viewModel.copyToastShown()
        }
    }

    val canEdit = (state as? SchedulingHubUiState.Loaded)?.canEdit ?: true
    val showFooter = state is SchedulingHubUiState.Loaded && canEdit

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            HubTopBar(
                canEdit = canEdit,
                onSettings = { onNavigate(viewModel.settingsRoute()) },
            )
            HubPillBand(pillar = pillar, onSelect = viewModel::selectPillar)
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = Spacing.s4),
                ) {
                    when (val s = state) {
                        SchedulingHubUiState.Loading -> {
                            Spacer(Modifier.height(Spacing.s4))
                            HubSkeleton()
                        }
                        is SchedulingHubUiState.Error -> HubErrorState(message = s.message, onRetry = viewModel::load)
                        is SchedulingHubUiState.Empty -> {
                            HubEmptyState(pillar = s.pillar, onSetUp = { onNavigate(viewModel.startSetupRoute()) })
                            Spacer(Modifier.height(Spacing.s8))
                        }
                        is SchedulingHubUiState.Loaded ->
                            HubLoadedBody(
                                state = s,
                                onCopy = {
                                    if (s.shareUrl.isNotEmpty()) {
                                        clipboard.setText(AnnotatedString(s.shareUrl))
                                        viewModel.copyLink()
                                    }
                                },
                                onShare = viewModel::shareLink,
                                onResume = { viewModel.setPaused(false) },
                                onToggle = { accepting -> viewModel.setPaused(!accepting) },
                                onNavigate = onNavigate,
                                onSeeAllBookings = { onNavigate(viewModel.bookingsRoute()) },
                                onRetrySummary = viewModel::retrySummary,
                                onInsights = { onNavigate(viewModel.insightsRoute()) },
                            )
                    }
                }
            }
            if (showFooter) {
                val loaded = state as SchedulingHubUiState.Loaded
                HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
                HubFooterCta(pillar = loaded.pillar, isPaused = loaded.isPaused, onClick = viewModel::footerTapped)
            }
        }
        if (copied) {
            CopyToast(modifier = Modifier.align(Alignment.TopCenter))
        }
    }
}

@Composable
private fun HubTopBar(
    canEdit: Boolean,
    onSettings: () -> Unit,
) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s3),
        ) {
            // Hub is a tab-root destination — design shows an inert 36×36 spacer, no back button.
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .size(36.dp),
            )
            Text(
                "Scheduling",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.align(Alignment.Center),
            )
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterEnd)
                        .size(36.dp)
                        // The overflow glyph was purely decorative; the design's top-bar action
                        // opens Settings (the manage list's Settings row goes to the same place).
                        // Only interactive when the viewer can edit — view-only shows the info glyph.
                        .then(if (canEdit) Modifier.clickable(onClick = onSettings) else Modifier)
                        .testTag(HubTags.TOP_BAR_TRAILING),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (canEdit) PantopusIcon.MoreHorizontal else PantopusIcon.Info,
                    contentDescription = if (canEdit) "Settings" else "View-only access",
                    size = if (canEdit) 22.dp else 20.dp,
                    tint = PantopusColors.appText,
                )
            }
        }
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

@Composable
private fun HubPillBand(
    pillar: SchedulingPillar,
    onSelect: (SchedulingPillar) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(pillar.accentBg, PantopusColors.appSurface)))
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s3 + 2.dp),
    ) {
        IdentitySwitcherPillRow(
            options =
                listOf(
                    IdentityOption("personal", "Personal", PantopusIcon.User, SchedulingPillar.Personal.accent),
                    IdentityOption("home", "Home", PantopusIcon.Home, SchedulingPillar.Home.accent),
                    // Hub identity pill uses the storefront glyph per scheduling-hub-frames.jsx
                    // (PILLAR.business.icon == 'store'); mirrors iOS SetupKit's hub-pill override.
                    IdentityOption("business", "Business", PantopusIcon.Store, SchedulingPillar.Business.accent),
                ),
            activeId =
                when (pillar) {
                    SchedulingPillar.Personal -> "personal"
                    SchedulingPillar.Home -> "home"
                    SchedulingPillar.Business -> "business"
                },
            onSelect = { id ->
                onSelect(
                    when (id) {
                        "home" -> SchedulingPillar.Home
                        "business" -> SchedulingPillar.Business
                        else -> SchedulingPillar.Personal
                    },
                )
            },
            identifierPrefix = HubTags.PILLAR_PREFIX,
        )
    }
}

@Composable
private fun HubLoadedBody(
    state: SchedulingHubUiState.Loaded,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    onResume: () -> Unit,
    onToggle: (Boolean) -> Unit,
    onNavigate: (String) -> Unit,
    onSeeAllBookings: () -> Unit,
    onRetrySummary: () -> Unit,
    onInsights: () -> Unit,
) {
    Spacer(Modifier.height(Spacing.s4))
    if (!state.canEdit) {
        ViewOnlyBanner()
        Spacer(Modifier.height(Spacing.s3))
    }
    // A5 summary card — embedded at the TOP of the loaded hub, above the
    // booking-link card (summary-card-frames.jsx; mirrors iOS
    // SchedulingHubScreen.summaryCard). Data / empty (share CTA) / error
    // (retry) come from the already-fetched summary; the hub skeleton covers
    // the initial loading frame and the card's own shimmer covers a
    // summary-only retry.
    SummaryCard(
        content = summaryContent(state),
        pillar = state.pillar,
        onShare = onShare,
        onRetry = onRetrySummary,
        onInsights = onInsights,
    )
    if (state.isComposed) {
        Spacer(Modifier.height(Spacing.s3))
        val lead = state.displayName.trim().firstOrNull()?.uppercase() ?: "Y"
        HubComposedNote(pillar = state.pillar, initials = listOf(lead, "JD", "AV"))
    }
    Spacer(Modifier.height(Spacing.s3 + 2.dp))
    BookingLinkCard(
        pillar = state.pillar,
        displayName = state.displayName,
        displayRole = state.displayRole,
        handle = state.handle,
        isPaused = state.isPaused,
        readOnly = !state.canEdit,
        onCopy = onCopy,
        onShare = onShare,
    )
    Spacer(Modifier.height(Spacing.s3))
    when {
        !state.canEdit -> HubReadOnlyStatus(pillar = state.pillar)
        state.isPaused -> HubPausedBanner(onResume = onResume)
        else -> HubPauseRow(pillar = state.pillar, isAccepting = true, onToggle = onToggle)
    }
    if (state.agenda.isNotEmpty()) {
        HubSectionHeader(
            title = "Today & upcoming",
            actionLabel = if (state.canEdit) "See all bookings" else null,
            onAction = if (state.canEdit) onSeeAllBookings else null,
        )
        if (state.isPaused) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .padding(horizontal = Spacing.s3, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(icon = PantopusIcon.Info, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
                Text("Existing bookings stay on your calendar while paused.", color = PantopusColors.appTextSecondary, fontSize = 12.sp)
            }
        }
        state.agenda.forEach { section ->
            HubAgendaDateHeader(header = section.header, sub = section.sub)
            section.rows.forEach { row ->
                HubBookingRowCard(row = row)
                Spacer(Modifier.height(Spacing.s2))
            }
        }
    }
    HubSectionHeader(title = "Manage")
    HubManageGroup(rows = state.manageRows, readOnly = !state.canEdit, onNavigate = onNavigate)
    Spacer(Modifier.height(Spacing.s6))
}

/**
 * Loaded-hub summary projection: retry-in-flight → the card's shimmer;
 * fetch failure → error/Retry; zero data → the share-CTA empty variant;
 * otherwise the stat cells (mirrors iOS `summaryContent`).
 */
private fun summaryContent(state: SchedulingHubUiState.Loaded): SummaryCardContent =
    when {
        state.summaryRetrying -> SummaryCardContent.Loading
        state.summary == null -> SummaryCardContent.Error
        state.summary.isEmpty -> SummaryCardContent.Empty
        else -> SummaryCardContent.Data(state.summary)
    }

@Composable
private fun ViewOnlyBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.infoBg)
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Eye, contentDescription = null, size = 16.dp, tint = PantopusColors.info)
        Text(
            "You have view-only access. Ask an owner to make changes.",
            color = PantopusColors.appTextStrong,
            fontSize = 11.5.sp,
        )
    }
}

@Composable
private fun CopyToast(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .padding(top = Spacing.s12)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2 + 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 15.dp, tint = PantopusColors.success)
        Text("Link copied", color = PantopusColors.appTextInverse, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
    }
}
