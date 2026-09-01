@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.MailDraft
import app.pantopus.android.ui.components.composeMail
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private const val TOAST_MS = 1800L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingPageManageScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BookingPageManageViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val slugCheck by viewModel.slugCheck.collectAsStateWithLifecycle()
    val saving by viewModel.saving.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current

    var showShare by remember { mutableStateOf(false) }
    var shareStartQr by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(TOAST_MS)
            viewModel.consumeToast()
        }
    }

    val pillar = viewModel.pillar

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            BLTopBar(
                title = "Booking link",
                onBack = onBack,
            )
            when (val s = state) {
                BookingPageManageUiState.Loading ->
                    SchedulingLoadingSkeleton(modifier = Modifier.fillMaxWidth(), rows = 5)
                BookingPageManageUiState.NeedsSetup ->
                    BookingPageZeroState(
                        kind = SchedulingZeroKind.BookingLink,
                        pillar = pillar,
                        onCta = { onNavigate(SchedulingRoutes.SETUP_WIZARD) },
                    )
                is BookingPageManageUiState.Error ->
                    ErrorState(headline = "Couldn't load your booking link", message = s.message, onRetry = viewModel::refresh)
                is BookingPageManageUiState.Loaded ->
                    LoadedBody(
                        form = s.form,
                        slugCheck = slugCheck,
                        saving = saving,
                        canSave = viewModel.canSave(),
                        pillar = pillar,
                        viewModel = viewModel,
                        onNavigate = onNavigate,
                        onCopy = {
                            clipboard.setText(AnnotatedString(BookingLinkUrls.shareable(s.form.slug)))
                            viewModel.flashToast("Link copied")
                        },
                        onShare = {
                            showShare = true
                            shareStartQr = false
                        },
                        onViewQr = {
                            showShare = true
                            shareStartQr = true
                        },
                    )
            }
        }

        toast?.let {
            BLSavedToast(message = it, modifier = Modifier.align(Alignment.TopCenter).padding(top = Spacing.s12))
        }

        loadedForm(state)?.takeIf { showShare }?.let { form ->
            ShareLinkSheet(
                url = BookingLinkUrls.display(form.slug),
                displayName = form.title,
                pillar = pillar,
                isDraft = form.status == PageStatus.Draft,
                sheetState = sheetState,
                startWithQr = shareStartQr,
                onCopy = { clipboard.setText(AnnotatedString(BookingLinkUrls.shareable(form.slug))) },
                onShare = { context.shareText(BookingLinkUrls.shareable(form.slug)) },
                onMessages = { context.shareText(BookingLinkUrls.shareable(form.slug)) },
                onEmail = {
                    context.composeMail(
                        MailDraft(
                            subject = "Book a time with me",
                            body = "Pick a time that works: ${BookingLinkUrls.shareable(form.slug)}",
                        ),
                    )
                },
                onRegenerate = {
                    showShare = false
                    viewModel.regenerateLink()
                },
                onTurnOn = {
                    showShare = false
                    viewModel.toggleStatus()
                },
                onDismiss = { showShare = false },
            )
        }
    }
}

private fun loadedForm(state: BookingPageManageUiState): BookingPageForm? = (state as? BookingPageManageUiState.Loaded)?.form

@Composable
private fun LoadedBody(
    form: BookingPageForm,
    slugCheck: SlugCheckState,
    saving: Boolean,
    canSave: Boolean,
    pillar: SchedulingPillar,
    viewModel: BookingPageManageViewModel,
    onNavigate: (String) -> Unit,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    onViewQr: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            BLHeaderPill(pillar)
            StatusCard(form.status, !saving, pillar, viewModel::toggleStatus)
            SlugCard(form.slug, slugCheck, !saving, pillar, viewModel::setSlug, viewModel::pickSuggestedSlug)
            HeaderCard(form, !saving, pillar, viewModel::setTitle, viewModel::setTagline)
            ServicesCard(form.services, pillar, viewModel::toggleService)
            CopyCard(form, !saving, pillar, viewModel::setIntro, viewModel::setConfirmation)
            VisibilityCard(form.listed, pillar, viewModel::setListed)
            LinksCard(
                form = form,
                pillar = pillar,
                previewRoute = viewModel.previewRoute(),
                eventTypesRoute = viewModel.eventTypesRoute(),
                onNavigate = onNavigate,
            )
            FooterRow(enabled = form.slug.isNotBlank(), onCopy = onCopy, onShare = onShare, onViewQr = onViewQr)
        }
        BLSaveBar(
            saving = saving,
            enabled = canSave,
            label = if (form.status == PageStatus.Draft) "Save draft" else "Save changes",
            onSave = viewModel::save,
        )
    }
}

@Composable
private fun StatusCard(
    status: PageStatus,
    enabled: Boolean,
    pillar: SchedulingPillar,
    onToggle: () -> Unit,
) {
    val copy =
        when (status) {
            PageStatus.Live -> "Anyone with this link can book you."
            PageStatus.Paused -> "Page is paused. People see a short note and cannot book."
            PageStatus.Draft -> "Not published yet. Finish setup, then publish to go live."
        }
    BLCard(pillar = pillar, overline = "Status") {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Column(Modifier.weight(1f)) {
                SchedulingStatusPill(status = status.toPillStatus())
                Text(
                    copy,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.5.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(top = 7.dp),
                )
            }
            BLToggle(on = status == PageStatus.Live, enabled = enabled, onToggle = onToggle, modifier = Modifier.testTag("statusToggle"))
        }
    }
}

@Composable
private fun SlugCard(
    slug: String,
    slugCheck: SlugCheckState,
    enabled: Boolean,
    pillar: SchedulingPillar,
    onSlugChange: (String) -> Unit,
    onPickSuggestion: (String) -> Unit,
) {
    BLCard(pillar = pillar, overline = "Your link") {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (enabled) PantopusColors.appSurface else PantopusColors.appSurfaceRaised)
                    .border(1.5.dp, if (slugCheck.taken) PantopusColors.error else PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = 11.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                BookingLinkUrls.DISPLAY_PREFIX,
                color = PantopusColors.appTextSecondary,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.5.sp,
            )
            androidx.compose.foundation.text.BasicTextField(
                value = slug,
                onValueChange = onSlugChange,
                enabled = enabled,
                singleLine = true,
                textStyle =
                    androidx.compose.ui.text.TextStyle(
                        color = PantopusColors.appText,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                    ),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(PantopusColors.primary600),
                modifier = Modifier.weight(1f).testTag("slugField"),
            )
        }
        when {
            slugCheck.checking ->
                SlugHint(PantopusIcon.Clock, "Checking…", PantopusColors.appTextSecondary)
            slugCheck.taken ->
                Column {
                    SlugHint(PantopusIcon.AlertCircle, "That handle is taken. Try another.", PantopusColors.error)
                    if (slugCheck.suggestions.isNotEmpty()) {
                        Row(modifier = Modifier.padding(top = Spacing.s2), horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                            slugCheck.suggestions.take(3).forEach { s ->
                                Text(
                                    s,
                                    color = PantopusColors.appTextStrong,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 11.5.sp,
                                    modifier =
                                        Modifier
                                            .clip(RoundedCornerShape(Radii.pill))
                                            .background(PantopusColors.appSurface)
                                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                                            .clickable { onPickSuggestion(s) }
                                            .padding(horizontal = 11.dp, vertical = Spacing.s1)
                                            .testTag("slugSuggestion_$s"),
                                )
                            }
                        }
                    }
                }
            slugCheck.available == true ->
                SlugHint(PantopusIcon.CheckCircle, "Available", PantopusColors.success)
            else -> Unit
        }
    }
}

@Composable
private fun SlugHint(
    icon: PantopusIcon,
    text: String,
    color: androidx.compose.ui.graphics.Color,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = color)
        Text(text, color = color, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp)
    }
}

@Composable
private fun HeaderCard(
    form: BookingPageForm,
    enabled: Boolean,
    pillar: SchedulingPillar,
    onName: (String) -> Unit,
    onTagline: (String) -> Unit,
) {
    BLCard(pillar = pillar, overline = "Page header") {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            BLAvatar(initials = form.avatarInitials, pillar = pillar)
            Text(
                "Change photo",
                color = if (enabled) PantopusColors.primary600 else PantopusColors.appTextMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.5.sp,
            )
        }
        BLTextField(label = "Display name", value = form.title, onValueChange = onName, placeholder = "Your name", enabled = enabled)
        BLTextField(label = "Tagline", value = form.tagline, onValueChange = onTagline, placeholder = "One short line", enabled = enabled)
    }
}

@Composable
private fun ServicesCard(
    services: List<ServiceToggleItem>,
    pillar: SchedulingPillar,
    onToggle: (String) -> Unit,
) {
    BLCard(pillar = pillar, overline = "Services people can book") {
        if (services.isNotEmpty() && services.none { it.visible }) {
            WarningNote("Turn on at least one service so people can book")
        }
        services.forEachIndexed { index, svc ->
            BLToggleRow(
                label = svc.name,
                sub = svc.durationLabel,
                icon = serviceIcon(svc.locationMode),
                on = svc.visible,
                onToggle = { onToggle(svc.id) },
                last = index == services.lastIndex,
            )
        }
    }
}

@Composable
private fun CopyCard(
    form: BookingPageForm,
    enabled: Boolean,
    pillar: SchedulingPillar,
    onIntro: (String) -> Unit,
    onConfirmation: (String) -> Unit,
) {
    BLCard(pillar = pillar, overline = "Intro & confirmation") {
        BLTextField(
            label = "Intro message",
            value = form.intro,
            onValueChange = onIntro,
            placeholder = "Pick a time that works.",
            enabled = enabled,
            multiline = true,
        )
        BLTextField(
            label = "Confirmation message",
            value = form.confirmation,
            onValueChange = onConfirmation,
            placeholder = "Thanks for booking.",
            enabled = enabled,
            multiline = true,
        )
    }
}

@Composable
private fun VisibilityCard(
    listed: Boolean,
    pillar: SchedulingPillar,
    onSet: (Boolean) -> Unit,
) {
    BLCard(pillar = pillar, overline = "Visibility") {
        BLSegmented(
            options = listOf("Listed", "Link-only"),
            selectedIndex = if (listed) 0 else 1,
            onSelect = { onSet(it == 0) },
            accent = pillar.accent,
        )
        Text(
            if (listed) "Shown on your Pantopus profile and in search." else "Only people with the link can find your page.",
            color = PantopusColors.appTextSecondary,
            fontSize = 11.sp,
            lineHeight = 15.sp,
        )
    }
}

@Composable
private fun LinksCard(
    form: BookingPageForm,
    pillar: SchedulingPillar,
    previewRoute: String,
    eventTypesRoute: String,
    onNavigate: (String) -> Unit,
) {
    BLCard(pillar = pillar) {
        LinkRowItem(
            icon = PantopusIcon.Eye,
            label = "Preview your page",
            // VM-built route: carries this screen's owner into the preview.
            onClick = { onNavigate(previewRoute) },
        )
        LinkRowItem(
            icon = PantopusIcon.ListChecks,
            label = "Intake questions",
            value = if (form.firstEventTypeId == null) "Add an event type first" else null,
            onClick = {
                val id = form.firstEventTypeId
                if (id != null) onNavigate(SchedulingRoutes.intakeQuestionsEditor(id)) else onNavigate(eventTypesRoute)
            },
        )
        LinkRowItem(
            icon = PantopusIcon.CreditCard,
            label = "Connect Stripe to take paid bookings",
            onClick = { onNavigate(SchedulingRoutes.PAYMENTS_SETUP) },
            last = true,
        )
    }
}

@Composable
private fun FooterRow(
    enabled: Boolean,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    onViewQr: () -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        RowScopeFooterAction(PantopusIcon.Copy, "Copy link", enabled, onCopy, Modifier.weight(1f))
        RowScopeFooterAction(PantopusIcon.Share, "Share", enabled, onShare, Modifier.weight(1f))
        RowScopeFooterAction(PantopusIcon.QrCode, "View QR", enabled, onViewQr, Modifier.weight(1f))
    }
}
