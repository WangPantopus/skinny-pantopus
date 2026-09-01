@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.unboxing

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.OcrFact
import app.pantopus.android.ui.components.OcrFactsList
import app.pantopus.android.ui.components.OcrFactsStatus
import app.pantopus.android.ui.components.OcrFactsTone
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.unboxing.components.CaptureFilmstrip
import app.pantopus.android.ui.screens.mailbox.unboxing.components.DrawerSuggestionCard
import app.pantopus.android.ui.screens.mailbox.unboxing.components.FiledSummary
import app.pantopus.android.ui.screens.mailbox.unboxing.components.ScanNextCard
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * A17.14 — Unboxing scan-capture flow. A scan-first surface in the A17
 * archetype: a custom nav (back · "Unboxing" eyebrow · gallery/overflow),
 * a status-chip header row, and a phase-dependent body over a sticky action
 * shelf.
 *
 *  - `Capture` — [CaptureFilmstrip] (CameraScanner viewfinder + filmstrip) ·
 *    AI elf · [DrawerSuggestionCard] · `OcrFactsList` (editable) · Confirm
 *    shelf.
 *  - `Filed` — [FiledSummary] (banner + photo summary) · AI elf ·
 *    `OcrFactsList` (locked) · [ScanNextCard] · View-in-drawer shelf.
 *
 * The `CameraScanner` viewfinder falls back to a static placeholder under
 * Compose inspection / when camera access is off — so Paparazzi snapshots
 * are deterministic. Mirrors `UnboxingView` on iOS.
 */
@Composable
fun UnboxingScreen(
    onBack: () -> Unit,
    onScanNext: () -> Unit = {},
    onOpenDrawer: () -> Unit = {},
    viewModel: UnboxingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isBusy by viewModel.isBusy.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Real image source: the photo picker hands back a content Uri, we read
    // the bytes and the view-model uploads + attaches them to the package.
    val picker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickVisualMedia(),
        ) { uri: Uri? ->
            if (uri == null) return@rememberLauncherForActivityResult
            scope.launch {
                val bytes =
                    withContext(Dispatchers.IO) {
                        context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    }
                if (bytes != null) viewModel.capture(bytes)
            }
        }

    LaunchedEffect(Unit) {
        viewModel.configure(onScanNext = onScanNext, onOpenDrawer = onOpenDrawer)
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        UnboxingScaffold(
            state = state,
            isBusy = isBusy,
            onBack = onBack,
            onRetry = viewModel::retry,
            onCapture = {
                picker.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                )
            },
            onConfirm = viewModel::confirm,
            onSaveManual = viewModel::saveManual,
            onUndo = viewModel::undo,
            onScanNext = viewModel::scanNext,
            onOpenDrawer = viewModel::openDrawer,
            onPostAssemblyGig = viewModel::postAssemblyGig,
        )
        toast?.let { message ->
            LaunchedEffect(message) {
                delay(TOAST_MILLIS)
                viewModel.consumeToast()
            }
            Text(
                text = message,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 160.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("unboxing_toast"),
            )
        }
    }
}

private const val TOAST_MILLIS = 1_800L

private val accent get() = PantopusColors.categoryUnboxing
private val accentDark get() = PantopusColors.categoryUnboxingDark
private val accentBg get() = PantopusColors.categoryUnboxingBg
private val accentBorder get() = PantopusColors.categoryUnboxingBorder

@Composable
private fun UnboxingScaffold(
    state: UnboxingUiState,
    onBack: () -> Unit,
    onCapture: () -> Unit,
    onConfirm: () -> Unit,
    onUndo: () -> Unit,
    onScanNext: () -> Unit,
    onOpenDrawer: () -> Unit,
    isBusy: Boolean = false,
    onRetry: () -> Unit = {},
    onSaveManual: () -> Unit = {},
    onPostAssemblyGig: () -> Unit = {},
    cameraPreviewEnabled: Boolean = true,
) {
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("unboxing")) {
        Column(modifier = Modifier.fillMaxSize()) {
            UnboxNav(onBack = onBack)
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                when (state) {
                    is UnboxingUiState.Loading -> LoadingBody()
                    is UnboxingUiState.Capture ->
                        CaptureBody(
                            content = state.content,
                            isBusy = isBusy,
                            onCapture = onCapture,
                            onPostAssemblyGig = onPostAssemblyGig,
                            cameraPreviewEnabled = cameraPreviewEnabled,
                        )
                    is UnboxingUiState.Filed ->
                        FiledBody(
                            content = state.content,
                            isBusy = isBusy,
                            onUndo = onUndo,
                            onScanNext = onScanNext,
                            onPostAssemblyGig = onPostAssemblyGig,
                        )
                    is UnboxingUiState.Error ->
                        ErrorState(
                            headline = "Couldn't load this package",
                            message = state.message,
                            modifier = Modifier.testTag("unboxing_error"),
                            onRetry = onRetry,
                        )
                    is UnboxingUiState.Unavailable ->
                        EmptyState(
                            icon = PantopusIcon.Package,
                            headline = "Nothing to unbox yet",
                            subcopy =
                                "Open a delivered package from your mailbox and tap Virtual unboxing to start.",
                            modifier = Modifier.testTag("unboxing_unavailable"),
                            ctaTitle = "Back to Mailbox",
                            onCta = onBack,
                        )
                }
                Spacer(Modifier.height(128.dp))
            }
        }
        if (state is UnboxingUiState.Capture || state is UnboxingUiState.Filed) {
            Column(
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(PantopusColors.appSurface),
            ) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
                Box(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3)) {
                    when (state) {
                        is UnboxingUiState.Capture ->
                            CaptureActions(
                                isBusy = isBusy,
                                onConfirm = onConfirm,
                                onAddPhoto = onCapture,
                                onSaveManual = onSaveManual,
                            )
                        else -> FiledActions(onOpenDrawer = onOpenDrawer)
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadingBody() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4), modifier = Modifier.testTag("unboxing_loading")) {
        Shimmer(width = 320.dp, height = 220.dp, cornerRadius = Radii.xl)
        Shimmer(width = 320.dp, height = 132.dp, cornerRadius = Radii.xl)
        Shimmer(width = 320.dp, height = 150.dp, cornerRadius = Radii.xl)
    }
}

// ─── Bodies ───────────────────────────────────────────────────

@Composable
private fun CaptureBody(
    content: UnboxingContent,
    isBusy: Boolean,
    onCapture: () -> Unit,
    onPostAssemblyGig: () -> Unit,
    cameraPreviewEnabled: Boolean,
) {
    HeaderRow(content = content, filed = false)
    CaptureFilmstrip(
        accent = accent,
        shots = content.shots,
        onCapture = onCapture,
        onAddShot = onCapture,
        cameraPreviewEnabled = cameraPreviewEnabled,
    )
    Box(modifier = Modifier.testTag("unboxing_elf")) { AIElfStripView(content = content.classifyElf) }
    DrawerSuggestionCard(
        accent = accent,
        accentDark = accentDark,
        accentBg = accentBg,
        suggestion = content.suggestion,
        alternates = content.alternates,
        onSelectAlternate = {},
        onChooseAnother = {},
    )
    if (content.facts.isNotEmpty()) FactsList(facts = content.facts, locked = false)
    AssemblyGigCard(isBusy = isBusy, onPost = onPostAssemblyGig)
}

@Composable
private fun FiledBody(
    content: UnboxingContent,
    isBusy: Boolean,
    onUndo: () -> Unit,
    onScanNext: () -> Unit,
    onPostAssemblyGig: () -> Unit,
) {
    HeaderRow(content = content, filed = true)
    FiledSummary(
        filedTo = content.filedTo,
        filedSubtitle = content.filedSubtitle,
        shots = content.shots,
        photosSavedLabel = content.photosSavedLabel,
        onUndo = onUndo,
        onViewPhotos = {},
    )
    Box(modifier = Modifier.testTag("unboxing_elf")) { AIElfStripView(content = content.filedElf) }
    if (content.facts.isNotEmpty()) FactsList(facts = content.facts, locked = true)
    AssemblyGigCard(isBusy = isBusy, onPost = onPostAssemblyGig)
    ScanNextCard(accent = accent, accentDark = accentDark, accentBg = accentBg, onTap = onScanNext)
}

@Composable
private fun FactsList(
    facts: List<OcrFact>,
    locked: Boolean,
) {
    Box(modifier = Modifier.testTag("unboxing_facts")) {
        OcrFactsList(
            title = "On this package",
            status =
                if (locked) {
                    OcrFactsStatus(PantopusIcon.Lock, "Saved", OcrFactsTone.Success)
                } else {
                    OcrFactsStatus(PantopusIcon.Package, "From the carrier", OcrFactsTone.Neutral)
                },
            facts = facts,
        )
    }
}

/**
 * "Need help assembling?" — RN's package gig card
 * (`src/app/mailbox/unboxing.tsx:141-158`), posting
 * `POST api/mailbox/v2/p2/package/:mailId/gig` with `gigType = "assembly"`.
 */
@Composable
private fun AssemblyGigCard(
    isBusy: Boolean,
    onPost: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.businessBg)
                .padding(14.dp)
                .testTag("unboxing_assemblyCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Need help assembling?",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextStrong,
        )
        Text(
            text = "Post a task and a Verified Neighbor will help. Package details are pre-filled.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.business)
                    .clickable(enabled = !isBusy, onClick = onPost)
                    .testTag("unboxing_assemblyGig"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UsersRound,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.appTextInverse,
            )
            Spacer(Modifier.size(Spacing.s2))
            Text(
                text = "Create Task Request",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

// ─── Top nav ──────────────────────────────────────────────────

@Composable
private fun UnboxNav(onBack: () -> Unit) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).height(44.dp).padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onBack)
                        .padding(horizontal = Spacing.s1, vertical = 6.dp)
                        .semantics { contentDescription = "Back to Mailbox" }
                        .testTag("unboxing_back"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.primary600,
                )
                Text(text = "Mailbox", fontSize = 15.sp, color = PantopusColors.primary600)
            }
            Spacer(Modifier.weight(1f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                modifier = Modifier.semantics { contentDescription = "Unboxing" }.testTag("unboxing_eyebrow"),
            ) {
                Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(accent))
                Text(
                    text = "UNBOXING",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                NavIcon(icon = PantopusIcon.Image, label = "Photo library")
                NavIcon(icon = PantopusIcon.MoreHorizontal, label = "More actions")
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
    }
}

@Composable
private fun NavIcon(
    icon: PantopusIcon,
    label: String,
) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .clickable {}
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextStrong)
    }
}

// ─── Header row ───────────────────────────────────────────────

@Composable
private fun HeaderRow(
    content: UnboxingContent,
    filed: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        StateChip(filed = filed)
        CategoryChip(label = content.category)
        Spacer(Modifier.weight(1f))
        Text(text = content.timeLabel, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun StateChip(filed: Boolean) {
    val fg = if (filed) PantopusColors.success else accentDark
    val bg = if (filed) PantopusColors.successBg else accentBg
    val border = if (filed) PantopusColors.successLight else accentBorder
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(1.dp, border, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .testTag("unboxing_stateChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = if (filed) PantopusIcon.CheckCircle else PantopusIcon.ScanLine,
            contentDescription = null,
            size = 11.dp,
            tint = fg,
        )
        Text(text = if (filed) "Filed" else "New capture", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = fg)
    }
}

@Composable
private fun CategoryChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(accent))
        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextStrong)
    }
}

// ─── Action shelves ───────────────────────────────────────────

@Composable
private fun CaptureActions(
    isBusy: Boolean,
    onConfirm: () -> Unit,
    onAddPhoto: () -> Unit,
    onSaveManual: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        UnboxPrimaryButton(
            icon = PantopusIcon.CheckCheck,
            label = "Confirm — file to Home",
            background = accent,
            onClick = { if (!isBusy) onConfirm() },
            testTag = "unboxing_confirm",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            UbChip(
                icon = PantopusIcon.Camera,
                label = "Add photo",
                onClick = { if (!isBusy) onAddPhoto() },
                modifier = Modifier.weight(1f).testTag("unboxing_addPhoto"),
            )
            UbChip(
                icon = PantopusIcon.FileText,
                label = "Save manual",
                onClick = { if (!isBusy) onSaveManual() },
                modifier = Modifier.weight(1f).testTag("unboxing_saveManual"),
            )
        }
    }
}

@Composable
private fun FiledActions(onOpenDrawer: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        UnboxPrimaryButton(
            icon = PantopusIcon.FolderLock,
            label = "View in Home drawer",
            background = PantopusColors.primary600,
            onClick = onOpenDrawer,
            testTag = "unboxing_viewInDrawer",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            UbChip(icon = PantopusIcon.Package, label = "Open record", modifier = Modifier.weight(1f))
            UbChip(icon = PantopusIcon.Share, label = "Share", modifier = Modifier.weight(1f))
            UbChip(icon = PantopusIcon.Bell, label = "Reminders", modifier = Modifier.weight(1f))
            UbChip(icon = PantopusIcon.Archive, label = "Archive", modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun UnboxPrimaryButton(
    icon: PantopusIcon,
    label: String,
    background: Color,
    onClick: () -> Unit,
    testTag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .clickable(onClick = onClick)
                .semantics { contentDescription = label }
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 17.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.appTextInverse,
        )
        Spacer(Modifier.size(Spacing.s2))
        Text(text = label, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
    }
}

@Composable
private fun UbChip(
    icon: PantopusIcon,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s1, vertical = 10.dp)
                .semantics { contentDescription = label },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 17.dp, tint = PantopusColors.appTextSecondary)
        Text(text = label, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary, maxLines = 1)
    }
}

// ─── VM-free frames for Paparazzi ─────────────────────────────

/** VM-free capture frame for Paparazzi snapshots (no CameraX binding). */
@Composable
internal fun UnboxingCaptureFrame(content: UnboxingContent) {
    UnboxingScaffold(
        state = UnboxingUiState.Capture(content),
        onBack = {},
        onCapture = {},
        onConfirm = {},
        onUndo = {},
        onScanNext = {},
        onOpenDrawer = {},
        cameraPreviewEnabled = false,
    )
}

/** VM-free filed frame for Paparazzi snapshots. */
@Composable
internal fun UnboxingFiledFrame(content: UnboxingContent) {
    UnboxingScaffold(
        state = UnboxingUiState.Filed(content),
        onBack = {},
        onCapture = {},
        onConfirm = {},
        onUndo = {},
        onScanNext = {},
        onOpenDrawer = {},
        cameraPreviewEnabled = false,
    )
}

/** VM-free "no package" frame for Paparazzi snapshots. */
@Composable
internal fun UnboxingUnavailableFrame() {
    UnboxingScaffold(
        state = UnboxingUiState.Unavailable,
        onBack = {},
        onCapture = {},
        onConfirm = {},
        onUndo = {},
        onScanNext = {},
        onOpenDrawer = {},
        cameraPreviewEnabled = false,
    )
}
